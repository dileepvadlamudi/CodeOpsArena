import { Router } from 'express';
import { db } from '../db';
import { contestEngine } from '../contestState';
import {
  broadcastState,
  broadcastAnnouncement,
  broadcastLeaderboard,
  broadcastTeamUpdate,
  forceLogoutTeam
} from '../socket';
import {
  ContestStage,
  TypingRound,
  QuizQuestion,
  CodingProblem,
  CrackChallenge,
  Announcement,
  Team
} from '../../src/types/contest';
import { executeCode } from '../codeRunner';

const router = Router();

// Middleware: Admin Auth Guard
const adminAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Admin authentication required.' });
  }
  const token = authHeader.replace('Bearer ', '').trim();
  const store = db.getStore();
  const isAuthorizedAdmin = token === store.adminToken || (Array.isArray(store.adminTokens) && store.adminTokens.includes(token));
  if (!isAuthorizedAdmin) {
    return res.status(403).json({ success: false, message: 'Invalid admin credentials.' });
  }
  next();
};

router.use(adminAuth);

/* =========================================================================
   1. CONTEST STATE & TIMER CONTROLS
   ========================================================================= */

// Get current state
router.get('/contest-state', (req, res) => {
  const store = db.getStore();
  res.json({
    success: true,
    state: store.contestState
  });
});

// Set contest stage
router.post('/set-stage', (req, res) => {
  const { stage } = req.body;
  if (!stage) {
    return res.status(400).json({ success: false, message: 'Stage is required.' });
  }
  contestEngine.setStage(stage as ContestStage, 'Admin');
  const store = db.getStore();
  res.json({ success: true, state: store.contestState });
});

// Timer controls
router.post('/timer/start', (req, res) => {
  contestEngine.startTimer();
  db.logAction('Admin', 'TIMER_START', 'TIMER', 'GLOBAL', '', 'Started');
  const store = db.getStore();
  res.json({ success: true, timer: store.contestState.timer });
});

router.post('/timer/pause', (req, res) => {
  contestEngine.pauseTimer();
  db.logAction('Admin', 'TIMER_PAUSE', 'TIMER', 'GLOBAL', '', 'Paused');
  const store = db.getStore();
  res.json({ success: true, timer: store.contestState.timer });
});

router.post('/timer/resume', (req, res) => {
  contestEngine.resumeTimer();
  db.logAction('Admin', 'TIMER_RESUME', 'TIMER', 'GLOBAL', '', 'Resumed');
  const store = db.getStore();
  res.json({ success: true, timer: store.contestState.timer });
});

router.post('/round/restart', (req, res) => {
  const { round, durationSeconds } = req.body;
  const store = db.getStore();
  const currentStage = String(store.contestState.currentStage || '');

  let duration = Number(durationSeconds) || 600;
  if (!durationSeconds) {
    if (round === 'r1' || currentStage.includes('ROUND_1') || currentStage.includes('R1')) {
      duration = 300;
    } else if (round === 'r2' || currentStage.includes('ROUND_2') || currentStage.includes('R2')) {
      duration = 600;
    } else if (round === 'r3' || currentStage.includes('ROUND_3') || currentStage.includes('R3')) {
      duration = 1800;
    } else if (round === 'r4' || currentStage.includes('ROUND_4') || currentStage.includes('R4')) {
      duration = 1800;
    }
  }

  contestEngine.setTimer(duration, true);
  db.logAction('Admin', 'ROUND_RESTART', 'ROUND', currentStage, '', `Timer reset to ${duration}s and restarted`);
  broadcastState(store.contestState);
  broadcastLeaderboard(db.getLeaderboard());
  res.json({ success: true, contestState: store.contestState });
});

router.post('/timer/add-time', (req, res) => {
  const { seconds } = req.body;
  const sec = Number(seconds) || 30;
  contestEngine.addTime(sec);
  db.logAction('Admin', 'TIMER_ADD_TIME', 'TIMER', 'GLOBAL', '', `+${sec}s`);
  const store = db.getStore();
  res.json({ success: true, timer: store.contestState.timer });
});

router.post('/timer/set', (req, res) => {
  const { seconds, autoStart } = req.body;
  const sec = Number(seconds) || 60;
  contestEngine.setTimer(sec, Boolean(autoStart));
  db.logAction('Admin', 'TIMER_SET', 'TIMER', 'GLOBAL', '', `${sec}s`);
  const store = db.getStore();
  res.json({ success: true, timer: store.contestState.timer });
});

// Emergency Lock
router.post('/emergency-lock', (req, res) => {
  const { locked } = req.body;
  contestEngine.toggleEmergencyLock(locked);
  const store = db.getStore();
  db.logAction('Admin', 'EMERGENCY_LOCK', 'SYSTEM', 'GLOBAL', '', store.contestState.isEmergencyLocked ? 'LOCKED' : 'UNLOCKED');
  res.json({ success: true, isEmergencyLocked: store.contestState.isEmergencyLocked });
});

// End stage / timer
router.post('/timer/end', (req, res) => {
  contestEngine.stopTimer();
  db.logAction('Admin', 'TIMER_STOP', 'TIMER', 'GLOBAL', '', 'Ended');
  const store = db.getStore();
  res.json({ success: true, timer: store.contestState.timer });
});

router.post('/end-stage', (req, res) => {
  contestEngine.stopTimer();
  db.logAction('Admin', 'STAGE_ENDED', 'CONTEST_STATE', 'GLOBAL', '', 'Stage Timer Stopped');
  const store = db.getStore();
  res.json({ success: true, state: store.contestState });
});

// Configure Active Sub-rounds
router.post('/set-subround', (req, res) => {
  const { typingRoundId, quizQuestionId, codingProblemId } = req.body;
  const store = db.getStore();
  if (typingRoundId) store.contestState.currentTypingRoundId = typingRoundId;
  if (quizQuestionId !== undefined) store.contestState.currentQuizQuestionId = quizQuestionId;
  if (codingProblemId) store.contestState.currentCodingProblemId = codingProblemId;

  db.saveData();
  broadcastState(store.contestState);
  res.json({ success: true, state: store.contestState });
});

/* =========================================================================
   2. TEAM ID MANAGEMENT
   ========================================================================= */

router.get('/team-codes', (req, res) => {
  const store = db.getStore();
  res.json({
    success: true,
    codes: Object.values(store.teamCodes)
  });
});

router.post('/team-codes/generate', (req, res) => {
  const count = Math.min(100, Math.max(1, Number(req.body.count) || 1));
  const generated: string[] = [];
  const store = db.getStore();

  for (let i = 0; i < count; i++) {
    const code = db.generateUniqueTeamCode();
    store.teamCodes[code] = {
      code,
      status: 'unused',
      claimed_by_team_id: null,
      created_at: Date.now()
    };
    generated.push(code);
  }

  db.logAction('Admin', 'GENERATE_TEAM_CODES', 'TEAM_CODES', `${count} Codes`, '', generated.join(', '));
  db.saveData();
  res.json({ success: true, generated, total: Object.keys(store.teamCodes).length });
});

router.post('/team-codes/import', (req, res) => {
  const { csvText } = req.body;
  if (!csvText || typeof csvText !== 'string') {
    return res.status(400).json({ success: false, message: 'CSV content is required.' });
  }

  const lines = csvText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  const store = db.getStore();
  let importedCount = 0;

  lines.forEach(line => {
    // extract first column
    const code = line.split(',')[0].trim().toUpperCase();
    if (code.length >= 4 && !store.teamCodes[code]) {
      store.teamCodes[code] = {
        code,
        status: 'unused',
        claimed_by_team_id: null,
        created_at: Date.now()
      };
      importedCount++;
    }
  });

  db.logAction('Admin', 'IMPORT_TEAM_CODES_CSV', 'TEAM_CODES', `${importedCount} Codes`, '', '');
  db.saveData();
  res.json({ success: true, importedCount, total: Object.keys(store.teamCodes).length });
});

router.post('/team-codes/revoke', (req, res) => {
  const { code } = req.body;
  const store = db.getStore();
  if (!store.teamCodes[code]) {
    return res.status(404).json({ success: false, message: 'Team code not found.' });
  }

  const prev = store.teamCodes[code].status;
  store.teamCodes[code].status = 'revoked';
  db.logAction('Admin', 'REVOKE_TEAM_CODE', 'TEAM_CODE', code, prev, 'revoked');
  db.saveData();
  res.json({ success: true, teamCode: store.teamCodes[code] });
});

router.delete('/team-codes/:code', (req, res) => {
  const { code } = req.params;
  const store = db.getStore();
  if (store.teamCodes[code]) {
    delete store.teamCodes[code];
    db.logAction('Admin', 'DELETE_TEAM_CODE', 'TEAM_CODE', code, '', 'Deleted');
    db.saveData();
  }
  res.json({ success: true });
});

/* =========================================================================
   3. TEAM MANAGEMENT
   ========================================================================= */

router.get('/teams', (req, res) => {
  const store = db.getStore();
  res.json({
    success: true,
    teams: Object.values(store.teams)
  });
});

router.post('/teams/:id/lock', (req, res) => {
  const { id } = req.params;
  const store = db.getStore();
  const team = store.teams[id];
  if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });

  team.status = team.status === 'locked' ? 'active' : 'locked';
  db.logAction('Admin', 'TOGGLE_TEAM_LOCK', 'TEAM', id, '', team.status);
  db.saveData();
  broadcastTeamUpdate(team);
  res.json({ success: true, team });
});

router.post('/teams/:id/disqualify', (req, res) => {
  const { id } = req.params;
  const { reason, restore } = req.body;
  const store = db.getStore();
  const team = store.teams[id];
  if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });

  if (restore) {
    team.status = 'active';
    delete team.disqualified_reason;
    db.logAction('Admin', 'RESTORE_TEAM', 'TEAM', id, 'disqualified', 'active');
  } else {
    team.status = 'disqualified';
    team.disqualified_reason = reason || 'Violation of contest guidelines';
    db.logAction('Admin', 'DISQUALIFY_TEAM', 'TEAM', id, 'active', team.disqualified_reason);
    forceLogoutTeam(id, `Your team was disqualified: ${team.disqualified_reason}`);
  }

  db.saveData();
  broadcastTeamUpdate(team);
  broadcastLeaderboard(db.getLeaderboard());
  res.json({ success: true, team });
});

router.post('/teams/:id/rename', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const store = db.getStore();
  const team = store.teams[id];
  if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });

  const prev = team.name;
  team.name = name.trim();
  if (store.teamCodes[team.team_code]) {
    store.teamCodes[team.team_code].claimed_by_team_name = team.name;
  }
  db.logAction('Admin', 'RENAME_TEAM', 'TEAM', id, prev, team.name);
  db.saveData();
  broadcastTeamUpdate(team);
  broadcastLeaderboard(db.getLeaderboard());
  res.json({ success: true, team });
});

router.post('/teams/:id/force-logout', (req, res) => {
  const { id } = req.params;
  const store = db.getStore();
  const team = store.teams[id];
  if (team) {
    team.session_token = null;
    team.is_online = false;
    forceLogoutTeam(id, 'Admin performed a forced session reset.');
    db.logAction('Admin', 'FORCE_LOGOUT_TEAM', 'TEAM', id, '', 'Logged out');
    db.saveData();
    broadcastTeamUpdate(team);
  }
  res.json({ success: true });
});

router.post('/teams/:id/override-score', (req, res) => {
  const { id } = req.params;
  const { round, score, type, reason } = req.body;
  const store = db.getStore();
  const team = store.teams[id];
  if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });

  const rKey = round as 'r1' | 'r2' | 'r3' | 'r4';
  if (['r1', 'r2', 'r3', 'r4'].includes(rKey)) {
    db.overrideTeamScore(
      id,
      rKey,
      type || 'override',
      Number(score),
      reason || 'Admin direct team score override',
      'Admin'
    );
    broadcastLeaderboard(db.getLeaderboard());
  }

  res.json({ success: true, team: store.teams[id] });
});

/* =========================================================================
   4. ROUND 1 — TYPING MANAGER
   ========================================================================= */

router.get('/round1/typing-rounds', (req, res) => {
  res.json({ success: true, rounds: db.getTypingRounds() });
});

router.post('/round1/typing-rounds', (req, res) => {
  const roundData: Partial<TypingRound> = req.body;
  const isEdit = Boolean(req.body.isEdit || (roundData.id && db.getTypingRound(roundData.id)));
  const saved = db.saveTypingRound(roundData, isEdit, 'Admin');
  res.json({ success: true, round: saved });
});

router.put('/round1/typing-rounds/:id', (req, res) => {
  const { id } = req.params;
  const saved = db.saveTypingRound({ ...req.body, id }, true, 'Admin');
  res.json({ success: true, round: saved });
});

router.delete('/round1/typing-rounds/:id', (req, res) => {
  const { id } = req.params;
  const deleted = db.deleteTypingRound(id, 'Admin');
  res.json({ success: deleted });
});

router.post('/round1/typing-rounds/:id/duplicate', (req, res) => {
  const { id } = req.params;
  const duplicated = db.duplicateTypingRound(id, 'Admin');
  if (!duplicated) return res.status(404).json({ success: false, message: 'Source typing round not found.' });
  res.json({ success: true, round: duplicated });
});

router.post('/round1/typing-rounds/reorder', (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ success: false, message: 'orderedIds array required' });
  db.reorderTypingRounds(orderedIds, 'Admin');
  res.json({ success: true, rounds: db.getTypingRounds() });
});

router.post('/round1/set-active', (req, res) => {
  const { typingRoundId } = req.body;
  const store = db.getStore();
  if (store.typingRounds[typingRoundId]) {
    const prev = store.contestState.currentTypingRoundId;
    store.contestState.currentTypingRoundId = typingRoundId;
    db.logAction('Admin', 'SET_ACTIVE_TYPING_ROUND', 'TYPING_ROUND', typingRoundId, prev, typingRoundId);
    db.saveData();
    broadcastState(store.contestState);
  }
  res.json({ success: true, currentTypingRoundId: store.contestState.currentTypingRoundId });
});

router.get('/round1/config', (req, res) => {
  res.json({ success: true, config: db.getRound1Config() });
});

router.post('/round1/config', (req, res) => {
  const updated = db.updateRound1Config(req.body, 'Admin');
  broadcastLeaderboard(db.getLeaderboard());
  res.json({ success: true, config: updated });
});

router.post('/round1/score-override', (req, res) => {
  const { teamId, type, value, note, typingRoundId } = req.body;
  try {
    const override = db.overrideTypingScore(teamId, type, Number(value), note, 'Admin', typingRoundId);
    broadcastLeaderboard(db.getLeaderboard());
    res.json({ success: true, override, stats: db.getTeamTypingStats() });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/round1/team-stats', (req, res) => {
  res.json({
    success: true,
    stats: db.getTeamTypingStats(),
    config: db.getRound1Config(),
    currentTypingRoundId: db.getStore().contestState.currentTypingRoundId
  });
});

router.get('/round1/submissions', (req, res) => {
  const store = db.getStore();
  res.json({ success: true, submissions: store.typingSubmissions });
});

// Stage Control Routes for Round 1
router.post('/round1/start-instructions', (req, res) => {
  contestEngine.startTypingInstructions('Admin');
  res.json({ success: true, contestState: db.getStore().contestState });
});

router.post('/round1/start-practice', (req, res) => {
  const { typingRoundId } = req.body;
  contestEngine.startTypingPractice(typingRoundId, 'Admin');
  res.json({ success: true, contestState: db.getStore().contestState });
});

router.post('/round1/start-test', (req, res) => {
  const { typingRoundId } = req.body;
  contestEngine.startTypingTest(typingRoundId, 'Admin');
  res.json({ success: true, contestState: db.getStore().contestState });
});

router.post('/round1/show-results', (req, res) => {
  contestEngine.showTypingResults('Admin');
  res.json({ success: true, contestState: db.getStore().contestState });
});

router.post('/round1/next-round', (req, res) => {
  const { autoStartPractice } = req.body;
  const nextId = contestEngine.nextTypingRound(Boolean(autoStartPractice), 'Admin');
  res.json({ success: true, nextId, contestState: db.getStore().contestState });
});

router.post('/round1/prev-round', (req, res) => {
  const { autoStartPractice } = req.body;
  const prevId = contestEngine.prevTypingRound(Boolean(autoStartPractice), 'Admin');
  res.json({ success: true, prevId, contestState: db.getStore().contestState });
});

router.post('/round1/end-round', (req, res) => {
  contestEngine.endRound1('Admin');
  res.json({ success: true, contestState: db.getStore().contestState });
});

/* =========================================================================
   5. ROUND 2 — BYTE-SIZED BRAINS QUIZ MANAGER
   ========================================================================= */

router.get('/round2/phases', (req, res) => {
  const store = db.getStore();
  res.json({
    success: true,
    phases: store.round2Config.phases,
    currentQuizPhase: store.contestState.currentQuizPhase || 1
  });
});

router.put('/round2/phases/:phaseNumber', (req, res) => {
  const phaseNum = Number(req.params.phaseNumber);
  const updated = db.updateQuizPhaseConfig(phaseNum, req.body, 'Admin');
  res.json({ success: true, phase: updated });
});

router.post('/round2/start-arena', (req, res) => {
  contestEngine.setStage('ROUND_2_QUIZ', 'Admin');
  res.json({
    success: true,
    contestState: db.getStore().contestState
  });
});

router.post('/round2/start-phase', (req, res) => {
  const { phaseNumber } = req.body;
  const pNum = Number(phaseNumber) || 1;
  const stageName: ContestStage = pNum === 1 ? 'ROUND_2_PHASE_1' : pNum === 2 ? 'ROUND_2_PHASE_2' : 'ROUND_2_PHASE_3';
  contestEngine.setStage(stageName, 'Admin');
  res.json({
    success: true,
    currentQuizPhase: pNum,
    contestState: db.getStore().contestState
  });
});

router.post('/round2/pause-phase', (req, res) => {
  contestEngine.pauseTimer();
  res.json({ success: true, contestState: db.getStore().contestState });
});

router.post('/round2/resume-phase', (req, res) => {
  contestEngine.resumeTimer();
  res.json({ success: true, contestState: db.getStore().contestState });
});

router.post('/round2/add-time', (req, res) => {
  const { seconds } = req.body;
  contestEngine.addTime(Number(seconds) || 30);
  res.json({ success: true, contestState: db.getStore().contestState });
});

router.get('/round2/monitoring', (req, res) => {
  try {
    const phase = Number(req.query.phase) || db.getStore().contestState.currentQuizPhase || 1;
    const monitoringData = db.getAdminQuizMonitoring(phase);
    // Ensure monitoring is always an array of team progress
    const monitoring = Array.isArray(monitoringData?.teams)
      ? monitoringData.teams
      : (Array.isArray(monitoringData) ? monitoringData : []);
    res.json({
      success: true,
      monitoring,
      phaseInfo: monitoringData,
      currentQuizPhase: phase
    });
  } catch (err: any) {
    console.error('[Admin] Error in /round2/monitoring:', err);
    res.json({ success: false, monitoring: [], error: err.message || 'Error fetching monitoring data' });
  }
});

router.post('/round2/end-round', (req, res) => {
  contestEngine.setStage('ROUND_2_RESULTS', 'Admin');
  db.recalculateRound2Scores();
  broadcastLeaderboard(db.getLeaderboard());
  res.json({ success: true, contestState: db.getStore().contestState });
});

router.get('/round2/stages', (req, res) => {
  res.json({ success: true, stages: db.getQuizStages() });
});

router.post('/round2/stages', (req, res) => {
  const stage = db.saveQuizStage(req.body, false, 'Admin');
  res.json({ success: true, stage });
});

router.put('/round2/stages/:id', (req, res) => {
  const { id } = req.params;
  const stage = db.saveQuizStage({ ...req.body, id }, true, 'Admin');
  res.json({ success: true, stage });
});

router.delete('/round2/stages/:id', (req, res) => {
  const { id } = req.params;
  const deleted = db.deleteQuizStage(id, 'Admin');
  res.json({ success: deleted });
});

// Helper to parse Quiz Questions CSV
function parseQuizQuestionsCSV(csvContent: string): Partial<QuizQuestion>[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) return [];

  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const findIndex = (aliases: string[]): number => {
    for (const a of aliases) {
      const norm = a.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = headers.indexOf(norm);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const qIdx = findIndex(['question', 'questiontext', 'title', 'prompt']);
  const optAIdx = findIndex(['optiona', 'option1', 'a', 'choicea', 'choice1']);
  const optBIdx = findIndex(['optionb', 'option2', 'b', 'choiceb', 'choice2']);
  const optCIdx = findIndex(['optionc', 'option3', 'c', 'choicec', 'choice3']);
  const optDIdx = findIndex(['optiond', 'option4', 'd', 'choiced', 'choice4']);
  const optionsIdx = findIndex(['options', 'choices']);
  const ansIdx = findIndex(['correctanswer', 'answer', 'correctoption', 'key', 'correct']);
  const catIdx = findIndex(['category', 'topic', 'subject']);
  const diffIdx = findIndex(['difficulty', 'level']);
  const stageIdx = findIndex(['stage', 'stagenumber', 'phase']);
  const ptsIdx = findIndex(['points', 'score', 'pts', 'weight']);
  const timeIdx = findIndex(['timelimitseconds', 'timelimit', 'time', 'duration']);
  const typeIdx = findIndex(['type', 'questiontype']);
  const codeIdx = findIndex(['codesnippet', 'code', 'snippet']);
  const expIdx = findIndex(['explanation', 'solution', 'reason']);

  const questions: Partial<QuizQuestion>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length === 0 || cols.every(c => c === '')) continue;

    const questionText = qIdx !== -1 ? cols[qIdx] : cols[0];
    if (!questionText || questionText.trim().length === 0) continue;

    let options: string[] = [];
    if (optAIdx !== -1 && optBIdx !== -1) {
      const a = cols[optAIdx] || '';
      const b = cols[optBIdx] || '';
      const c = optCIdx !== -1 ? (cols[optCIdx] || '') : '';
      const d = optDIdx !== -1 ? (cols[optDIdx] || '') : '';
      options = [a, b, c, d].filter(Boolean);
    } else if (optionsIdx !== -1 && cols[optionsIdx]) {
      const rawOpts = cols[optionsIdx];
      if (rawOpts.includes('|')) options = rawOpts.split('|').map(o => o.trim()).filter(Boolean);
      else if (rawOpts.includes(';')) options = rawOpts.split(';').map(o => o.trim()).filter(Boolean);
      else if (rawOpts.includes('::')) options = rawOpts.split('::').map(o => o.trim()).filter(Boolean);
    }

    if (options.length === 0) {
      options = ['Option A', 'Option B', 'Option C', 'Option D'];
    }

    let rawAns = ansIdx !== -1 ? (cols[ansIdx] || '') : '';
    let correctAnswer: string = options[0] || 'Option A';
    const cleanRaw = rawAns.trim().toUpperCase();

    if (cleanRaw === 'A' || cleanRaw === '1') correctAnswer = options[0] || 'Option A';
    else if (cleanRaw === 'B' || cleanRaw === '2') correctAnswer = options[1] || 'Option B';
    else if (cleanRaw === 'C' || cleanRaw === '3') correctAnswer = options[2] || 'Option C';
    else if (cleanRaw === 'D' || cleanRaw === '4') correctAnswer = options[3] || 'Option D';
    else if (rawAns.trim()) {
      const matched = options.find(o => o.trim().toLowerCase() === rawAns.trim().toLowerCase());
      correctAnswer = matched || rawAns.trim();
    }

    let difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'EASY';
    let stageNumber = 1;
    if (stageIdx !== -1 && cols[stageIdx]) {
      const num = parseInt(cols[stageIdx], 10);
      if (num === 2 || num === 3 || num === 1) stageNumber = num;
    }

    if (diffIdx !== -1 && cols[diffIdx]) {
      const d = cols[diffIdx].trim().toUpperCase();
      if (d === 'HARD' || d === 'H') {
        difficulty = 'HARD';
        if (stageIdx === -1) stageNumber = 3;
      } else if (d === 'MEDIUM' || d === 'MED' || d === 'M') {
        difficulty = 'MEDIUM';
        if (stageIdx === -1) stageNumber = 2;
      } else {
        difficulty = 'EASY';
        if (stageIdx === -1) stageNumber = 1;
      }
    } else {
      difficulty = stageNumber === 3 ? 'HARD' : stageNumber === 2 ? 'MEDIUM' : 'EASY';
    }

    const category = (catIdx !== -1 && cols[catIdx]) ? cols[catIdx].trim() : 'General Technology Awareness';
    const points = (ptsIdx !== -1 && cols[ptsIdx]) ? (parseInt(cols[ptsIdx], 10) || (stageNumber === 3 ? 6 : stageNumber === 2 ? 4 : 2)) : (stageNumber === 3 ? 6 : stageNumber === 2 ? 4 : 2);
    const timeLimitSeconds = (timeIdx !== -1 && cols[timeIdx]) ? (parseInt(cols[timeIdx], 10) || (stageNumber === 3 ? 60 : stageNumber === 2 ? 45 : 30)) : (stageNumber === 3 ? 60 : stageNumber === 2 ? 45 : 30);
    const qType = (typeIdx !== -1 && cols[typeIdx]) ? cols[typeIdx].trim().toLowerCase() : 'mcq';
    const codeSnippet = (codeIdx !== -1 && cols[codeIdx]) ? cols[codeIdx].trim() : undefined;
    const explanation = (expIdx !== -1 && cols[expIdx]) ? cols[expIdx].trim() : '';

    questions.push({
      questionText: questionText.trim(),
      options,
      correctAnswer,
      category,
      difficulty,
      stageNumber,
      points,
      timeLimitSeconds,
      type: qType as any,
      codeSnippet,
      explanation
    });
  }

  return questions;
}

router.get('/round2/questions', (req, res) => {
  res.json({ success: true, questions: db.getQuizQuestions() });
});

// Bulk Import Questions from JSON or CSV
router.post('/round2/questions/bulk-import', (req, res) => {
  const { questions, csvText, overwrite } = req.body;
  let questionsToImport: Partial<QuizQuestion>[] = [];

  if (Array.isArray(questions) && questions.length > 0) {
    questionsToImport = questions;
  } else if (typeof csvText === 'string' && csvText.trim().length > 0) {
    questionsToImport = parseQuizQuestionsCSV(csvText);
  }

  if (questionsToImport.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid questions found to import.' });
  }

  const result = db.importQuizQuestions(questionsToImport, undefined, Boolean(overwrite));
  res.json({
    success: true,
    addedCount: result.addedCount,
    updatedCount: result.updatedCount,
    totalCount: Object.keys(db.getStore().quizQuestions).length,
    questions: db.getQuizQuestions()
  });
});

router.post('/round2/questions', (req, res) => {
  const isEdit = Boolean(req.body.isEdit || (req.body.id && db.getQuizQuestion(req.body.id)));
  const question = db.saveQuizQuestion(req.body, isEdit, 'Admin');
  res.json({ success: true, question });
});

router.put('/round2/questions/:id', (req, res) => {
  const { id } = req.params;
  const question = db.saveQuizQuestion({ ...req.body, id }, true, 'Admin');
  res.json({ success: true, question });
});

router.delete('/round2/questions/:id', (req, res) => {
  const { id } = req.params;
  const deleted = db.deleteQuizQuestion(id, 'Admin');
  res.json({
    success: deleted,
    totalCount: Object.keys(db.getStore().quizQuestions).length,
    questions: db.getQuizQuestions()
  });
});

router.post('/round2/questions/bulk-delete', (req, res) => {
  const { ids, stageNumber, clearAll } = req.body;
  if (clearAll) {
    const result = db.clearAllQuizQuestions(stageNumber !== undefined ? Number(stageNumber) : undefined, 'Admin');
    return res.json({
      success: true,
      deletedCount: result.deletedCount,
      totalCount: Object.keys(db.getStore().quizQuestions).length,
      questions: db.getQuizQuestions()
    });
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'No question IDs provided.' });
  }
  const result = db.bulkDeleteQuizQuestions(ids, 'Admin');
  res.json({
    success: true,
    deletedCount: result.deletedCount,
    totalCount: Object.keys(db.getStore().quizQuestions).length,
    questions: db.getQuizQuestions()
  });
});

router.post('/round2/questions/:id/duplicate', (req, res) => {
  const { id } = req.params;
  const duplicated = db.duplicateQuizQuestion(id, 'Admin');
  if (!duplicated) return res.status(404).json({ success: false, message: 'Question not found.' });
  res.json({ success: true, question: duplicated });
});

router.post('/round2/questions/reorder', (req, res) => {
  const { orderedIds } = req.body;
  if (Array.isArray(orderedIds)) {
    db.reorderQuizQuestions(orderedIds, 'Admin');
  }
  res.json({ success: true, questions: db.getQuizQuestions() });
});

router.post('/round2/questions/:id/void', (req, res) => {
  const { id } = req.params;
  try {
    const question = db.voidQuizQuestion(id, 'Admin');
    broadcastLeaderboard(db.getLeaderboard());
    res.json({ success: true, question });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
});

router.post('/round2/questions/:id/award-all', (req, res) => {
  const { id } = req.params;
  try {
    const question = db.awardAllQuizPoints(id, 'Admin');
    broadcastLeaderboard(db.getLeaderboard());
    res.json({ success: true, question });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
});

router.post('/round2/launch-question', (req, res) => {
  const { questionId } = req.body;
  const qId = questionId || db.getStore().contestState.currentQuizQuestionId;
  if (!qId) {
    const questions = db.getQuizQuestions();
    if (questions.length === 0) return res.status(400).json({ success: false, message: 'No questions in Question Bank.' });
    contestEngine.launchQuizQuestion(questions[0].id, 'Admin');
  } else {
    contestEngine.launchQuizQuestion(qId, 'Admin');
  }
  res.json({ success: true, contestState: db.getStore().contestState });
});

router.post('/round2/start-instructions', (req, res) => {
  contestEngine.startQuizInstructions('Admin');
  res.json({ success: true, contestState: db.getStore().contestState });
});

router.post('/round2/close-question', (req, res) => {
  contestEngine.closeQuizQuestion('Admin');
  res.json({ success: true, contestState: db.getStore().contestState });
});

router.post('/round2/next-question', (req, res) => {
  const { autoLaunch } = req.body;
  const nextId = contestEngine.nextQuizQuestion(Boolean(autoLaunch), 'Admin');
  res.json({ success: true, nextId, contestState: db.getStore().contestState });
});

router.post('/round2/prev-question', (req, res) => {
  const { autoLaunch } = req.body;
  const prevId = contestEngine.prevQuizQuestion(Boolean(autoLaunch), 'Admin');
  res.json({ success: true, prevId, contestState: db.getStore().contestState });
});

router.post('/round2/show-results', (req, res) => {
  contestEngine.showQuizResults('Admin');
  res.json({ success: true, contestState: db.getStore().contestState });
});

router.post('/round2/toggle-leaderboard', (req, res) => {
  const isVisible = contestEngine.toggleLeaderboardVisibility('Admin');
  res.json({ success: true, isLeaderboardVisibleToTeams: isVisible });
});

router.get('/round2/submissions', (req, res) => {
  const store = db.getStore();
  res.json({ success: true, submissions: store.quizSubmissions });
});

router.get('/round2/team-stats', (req, res) => {
  res.json({ success: true, teamStats: db.getTeamQuizStats() });
});

router.post('/round2/score-override', (req, res) => {
  const { teamId, type, value, note } = req.body;
  try {
    const override = db.overrideQuizScore(teamId, type, Number(value), note, 'Admin');
    broadcastLeaderboard(db.getLeaderboard());
    res.json({ success: true, override, teamStats: db.getTeamQuizStats() });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/round2/qualify-teams', (req, res) => {
  const { teamIds, topN, minScore } = req.body;
  const store = db.getStore();
  const teams = Object.values(store.teams);

  // If topN is provided, sort by r2 score and qualify top N
  if (topN !== undefined && Number(topN) > 0) {
    teams.sort((a, b) => (b.scores.r2 || 0) - (a.scores.r2 || 0));
    teams.forEach((t, idx) => {
      t.qualification.r2 = idx < Number(topN);
    });
  } else if (minScore !== undefined) {
    teams.forEach(t => {
      t.qualification.r2 = (t.scores.r2 || 0) >= Number(minScore);
    });
  } else if (Array.isArray(teamIds)) {
    teams.forEach(t => {
      t.qualification.r2 = teamIds.includes(t.id);
    });
  }

  db.logAction('Admin', 'MANUAL_QUALIFY_ROUND2', 'QUALIFICATION', 'ROUND_2', '', { teamIds, topN, minScore });
  db.saveData();
  broadcastLeaderboard(db.getLeaderboard());
  res.json({ success: true, teams: Object.values(store.teams) });
});

/* =========================================================================
   6. ROUND 3 — CODE MINIMALIST MANAGER
   ========================================================================= */

// Round-level controls
router.post('/round3/start', (req, res) => {
  const { durationSeconds } = req.body;
  contestEngine.startRound3(Number(durationSeconds) || 1800, 'Admin');
  res.json({ success: true, message: 'Round 3 started successfully.' });
});

router.post('/round3/pause', (req, res) => {
  contestEngine.pauseRound3('Admin');
  res.json({ success: true, message: 'Round 3 paused.' });
});

router.post('/round3/resume', (req, res) => {
  contestEngine.resumeRound3('Admin');
  res.json({ success: true, message: 'Round 3 resumed.' });
});

router.post('/round3/restart', (req, res) => {
  const { durationSeconds } = req.body;
  contestEngine.restartRound3(Number(durationSeconds) || 1800, 'Admin');
  res.json({ success: true, message: 'Round 3 restarted. Submissions and scores reset.' });
});

router.post('/round3/end', (req, res) => {
  contestEngine.endRound3('Admin');
  res.json({ success: true, message: 'Round 3 ended.' });
});

// Problem Bank CRUD
router.get('/round3/problems', (req, res) => {
  const problems = db.getCodingProblems();
  res.json({ success: true, problems });
});

router.post('/round3/problems', (req, res) => {
  try {
    const probData: Partial<CodingProblem> = req.body;
    const problem = db.saveCodingProblem(probData, false, 'Admin');
    res.json({ success: true, problem });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to create problem.' });
  }
});

router.put('/round3/problems/:id', (req, res) => {
  try {
    const { id } = req.params;
    const problem = db.saveCodingProblem({ ...req.body, id }, true, 'Admin');
    res.json({ success: true, problem });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to update problem.' });
  }
});

router.put('/round3/problems/:id/boilerplate', (req, res) => {
  try {
    const { id } = req.params;
    const { boilerplates } = req.body;
    const problem = db.updateProblemBoilerplates(id, boilerplates || {}, 'Admin');
    res.json({ success: true, problem });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to update boilerplate.' });
  }
});

router.delete('/round3/problems/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.deleteCodingProblem(id, 'Admin');
    res.json({ success: true, message: 'Problem deleted.' });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to delete problem.' });
  }
});

router.post('/round3/problems/:id/duplicate', (req, res) => {
  try {
    const { id } = req.params;
    const duplicated = db.duplicateCodingProblem(id, 'Admin');
    res.json({ success: true, problem: duplicated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to duplicate problem.' });
  }
});

router.post('/round3/problems/reorder', (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ success: false, message: 'orderedIds must be an array.' });
  }
  db.reorderCodingProblems(orderedIds, 'Admin');
  res.json({ success: true, problems: db.getCodingProblems() });
});

router.post('/round3/problems/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const isEnabled = db.toggleCodingProblemEnabled(id, 'Admin');
    res.json({ success: true, isEnabled });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to toggle problem.' });
  }
});

// Submissions & Re-judging
router.get('/round3/submissions', (req, res) => {
  res.json({ success: true, submissions: db.getCodeSubmissions() });
});

router.post('/round3/submissions/:id/rejudge', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await db.rejudgeCodeSubmission(id, 'Admin');
    broadcastLeaderboard(db.getLeaderboard());
    res.json({ success: true, submission: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to re-judge submission.' });
  }
});

// Round 3 matrix and stats
router.get('/round3/stats', (req, res) => {
  const problems = db.getCodingProblems();
  const submissions = db.getCodeSubmissions();
  const store = db.getStore();
  const teams = Object.values(store.teams);

  // Build matrix of team progress
  const matrix = teams.map(t => {
    const teamSubs = submissions.filter(s => s.teamId === t.id);
    const problemStatus: Record<string, { solved: boolean; bestChars?: number; attempts: number }> = {};

    problems.forEach(p => {
      const pSubs = teamSubs.filter(s => s.problemId === p.id);
      const passedSubs = pSubs.filter(s => s.isAccepted || s.allPassed);
      const bestChars = passedSubs.length > 0
        ? Math.min(...passedSubs.map(s => s.charCount))
        : undefined;

      problemStatus[p.id] = {
        solved: passedSubs.length > 0,
        bestChars,
        attempts: pSubs.length
      };
    });

    const solvedCount = Object.values(problemStatus).filter(s => s.solved).length;
    const totalChars = Object.values(problemStatus)
      .filter(s => s.solved && s.bestChars !== undefined)
      .reduce((sum, s) => sum + (s.bestChars || 0), 0);

    return {
      teamId: t.id,
      teamName: t.name,
      teamCode: t.team_code,
      status: t.status,
      isOnline: t.is_online,
      scoreR3: t.scores.r3 || 0,
      solvedCount,
      totalChars,
      problemStatus
    };
  });

  res.json({
    success: true,
    totalProblems: problems.length,
    enabledProblems: problems.filter(p => p.isEnabled).length,
    totalSubmissions: submissions.length,
    acceptedSubmissions: submissions.filter(s => s.isAccepted).length,
    matrix
  });
});

/* =========================================================================
   7. ROUND 4 — CRACK & COMPETE MANAGER
   ========================================================================= */

router.get('/round4/challenges', (req, res) => {
  const store = db.getStore();
  res.json({ success: true, challenges: Object.values(store.crackChallenges).sort((a, b) => a.order - b.order) });
});

router.post('/round4/challenges', (req, res) => {
  const chData: CrackChallenge = req.body;
  const store = db.getStore();
  const id = chData.id || `chk-${Date.now()}`;
  store.crackChallenges[id] = { ...chData, id };
  db.logAction('Admin', 'CREATE_CRACK_CHALLENGE', 'ROUND_4', id, '', chData.title);
  db.saveData();
  res.json({ success: true, challenge: store.crackChallenges[id] });
});

router.put('/round4/challenges/:id', (req, res) => {
  const { id } = req.params;
  const store = db.getStore();
  if (!store.crackChallenges[id]) return res.status(404).json({ success: false, message: 'Challenge not found.' });

  store.crackChallenges[id] = { ...store.crackChallenges[id], ...req.body, id };
  db.logAction('Admin', 'UPDATE_CRACK_CHALLENGE', 'ROUND_4', id, '', store.crackChallenges[id].title);
  db.saveData();
  res.json({ success: true, challenge: store.crackChallenges[id] });
});

router.get('/round4/progress', (req, res) => {
  const store = db.getStore();
  res.json({
    success: true,
    progress: store.crackProgress || {},
    progressList: Object.values(store.crackProgress || {})
  });
});

router.post('/round4/manual-unlock', (req, res) => {
  const { challengeId, teamId } = req.body;
  const store = db.getStore();
  const challenge = store.crackChallenges[challengeId];
  if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found.' });

  if (teamId) {
    const prog = store.crackProgress[teamId];
    if (prog && !prog.completedChallengeIds.includes(challengeId)) {
      prog.completedChallengeIds.push(challengeId);
      prog.totalSolved = prog.completedChallengeIds.length;
      prog.unlockedHints.push({ challengeId, hint: challenge.hintAfterSolve });
    }
  } else {
    // Unlock for everyone
    challenge.isManuallyUnlockedForEveryone = true;
    Object.values(store.crackProgress).forEach(prog => {
      if (!prog.completedChallengeIds.includes(challengeId)) {
        prog.completedChallengeIds.push(challengeId);
        prog.totalSolved = prog.completedChallengeIds.length;
        prog.unlockedHints.push({ challengeId, hint: challenge.hintAfterSolve });
      }
    });
  }

  db.logAction('Admin', 'MANUAL_UNLOCK_CHALLENGE', 'ROUND_4', challengeId, '', teamId ? `Team: ${teamId}` : 'All Teams');
  db.saveData();
  res.json({ success: true });
});

router.post('/round4/start', (req, res) => {
  const { durationSeconds } = req.body;
  contestEngine.startRound4(Number(durationSeconds) || 1800, 'Admin');
  res.json({ success: true, message: 'Round 4 started.' });
});

router.post('/round4/pause', (req, res) => {
  contestEngine.pauseRound4('Admin');
  res.json({ success: true, message: 'Round 4 paused.' });
});

router.post('/round4/resume', (req, res) => {
  contestEngine.resumeRound4('Admin');
  res.json({ success: true, message: 'Round 4 resumed.' });
});

router.post('/round4/restart', (req, res) => {
  const { durationSeconds } = req.body;
  contestEngine.restartRound4(Number(durationSeconds) || 1800, 'Admin');
  res.json({ success: true, message: 'Round 4 restarted. All progress and scores reset. All teams start at Question 1.' });
});

router.post('/round4/end', (req, res) => {
  contestEngine.endRound4('Admin');
  res.json({ success: true, message: 'Round 4 ended.' });
});

/* =========================================================================
   8. QUALIFICATION & LEADERBOARD CONTROLS
   ========================================================================= */

router.post('/qualification/apply-rule', (req, res) => {
  const { round, ruleType, value } = req.body; // round: 'r1'|'r2'|'r3'|'r4', ruleType: 'top_n' | 'top_percent' | 'min_score'
  const store = db.getStore();
  const teams = Object.values(store.teams);
  const rKey = round as keyof Team['scores'];

  teams.sort((a, b) => (b.scores[rKey] || 0) - (a.scores[rKey] || 0));

  if (ruleType === 'top_n') {
    const n = Math.max(1, Number(value) || 10);
    teams.forEach((t, idx) => {
      t.qualification[round as keyof Team['qualification']] = idx < n;
    });
  } else if (ruleType === 'top_percent') {
    const pct = Math.max(1, Math.min(100, Number(value) || 50));
    const cutoff = Math.ceil((teams.length * pct) / 100);
    teams.forEach((t, idx) => {
      t.qualification[round as keyof Team['qualification']] = idx < cutoff;
    });
  } else if (ruleType === 'min_score') {
    const minScore = Number(value) || 50;
    teams.forEach(t => {
      t.qualification[round as keyof Team['qualification']] = (t.scores[rKey] || 0) >= minScore;
    });
  }

  db.logAction('Admin', 'APPLY_QUALIFICATION_RULE', 'QUALIFICATION', `Round ${round}`, '', `${ruleType}: ${value}`);
  db.saveData();
  broadcastLeaderboard(db.getLeaderboard());
  res.json({ success: true, teams: Object.values(store.teams) });
});

router.post('/qualification/manual-toggle', (req, res) => {
  const { teamId, round, qualified } = req.body;
  const store = db.getStore();
  const team = store.teams[teamId];
  if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });

  team.qualification[round as keyof Team['qualification']] = Boolean(qualified);
  db.logAction('Admin', 'MANUAL_QUALIFY_TOGGLE', 'QUALIFICATION', teamId, '', `Round ${round}: ${qualified}`);
  db.saveData();
  broadcastLeaderboard(db.getLeaderboard());
  res.json({ success: true, team });
});

router.get('/leaderboard', (req, res) => {
  res.json({ success: true, leaderboard: db.getLeaderboard() });
});

router.post('/leaderboard/toggle-visibility', (req, res) => {
  const { visible } = req.body;
  const store = db.getStore();
  store.contestState.isLeaderboardVisibleToTeams = visible !== undefined ? visible : !store.contestState.isLeaderboardVisibleToTeams;
  db.logAction('Admin', 'TOGGLE_LEADERBOARD_VISIBILITY', 'LEADERBOARD', '', '', store.contestState.isLeaderboardVisibleToTeams ? 'VISIBLE' : 'HIDDEN');
  db.saveData();
  broadcastState(store.contestState);
  broadcastLeaderboard(db.getLeaderboard());
  res.json({ success: true, isLeaderboardVisibleToTeams: store.contestState.isLeaderboardVisibleToTeams });
});

router.post('/leaderboard/toggle-freeze', (req, res) => {
  const { frozen } = req.body;
  const store = db.getStore();
  store.contestState.isLeaderboardFrozen = frozen !== undefined ? frozen : !store.contestState.isLeaderboardFrozen;
  db.logAction('Admin', 'TOGGLE_LEADERBOARD_FREEZE', 'LEADERBOARD', '', '', store.contestState.isLeaderboardFrozen ? 'FROZEN' : 'UNFROZEN');
  db.saveData();
  broadcastState(store.contestState);
  res.json({ success: true, isLeaderboardFrozen: store.contestState.isLeaderboardFrozen });
});

router.post('/scoring/weights', (req, res) => {
  const { r1, r2, r3, r4 } = req.body;
  const store = db.getStore();
  const prev = { ...store.contestState.weights };
  store.contestState.weights = {
    r1: Number(r1) || 15,
    r2: Number(r2) || 25,
    r3: Number(r3) || 30,
    r4: Number(r4) || 30
  };

  // Sync to master scoring config multipliers
  const config = db.getMasterScoringConfig();
  if (r1 !== undefined) config.r1.multiplier = Number(r1) / 10 || 1.0;
  if (r2 !== undefined) config.r2.multiplier = Number(r2) / 10 || 1.0;
  if (r3 !== undefined) config.r3.multiplier = Number(r3) / 10 || 1.0;
  if (r4 !== undefined) config.r4.multiplier = Number(r4) / 10 || 1.0;

  db.recalculateTeamScores();
  db.logAction('Admin', 'UPDATE_SCORING_WEIGHTS', 'SCORING', 'WEIGHTS', prev, store.contestState.weights);
  broadcastState(store.contestState);
  broadcastLeaderboard(db.getLeaderboard());
  res.json({ success: true, weights: store.contestState.weights, config });
});

router.get('/scoring/config', (req, res) => {
  const config = db.getMasterScoringConfig();
  const roundScores = db.getRoundScores();
  res.json({ success: true, config, roundScores });
});

router.post('/scoring/config', (req, res) => {
  const newConfig = req.body;
  const adminUser = 'Admin';
  const updated = db.updateMasterScoringConfig(newConfig, adminUser);
  const store = db.getStore();
  broadcastState(store.contestState);
  broadcastLeaderboard(db.getLeaderboard());
  res.json({ success: true, config: updated, leaderboard: db.getLeaderboard() });
});

router.post('/scoring/recalculate', (req, res) => {
  db.recalculateTeamScores();
  const store = db.getStore();
  const leaderboard = db.getLeaderboard();
  broadcastState(store.contestState);
  broadcastLeaderboard(leaderboard);
  res.json({
    success: true,
    message: 'All round scores and leaderboard recalculated successfully according to current scoring rules.',
    leaderboard,
    roundScores: db.getRoundScores()
  });
});

router.post('/scoring/override', (req, res) => {
  const { teamId, round, type, value, reason } = req.body;
  const adminUser = 'Admin';
  if (!teamId || !round) {
    return res.status(400).json({ success: false, message: 'teamId and round are required.' });
  }
  const override = db.overrideTeamScore(teamId, round, type || 'override', Number(value), reason, adminUser);
  const leaderboard = db.getLeaderboard();
  broadcastLeaderboard(leaderboard);
  res.json({ success: true, override, leaderboard, roundScores: db.getRoundScores() });
});

router.get('/scoring/round-scores', (req, res) => {
  res.json({ success: true, roundScores: db.getRoundScores() });
});

/* =========================================================================
   9. ANNOUNCEMENTS & AUDIT LOGS
   ========================================================================= */

router.get('/announcements', (req, res) => {
  const store = db.getStore();
  res.json({ success: true, announcements: store.announcements });
});

router.post('/announcements', (req, res) => {
  const { title, message, type, target } = req.body;
  const store = db.getStore();
  const ann: Announcement = {
    id: `ann-${Date.now()}`,
    title: title || 'Contest Announcement',
    message,
    type: type || 'info',
    target: target || 'all',
    createdAt: Date.now(),
    isActive: true
  };

  store.announcements.unshift(ann);
  store.contestState.activeAnnouncement = ann;
  db.logAction('Admin', 'BROADCAST_ANNOUNCEMENT', 'ANNOUNCEMENT', ann.id, '', message);
  db.saveData();
  broadcastAnnouncement(ann);
  broadcastState(store.contestState);

  // Auto-dismiss from global state after 15 seconds so messages never linger indefinitely
  setTimeout(() => {
    const s = db.getStore();
    if (s.contestState.activeAnnouncement && s.contestState.activeAnnouncement.id === ann.id) {
      s.contestState.activeAnnouncement = null;
      db.saveData();
      broadcastAnnouncement(null);
      broadcastState(s.contestState);
    }
  }, 15000);

  res.json({ success: true, announcement: ann });
});

router.post('/announcements/dismiss', (req, res) => {
  const store = db.getStore();
  store.contestState.activeAnnouncement = null;
  db.logAction('Admin', 'DISMISS_ANNOUNCEMENT', 'ANNOUNCEMENT', 'GLOBAL', '', 'Active announcement dismissed by administrator');
  db.saveData();
  broadcastAnnouncement(null);
  broadcastState(store.contestState);
  res.json({ success: true });
});

router.get('/audit-logs', (req, res) => {
  const store = db.getStore();
  res.json({ success: true, logs: store.auditLogs });
});

export default router;
