import { db } from './db';
import { ContestStage, ContestState, TimerState } from '../src/types/contest';
import { broadcastState, broadcastTimerTick, broadcastLeaderboard } from './socket';

class ContestStateEngine {
  private timerInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTimerLoop();
  }

  private getStageDetails(stage: ContestStage): { round: string; title: string; defaultStatus: ContestState['eventStatus'] } {
    switch (stage) {
      case 'LOBBY':
        return { round: 'LOBBY', title: 'Waiting Room & Contest Lobby', defaultStatus: 'WAITING' };
      
      case 'R1_INSTRUCTIONS':
      case 'ROUND_1_INSTRUCTIONS':
        return { round: 'ROUND_1', title: 'Round 1: Fastest Fingers First — Briefing & Rules', defaultStatus: 'LIVE' };
      case 'R1_PRACTICE':
      case 'ROUND_1_PRACTICE':
        return { round: 'ROUND_1', title: 'Round 1: Fastest Fingers First — Practice Warmup (1 Min)', defaultStatus: 'LIVE' };
      case 'R1_TEST':
      case 'ROUND_1_TEST':
        return { round: 'ROUND_1', title: 'Round 1: Fastest Fingers First — Main Typing Test', defaultStatus: 'LIVE' };
      case 'R1_RESULTS':
      case 'ROUND_1_RESULTS':
        return { round: 'ROUND_1', title: 'Round 1: Fastest Fingers First — Round Results', defaultStatus: 'LIVE' };

      case 'R2_INSTRUCTIONS':
      case 'ROUND_2_INSTRUCTIONS':
        return { round: 'ROUND_2', title: 'Round 2: Byte-Sized Brains — Briefing & Rules', defaultStatus: 'LIVE' };
      case 'R2_PHASE_1':
      case 'ROUND_2_PHASE_1':
        return { round: 'ROUND_2', title: 'Round 2: Byte-Sized Brains — Phase 1 (Easy)', defaultStatus: 'LIVE' };
      case 'R2_PHASE_2':
      case 'ROUND_2_PHASE_2':
        return { round: 'ROUND_2', title: 'Round 2: Byte-Sized Brains — Phase 2 (Medium)', defaultStatus: 'LIVE' };
      case 'R2_PHASE_3':
      case 'ROUND_2_PHASE_3':
        return { round: 'ROUND_2', title: 'Round 2: Byte-Sized Brains — Phase 3 (Hard)', defaultStatus: 'LIVE' };
      case 'R2_QUIZ':
      case 'ROUND_2_QUIZ':
      case 'ROUND_2_ACTIVE':
        return { round: 'ROUND_2', title: 'Round 2: Byte-Sized Brains — Live Quiz Arena', defaultStatus: 'LIVE' };
      case 'R2_RESULTS':
      case 'ROUND_2_RESULTS':
        return { round: 'ROUND_2', title: 'Round 2: Byte-Sized Brains — Round Results', defaultStatus: 'LIVE' };

      case 'LUNCH_BREAK':
        return { round: 'LUNCH', title: 'Official Intermission & Lunch Break', defaultStatus: 'LIVE' };

      case 'R3_INSTRUCTIONS':
      case 'ROUND_3_INSTRUCTIONS':
        return { round: 'ROUND_3', title: 'Round 3: Code Minimalist — Briefing & Rules', defaultStatus: 'LIVE' };
      case 'R3_CODE':
      case 'ROUND_3_CODE':
      case 'ROUND_3_ACTIVE':
        return { round: 'ROUND_3', title: 'Round 3: Code Minimalist', defaultStatus: 'LIVE' };
      case 'R3_RESULTS':
      case 'ROUND_3_RESULTS':
        return { round: 'ROUND_3', title: 'Round 3: Code Minimalist — Round Results', defaultStatus: 'LIVE' };

      case 'R4_INSTRUCTIONS':
      case 'ROUND_4_INSTRUCTIONS':
        return { round: 'ROUND_4', title: 'Round 4: Crack & Compete — Briefing & Rules', defaultStatus: 'LIVE' };
      case 'R4_CRACK':
      case 'ROUND_4_CRACK':
      case 'ROUND_4_ACTIVE':
        return { round: 'ROUND_4', title: 'Round 4: Crack & Compete — Security Puzzle Chain', defaultStatus: 'LIVE' };
      case 'R4_RESULTS':
      case 'ROUND_4_RESULTS':
        return { round: 'ROUND_4', title: 'Round 4: Crack & Compete — Round Results', defaultStatus: 'LIVE' };

      case 'FINAL_RESULTS':
        return { round: 'FINAL', title: 'CodexClub 2026 — Final Awards & Standings', defaultStatus: 'ENDED' };

      case 'PAUSED':
        return { round: 'PAUSED', title: 'Contest Paused by Administrator', defaultStatus: 'PAUSED' };
      case 'ENDED':
      case 'CONTEST_ENDED':
        return { round: 'FINAL', title: 'Contest Ended', defaultStatus: 'ENDED' };

      default:
        return { round: 'LOBBY', title: 'Event Waiting Room', defaultStatus: 'WAITING' };
    }
  }

  private syncStateFields(store: any) {
    const s = store.contestState;
    s.currentTypingRound = s.currentTypingRoundId || 'tr-1';
    s.activeQuestion = s.currentQuizQuestionId || 'q-1';
    s.timerStartedAt = s.timer ? s.timer.startedAt : null;
    s.timerDuration = s.timer ? s.timer.durationSeconds : 0;
    s.leaderboardVisible = s.isLeaderboardVisibleToTeams !== false;
  }

  public setStage(stage: ContestStage, adminUser: string = 'Admin') {
    const store = db.getStore();
    const prevStage = store.contestState.currentStage;
    const { round, title, defaultStatus } = this.getStageDetails(stage);

    store.contestState.currentStage = stage;
    store.contestState.currentRound = round;
    store.contestState.stageTitle = title;
    store.contestState.eventStatus = defaultStatus;
    
    // Stage-specific timer presets if not already set
    if (stage === 'R1_PRACTICE' || stage === 'ROUND_1_PRACTICE') {
      // Exactly 1 minute (60s) for practice
      this.setTimer(60, true);
    } else if (stage === 'R1_TEST' || stage === 'ROUND_1_TEST') {
      const tr = store.typingRounds[store.contestState.currentTypingRoundId];
      const duration = tr ? tr.testDurationSeconds : 120;
      this.setTimer(duration, true);
    } else if (stage === 'R2_PHASE_1' || stage === 'ROUND_2_PHASE_1') {
      store.contestState.currentQuizPhase = 1;
      db.startQuizPhase(1, adminUser);
      const cfg = db.getQuizPhaseConfig(1);
      this.setTimer(cfg.questionCount * cfg.timePerQuestionSeconds, true);
    } else if (stage === 'R2_PHASE_2' || stage === 'ROUND_2_PHASE_2') {
      store.contestState.currentQuizPhase = 2;
      db.startQuizPhase(2, adminUser);
      const cfg = db.getQuizPhaseConfig(2);
      this.setTimer(cfg.questionCount * cfg.timePerQuestionSeconds, true);
    } else if (stage === 'R2_PHASE_3' || stage === 'ROUND_2_PHASE_3') {
      store.contestState.currentQuizPhase = 3;
      db.startQuizPhase(3, adminUser);
      const cfg = db.getQuizPhaseConfig(3);
      this.setTimer(cfg.questionCount * cfg.timePerQuestionSeconds, true);
    } else if (stage === 'R2_QUIZ' || stage === 'ROUND_2_QUIZ' || stage === 'ROUND_2_ACTIVE') {
      store.contestState.currentQuizPhase = 1;
      const questions = db.getQuizQuestions().filter(q => !q.isVoided);
      const calculatedDuration = questions.reduce((sum, q) => sum + (q.timeLimitSeconds || 30), 0);
      this.setTimer(Math.max(600, calculatedDuration || 900), true);
    } else if (stage === 'R3_CODE' || stage === 'ROUND_3_CODE' || stage === 'ROUND_3_ACTIVE') {
      store.contestState.eventStatus = 'LIVE';
      if (!store.contestState.timer.isRunning || store.contestState.timer.remainingSeconds <= 0) {
        this.setTimer(1800, true);
      }
    } else if (stage === 'R3_RESULTS' || stage === 'ROUND_3_RESULTS') {
      this.stopTimer();
      db.recalculateRound3Scores();
    } else if (stage === 'R4_CRACK' || stage === 'ROUND_4_CRACK' || stage === 'ROUND_4_ACTIVE') {
      this.setTimer(1800, true); // 30 mins default
    } else if (stage === 'PAUSED') {
      this.pauseTimer();
      store.contestState.eventStatus = 'PAUSED';
    } else {
      // Stop timer for instruction / results / lobby screens unless admin explicitly starts
      this.stopTimer();
    }

    this.syncStateFields(store);
    db.logAction(adminUser, 'SET_CONTEST_STAGE', 'CONTEST_STATE', stage, prevStage, stage);
    db.saveData();
    broadcastState(store.contestState);
    broadcastLeaderboard(db.getLeaderboard());
  }

  public setTimer(durationSeconds: number, autoStart: boolean = false) {
    const store = db.getStore();
    store.contestState.timer = {
      isRunning: autoStart,
      isPaused: false,
      durationSeconds,
      remainingSeconds: durationSeconds,
      startedAt: autoStart ? Date.now() : null,
      endsAt: autoStart ? Date.now() + durationSeconds * 1000 : null
    };
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
  }

  public startTimer() {
    const store = db.getStore();
    const timer = store.contestState.timer;
    if (timer.remainingSeconds <= 0 && timer.durationSeconds > 0) {
      timer.remainingSeconds = timer.durationSeconds;
    }
    if (timer.remainingSeconds <= 0) return;

    timer.isRunning = true;
    timer.isPaused = false;
    timer.startedAt = Date.now();
    timer.endsAt = Date.now() + timer.remainingSeconds * 1000;
    store.contestState.eventStatus = 'LIVE';

    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
  }

  public pauseTimer() {
    const store = db.getStore();
    const timer = store.contestState.timer;
    timer.isRunning = false;
    timer.isPaused = true;
    store.contestState.eventStatus = 'PAUSED';

    db.pauseQuizPhase();
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
  }

  public resumeTimer() {
    const store = db.getStore();
    const timer = store.contestState.timer;
    if (timer.remainingSeconds <= 0) return;

    timer.isRunning = true;
    timer.isPaused = false;
    timer.startedAt = Date.now();
    timer.endsAt = Date.now() + timer.remainingSeconds * 1000;
    store.contestState.eventStatus = 'LIVE';

    db.resumeQuizPhase();
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
  }

  public stopTimer() {
    const store = db.getStore();
    store.contestState.timer.isRunning = false;
    store.contestState.timer.isPaused = false;
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
  }

  public addTime(secondsToAdd: number) {
    const store = db.getStore();
    const timer = store.contestState.timer;
    timer.remainingSeconds = Math.max(0, timer.remainingSeconds + secondsToAdd);
    timer.durationSeconds += secondsToAdd;
    if (timer.isRunning && timer.endsAt) {
      timer.endsAt += secondsToAdd * 1000;
    }
    db.addTimeQuizPhase(secondsToAdd);
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
  }

  public toggleEmergencyLock(locked?: boolean) {
    const store = db.getStore();
    const newState = locked !== undefined ? locked : !store.contestState.isEmergencyLocked;
    store.contestState.isEmergencyLocked = newState;
    if (newState) {
      this.pauseTimer();
      store.contestState.eventStatus = 'PAUSED';
    } else {
      store.contestState.eventStatus = 'LIVE';
    }
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
  }

  // ================= ROUND 1 TYPING WORKFLOW CONTROLS =================

  public startTypingInstructions(adminUser = 'Admin') {
    this.setStage('R1_INSTRUCTIONS', adminUser);
  }

  public startTypingPractice(typingRoundId?: string, adminUser = 'Admin') {
    const store = db.getStore();
    if (typingRoundId && store.typingRounds[typingRoundId]) {
      store.contestState.currentTypingRoundId = typingRoundId;
    }
    this.setStage('R1_PRACTICE', adminUser);
  }

  public startTypingTest(typingRoundId?: string, adminUser = 'Admin') {
    const store = db.getStore();
    if (typingRoundId && store.typingRounds[typingRoundId]) {
      store.contestState.currentTypingRoundId = typingRoundId;
    }
    this.setStage('R1_TEST', adminUser);
  }

  public showTypingResults(adminUser = 'Admin') {
    this.setStage('R1_RESULTS', adminUser);
  }

  public nextTypingRound(autoStartPractice = false, adminUser = 'Admin'): string | null {
    const store = db.getStore();
    const rounds = db.getTypingRounds();
    if (rounds.length === 0) return null;

    const currentId = store.contestState.currentTypingRoundId;
    const currentIndex = rounds.findIndex(r => r.id === currentId);
    const nextIndex = currentIndex >= 0 && currentIndex < rounds.length - 1 ? currentIndex + 1 : 0;
    const nextRound = rounds[nextIndex];

    store.contestState.currentTypingRoundId = nextRound.id;
    db.logAction(adminUser, 'SET_ACTIVE_TYPING_ROUND', 'TYPING_ROUND', nextRound.id, currentId, nextRound.id);
    db.saveData();

    if (autoStartPractice) {
      this.setStage('R1_PRACTICE', adminUser);
    } else {
      this.syncStateFields(store);
      broadcastState(store.contestState);
    }

    return nextRound.id;
  }

  public prevTypingRound(autoStartPractice = false, adminUser = 'Admin'): string | null {
    const store = db.getStore();
    const rounds = db.getTypingRounds();
    if (rounds.length === 0) return null;

    const currentId = store.contestState.currentTypingRoundId;
    const currentIndex = rounds.findIndex(r => r.id === currentId);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : rounds.length - 1;
    const prevRound = rounds[prevIndex];

    store.contestState.currentTypingRoundId = prevRound.id;
    db.logAction(adminUser, 'SET_ACTIVE_TYPING_ROUND', 'TYPING_ROUND', prevRound.id, currentId, prevRound.id);
    db.saveData();

    if (autoStartPractice) {
      this.setStage('R1_PRACTICE', adminUser);
    } else {
      this.syncStateFields(store);
      broadcastState(store.contestState);
    }

    return prevRound.id;
  }

  public endRound1(adminUser = 'Admin') {
    this.showTypingResults(adminUser);
  }

  // ================= ROUND 2: BYTE-SIZED BRAINS =================
  public startQuizInstructions(adminUser = 'Admin') {
    this.setStage('R2_INSTRUCTIONS', adminUser);
  }

  public launchQuizQuestion(questionId: string, adminUser = 'Admin') {
    const store = db.getStore();
    const q = store.quizQuestions[questionId];
    if (!q) throw new Error('Question not found');

    store.contestState.currentQuizQuestionId = questionId;
    db.logAction(adminUser, 'LAUNCH_QUIZ_QUESTION', 'QUIZ_QUESTION', questionId, store.contestState.currentQuizQuestionId, questionId);
    this.setStage('R2_QUIZ', adminUser);
  }

  public closeQuizQuestion(adminUser = 'Admin') {
    const store = db.getStore();
    this.stopTimer();
    store.contestState.timer.remainingSeconds = 0;
    store.contestState.timer.isRunning = false;
    db.logAction(adminUser, 'CLOSE_QUIZ_QUESTION', 'QUIZ_QUESTION', store.contestState.currentQuizQuestionId || 'NONE', 'OPEN', 'CLOSED');
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
  }

  public nextQuizQuestion(autoLaunch: boolean = false, adminUser = 'Admin'): string | null {
    const store = db.getStore();
    const questions = db.getQuizQuestions();
    if (questions.length === 0) return null;

    const currentId = store.contestState.currentQuizQuestionId;
    const currentIndex = questions.findIndex(q => q.id === currentId);
    const nextIndex = (currentIndex + 1) % questions.length;
    const nextQ = questions[nextIndex];

    store.contestState.currentQuizQuestionId = nextQ.id;
    db.logAction(adminUser, 'SET_ACTIVE_QUIZ_QUESTION', 'QUIZ_QUESTION', nextQ.id, currentId, nextQ.id);
    db.saveData();

    if (autoLaunch) {
      this.launchQuizQuestion(nextQ.id, adminUser);
    } else {
      this.syncStateFields(store);
      broadcastState(store.contestState);
    }

    return nextQ.id;
  }

  public prevQuizQuestion(autoLaunch: boolean = false, adminUser = 'Admin'): string | null {
    const store = db.getStore();
    const questions = db.getQuizQuestions();
    if (questions.length === 0) return null;

    const currentId = store.contestState.currentQuizQuestionId;
    const currentIndex = questions.findIndex(q => q.id === currentId);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : questions.length - 1;
    const prevQ = questions[prevIndex];

    store.contestState.currentQuizQuestionId = prevQ.id;
    db.logAction(adminUser, 'SET_ACTIVE_QUIZ_QUESTION', 'QUIZ_QUESTION', prevQ.id, currentId, prevQ.id);
    db.saveData();

    if (autoLaunch) {
      this.launchQuizQuestion(prevQ.id, adminUser);
    } else {
      this.syncStateFields(store);
      broadcastState(store.contestState);
    }

    return prevQ.id;
  }

  public showQuizResults(adminUser = 'Admin') {
    this.setStage('R2_RESULTS', adminUser);
  }

  public toggleLeaderboardVisibility(adminUser = 'Admin') {
    const store = db.getStore();
    const prev = store.contestState.isLeaderboardVisibleToTeams;
    store.contestState.isLeaderboardVisibleToTeams = !prev;
    db.logAction(adminUser, 'TOGGLE_LEADERBOARD_VISIBILITY', 'CONTEST_STATE', 'GLOBAL', prev, !prev);
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
    broadcastLeaderboard(db.getLeaderboard());
    return store.contestState.isLeaderboardVisibleToTeams;
  }

  // ================= ROUND 3 CODE MINIMALIST CONTROLS =================

  public startRound3(durationSeconds: number = 1800, adminUser = 'Admin') {
    const store = db.getStore();
    store.contestState.currentStage = 'ROUND_3_CODE';
    store.contestState.eventStatus = 'LIVE';
    this.setTimer(durationSeconds, true);
    db.logAction(adminUser, 'START_ROUND_3', 'CONTEST_STATE', 'ROUND_3_CODE', null, { durationSeconds });
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
    broadcastLeaderboard(db.getLeaderboard());
  }

  public pauseRound3(adminUser = 'Admin') {
    this.pauseTimer();
    const store = db.getStore();
    store.contestState.eventStatus = 'PAUSED';
    db.logAction(adminUser, 'PAUSE_ROUND_3', 'CONTEST_STATE', 'ROUND_3_CODE', 'LIVE', 'PAUSED');
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
  }

  public resumeRound3(adminUser = 'Admin') {
    this.resumeTimer();
    const store = db.getStore();
    store.contestState.eventStatus = 'LIVE';
    db.logAction(adminUser, 'RESUME_ROUND_3', 'CONTEST_STATE', 'ROUND_3_CODE', 'PAUSED', 'LIVE');
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
  }

  public restartRound3(durationSeconds: number = 1800, adminUser = 'Admin') {
    const store = db.getStore();
    db.restartRound3(adminUser);
    store.contestState.currentStage = 'ROUND_3_CODE';
    store.contestState.eventStatus = 'LIVE';
    this.setTimer(durationSeconds, true);
    db.logAction(adminUser, 'RESTART_ROUND_3', 'CONTEST_STATE', 'ROUND_3_CODE', null, { durationSeconds });
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
    broadcastLeaderboard(db.getLeaderboard());
  }

  public endRound3(adminUser = 'Admin') {
    const store = db.getStore();
    this.stopTimer();
    store.contestState.currentStage = 'ROUND_3_RESULTS';
    store.contestState.eventStatus = 'ENDED';
    db.recalculateRound3Scores();
    db.logAction(adminUser, 'END_ROUND_3', 'CONTEST_STATE', 'ROUND_3_RESULTS', null, null);
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
    broadcastLeaderboard(db.getLeaderboard());
  }

  public showRound3Instructions(adminUser = 'Admin') {
    this.setStage('ROUND_3_INSTRUCTIONS', adminUser);
  }

  public showRound3Results(adminUser = 'Admin') {
    this.setStage('ROUND_3_RESULTS', adminUser);
  }

  public startRound4(durationSeconds: number = 1800, adminUser = 'Admin') {
    const store = db.getStore();
    store.contestState.currentStage = 'ROUND_4_CRACK';
    store.contestState.eventStatus = 'LIVE';
    this.setTimer(durationSeconds, true);
    db.logAction(adminUser, 'START_ROUND_4', 'CONTEST_STATE', 'ROUND_4_CRACK', null, { durationSeconds });
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
    broadcastLeaderboard(db.getLeaderboard());
  }

  public pauseRound4(adminUser = 'Admin') {
    this.pauseTimer();
    const store = db.getStore();
    store.contestState.eventStatus = 'PAUSED';
    db.logAction(adminUser, 'PAUSE_ROUND_4', 'CONTEST_STATE', 'ROUND_4_CRACK', 'LIVE', 'PAUSED');
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
  }

  public resumeRound4(adminUser = 'Admin') {
    this.resumeTimer();
    const store = db.getStore();
    store.contestState.eventStatus = 'LIVE';
    db.logAction(adminUser, 'RESUME_ROUND_4', 'CONTEST_STATE', 'ROUND_4_CRACK', 'PAUSED', 'LIVE');
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
  }

  public restartRound4(durationSeconds: number = 1800, adminUser = 'Admin') {
    const store = db.getStore();
    db.restartRound4(adminUser);
    store.contestState.currentStage = 'ROUND_4_CRACK';
    store.contestState.eventStatus = 'LIVE';
    this.setTimer(durationSeconds, true);
    db.logAction(adminUser, 'RESTART_ROUND_4', 'CONTEST_STATE', 'ROUND_4_CRACK', null, { durationSeconds });
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
    broadcastLeaderboard(db.getLeaderboard());
  }

  public endRound4(adminUser = 'Admin') {
    const store = db.getStore();
    this.stopTimer();
    store.contestState.currentStage = 'ROUND_4_RESULTS';
    store.contestState.eventStatus = 'ENDED';
    db.logAction(adminUser, 'END_ROUND_4', 'CONTEST_STATE', 'ROUND_4_RESULTS', null, null);
    this.syncStateFields(store);
    db.saveData();
    broadcastState(store.contestState);
    broadcastLeaderboard(db.getLeaderboard());
  }

  public showRound4Instructions(adminUser = 'Admin') {
    this.setStage('ROUND_4_INSTRUCTIONS', adminUser);
  }

  public showRound4Results(adminUser = 'Admin') {
    this.setStage('ROUND_4_RESULTS', adminUser);
  }

  private startTimerLoop() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      const store = db.getStore();
      const timer = store.contestState.timer;

      if (timer.isRunning && !timer.isPaused && timer.remainingSeconds > 0) {
        timer.remainingSeconds -= 1;

        if (timer.remainingSeconds <= 0) {
          timer.remainingSeconds = 0;
          timer.isRunning = false;
          // Timer ended
          this.syncStateFields(store);
          db.saveData();
          broadcastState(store.contestState);
        } else {
          // Broadcast lightweight tick to keep all clients precisely in sync
          broadcastTimerTick(timer.remainingSeconds, timer.isRunning, timer.isPaused);
        }
      }
    }, 1000);
  }
}

export const contestEngine = new ContestStateEngine();

