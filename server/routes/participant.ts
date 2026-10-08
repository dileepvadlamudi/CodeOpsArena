import { Router } from 'express';
import { db } from '../db';
import { executeCode, calculateCharCount, reconstructFullCode } from '../codeRunner';
import { broadcastLeaderboard, broadcastTeamUpdate } from '../socket';
import {
  TypingSubmission,
  QuizSubmission,
  CodeSubmission,
  CrackAttempt
} from '../../src/types/contest';

const router = Router();

// Middleware: Team Session Guard
const teamAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  const token = authHeader.replace('Bearer ', '').trim();
  const store = db.getStore();

  // Allow admin preview
  if (token === store.adminToken || (Array.isArray(store.adminTokens) && store.adminTokens.includes(token))) {
    const previewTeamId = req.headers['x-preview-team-id'] as string;
    req.team = (previewTeamId && store.teams[previewTeamId]) ? store.teams[previewTeamId] : Object.values(store.teams)[0];
    req.isAdminPreview = true;
    return next();
  }

  const team = Object.values(store.teams).find(t => t.session_token === token);
  if (!team) {
    return res.status(401).json({ success: false, message: 'Invalid or expired team session.' });
  }

  if (team.status === 'disqualified') {
    return res.status(403).json({ success: false, message: `Team is disqualified: ${team.disqualified_reason || 'Contest policy violation'}` });
  }

  req.team = team;
  req.isAdminPreview = false;
  next();
};

router.use(teamAuth);

const MAIN_ROUND_BY_STAGE: Record<string, 'r1' | 'r2' | 'r3' | 'r4' | null> = {
  R1_TEST: 'r1', ROUND_1_TEST: 'r1',
  R2_PHASE_1: 'r2', ROUND_2_PHASE_1: 'r2',
  R2_PHASE_2: 'r2', ROUND_2_PHASE_2: 'r2',
  R2_PHASE_3: 'r2', ROUND_2_PHASE_3: 'r2',
  R2_QUIZ: 'r2', ROUND_2_QUIZ: 'r2', ROUND_2_ACTIVE: 'r2',
  R3_CODE: 'r3', ROUND_3_CODE: 'r3', ROUND_3_ACTIVE: 'r3',
  R4_CRACK: 'r4', ROUND_4_CRACK: 'r4', ROUND_4_ACTIVE: 'r4',
};

const getMainRound = (stage: string) => MAIN_ROUND_BY_STAGE[stage] || null;

// Record one fullscreen exit. Counts are independent for each main round and capped at 3.
router.post('/fullscreen-violation', (req: any, res) => {
  if (req.isAdminPreview) {
    return res.json({ success: true, ignored: true, message: 'Admin preview does not record fullscreen violations.' });
  }

  const store = db.getStore();
  const round = getMainRound(store.contestState.currentStage);
  if (!round) {
    return res.status(409).json({ success: false, message: 'Fullscreen enforcement is not active outside a main round.' });
  }

  const team = req.team;
  if (!team.fullscreenWarnings) team.fullscreenWarnings = { r1: 0, r2: 0, r3: 0, r4: 0 };

  const previous = team.fullscreenWarnings[round] || 0;
  const current = Math.min(3, previous + 1);
  team.fullscreenWarnings[round] = current;

  // Three exits are the limit for a main round. The third warning immediately
  // disqualifies the team; the first two warnings give the participant 7 seconds
  // to return to fullscreen.
  if (current >= 3) {
    team.status = 'disqualified';
    team.disqualified_reason = `Fullscreen policy violation: 3 fullscreen warnings in ${round.toUpperCase()}.`;
    db.logAction('System', 'FULLSCREEN_DISQUALIFIED', 'TEAM', team.id, String(previous), JSON.stringify({ round, warning: current, maxWarnings: 3 }));
  } else {
    db.logAction('System', 'FULLSCREEN_EXIT', 'TEAM', team.id, String(previous), JSON.stringify({ round, warning: current, maxWarnings: 3 }));
  }
  db.saveData();

  return res.json({
    success: true,
    round,
    warningCount: current,
    maxWarnings: 3,
    isFinalWarning: current >= 3,
    disqualified: current >= 3,
    warnings: team.fullscreenWarnings,
    teamStatus: team.status,
    message: current >= 3
      ? 'Third fullscreen warning reached. Team has been disqualified.'
      : 'Fullscreen exit recorded. Return within 7 seconds.'
  });
});

// If a participant does not return to fullscreen within the client-side 7-second grace
// period, lock/disqualify the team. This endpoint is intentionally valid only in a main round.
router.post('/fullscreen-timeout', (req: any, res) => {
  if (req.isAdminPreview) return res.json({ success: true, ignored: true });

  const store = db.getStore();
  const round = getMainRound(store.contestState.currentStage);
  if (!round) return res.status(409).json({ success: false, message: 'Fullscreen enforcement is not active.' });

  const team = req.team;
  const warnings = team.fullscreenWarnings?.[round] || 0;

  if (warnings > 0 && team.status !== 'disqualified') {
    team.status = 'disqualified';
    team.disqualified_reason = `Fullscreen policy violation: failed to return to fullscreen within 7 seconds after warning ${warnings}/3 in ${round.toUpperCase()}.`;
    db.logAction('System', 'FULLSCREEN_TIMEOUT_DISQUALIFICATION', 'TEAM', team.id, String(warnings), JSON.stringify({ round, gracePeriodSeconds: 7 }));
    db.saveData();
  }

  return res.json({
    success: true,
    disqualified: team.status === 'disqualified',
    warnings: team.fullscreenWarnings,
    teamStatus: team.status
  });
});

// Get current team profile
router.get('/profile', (req: any, res) => {
  res.json({
    success: true,
    team: req.team
  });
});

// Get current state & filtered stage content for participant view
router.get('/view-data', (req: any, res) => {
  const store = db.getStore();
  const team = req.team;
  const stage = store.contestState.currentStage;

  let stageData: any = null;

  if (stage === 'ROUND_1_PRACTICE' || stage === 'ROUND_1_TEST' || stage === 'R1_PRACTICE' || stage === 'R1_TEST') {
    const roundsList = db.getTypingRounds().sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Map all uploaded sets with this team's submission status
    const allSets = roundsList.map((r, idx) => {
      const teamSubs = team ? store.typingSubmissions.filter(s => s.teamId === team.id && s.typingRoundId === r.id) : [];
      const pSub = teamSubs.find(s => s.isPractice);
      const tSub = teamSubs.find(s => !s.isPractice);
      return {
        id: r.id,
        order: r.order || idx + 1,
        setNumber: idx + 1,
        title: r.title,
        practicePassage: r.practicePassage,
        mainPassage: r.mainPassage,
        testDurationSeconds: r.testDurationSeconds || 60,
        practiceDurationSeconds: 60,
        minAccuracyPercent: r.minAccuracyPercent || 80,
        scoringMultiplier: r.scoringMultiplier || 1.0,
        hasCompletedPractice: Boolean(pSub),
        hasCompletedTest: Boolean(tSub),
        myPracticeResult: pSub || null,
        myTestResult: tSub || null
      };
    });

    // Select the target set: query param -> first uncompleted test set -> last set
    const requestedId = req.query.roundId as string;
    let targetIndex = -1;
    if (requestedId) {
      targetIndex = allSets.findIndex(s => s.id === requestedId);
    }
    if (targetIndex === -1) {
      targetIndex = allSets.findIndex(s => !s.hasCompletedTest);
    }
    if (targetIndex === -1 && allSets.length > 0) {
      targetIndex = allSets.length - 1;
    }
    if (targetIndex === -1) targetIndex = 0;

    const currentSet = allSets[targetIndex] || null;
    const isPracticeRequested = req.query.isPractice !== undefined 
      ? req.query.isPractice === 'true' 
      : (stage === 'ROUND_1_PRACTICE' || stage === 'R1_PRACTICE');

    const completedSetsCount = allSets.filter(s => s.hasCompletedTest).length;
    const allSetsCompleted = allSets.length > 0 && completedSetsCount >= allSets.length;

    if (currentSet) {
      stageData = {
        typingRound: {
          id: currentSet.id,
          title: currentSet.title,
          subRoundNumber: targetIndex + 1,
          totalSubRounds: allSets.length,
          isPractice: isPracticeRequested,
          passage: isPracticeRequested ? currentSet.practicePassage : currentSet.mainPassage,
          practicePassage: currentSet.practicePassage,
          mainPassage: currentSet.mainPassage,
          durationSeconds: isPracticeRequested ? currentSet.practiceDurationSeconds : currentSet.testDurationSeconds,
          minAccuracyPercent: currentSet.minAccuracyPercent,
          scoringMultiplier: currentSet.scoringMultiplier,
          hasCompletedPractice: currentSet.hasCompletedPractice,
          hasCompletedTest: currentSet.hasCompletedTest,
          myPracticeResult: currentSet.myPracticeResult,
          myTestResult: currentSet.myTestResult
        },
        allSets,
        currentSetIndex: targetIndex,
        completedSetsCount,
        totalSetsCount: allSets.length,
        allSetsCompleted
      };
    }
  } else if (stage === 'ROUND_1_INSTRUCTIONS' || stage === 'R1_INSTRUCTIONS') {
    const roundsList = db.getTypingRounds();
    stageData = {
      round1Summary: {
        totalSubRounds: roundsList.length,
        rounds: roundsList.map(r => ({ id: r.id, title: r.title, testDurationSeconds: r.testDurationSeconds, minAccuracyPercent: r.minAccuracyPercent })),
        scoringMethod: store.round1Config?.scoringMethod || 'best'
      }
    };
  } else if (stage === 'ROUND_1_RESULTS' || stage === 'R1_RESULTS') {
    const roundsList = db.getTypingRounds();
    const teamStats = db.getTeamTypingStats();
    const myStats = team ? teamStats.find(t => t.teamId === team.id) : null;
    stageData = {
      round1Results: {
        scoringMethod: store.round1Config?.scoringMethod || 'best',
        rounds: roundsList,
        myStats: myStats || null,
        leaderboard: db.getLeaderboard().slice(0, 10)
      }
    };
  } else if (stage === 'ROUND_2_INSTRUCTIONS' || stage === 'R2_INSTRUCTIONS') {
    const stagesList = db.getQuizStages();
    const questionsList = db.getQuizQuestions();
    stageData = {
      round2Summary: {
        stages: stagesList,
        totalQuestions: questionsList.length,
        totalPoints: questionsList.reduce((sum, q) => sum + (q.points || 0), 0),
        categories: [
          'Programming Languages',
          'Databases',
          'Computer Fundamentals',
          'Web & Systems',
          'General Technology Awareness'
        ],
        rules: [
          'Instructions are shown only once for Round 2.',
          'Each question has an individual authoritative countdown timer synced from the server.',
          'Transitions between stages and questions are managed manually by the Administrator.',
          'Once submitted, your answer is locked and cannot be re-submitted.',
          'If the timer expires before you submit, any currently selected choice will automatically be submitted.',
          'Question types include Single Select (MCQ), Multi-Select, True/False, Fill in the Blank, and Code Output.'
        ]
      }
    };
  } else if (
    stage === 'ROUND_2_QUIZ' || stage === 'R2_QUIZ' || stage === 'ROUND_2_ACTIVE' ||
    stage === 'R2_PHASE_1' || stage === 'ROUND_2_PHASE_1' ||
    stage === 'R2_PHASE_2' || stage === 'ROUND_2_PHASE_2' ||
    stage === 'R2_PHASE_3' || stage === 'ROUND_2_PHASE_3'
  ) {
    const stagesList = db.getQuizStages();
    const allBankQuestions = db.getQuizQuestions().filter(q => !q.isVoided);
    const mySubmissions = team ? store.quizSubmissions.filter(s => s.teamId === team.id) : [];
    const isPaused = Boolean(store.contestState.timer.isPaused || store.contestState.eventStatus === 'PAUSED');

    // Build the ordered questions list with submission state
    const questionList = allBankQuestions.map((q, idx) => {
      const sub = mySubmissions.find(s => s.questionId === q.id);
      return {
        id: q.id,
        index: idx + 1,
        stageNumber: q.stageNumber,
        category: q.category,
        type: q.type,
        questionText: q.questionText,
        codeSnippet: q.codeSnippet,
        options: q.options,
        difficulty: q.difficulty,
        points: q.points,
        timeLimitSeconds: q.timeLimitSeconds,
        isVoided: q.isVoided,
        isFullPointsAwarded: q.isFullPointsAwarded,
        status: sub ? (sub.answer === '__TIMEOUT__' ? 'timed_out' : 'answered') : 'unanswered',
        hasSubmitted: Boolean(sub),
        mySubmission: sub ? {
          answer: sub.answer,
          pointsAwarded: sub.pointsAwarded,
          isCorrect: sub.isCorrect,
          timeTakenSeconds: sub.timeTakenSeconds,
          submittedAt: sub.submittedAt
        } : null
      };
    });

    // Group questions stage-wise
    const stagesWithQuestions = stagesList.map(stg => {
      const stgQuestions = questionList.filter(q => q.stageNumber === stg.stageNumber);
      const answeredCount = stgQuestions.filter(q => q.hasSubmitted).length;
      return {
        id: stg.id,
        stageNumber: stg.stageNumber,
        title: stg.title,
        description: stg.description,
        totalQuestions: stgQuestions.length,
        answeredCount,
        questions: stgQuestions
      };
    });

    // Compute remaining seconds from contest timer
    let remainingSeconds = 0;
    const timer = store.contestState.timer;
    if (timer) {
      if (timer.isPaused) {
        remainingSeconds = timer.remainingSeconds || 0;
      } else if (timer.startedAt && timer.durationSeconds) {
        const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
        remainingSeconds = Math.max(0, timer.durationSeconds - elapsed);
      } else if (typeof timer.remainingSeconds === 'number') {
        remainingSeconds = timer.remainingSeconds;
      }
    }

    stageData = {
      stages: stagesWithQuestions,
      allQuestions: questionList,
      totalQuestions: questionList.length,
      totalAnswered: mySubmissions.length,
      totalPoints: questionList.reduce((sum, q) => sum + (q.points || 0), 0),
      totalScore: team ? (team.scores.r2 || 0) : 0,
      isPaused,
      remainingSeconds,
      isCompleted: questionList.length > 0 && mySubmissions.length >= questionList.length
    };
  } else if (stage === 'ROUND_2_RESULTS' || stage === 'R2_RESULTS') {
    const teamStats = db.getTeamQuizStats();
    const myStats = team ? teamStats.find(t => t.teamId === team.id) : null;
    const questions = db.getQuizQuestions();
    const mySubmissions = team ? store.quizSubmissions.filter(s => s.teamId === team.id) : [];

    const reviewQuestions = questions.map(q => {
      const sub = mySubmissions.find(s => s.questionId === q.id);
      return {
        id: q.id,
        stageNumber: q.stageNumber,
        category: q.category,
        type: q.type,
        questionText: q.questionText,
        codeSnippet: q.codeSnippet,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        points: q.points,
        isVoided: q.isVoided,
        isFullPointsAwarded: q.isFullPointsAwarded,
        userAnswer: sub ? sub.answer : null,
        userPointsAwarded: sub ? sub.pointsAwarded : (q.isFullPointsAwarded ? q.points : 0),
        userIsCorrect: sub ? sub.isCorrect : (q.isFullPointsAwarded || false)
      };
    });

    stageData = {
      round2Results: {
        myStats: myStats || null,
        reviewQuestions,
        stages: db.getQuizStages(),
        leaderboard: db.getLeaderboard().slice(0, 10)
      }
    };
  } else if (stage === 'ROUND_3_RESULTS' || stage === 'R3_RESULTS') {
    const subs = team ? store.codeSubmissions.filter(s => s.teamId === team.id) : [];
    const bestSub = subs.length > 0 ? [...subs].sort((a, b) => b.score - a.score)[0] : null;

    stageData = {
      round3Results: {
        myStats: team ? {
          teamId: team.id,
          teamName: team.name,
          r3Score: team.scores.r3,
          submissionsCount: subs.length,
          bestScore: bestSub ? bestSub.score : 0,
          bestLanguage: bestSub ? bestSub.language : null,
          characterCount: bestSub ? (bestSub.charCount || (bestSub.code ? bestSub.code.length : 0)) : 0,
          testsPassed: bestSub ? (bestSub.testResults?.filter((t: any) => t.passed).length || 0) : 0,
          totalTests: bestSub ? (bestSub.testResults?.length || 0) : 0
        } : null,
        leaderboard: db.getLeaderboard().slice(0, 10)
      }
    };
  } else if (stage === 'ROUND_4_RESULTS' || stage === 'R4_RESULTS') {
    const crackProg = team ? store.crackProgress[team.id] : null;
    const allChallenges = Object.values(store.crackChallenges);

    stageData = {
      round4Results: {
        myStats: team ? {
          teamId: team.id,
          teamName: team.name,
          r4Score: team.scores.r4,
          totalSolved: crackProg ? crackProg.totalSolved : 0,
          totalChallenges: allChallenges.length,
          totalTimeSeconds: crackProg ? crackProg.totalTimeSeconds : 0
        } : null,
        leaderboard: db.getLeaderboard().slice(0, 10)
      }
    };
  } else if (stage === 'FINAL_RESULTS' || stage === 'CONTEST_ENDED' || stage === 'ENDED') {
    stageData = {
      finalResults: {
        leaderboard: db.getLeaderboard(),
        myTeam: team ? {
          id: team.id,
          name: team.name,
          scores: team.scores,
          qualification: team.qualification
        } : null
      }
    };
  } else if (stage === 'ROUND_3_CODE' || stage === 'R3_CODE' || stage === 'ROUND_3_ACTIVE') {
    const problems = db.getParticipantCodingProblems();
    const subs = team ? db.getTeamCodeSubmissions(team.id) : [];

    const solvedMap: Record<string, { solved: boolean; bestChars?: number; bestScore?: number }> = {};
    problems.forEach(p => {
      if (p.id) {
        const pSubs = subs.filter(s => s.problemId === p.id && (s.isAccepted || s.allPassed));
        if (pSubs.length > 0) {
          const minChars = Math.min(...pSubs.map(s => s.charCount));
          const maxScore = Math.max(...pSubs.map(s => s.score || 0));
          solvedMap[p.id] = { solved: true, bestChars: minChars, bestScore: maxScore };
        } else {
          solvedMap[p.id] = { solved: false };
        }
      }
    });

    stageData = {
      problems,
      submissions: subs,
      solvedStatus: solvedMap,
      allowedLanguages: ['C', 'C++', 'Java']
    };
  } else if (
    (stage as string) === 'ROUND_4_CRACK' || (stage as string) === 'R4_CRACK' ||
    (stage as string) === 'ROUND_4_ACTIVE' || (stage as string) === 'ROUND_4'
  ) {
    const crackProg = store.crackProgress[team.id] || {
      teamId: team.id,
      teamName: team.name,
      currentChallengeIndex: 0,
      completedChallengeIds: [],
      unlockedHints: [],
      attemptsCount: {},
      totalSolved: 0,
      lastSolveTimestamp: null,
      totalTimeSeconds: 0
    };

    const allChallenges = Object.values(store.crackChallenges).sort((a, b) => a.order - b.order);
    
    // Determine the current active challenge (the first unsolved node in the sequence)
    const firstUnsolvedIdx = allChallenges.findIndex(
      ch => !crackProg.completedChallengeIds.includes(ch.id) && !ch.isManuallyUnlockedForEveryone
    );
    const activeChallengeObj = firstUnsolvedIdx !== -1 ? allChallenges[firstUnsolvedIdx] : null;

    // Format challenges: completed ones show details, active one shows prompt, future ones strictly locked
    const formattedChallenges = allChallenges.map((ch, idx) => {
      const isCompleted = crackProg.completedChallengeIds.includes(ch.id) || Boolean(ch.isManuallyUnlockedForEveryone);
      const isCurrent = activeChallengeObj ? ch.id === activeChallengeObj.id : false;
      const isLocked = !isCompleted && !isCurrent;

      // Hint for this challenge was unlocked when the previous challenge was solved
      const prevChallenge = idx > 0 ? allChallenges[idx - 1] : null;
      const isPrevCompleted = prevChallenge
        ? (crackProg.completedChallengeIds.includes(prevChallenge.id) || Boolean(prevChallenge.isManuallyUnlockedForEveryone))
        : false;
      
      const unlockedHintFromPrevious = (isPrevCompleted && prevChallenge)
        ? prevChallenge.hintAfterSolve
        : undefined;

      return {
        id: ch.id,
        order: ch.order,
        title: ch.title,
        puzzleType: ch.puzzleType,
        points: ch.points,
        isCompleted,
        isCurrent,
        isLocked,
        prompt: isLocked ? 'Locked until previous node is cracked.' : ch.prompt,
        cipherText: isLocked ? undefined : ch.cipherText,
        codeOrData: isLocked ? undefined : ch.codeOrData,
        // Only return this node's hintAfterSolve if this node has been completed
        hintAfterSolve: isCompleted ? ch.hintAfterSolve : undefined,
        // The hint that was unlocked by solving the previous node
        hintFromPrevious: unlockedHintFromPrevious
      };
    });

    const activeFormatted = formattedChallenges.find(c => c.isCurrent) || null;

    stageData = {
      challenges: formattedChallenges,
      activeChallenge: activeFormatted,
      completedChallengeIds: crackProg.completedChallengeIds,
      unlockedHints: crackProg.unlockedHints || [],
      totalSolved: crackProg.completedChallengeIds.length,
      totalChallenges: allChallenges.length,
      allSolved: allChallenges.length > 0 && crackProg.completedChallengeIds.length >= allChallenges.length,
      progress: crackProg
    };
  }

  res.json({
    success: true,
    team,
    contestState: store.contestState,
    stageData,
    data: stageData
  });
});

// Round 2: Get all quiz arena questions
router.get('/round2/questions', (req: any, res) => {
  const store = db.getStore();
  const team = req.team;
  const allBankQuestions = db.getQuizQuestions().filter(q => !q.isVoided);
  const mySubmissions = team ? store.quizSubmissions.filter(s => s.teamId === team.id) : [];

  const questionList = allBankQuestions.map((q, idx) => {
    const sub = mySubmissions.find(s => s.questionId === q.id);
    return {
      id: q.id,
      index: idx + 1,
      stageNumber: q.stageNumber,
      category: q.category,
      type: q.type,
      questionText: q.questionText,
      codeSnippet: q.codeSnippet,
      options: q.options,
      difficulty: q.difficulty,
      points: q.points,
      timeLimitSeconds: q.timeLimitSeconds,
      isVoided: q.isVoided,
      isFullPointsAwarded: q.isFullPointsAwarded,
      status: sub ? (sub.answer === '__TIMEOUT__' ? 'timed_out' : 'answered') : 'unanswered',
      hasSubmitted: Boolean(sub),
      mySubmission: sub ? {
        answer: sub.answer,
        pointsAwarded: sub.pointsAwarded,
        isCorrect: sub.isCorrect,
        timeTakenSeconds: sub.timeTakenSeconds,
        submittedAt: sub.submittedAt
      } : null
    };
  });

  res.json({
    success: true,
    questions: questionList,
    allQuestions: questionList,
    totalQuestions: questionList.length
  });
});

// Round 1: Submit Typing Attempt
router.post('/round1/submit', (req: any, res) => {
  const { isPractice, typingRoundId, wpm, accuracy, charsTyped, correctChars, incorrectChars, timeTakenSeconds } = req.body;
  const store = db.getStore();
  const team = req.team;

  if (store.contestState.isEmergencyLocked) {
    return res.status(423).json({ success: false, message: 'Contest is currently paused by administrator.' });
  }

  const tr = store.typingRounds[typingRoundId] || Object.values(store.typingRounds)[0];
  const accDecimal = Math.min(1, Math.max(0, Number(accuracy) / 100));
  const cleanWpm = Number(wpm) || 0;
  
  // Formula: score = WPM * accuracy (decimal) * multiplier
  const mult = tr ? tr.scoringMultiplier : 1.0;
  const rawScore = cleanWpm * accDecimal * mult;
  const calculatedScore = Number(rawScore.toFixed(2));

  const submission: TypingSubmission = {
    id: `sub-typ-${Date.now()}-${team.id}`,
    teamId: team.id,
    teamName: team.name,
    typingRoundId: typingRoundId || 'tr-1',
    isPractice: Boolean(isPractice),
    wpm: cleanWpm,
    accuracy: Number(accuracy) || 0,
    charsTyped: Number(charsTyped) || 0,
    correctChars: Number(correctChars) || 0,
    incorrectChars: Number(incorrectChars) || 0,
    timeTakenSeconds: Number(timeTakenSeconds) || 0,
    score: calculatedScore,
    submittedAt: Date.now()
  };

  store.typingSubmissions.push(submission);

  // Practice score is NEVER counted towards the leaderboard, but logged for participant feedback
  if (!isPractice) {
    db.recalculateRound1Scores();
    broadcastLeaderboard(db.getLeaderboard());
  }

  db.saveData();
  broadcastTeamUpdate(team);

  res.json({
    success: true,
    submission,
    teamScore: team.scores.r1
  });
});

// Round 2: Submit Quiz Answer
router.post('/round2/submit', (req: any, res) => {
  const { questionId, answer, timeTakenSeconds } = req.body;
  const store = db.getStore();
  const team = req.team;

  if (!team) {
    return res.status(400).json({ success: false, message: 'No active team session identified.' });
  }

  if (store.contestState.isEmergencyLocked) {
    return res.status(423).json({ success: false, message: 'Contest is currently locked.' });
  }

  const q = store.quizQuestions[questionId];
  if (!q) return res.status(404).json({ success: false, message: 'Question not found.' });

  let phaseNumber = store.contestState.currentQuizPhase || q.stageNumber || 1;
  const stage = store.contestState.currentStage;
  if (stage === 'R2_PHASE_1' || stage === 'ROUND_2_PHASE_1') phaseNumber = 1;
  else if (stage === 'R2_PHASE_2' || stage === 'ROUND_2_PHASE_2') phaseNumber = 2;
  else if (stage === 'R2_PHASE_3' || stage === 'ROUND_2_PHASE_3') phaseNumber = 3;

  try {
    const { submission, progress } = db.submitQuizAnswer(
      team.id,
      questionId,
      answer,
      timeTakenSeconds || 0,
      phaseNumber
    );

    broadcastLeaderboard(db.getLeaderboard());
    broadcastTeamUpdate(team);

    res.json({
      success: true,
      submission,
      pointsAwarded: submission.pointsAwarded,
      isCorrect: submission.isCorrect,
      totalR2Score: team.scores.r2,
      totalScore: team.scores.total,
      progress
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Submission error' });
  }
});

// Round 2: Complete Quiz & Final Submission
router.post('/round2/complete', (req: any, res) => {
  const store = db.getStore();
  const team = req.team;

  if (!team) {
    return res.status(400).json({ success: false, message: 'No active team session.' });
  }

  if (store.contestState.isEmergencyLocked) {
    return res.status(423).json({ success: false, message: 'Contest is currently locked.' });
  }

  // Recalculate round 2 and overall team scores
  db.recalculateRound2Scores();

  if (!team.qualification) team.qualification = { r1: true, r2: true, r3: false, r4: false };
  team.qualification.r2 = true;

  const teamSubs = store.quizSubmissions.filter(s => s.teamId === team.id);
  const correctCount = teamSubs.filter(s => s.isCorrect || s.pointsAwarded > 0).length;
  const totalQuestions = Object.values(store.quizQuestions).filter(q => !q.isVoided).length;

  db.saveData();
  broadcastLeaderboard(db.getLeaderboard());
  broadcastTeamUpdate(team);

  res.json({
    success: true,
    message: 'Round 2 Quiz submitted successfully!',
    teamScore: team.scores.r2,
    totalScore: team.scores.total,
    totalAnswered: teamSubs.length,
    correctCount,
    totalQuestions
  });
});

// Round 2: Auto-Timeout or Skip Question
router.post('/round2/timeout', (req: any, res) => {
  const store = db.getStore();
  const team = req.team;
  let phaseNumber = store.contestState.currentQuizPhase || 1;
  const stage = store.contestState.currentStage;
  if (stage === 'R2_PHASE_1' || stage === 'ROUND_2_PHASE_1') phaseNumber = 1;
  else if (stage === 'R2_PHASE_2' || stage === 'ROUND_2_PHASE_2') phaseNumber = 2;
  else if (stage === 'R2_PHASE_3' || stage === 'ROUND_2_PHASE_3') phaseNumber = 3;

  db.advanceTeamQuizQuestion(team.id, phaseNumber, true);
  broadcastLeaderboard(db.getLeaderboard());
  broadcastTeamUpdate(team);

  res.json({ success: true });
});

// Round 3: Get Problems for Participant
router.get('/round3/problems', (req: any, res) => {
  const problems = db.getParticipantCodingProblems();
  const team = req.team;
  const subs = team ? db.getTeamCodeSubmissions(team.id) : [];

  const solvedMap: Record<string, { solved: boolean; bestChars?: number; bestScore?: number }> = {};
  problems.forEach(p => {
    if (p.id) {
      const pSubs = subs.filter(s => s.problemId === p.id && (s.isAccepted || s.allPassed));
      if (pSubs.length > 0) {
        const minChars = Math.min(...pSubs.map(s => s.charCount));
        const maxScore = Math.max(...pSubs.map(s => s.score || 0));
        solvedMap[p.id] = { solved: true, bestChars: minChars, bestScore: maxScore };
      } else {
        solvedMap[p.id] = { solved: false };
      }
    }
  });

  res.json({
    success: true,
    problems,
    submissions: subs,
    solvedStatus: solvedMap
  });
});

// Round 3: Run Code (Sample test cases only)
router.post('/round3/run', async (req: any, res) => {
  try {
    const { problemId, code, participantCode, language } = req.body;
    const store = db.getStore();
    const prob = store.codingProblems[problemId] || db.getCodingProblems()[0];
    if (!prob) return res.status(404).json({ success: false, message: 'Problem not found.', compileError: 'Problem not found.' });

    const chosenLang = (language || 'C++') as 'C' | 'C++' | 'Java' | 'Python';
    const sentCode = code !== undefined ? String(code) : String(participantCode || '');
    
    // Resolve starting boilerplate for chosen language
    const rawBp: any = (prob.boilerplates as any)?.[chosenLang];
    const initialBoilerplate = typeof rawBp === 'string'
      ? rawBp
      : (rawBp && typeof rawBp === 'object' ? `${rawBp.prefix || rawBp.top || ''}\n${rawBp.suffix || rawBp.bottom || ''}` : '');

    // If complete code was entered in editor (with boilerplate or main), use directly
    const fullCode = (sentCode.includes('main(') || sentCode.includes('Main') || chosenLang === 'Python')
      ? sentCode
      : reconstructFullCode(chosenLang, sentCode, prob.boilerplates);

    const sampleTests = prob.visibleTestCases || prob.sampleTestCases || [];

    const execution = await executeCode(
      chosenLang,
      fullCode,
      sampleTests,
      prob.prohibitedKeywords || [],
      sentCode,
      prob.timeLimitSeconds || 2,
      prob.boilerplates,
      initialBoilerplate
    );

    const sanitizedResults = (execution.results || []).map(r => ({
      ...r,
      actual: r.actual,
      actualOutput: r.actualOutput || r.actual,
      expected: r.expected,
      expectedOutput: r.expectedOutput || r.expected
    }));

    res.json({
      success: true,
      results: sanitizedResults,
      testResults: sanitizedResults,
      allPassed: execution.allPassed,
      charCount: execution.charCount,
      additionalChars: execution.charCount,
      lineCount: execution.lineCount,
      compileError: execution.compileError || (execution.rejectionReason ? execution.rejectionReason : undefined),
      rejectionReason: execution.rejectionReason
    });
  } catch (err: any) {
    console.error('[Round3 Run Error]:', err);
    res.status(200).json({
      success: false,
      message: err.message || 'Execution failed',
      compileError: `Execution error: ${err.message || 'Unknown error occurred during compilation or execution.'}`,
      results: [],
      testResults: [],
      allPassed: false
    });
  }
});

// Round 3: Submit Code (Full evaluation)
router.post('/round3/submit', async (req: any, res) => {
  try {
    const store = db.getStore();
    const team = req.team;

    if (store.contestState.isEmergencyLocked || store.contestState.eventStatus === 'PAUSED') {
      return res.status(423).json({ success: false, message: 'Contest is paused. Submissions are temporarily blocked.', compileError: 'Contest is paused.' });
    }

    const currentStage = store.contestState.currentStage;
    if (currentStage !== 'ROUND_3_CODE' && currentStage !== 'R3_CODE' && currentStage !== 'ROUND_3_ACTIVE') {
      return res.status(403).json({ success: false, message: 'Round 3 is not currently active.', compileError: 'Round 3 is not currently active.' });
    }

    const { problemId, code, participantCode, language } = req.body;
    const prob = store.codingProblems[problemId] || db.getCodingProblems()[0];
    if (!prob) return res.status(404).json({ success: false, message: 'Problem not found.', compileError: 'Problem not found.' });
    if (!prob.isEnabled) return res.status(400).json({ success: false, message: 'This problem is not currently active.', compileError: 'This problem is disabled.' });

    const chosenLang = (language || 'C++') as 'C' | 'C++' | 'Java' | 'Python';
    const sentCode = code !== undefined ? String(code) : String(participantCode || '');

    // Resolve starting boilerplate for chosen language
    const rawBpSubmit: any = (prob.boilerplates as any)?.[chosenLang];
    const initialBoilerplate = typeof rawBpSubmit === 'string'
      ? rawBpSubmit
      : (rawBpSubmit && typeof rawBpSubmit === 'object' ? `${rawBpSubmit.prefix || rawBpSubmit.top || ''}\n${rawBpSubmit.suffix || rawBpSubmit.bottom || ''}` : '');

    // If complete code was entered in editor, use directly; otherwise reconstruct
    const fullCode = (sentCode.includes('main(') || sentCode.includes('Main') || chosenLang === 'Python')
      ? sentCode
      : reconstructFullCode(chosenLang, sentCode, prob.boilerplates);

    const allTestCases = [
      ...(prob.visibleTestCases || prob.sampleTestCases || []),
      ...(prob.hiddenTestCases || [])
    ];

    const execution = await executeCode(
      chosenLang,
      fullCode,
      allTestCases,
      prob.prohibitedKeywords || [],
      sentCode,
      prob.timeLimitSeconds || 2,
      prob.boilerplates,
      initialBoilerplate
    );

    const isAccepted = execution.allPassed && !execution.compileError && !execution.rejectionReason;
    const basePoints = prob.points || 100;
    const score = isAccepted ? basePoints : 0;

    // Sanitize test results for response so hidden test inputs/outputs are never leaked
    const visibleCount = (prob.visibleTestCases || prob.sampleTestCases || []).length;
    const sanitizedTestResults = (execution.results || []).map((r, idx) => {
      const isHidden = idx >= visibleCount;
      if (isHidden) {
        return {
          passed: r.passed,
          input: '[Hidden Test]',
          expected: '[Hidden]',
          actual: r.passed ? '[Hidden Test Passed]' : '[Hidden Test Failed]',
          actualOutput: r.passed ? '[Hidden Test Passed]' : '[Hidden Test Failed]',
          expectedOutput: '[Hidden]',
          executionTimeMs: r.executionTimeMs,
          isHidden: true,
          error: r.error ? 'Output mismatch or runtime exception' : undefined
        };
      }
      return {
        ...r,
        actualOutput: r.actual,
        expectedOutput: r.expected,
        isHidden: false
      };
    });

    const submission: CodeSubmission = {
      id: `sub-code-${Date.now()}-${team.id}-${Math.random().toString(36).substring(2, 7)}`,
      teamId: team.id,
      teamName: team.name,
      problemId: prob.id,
      problemTitle: prob.title,
      code: fullCode,
      participantCode: sentCode,
      language: chosenLang,
      charCount: execution.charCount,
      lineCount: execution.lineCount,
      executionStatus: execution.rejectionReason
        ? 'rejected'
        : (execution.compileError ? 'compile_error' : (execution.allPassed ? 'passed' : 'failed')),
      compileError: execution.compileError,
      testResults: sanitizedTestResults,
      allPassed: execution.allPassed,
      score,
      isAccepted,
      submittedAt: Date.now()
    };

    db.saveCodeSubmission(submission);
    broadcastLeaderboard(db.getLeaderboard());
    broadcastTeamUpdate(store.teams[team.id] || team);

    res.json({
      success: true,
      submission,
      allPassed: execution.allPassed,
      isAccepted,
      charCount: execution.charCount,
      compileError: execution.compileError || (execution.rejectionReason ? execution.rejectionReason : undefined),
      score: (store.teams[team.id] || team).scores.r3,
      testResults: sanitizedTestResults
    });
  } catch (err: any) {
    console.error('[Round3 Submit Error]:', err);
    res.status(200).json({
      success: false,
      message: err.message || 'Submission failed',
      compileError: `Submission error: ${err.message || 'Unknown error occurred during submission evaluation.'}`,
      allPassed: false,
      isAccepted: false,
      testResults: []
    });
  }
});

// Round 4: Submit Crack Challenge Solution
router.post('/round4/submit', (req: any, res) => {
  const { challengeId, answer } = req.body;
  const store = db.getStore();
  const team = req.team;

  if (store.contestState.isEmergencyLocked) {
    return res.status(423).json({ success: false, message: 'Contest is locked.' });
  }

  const challenge = store.crackChallenges[challengeId];
  if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found.' });

  const prog = store.crackProgress[team.id] || {
    teamId: team.id,
    teamName: team.name,
    currentChallengeIndex: 0,
    completedChallengeIds: [],
    unlockedHints: [],
    attemptsCount: {},
    totalSolved: 0,
    lastSolveTimestamp: null,
    totalTimeSeconds: 0
  };

  // Enforce sequential unlocking: cannot submit to locked nodes
  const allChallenges = Object.values(store.crackChallenges).sort((a, b) => a.order - b.order);
  const chIdx = allChallenges.findIndex(c => c.id === challengeId);
  if (chIdx > 0) {
    const prevCh = allChallenges[chIdx - 1];
    const isPrevSolved = prog.completedChallengeIds.includes(prevCh.id) || Boolean(prevCh.isManuallyUnlockedForEveryone);
    if (!isPrevSolved && !challenge.isManuallyUnlockedForEveryone) {
      return res.status(403).json({
        success: false,
        isCorrect: false,
        message: `Node ${challenge.order} is locked. You must crack Node ${prevCh.order} first.`
      });
    }
  }

  prog.attemptsCount[challengeId] = (prog.attemptsCount[challengeId] || 0) + 1;

  const rawAns = String(answer || '').trim();
  const cleanAns = rawAns.toLowerCase().replace(/^["'`]|["'`]$/g, '').trim();
  const isCorrect = cleanAns === challenge.correctAnswer.trim().toLowerCase() ||
    (challenge.acceptedVariations && challenge.acceptedVariations.some(v => v.trim().toLowerCase() === cleanAns));

  const attempt: CrackAttempt = {
    id: `att-crk-${Date.now()}-${team.id}`,
    teamId: team.id,
    teamName: team.name,
    challengeId,
    submittedAnswer: String(answer || ''),
    isCorrect: Boolean(isCorrect),
    timestamp: Date.now()
  };

  store.crackAttempts.push(attempt);

  if (isCorrect) {
    if (!prog.completedChallengeIds.includes(challengeId)) {
      prog.completedChallengeIds.push(challengeId);
      prog.totalSolved = prog.completedChallengeIds.length;
      prog.currentChallengeIndex = prog.completedChallengeIds.length;
      prog.lastSolveTimestamp = Date.now();
      if (!prog.unlockedHints) prog.unlockedHints = [];
      if (!prog.unlockedHints.some(h => h.challengeId === challengeId)) {
        prog.unlockedHints.push({ challengeId, hint: challenge.hintAfterSolve });
      }

      // Add points to team score
      team.scores.r4 = (team.scores.r4 || 0) + challenge.points;
      db.recalculateTeamScores();
      broadcastLeaderboard(db.getLeaderboard());
    }

    // Determine the next challenge in sequence
    const nextChallenge = allChallenges[chIdx + 1] || null;

    store.crackProgress[team.id] = prog;
    db.saveData();
    broadcastTeamUpdate(team);

    return res.json({
      success: true,
      isCorrect: true,
      unlockedHintForNext: challenge.hintAfterSolve,
      nextChallengeId: nextChallenge ? nextChallenge.id : null,
      totalSolved: prog.totalSolved,
      r4Score: team.scores.r4,
      message: nextChallenge
        ? `Node ${challenge.order} cracked! +${challenge.points} pts awarded. Node ${nextChallenge.order} unlocked with decryption intel.`
        : `Node ${challenge.order} cracked! All security chain challenges solved!`
    });
  } else {
    store.crackProgress[team.id] = prog;
    db.saveData();

    return res.json({
      success: false,
      isCorrect: false,
      message: 'Incorrect decryption key or passphrase. Check your cipher logic and try again.'
    });
  }
});

// Leaderboard visibility for participant
router.get('/leaderboard', (req, res) => {
  const store = db.getStore();
  const stage = String(store.contestState.currentStage || '');
  const isResultStage = [
    'R1_RESULTS', 'ROUND_1_RESULTS',
    'R2_RESULTS', 'ROUND_2_RESULTS',
    'R3_RESULTS', 'ROUND_3_RESULTS',
    'R4_RESULTS', 'ROUND_4_RESULTS',
    'FINAL_RESULTS', 'CONTEST_ENDED', 'ENDED'
  ].includes(stage);

  if (!isResultStage && !store.contestState.isLeaderboardVisibleToTeams) {
    return res.status(403).json({ success: false, message: 'Leaderboard is currently hidden by the event administrator.' });
  }

  res.json({
    success: true,
    leaderboard: db.getLeaderboard()
  });
});

export default router;
