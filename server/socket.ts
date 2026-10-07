import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { db } from './db';
import { WSServerMessage, WSClientMessage, ContestState, Announcement } from '../src/types/contest';

interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
  isAdmin?: boolean;
  teamId?: string;
  teamName?: string;
}

let wss: WebSocketServer | null = null;
const clientSockets = new Set<ExtendedWebSocket>();

export function setupWebSocket(server: HttpServer) {
  try {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('error', (err) => {
      console.warn('[CodexClub WS] WebSocket server error:', err);
    });

    wss.on('connection', (ws: ExtendedWebSocket, req) => {
    ws.isAlive = true;
    clientSockets.add(ws);

    // Initial state push
    const store = db.getStore();
    ws.send(JSON.stringify({
      type: 'STATE_SYNC',
      state: store.contestState
    } as WSServerMessage));

    if (store.contestState.activeAnnouncement) {
      ws.send(JSON.stringify({
        type: 'ANNOUNCEMENT',
        announcement: store.contestState.activeAnnouncement
      } as WSServerMessage));
    }

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (messageRaw: string) => {
      try {
        const data: WSClientMessage = JSON.parse(messageRaw.toString());
        handleClientMessage(ws, data);
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    });

    ws.on('close', () => {
      clientSockets.delete(ws);
      if (ws.teamId) {
        // Check if any other socket is connected for this team
        const otherSockets = Array.from(clientSockets).filter(s => s.teamId === ws.teamId);
        if (otherSockets.length === 0) {
          const store = db.getStore();
          if (store.teams[ws.teamId]) {
            store.teams[ws.teamId].is_online = false;
            db.saveData();
            broadcastTeamUpdate(store.teams[ws.teamId]);
          }
        }
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket client error:', err);
    });
  });

  // Heartbeat ping interval
  const pingInterval = setInterval(() => {
    if (!wss) return;
    clientSockets.forEach((ws) => {
      if (ws.isAlive === false) {
        clientSockets.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });
  } catch (err) {
    console.error('[CodexClub WS] Failed to init WebSocket server:', err);
  }
}

function handleClientMessage(ws: ExtendedWebSocket, data: WSClientMessage) {
  const store = db.getStore();

  switch (data.type) {
    case 'AUTH_ADMIN': {
      if (data.token === store.adminToken || (Array.isArray(store.adminTokens) && store.adminTokens.includes(data.token))) {
        ws.isAdmin = true;
        ws.send(JSON.stringify({
          type: 'STATE_SYNC',
          state: store.contestState
        } as WSServerMessage));
      }
      break;
    }

    case 'AUTH_TEAM': {
      // Find team with matching session_token
      const team = Object.values(store.teams).find(t => t.session_token === data.token);
      if (team) {
        // Enforce strict single active device per team:
        // Disconnect and force-logout any other active socket connected for this team
        clientSockets.forEach((s) => {
          if (s !== ws && s.teamId === team.id) {
            try {
              if (s.readyState === WebSocket.OPEN) {
                s.send(JSON.stringify({
                  type: 'FORCE_LOGOUT',
                  reason: 'Another device connected with this Team ID. Only 1 device is allowed at a time.'
                } as WSServerMessage));
              }
              s.teamId = undefined;
              s.close(4001, 'Another device connected');
            } catch (err) {
              console.error('[CodexClub WS] Error closing concurrent socket:', err);
            }
          }
        });

        ws.teamId = team.id;
        ws.teamName = team.name;
        team.is_online = true;
        team.last_active = Date.now();
        db.saveData();

        ws.send(JSON.stringify({
          type: 'STATE_SYNC',
          state: store.contestState
        } as WSServerMessage));

        if (store.contestState.activeAnnouncement) {
          const ann = store.contestState.activeAnnouncement;
          if (ann.target === 'all' || (Array.isArray(ann.target) && ann.target.includes(team.id))) {
            ws.send(JSON.stringify({
              type: 'ANNOUNCEMENT',
              announcement: ann
            } as WSServerMessage));
          }
        }

        broadcastTeamUpdate(team);
      } else {
        ws.send(JSON.stringify({
          type: 'FORCE_LOGOUT',
          reason: 'Invalid or superseded session token. Another device may have logged in.'
        } as WSServerMessage));
      }
      break;
    }

    case 'PING': {
      ws.isAlive = true;
      if (ws.teamId && store.teams[ws.teamId]) {
        store.teams[ws.teamId].last_active = Date.now();
      }
      break;
    }

    default:
      break;
  }
}

export function broadcastState(state: ContestState) {
  const payload = JSON.stringify({
    type: 'STATE_SYNC',
    state
  } as WSServerMessage);

  clientSockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

export function broadcastTimerTick(remainingSeconds: number, isRunning: boolean, isPaused: boolean) {
  const payload = JSON.stringify({
    type: 'TIMER_TICK',
    remainingSeconds,
    isRunning,
    isPaused
  } as WSServerMessage);

  clientSockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

export function broadcastAnnouncement(announcement: Announcement | null) {
  clientSockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      if (!announcement || ws.isAdmin || announcement.target === 'all' || (ws.teamId && Array.isArray(announcement.target) && announcement.target.includes(ws.teamId))) {
        ws.send(JSON.stringify({
          type: 'ANNOUNCEMENT',
          announcement
        } as WSServerMessage));
      }
    }
  });
}

export function broadcastTeamUpdate(team: any) {
  const payload = JSON.stringify({
    type: 'TEAM_STATUS_UPDATE',
    team
  } as WSServerMessage);

  clientSockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN && (ws.isAdmin || ws.teamId === team.id)) {
      ws.send(payload);
    }
  });
}

export function broadcastLeaderboard(leaderboard: any[]) {
  const payload = JSON.stringify({
    type: 'LEADERBOARD_UPDATE',
    leaderboard
  } as WSServerMessage);

  const store = db.getStore();
  clientSockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      // Send to admin always, or to teams if permitted and not frozen/hidden
      if (ws.isAdmin || store.contestState.isLeaderboardVisibleToTeams) {
        ws.send(payload);
      }
    }
  });
}

export function isTeamSocketConnected(teamId: string): boolean {
  for (const ws of clientSockets) {
    if (ws.teamId === teamId && ws.readyState === WebSocket.OPEN) {
      return true;
    }
  }
  return false;
}

export function forceLogoutTeam(teamId: string, reason: string = 'Forced logout by contest administrator.') {
  clientSockets.forEach(ws => {
    if (ws.teamId === teamId) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'FORCE_LOGOUT',
            reason
          } as WSServerMessage));
        }
        ws.teamId = undefined;
        ws.close(4001, 'Force logout');
      } catch (err) {
        console.error('[CodexClub WS] Error force logging out socket:', err);
      }
    }
  });
}
