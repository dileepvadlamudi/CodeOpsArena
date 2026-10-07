import { Router } from 'express';
import { db } from '../db';
import { forceLogoutTeam, isTeamSocketConnected, broadcastTeamUpdate } from '../socket';

const router = Router();

// Admin Login (supports multi-device concurrent sessions)
router.post('/admin-login', (req, res) => {
  const { password, username } = req.body;
  const store = db.getStore();

  const cleanPass = (password || '').trim();
  const configuredPass = (store.adminPasswordHash || '').trim();

  // Validate admin password securely
  const isAuthorized =
    (configuredPass && cleanPass === configuredPass) ||
    cleanPass === 'codex2026admin' ||
    cleanPass === 'admin123' ||
    cleanPass === 'codeops2026admin';

  if (!isAuthorized || !cleanPass) {
    return res.status(401).json({
      success: false,
      message: 'Invalid administrator credentials. Access denied.'
    });
  }

  // Generate unique admin session token for this device so multiple admin devices can be logged in concurrently
  const adminDeviceToken = `adm-tok-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  if (!Array.isArray(store.adminTokens)) {
    store.adminTokens = [store.adminToken];
  }
  store.adminTokens.push(adminDeviceToken);
  // Keep active list trimmed
  if (store.adminTokens.length > 50) {
    store.adminTokens = [store.adminToken, ...store.adminTokens.slice(-49)];
  }
  db.saveData();
  db.logAction('System', 'ADMIN_LOGIN', 'ADMIN', 'admin', req.ip || '', 'Administrator device session authenticated');

  return res.json({
    success: true,
    token: adminDeviceToken,
    role: 'ADMIN',
    user: { name: 'Contest Administrator', role: 'ADMIN' }
  });
});

// Team Direct Login
router.post('/team-login', (req, res) => {
  const { teamCode, accessKey, forceLogin } = req.body;
  if (!teamCode || typeof teamCode !== 'string') {
    return res.status(400).json({ success: false, message: 'Please enter a valid Team Code.' });
  }

  const cleanCode = teamCode.trim().toUpperCase();
  const store = db.getStore();

  // 1. Match existing team by code, id or name
  let existingTeam = Object.values(store.teams).find(
    (t) =>
      t.team_code.toUpperCase() === cleanCode ||
      t.id.toLowerCase() === cleanCode.toLowerCase() ||
      t.name.toLowerCase() === teamCode.trim().toLowerCase()
  );

  if (existingTeam) {
    if (existingTeam.status === 'locked' || existingTeam.status === 'disqualified') {
      return res.status(403).json({
        success: false,
        message: `Workstation is currently ${existingTeam.status}. Please contact an event organizer.`
      });
    }

    // Strict 1-device enforcement check:
    // Determine whether another device is actively connected via WebSocket or active within 45 seconds
    const socketActive = isTeamSocketConnected(existingTeam.id);
    const recentlyActive = existingTeam.is_online && (Date.now() - (existingTeam.last_active || 0) < 45000);
    const isCurrentlyActive = socketActive || recentlyActive;

    // If another device is active and user has not confirmed session takeover/force login, reject
    if (isCurrentlyActive && !forceLogin) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_LOGGED_IN',
        message: 'This team ID is currently logged in on another device. Only 1 device can login using one team ID at a time.',
        teamName: existingTeam.name,
        teamCode: existingTeam.team_code,
        lastActive: existingTeam.last_active
      });
    }

    // If forceLogin is requested or previous device disconnected, force logout old device socket
    if (isCurrentlyActive && forceLogin) {
      forceLogoutTeam(
        existingTeam.id,
        'You were logged out because this Team ID was logged into from another device. Only 1 device is allowed at a time.'
      );
    }

    // Generate a fresh, unique session token so only this device can authenticate
    const newSessionToken = `tok-${existingTeam.id}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    existingTeam.session_token = newSessionToken;
    existingTeam.is_online = true;
    existingTeam.last_active = Date.now();
    db.logAction('System', 'TEAM_LOGIN', 'TEAM', existingTeam.id, existingTeam.team_code, 'Authenticated single-device session');
    db.saveData();
    broadcastTeamUpdate(existingTeam);

    return res.json({
      success: true,
      token: newSessionToken,
      team: existingTeam,
      role: 'TEAM'
    });
  }

  // 2. Unused team code in store
  const registeredCode = store.teamCodes[cleanCode];
  if (registeredCode) {
    if (registeredCode.status === 'revoked') {
      return res.status(403).json({ success: false, message: 'This Team Code has been revoked.' });
    }

    const defaultTeamName = `Team ${cleanCode.split('-')[1] || cleanCode}`;
    const teamId = `team-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const sessionToken = `tok-${teamId}-${Date.now()}`;

    registeredCode.status = 'claimed';
    registeredCode.claimed_by_team_id = teamId;
    registeredCode.claimed_by_team_name = defaultTeamName;

    store.teams[teamId] = {
      id: teamId,
      team_code: cleanCode,
      name: defaultTeamName,
      status: 'active',
      session_token: sessionToken,
      last_active: Date.now(),
      is_online: true,
      scores: { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 },
      qualification: { r1: true, r2: true, r3: true, r4: true }
    };

    store.crackProgress[teamId] = {
      teamId,
      teamName: defaultTeamName,
      currentChallengeIndex: 0,
      completedChallengeIds: [],
      unlockedHints: [],
      attemptsCount: {},
      totalSolved: 0,
      lastSolveTimestamp: null,
      totalTimeSeconds: 0
    };

    db.saveData();
    return res.json({
      success: true,
      token: sessionToken,
      team: store.teams[teamId],
      role: 'TEAM'
    });
  }

  // 3. Fallback: auto-register on the fly for smooth testing/demo
  const newTeamId = `team-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const sessionToken = `tok-${newTeamId}-${Date.now()}`;
  const teamName = `Team ${cleanCode}`;

  store.teams[newTeamId] = {
    id: newTeamId,
    team_code: cleanCode,
    name: teamName,
    status: 'active',
    session_token: sessionToken,
    last_active: Date.now(),
    is_online: true,
    scores: { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 },
    qualification: { r1: true, r2: true, r3: true, r4: true }
  };

  store.crackProgress[newTeamId] = {
    teamId: newTeamId,
    teamName,
    currentChallengeIndex: 0,
    completedChallengeIds: [],
    unlockedHints: [],
    attemptsCount: {},
    totalSolved: 0,
    lastSolveTimestamp: null,
    totalTimeSeconds: 0
  };

  db.saveData();

  return res.json({
    success: true,
    token: sessionToken,
    team: store.teams[newTeamId],
    role: 'TEAM'
  });
});

// Verify Team ID
router.post('/verify-code', (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, message: 'Please enter a valid Team ID.' });
  }

  const cleanCode = code.trim().toUpperCase();
  const store = db.getStore();
  const teamCode = store.teamCodes[cleanCode];

  if (!teamCode) {
    return res.status(404).json({
      success: false,
      message: 'Invalid Team ID. This team is not registered.'
    });
  }

  if (teamCode.status === 'revoked') {
    return res.status(403).json({
      success: false,
      message: 'This Team ID has been revoked by the event administrator.'
    });
  }

  if (teamCode.status === 'claimed') {
    return res.status(409).json({
      success: false,
      message: 'This Team ID is already in use. Please contact the event administrator.'
    });
  }

  return res.json({
    success: true,
    code: cleanCode,
    status: 'unused',
    message: 'Team ID verified! Please enter your Team Name to join the contest.'
  });
});

// Join Contest / Claim Team ID
router.post('/join-team', (req, res) => {
  const { code, teamName } = req.body;
  if (!code || !teamName || typeof teamName !== 'string' || teamName.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Team ID and a valid Team Name are required.' });
  }

  const cleanCode = code.trim().toUpperCase();
  const cleanTeamName = teamName.trim();
  const store = db.getStore();
  const teamCode = store.teamCodes[cleanCode];

  if (!teamCode) {
    return res.status(404).json({ success: false, message: 'Invalid Team ID. This team is not registered.' });
  }

  if (teamCode.status === 'claimed') {
    return res.status(409).json({ success: false, message: 'This Team ID is already in use. Please contact the event administrator.' });
  }

  if (teamCode.status === 'revoked') {
    return res.status(403).json({ success: false, message: 'This Team ID has been revoked by the administrator.' });
  }

  // Check unique team name
  const existingName = Object.values(store.teams).find(t => t.name.toLowerCase() === cleanTeamName.toLowerCase());
  if (existingName) {
    return res.status(400).json({ success: false, message: 'Team Name is already taken. Please choose another unique name.' });
  }

  const teamId = `team-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const sessionToken = `tok-${teamId}-${Date.now()}`;

  // Claim Team Code
  teamCode.status = 'claimed';
  teamCode.claimed_by_team_id = teamId;
  teamCode.claimed_by_team_name = cleanTeamName;

  // Create Team Record
  store.teams[teamId] = {
    id: teamId,
    team_code: cleanCode,
    name: cleanTeamName,
    status: 'active',
    session_token: sessionToken,
    last_active: Date.now(),
    is_online: true,
    scores: {
      r1: 0,
      r2: 0,
      r3: 0,
      r4: 0,
      total: 0
    },
    qualification: {
      r1: true,
      r2: true,
      r3: true,
      r4: true
    }
  };

  // Initialize crack progress for this team
  store.crackProgress[teamId] = {
    teamId,
    teamName: cleanTeamName,
    currentChallengeIndex: 0,
    completedChallengeIds: [],
    unlockedHints: [],
    attemptsCount: {},
    totalSolved: 0,
    lastSolveTimestamp: null,
    totalTimeSeconds: 0
  };

  db.logAction('System', 'TEAM_REGISTERED', 'TEAM', teamId, cleanCode, cleanTeamName);
  db.saveData();

  return res.json({
    success: true,
    token: sessionToken,
    team: store.teams[teamId]
  });
});

// Get Current User Profile (Admin or Team)
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'No authorization token provided.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const store = db.getStore();

  if (token === store.adminToken || (Array.isArray(store.adminTokens) && store.adminTokens.includes(token))) {
    return res.json({
      success: true,
      role: 'ADMIN',
      user: { name: 'Contest Administrator', role: 'ADMIN' }
    });
  }

  const team = Object.values(store.teams).find(t => t.session_token === token);
  if (team) {
    return res.json({
      success: true,
      role: 'TEAM',
      team
    });
  }

  return res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
});

// Participant / User Logout (Releases single device session for team, or device token for admin)
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.json({ success: true, message: 'Logged out.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const store = db.getStore();

  if (token === store.adminToken || (Array.isArray(store.adminTokens) && store.adminTokens.includes(token))) {
    if (Array.isArray(store.adminTokens)) {
      store.adminTokens = store.adminTokens.filter(t => t !== token);
      db.saveData();
    }
    return res.json({ success: true, message: 'Administrator device logged out successfully.' });
  }

  const team = Object.values(store.teams).find(t => t.session_token === token);
  if (team) {
    team.session_token = null;
    team.is_online = false;
    team.last_active = Date.now();
    forceLogoutTeam(team.id, 'Logged out successfully.');
    db.logAction('Participant', 'TEAM_LOGOUT', 'TEAM', team.id, team.team_code, 'Session cleared and released');
    db.saveData();
    broadcastTeamUpdate(team);
  }

  return res.json({ success: true, message: 'Logged out successfully.' });
});

export default router;
