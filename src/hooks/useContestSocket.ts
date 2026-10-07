import { useEffect, useRef, useState, useCallback } from 'react';
import { ContestState, WSServerMessage, Announcement, LeaderboardEntry, Team } from '../types/contest';
import { useAuth } from '../context/AuthContext';

const defaultContestState: ContestState = {
  eventStatus: 'LIVE',
  currentRound: 'LOBBY',
  currentStage: 'LOBBY',
  stageTitle: 'Lobby & Waiting Room',
  isEmergencyLocked: false,
  timer: {
    isRunning: false,
    isPaused: false,
    durationSeconds: 0,
    remainingSeconds: 0,
    startedAt: null,
    endsAt: null
  },
  currentTypingRoundId: 'tr-1',
  currentQuizQuestionId: null,
  currentCodingProblemId: 'prob-1',
  isLeaderboardVisibleToTeams: true,
  isLeaderboardFrozen: false,
  weights: { r1: 15, r2: 25, r3: 30, r4: 30 },
  activeAnnouncement: null
};

interface UseContestSocketOptions {
  token?: string | null;
  role?: 'ADMIN' | 'TEAM' | 'admin' | 'team' | null;
  onForceLogout?: (reason: string) => void;
  onAnnouncement?: (announcement: Announcement | null) => void;
  onTeamUpdate?: (team: Team) => void;
}

export function useContestSocket(options?: UseContestSocketOptions) {
  const auth = useAuth();
  const token = options?.token !== undefined ? options.token : auth.token;
  const role = options?.role !== undefined ? options.role : auth.user?.role;

  const [contestState, setContestState] = useState<ContestState>(defaultContestState);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isFetchingStateRef = useRef<boolean>(false);

  const fetchInitialState = useCallback(async () => {
    if (isFetchingStateRef.current) return;
    isFetchingStateRef.current = true;
    try {
      const res = await fetch('/api/contest/state');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.state) {
          setContestState(data.state);
          if (Array.isArray(data.leaderboard)) {
            setLeaderboard(data.leaderboard);
          }
          if (data.state.activeAnnouncement !== undefined) {
            setActiveAnnouncement(data.state.activeAnnouncement);
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch contest state via HTTP:', err);
    } finally {
      isFetchingStateRef.current = false;
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current) {
      try {
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.close();
      } catch {
        // Ignore close error
      }
      socketRef.current = null;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        if (token) {
          const roleUpper = (role || '').toUpperCase();
          if (roleUpper === 'ADMIN') {
            ws.send(JSON.stringify({ type: 'AUTH_ADMIN', token }));
          } else if (roleUpper === 'TEAM') {
            ws.send(JSON.stringify({ type: 'AUTH_TEAM', token }));
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSServerMessage = JSON.parse(event.data);
          switch (msg.type) {
            case 'STATE_SYNC':
              setContestState(msg.state);
              if (msg.state.activeAnnouncement !== undefined) {
                setActiveAnnouncement(msg.state.activeAnnouncement);
                if (options?.onAnnouncement) options.onAnnouncement(msg.state.activeAnnouncement);
              }
              break;

            case 'TIMER_TICK':
              setContestState((prev) => ({
                ...prev,
                timer: {
                  ...prev.timer,
                  remainingSeconds: msg.remainingSeconds,
                  isRunning: msg.isRunning,
                  isPaused: msg.isPaused
                }
              }));
              break;

            case 'ANNOUNCEMENT':
              setActiveAnnouncement(msg.announcement);
              setContestState((prev) => ({
                ...prev,
                activeAnnouncement: msg.announcement
              }));
              if (options?.onAnnouncement) options.onAnnouncement(msg.announcement);
              break;

            case 'FORCE_LOGOUT':
              if (options?.onForceLogout) options.onForceLogout(msg.reason);
              break;

            case 'TEAM_STATUS_UPDATE':
              if (options?.onTeamUpdate) options.onTeamUpdate(msg.team);
              break;

            case 'LEADERBOARD_UPDATE':
              if (Array.isArray(msg.leaderboard)) {
                setLeaderboard(msg.leaderboard);
              }
              break;

            default:
              break;
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectAttemptsRef.current += 1;
        // Exponential backoff capped at 25 seconds
        const delay = Math.min(25000, 2000 * Math.pow(1.5, Math.min(reconnectAttemptsRef.current, 6)));
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection event:', err);
        try {
          ws.close();
        } catch {
          // Ignore
        }
      };
    } catch (err) {
      console.warn('WebSocket initialization failed, continuing with HTTP polling:', err);
      setIsConnected(false);
      reconnectAttemptsRef.current += 1;
      const delay = Math.min(25000, 3000 * Math.pow(1.5, Math.min(reconnectAttemptsRef.current, 6)));
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    }
  }, [token, role, options]);

  useEffect(() => {
    fetchInitialState();
    connect();

    // Fallback HTTP polling keeps state accurate even if WS is dropped
    const pollInterval = setInterval(() => {
      fetchInitialState();
    }, isConnected ? 6000 : 3000);

    // Heartbeat ping if WebSocket open
    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.onclose = null;
          socketRef.current.onerror = null;
          socketRef.current.close();
        } catch {
          // Ignore
        }
      }
    };
  }, [connect, fetchInitialState, isConnected]);

  const refreshState = useCallback(() => {
    fetchInitialState();
  }, [fetchInitialState]);

  return {
    contestState,
    leaderboard,
    isConnected,
    activeAnnouncement,
    setActiveAnnouncement,
    refreshState
  };
}
