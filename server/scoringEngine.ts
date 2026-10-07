import {
  MasterScoringConfig,
  Round1ScoringConfig,
  Round2ScoringConfig,
  Round3ScoringConfig,
  Round4ScoringConfig,
  RoundScoreRecord,
  ScoreOverrideRecord,
  LeaderboardEntry,
  Team,
  CodingProblem,
  CodeSubmission
} from '../src/types/contest';

export function getDefaultMasterScoringConfig(): MasterScoringConfig {
  return {
    r1: {
      scoringMethod: 'best',
      subroundWeights: {},
      multiplier: 1.0,
      maxScore: undefined,
      overrides: {}
    },
    r2: {
      defaultEasyPoints: 2,
      defaultMediumPoints: 4,
      defaultHardPoints: 6,
      pointsPerQuestion: { easy: 2, medium: 4, hard: 6 },
      questionPointsOverride: {},
      incorrectPenalty: 0,
      multiplier: 1.0,
      maxScore: undefined,
      overrides: {}
    },
    r3: {
      problemPoints: {},
      minimizationMethod: 'rank_bonus',
      rankBonuses: [25, 18, 12, 8, 5],
      thresholdChars: 100,
      thresholdBonus: 15,
      multiplier: 1.0,
      maxScore: undefined,
      overrides: {}
    },
    r4: {
      challengePoints: {},
      speedBonusThresholdSeconds: 120,
      speedBonusPoints: 10,
      attemptPenalty: 0,
      multiplier: 1.0,
      maxScore: undefined,
      overrides: {}
    },
    tieBreakRules: {
      priority: [
        'overall_score',
        'r3_score',
        'r3_problems_solved',
        'r3_char_count',
        'r4_score',
        'r4_time',
        'r1_score',
        'r2_score',
        'earliest_submission'
      ]
    },
    maxScores: {}
  };
}

/**
 * Server-authoritative Round 1 scoring calculator.
 * Strictly uses raw performance metrics:
 * WPM = Correct Characters / 5 / TimeInMinutes
 * Accuracy = Correct Characters / Total Typed Characters
 * Performance Score = WPM * Accuracy
 * Practice attempts contribute ZERO points.
 */
export function calculateRound1Score(
  teamId: string,
  store: any,
  config: Round1ScoringConfig
): RoundScoreRecord {
  const submissions = (store.typingSubmissions || []).filter(
    (s: any) => s.teamId === teamId && !s.isPractice
  );
  const typingRounds = store.typingRounds || {};
  const overrides = config.overrides || {};

  // Best performance score per subround
  const subroundScores: Record<string, number> = {};
  const subroundDetails: Record<string, any> = {};

  let bestWpmOverall = 0;
  let bestAccuracyOverall = 0;

  submissions.forEach((s: any) => {
    const timeMins = (s.timeTakenSeconds || 0) > 0 ? s.timeTakenSeconds / 60 : 1;
    const calcWpm = s.correctChars ? s.correctChars / 5 / timeMins : (s.wpm || 0);
    const calcAcc = (s.charsTyped || 0) > 0 ? (s.correctChars || 0) / s.charsTyped : (s.accuracy || 0) / 100;
    const perfScore = Number((calcWpm * calcAcc).toFixed(2));

    if (calcWpm > bestWpmOverall) bestWpmOverall = Number(calcWpm.toFixed(1));
    if (calcAcc * 100 > bestAccuracyOverall) bestAccuracyOverall = Number((calcAcc * 100).toFixed(1));

    const cur = subroundScores[s.typingRoundId] || 0;
    if (perfScore > cur) {
      subroundScores[s.typingRoundId] = perfScore;
      subroundDetails[s.typingRoundId] = {
        wpm: Number(calcWpm.toFixed(1)),
        accuracy: Number((calcAcc * 100).toFixed(1)),
        score: perfScore,
        charsTyped: s.charsTyped,
        timeTakenSeconds: s.timeTakenSeconds
      };
    }
  });

  const roundIds = Object.keys(typingRounds);
  const attemptedScores = Object.values(subroundScores);

  let rawScore = 0;
  const method = config.scoringMethod || 'best';

  if (attemptedScores.length > 0) {
    if (method === 'best') {
      rawScore = Math.max(...attemptedScores);
    } else if (method === 'average') {
      const sum = attemptedScores.reduce((a, b) => a + b, 0);
      rawScore = Number((sum / attemptedScores.length).toFixed(2));
    } else if (method === 'total') {
      rawScore = Number(attemptedScores.reduce((a, b) => a + b, 0).toFixed(2));
    } else if (method === 'weighted') {
      const weights = config.subroundWeights || {};
      let weightedSum = 0;
      let totalWeight = 0;
      roundIds.forEach(rId => {
        const w = weights[rId] !== undefined ? weights[rId] : 1;
        const score = subroundScores[rId] || 0;
        weightedSum += score * w;
        totalWeight += w;
      });
      rawScore = totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : 0;
    }
  }

  // Multiplier
  const mult = config.multiplier !== undefined ? config.multiplier : 1.0;
  let multiplied = Number((rawScore * mult).toFixed(2));

  // Cap if maxScore configured
  if (config.maxScore !== undefined && config.maxScore > 0) {
    multiplied = Math.min(config.maxScore, multiplied);
  }

  // Check manual override
  const override: ScoreOverrideRecord | null = overrides[teamId] || null;
  let finalScore = multiplied;

  if (override) {
    if (override.type === 'override') {
      finalScore = Number(override.value.toFixed(2));
    } else if (override.type === 'bonus') {
      finalScore = Number((multiplied + override.value).toFixed(2));
    } else if (override.type === 'penalty') {
      finalScore = Number(Math.max(0, multiplied - override.value).toFixed(2));
    }
  }

  return {
    teamId,
    round: 'r1',
    score: finalScore,
    rawScore,
    maximumScore: config.maxScore,
    scoringBreakdown: {
      scoringMethod: method,
      subroundScores,
      subroundDetails,
      attemptCount: submissions.length,
      bestWpm: bestWpmOverall,
      bestAccuracy: bestAccuracyOverall,
      multiplier: mult,
      maxScore: config.maxScore
    },
    manualOverride: override,
    updatedAt: Date.now()
  };
}

/**
 * Server-authoritative Round 2 scoring calculator.
 * Question-level points, phase/difficulty defaults, optional penalties for incorrect answers.
 * Detailed breakdown per question difficulty.
 */
export function calculateRound2Score(
  teamId: string,
  store: any,
  config: Round2ScoringConfig
): RoundScoreRecord {
  const submissions = (store.quizSubmissions || []).filter((s: any) => s.teamId === teamId);
  const questions = store.quizQuestions || {};
  const overrides = config.overrides || {};

  const easyPts = (config as any).pointsPerQuestion?.easy ?? (config.defaultEasyPoints !== undefined ? config.defaultEasyPoints : 2);
  const medPts = (config as any).pointsPerQuestion?.medium ?? (config.defaultMediumPoints !== undefined ? config.defaultMediumPoints : 4);
  const hardPts = (config as any).pointsPerQuestion?.hard ?? (config.defaultHardPoints !== undefined ? config.defaultHardPoints : 6);
  const incorrectPenalty = (config as any).penaltyPerIncorrect ?? config.incorrectPenalty ?? 0;

  let easyCorrect = 0;
  let easyPoints = 0;
  let mediumCorrect = 0;
  let mediumPoints = 0;
  let hardCorrect = 0;
  let hardPoints = 0;
  let totalPenalty = 0;
  let correctCount = 0;
  let totalTime = 0;

  const questionScores: Record<string, number> = {};

  submissions.forEach((s: any) => {
    totalTime += (s.timeTakenSeconds || 0);
    const q = questions[s.questionId];
    if (!q || q.isVoided) {
      questionScores[s.questionId] = 0;
      return;
    }

    // Determine configured point value based on question points and difficulty weight
    let qPoints = q.points;
    if (config.questionPointsOverride && config.questionPointsOverride[q.id] !== undefined) {
      qPoints = config.questionPointsOverride[q.id];
    } else if (q.difficulty === 'EASY') {
      qPoints = easyPts || q.points || 2;
    } else if (q.difficulty === 'MEDIUM') {
      qPoints = medPts || q.points || 4;
    } else if (q.difficulty === 'HARD') {
      qPoints = hardPts || q.points || 6;
    }
    if (!qPoints || qPoints <= 0) {
      qPoints = q.difficulty === 'HARD' ? 6 : q.difficulty === 'MEDIUM' ? 4 : 2;
    }

    if (q.isFullPointsAwarded) {
      questionScores[s.questionId] = qPoints;
      correctCount++;
      if (q.difficulty === 'EASY') { easyCorrect++; easyPoints += qPoints; }
      else if (q.difficulty === 'MEDIUM') { mediumCorrect++; mediumPoints += qPoints; }
      else { hardCorrect++; hardPoints += qPoints; }
    } else if (s.isCorrect) {
      questionScores[s.questionId] = qPoints;
      correctCount++;
      if (q.difficulty === 'EASY') { easyCorrect++; easyPoints += qPoints; }
      else if (q.difficulty === 'MEDIUM') { mediumCorrect++; mediumPoints += qPoints; }
      else { hardCorrect++; hardPoints += qPoints; }
    } else {
      questionScores[s.questionId] = 0;
      if (incorrectPenalty > 0) {
        totalPenalty += incorrectPenalty;
      }
    }
  });

  // Global full points awarded to any missing submissions
  Object.values(questions).forEach((q: any) => {
    if (q.isFullPointsAwarded && !q.isVoided && questionScores[q.id] === undefined) {
      let qPoints = q.points;
      if (config.questionPointsOverride && config.questionPointsOverride[q.id] !== undefined) {
        qPoints = config.questionPointsOverride[q.id];
      } else if (q.difficulty === 'EASY') qPoints = easyPts;
      else if (q.difficulty === 'MEDIUM') qPoints = medPts;
      else if (q.difficulty === 'HARD') qPoints = hardPts;

      questionScores[q.id] = qPoints;
      correctCount++;
      if (q.difficulty === 'EASY') { easyCorrect++; easyPoints += qPoints; }
      else if (q.difficulty === 'MEDIUM') { mediumCorrect++; mediumPoints += qPoints; }
      else { hardCorrect++; hardPoints += qPoints; }
    }
  });

  const earnedSum = easyPoints + mediumPoints + hardPoints;
  const rawScore = Math.max(0, Number((earnedSum - totalPenalty).toFixed(2)));

  const mult = config.multiplier !== undefined ? config.multiplier : 1.0;
  let multiplied = Number((rawScore * mult).toFixed(2));

  if (config.maxScore !== undefined && config.maxScore > 0) {
    multiplied = Math.min(config.maxScore, multiplied);
  }

  const override: ScoreOverrideRecord | null = overrides[teamId] || null;
  let finalScore = multiplied;

  if (override) {
    if (override.type === 'override') {
      finalScore = Number(override.value.toFixed(2));
    } else if (override.type === 'bonus') {
      finalScore = Number((multiplied + override.value).toFixed(2));
    } else if (override.type === 'penalty') {
      finalScore = Number(Math.max(0, multiplied - override.value).toFixed(2));
    }
  }

  return {
    teamId,
    round: 'r2',
    score: finalScore,
    rawScore,
    maximumScore: config.maxScore,
    scoringBreakdown: {
      correctCount,
      totalSubmissions: submissions.length,
      accuracy: submissions.length > 0 ? Number(((correctCount / submissions.length) * 100).toFixed(1)) : 0,
      totalTimeSeconds: totalTime,
      easyCorrect,
      easyPoints,
      mediumCorrect,
      mediumPoints,
      hardCorrect,
      hardPoints,
      totalPenalty,
      multiplier: mult,
      maxScore: config.maxScore
    },
    manualOverride: override,
    updatedAt: Date.now()
  };
}

/**
 * Server-authoritative Round 3 scoring calculator.
 * Two distinct dimensions:
 * 1. Problems Solved: Configurable points per problem.
 * 2. Code Minimization:
 *    - Participant-added characters only + ignoring whitespace/newlines/tabs.
 *    - Minimization ranking calculated server-side across all teams that solved each problem.
 *    - Configurable minimization scoring method: rank_bonus, percentage, threshold, bonus_points, or tie_breaker_only.
 */
export function calculateRound3ScoresForAllTeams(
  teams: Team[],
  store: any,
  config: Round3ScoringConfig
): Record<string, RoundScoreRecord> {
  const submissions: CodeSubmission[] = store.codeSubmissions || [];
  const problems: Record<string, CodingProblem> = store.codingProblems || {};
  const overrides = config.overrides || {};

  // Find best accepted submission per team per problem
  const bestSubsByTeamAndProblem: Record<string, Record<string, CodeSubmission>> = {};

  teams.forEach(team => {
    bestSubsByTeamAndProblem[team.id] = {};
    const teamSubs = submissions.filter(s => s.teamId === team.id && (s.isAccepted || s.allPassed));
    teamSubs.forEach(s => {
      const existing = bestSubsByTeamAndProblem[team.id][s.problemId];
      if (!existing || s.charCount < existing.charCount) {
        bestSubsByTeamAndProblem[team.id][s.problemId] = s;
      }
    });
  });

  // For each problem, rank teams by charCount ascending to calculate minimization bonuses
  const problemRankings: Record<string, { teamId: string; charCount: number; submittedAt: number }[]> = {};

  Object.keys(problems).forEach(probId => {
    const list: { teamId: string; charCount: number; submittedAt: number }[] = [];
    teams.forEach(t => {
      const sub = bestSubsByTeamAndProblem[t.id]?.[probId];
      if (sub) {
        list.push({ teamId: t.id, charCount: sub.charCount, submittedAt: sub.submittedAt });
      }
    });

    list.sort((a, b) => {
      if (a.charCount !== b.charCount) return a.charCount - b.charCount;
      return a.submittedAt - b.submittedAt;
    });

    problemRankings[probId] = list;
  });

  const result: Record<string, RoundScoreRecord> = {};

  teams.forEach(team => {
    let baseProblemPoints = 0;
    let minimizationBonus = 0;
    let solvedCount = 0;
    let totalCharCount = 0;
    const solvedProblemsBreakdown: Record<string, any> = {};

    Object.keys(problems).forEach(probId => {
      const prob = problems[probId];
      const sub = bestSubsByTeamAndProblem[team.id]?.[probId];

      if (sub) {
        solvedCount++;
        totalCharCount += sub.charCount;
        const problemPts = config.problemPoints[probId] !== undefined
          ? config.problemPoints[probId]
          : (prob.points || 100);

        baseProblemPoints += problemPts;

        // Minimization bonus calculation
        let probBonus = 0;
        const rankings = problemRankings[probId] || [];
        const rankIndex = rankings.findIndex(r => r.teamId === team.id);

        if (rankIndex >= 0) {
          if (config.minimizationMethod === 'rank_bonus') {
            const bonuses = config.rankBonuses || [25, 18, 12, 8, 5];
            probBonus = bonuses[rankIndex] || 0;
          } else if (config.minimizationMethod === 'threshold') {
            const threshold = config.thresholdChars || 100;
            if (sub.charCount <= threshold) {
              probBonus = config.thresholdBonus || 15;
            }
          } else if (config.minimizationMethod === 'bonus_points') {
            if (rankIndex === 0) probBonus = 20;
          } else if (config.minimizationMethod === 'percentage') {
            const refLen = prob.referenceLengths?.python || prob.referenceLengths?.javascript || 150;
            const diff = Math.max(0, refLen - sub.charCount);
            probBonus = Number(((diff / refLen) * 20).toFixed(1));
          }
        }

        minimizationBonus += probBonus;

        solvedProblemsBreakdown[probId] = {
          title: prob.title,
          basePoints: problemPts,
          charCount: sub.charCount,
          minimizationBonus: probBonus,
          rankForProblem: rankIndex >= 0 ? rankIndex + 1 : null
        };
      }
    });

    const rawScore = Number((baseProblemPoints + minimizationBonus).toFixed(2));
    const mult = config.multiplier !== undefined ? config.multiplier : 1.0;
    let multiplied = Number((rawScore * mult).toFixed(2));

    if (config.maxScore !== undefined && config.maxScore > 0) {
      multiplied = Math.min(config.maxScore, multiplied);
    }

    const override: ScoreOverrideRecord | null = overrides[team.id] || null;
    let finalScore = multiplied;

    if (override) {
      if (override.type === 'override') {
        finalScore = Number(override.value.toFixed(2));
      } else if (override.type === 'bonus') {
        finalScore = Number((multiplied + override.value).toFixed(2));
      } else if (override.type === 'penalty') {
        finalScore = Number(Math.max(0, multiplied - override.value).toFixed(2));
      }
    }

    result[team.id] = {
      teamId: team.id,
      round: 'r3',
      score: finalScore,
      rawScore,
      maximumScore: config.maxScore,
      scoringBreakdown: {
        solvedCount,
        baseProblemPoints,
        minimizationBonus,
        totalCharCount,
        minimizationMethod: config.minimizationMethod,
        solvedProblems: solvedProblemsBreakdown,
        multiplier: mult,
        maxScore: config.maxScore
      },
      manualOverride: override,
      updatedAt: Date.now()
    };
  });

  return result;
}

/**
 * Server-authoritative Round 4 scoring calculator.
 * Sequential challenge points, speed bonuses, failed attempt penalties, and overrides.
 */
export function calculateRound4Score(
  teamId: string,
  store: any,
  config: Round4ScoringConfig
): RoundScoreRecord {
  const crackProgress = store.crackProgress?.[teamId] || {
    completedChallengeIds: [],
    attemptsCount: {},
    totalSolved: 0,
    totalTimeSeconds: 0
  };
  const crackChallenges = store.crackChallenges || {};
  const crackAttempts = (store.crackAttempts || []).filter((a: any) => a.teamId === teamId);
  const overrides = config.overrides || {};

  let challengePointsEarned = 0;
  const completedChallenges = crackProgress.completedChallengeIds || [];

  completedChallenges.forEach((chId: string) => {
    const ch = crackChallenges[chId];
    const pts = config.challengePoints[chId] !== undefined
      ? config.challengePoints[chId]
      : (ch?.points || 20);
    challengePointsEarned += pts;
  });

  // Speed bonus
  let speedBonus = 0;
  const speedThreshold = config.speedBonusThresholdSeconds || 120;
  if (
    config.speedBonusPoints > 0 &&
    completedChallenges.length > 0 &&
    crackProgress.totalTimeSeconds > 0 &&
    crackProgress.totalTimeSeconds <= speedThreshold
  ) {
    speedBonus = config.speedBonusPoints;
  }

  // Failed attempts penalties
  let attemptPenaltyDeduction = 0;
  if (config.attemptPenalty > 0) {
    const failedAttempts = crackAttempts.filter((a: any) => !a.isCorrect).length;
    attemptPenaltyDeduction = failedAttempts * config.attemptPenalty;
  }

  const rawScore = Math.max(0, Number((challengePointsEarned + speedBonus - attemptPenaltyDeduction).toFixed(2)));
  const mult = config.multiplier !== undefined ? config.multiplier : 1.0;
  let multiplied = Number((rawScore * mult).toFixed(2));

  if (config.maxScore !== undefined && config.maxScore > 0) {
    multiplied = Math.min(config.maxScore, multiplied);
  }

  const override: ScoreOverrideRecord | null = overrides[teamId] || null;
  let finalScore = multiplied;

  if (override) {
    if (override.type === 'override') {
      finalScore = Number(override.value.toFixed(2));
    } else if (override.type === 'bonus') {
      finalScore = Number((multiplied + override.value).toFixed(2));
    } else if (override.type === 'penalty') {
      finalScore = Number(Math.max(0, multiplied - override.value).toFixed(2));
    }
  }

  return {
    teamId,
    round: 'r4',
    score: finalScore,
    rawScore,
    maximumScore: config.maxScore,
    scoringBreakdown: {
      solvedCount: completedChallenges.length,
      challengePointsEarned,
      speedBonus,
      attemptPenaltyDeduction,
      totalTimeSeconds: crackProgress.totalTimeSeconds || 0,
      multiplier: mult,
      maxScore: config.maxScore
    },
    manualOverride: override,
    updatedAt: Date.now()
  };
}

/**
 * Calculates all round scores for all teams and updates team records.
 * Final Score = Round 1 Score + Round 2 Score + Round 3 Score + Round 4 Score.
 * NO FIXED 100 POINTS LIMIT.
 */
export function recalculateAllScores(
  store: any,
  config: MasterScoringConfig
): {
  roundScores: Record<string, Record<'r1' | 'r2' | 'r3' | 'r4', RoundScoreRecord>>;
} {
  const teams: Team[] = Object.values(store.teams || {});
  const roundScores: Record<string, Record<'r1' | 'r2' | 'r3' | 'r4', RoundScoreRecord>> = {};

  // Precompute Round 3 scores for all teams
  const r3ScoresMap = calculateRound3ScoresForAllTeams(teams, store, config.r3);

  teams.forEach(team => {
    if (!team.scores) {
      team.scores = { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
    }

    const r1Record = calculateRound1Score(team.id, store, config.r1);
    const r2Record = calculateRound2Score(team.id, store, config.r2);
    const r3Record = r3ScoresMap[team.id] || {
      teamId: team.id,
      round: 'r3',
      score: 0,
      rawScore: 0,
      scoringBreakdown: {},
      manualOverride: null,
      updatedAt: Date.now()
    };
    const r4Record = calculateRound4Score(team.id, store, config.r4);

    roundScores[team.id] = {
      r1: r1Record,
      r2: r2Record,
      r3: r3Record,
      r4: r4Record
    };

    team.scores.r1 = r1Record.score;
    team.scores.r2 = r2Record.score;
    team.scores.r3 = r3Record.score;
    team.scores.r4 = r4Record.score;

    // CORE REQUIREMENT: Final Score = R1 + R2 + R3 + R4
    team.scores.total = Number(
      (team.scores.r1 + team.scores.r2 + team.scores.r3 + team.scores.r4).toFixed(2)
    );
  });

  return { roundScores };
}

/**
 * Multi-criteria deterministic tie-breaking engine according to admin priority order.
 */
export function sortLeaderboard(
  teams: Team[],
  store: any,
  config: MasterScoringConfig,
  roundScores: Record<string, Record<'r1' | 'r2' | 'r3' | 'r4', RoundScoreRecord>>
): LeaderboardEntry[] {
  const priorities = config.tieBreakRules?.priority || [
    'overall_score',
    'r3_score',
    'r3_problems_solved',
    'r3_char_count',
    'r4_score',
    'r4_time',
    'r1_score',
    'r2_score',
    'earliest_submission'
  ];

  const sorted = [...teams].sort((a, b) => {
    const aScores = a.scores || { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
    const bScores = b.scores || { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };

    const aR3Breakdown = roundScores[a.id]?.r3?.scoringBreakdown || {};
    const bR3Breakdown = roundScores[b.id]?.r3?.scoringBreakdown || {};

    const aR4Breakdown = roundScores[a.id]?.r4?.scoringBreakdown || {};
    const bR4Breakdown = roundScores[b.id]?.r4?.scoringBreakdown || {};

    for (const rule of priorities) {
      if (rule === 'overall_score') {
        const diff = (bScores.total || 0) - (aScores.total || 0);
        if (Math.abs(diff) > 0.001) return diff;
      } else if (rule === 'r3_score') {
        const diff = (bScores.r3 || 0) - (aScores.r3 || 0);
        if (Math.abs(diff) > 0.001) return diff;
      } else if (rule === 'r3_problems_solved') {
        const diff = (bR3Breakdown.solvedCount || 0) - (aR3Breakdown.solvedCount || 0);
        if (diff !== 0) return diff;
      } else if (rule === 'r3_char_count') {
        // Lower is better
        const aChars = aR3Breakdown.totalCharCount || 999999;
        const bChars = bR3Breakdown.totalCharCount || 999999;
        if (aChars !== bChars) return aChars - bChars;
      } else if (rule === 'r4_score') {
        const diff = (bScores.r4 || 0) - (aScores.r4 || 0);
        if (Math.abs(diff) > 0.001) return diff;
      } else if (rule === 'r4_time') {
        // Lower solve time is better
        const aTime = aR4Breakdown.totalTimeSeconds || 999999;
        const bTime = bR4Breakdown.totalTimeSeconds || 999999;
        if (aTime !== bTime) return aTime - bTime;
      } else if (rule === 'r1_score') {
        const diff = (bScores.r1 || 0) - (aScores.r1 || 0);
        if (Math.abs(diff) > 0.001) return diff;
      } else if (rule === 'r2_score') {
        const diff = (bScores.r2 || 0) - (aScores.r2 || 0);
        if (Math.abs(diff) > 0.001) return diff;
      } else if (rule === 'earliest_submission') {
        // Earlier activity timestamp is better
        const aTime = a.last_active || 9999999999999;
        const bTime = b.last_active || 9999999999999;
        if (aTime !== bTime) return aTime - bTime;
      }
    }

    // Deterministic fallback by team_code
    return a.team_code.localeCompare(b.team_code);
  });

  return sorted.map((team, index) => {
    const isQualified =
      Boolean(team.qualification?.r1) &&
      Boolean(team.qualification?.r2) &&
      Boolean(team.qualification?.r3) &&
      Boolean(team.qualification?.r4);

    const r1 = team.scores?.r1 || 0;
    const r2 = team.scores?.r2 || 0;
    const r3 = team.scores?.r3 || 0;
    const r4 = team.scores?.r4 || 0;
    const total = team.scores?.total || 0;

    const rScores: Record<string, any> = roundScores[team.id] || {};

    return {
      rank: index + 1,
      teamId: team.id,
      teamName: team.name,
      teamCode: team.team_code,
      status: team.status,
      isOnline: team.is_online,
      r1Score: r1,
      r2Score: r2,
      r3Score: r3,
      r4Score: r4,
      totalScore: total,
      totalWeightedScore: total,
      scores: {
        r1,
        r2,
        r3,
        r4,
        total
      },
      breakdowns: {
        r1: rScores.r1?.scoringBreakdown,
        r2: rScores.r2?.scoringBreakdown,
        r3: rScores.r3?.scoringBreakdown,
        r4: rScores.r4?.scoringBreakdown
      },
      tieBreakDetails: {
        r3Solved: rScores.r3?.scoringBreakdown?.solvedCount,
        r3CharCount: rScores.r3?.scoringBreakdown?.totalCharCount,
        r4Solved: rScores.r4?.scoringBreakdown?.solvedCount,
        r4Time: rScores.r4?.scoringBreakdown?.totalTimeSeconds,
        lastActive: team.last_active
      },
      isQualified
    };
  });
}
