export type EventStatus = 'WAITING' | 'LIVE' | 'PAUSED' | 'ENDED' | 'DRAFT';

export type ContestStage =
  | 'LOBBY'
  | 'R1_INSTRUCTIONS'
  | 'R1_PRACTICE'
  | 'R1_TEST'
  | 'R1_RESULTS'
  | 'R2_INSTRUCTIONS'
  | 'R2_PHASE_1'
  | 'R2_PHASE_2'
  | 'R2_PHASE_3'
  | 'R2_QUIZ'
  | 'R2_RESULTS'
  | 'LUNCH_BREAK'
  | 'R3_INSTRUCTIONS'
  | 'R3_CODE'
  | 'R3_RESULTS'
  | 'R4_INSTRUCTIONS'
  | 'R4_CRACK'
  | 'R4_RESULTS'
  | 'FINAL_RESULTS'
  | 'PAUSED'
  | 'ENDED'
  // Compatibility aliases
  | 'ROUND_1_INSTRUCTIONS'
  | 'ROUND_1_PRACTICE'
  | 'ROUND_1_TEST'
  | 'ROUND_1_RESULTS'
  | 'ROUND_2_INSTRUCTIONS'
  | 'ROUND_2_PHASE_1'
  | 'ROUND_2_PHASE_2'
  | 'ROUND_2_PHASE_3'
  | 'ROUND_2_QUIZ'
  | 'ROUND_2_RESULTS'
  | 'ROUND_3_INSTRUCTIONS'
  | 'ROUND_3_CODE'
  | 'ROUND_3_RESULTS'
  | 'ROUND_4_INSTRUCTIONS'
  | 'ROUND_4_CRACK'
  | 'ROUND_4_RESULTS'
  | 'ROUND_2_ACTIVE'
  | 'ROUND_3_ACTIVE'
  | 'ROUND_4_ACTIVE'
  | 'CONTEST_ENDED';

export type TeamStatus = 'registered' | 'active' | 'locked' | 'disqualified';

export interface Team {
  id: string;
  team_code: string;
  name: string;
  status: TeamStatus;
  session_token: string | null;
  last_active: number;
  is_online: boolean;
  disqualified_reason?: string;
  fullscreenWarnings?: { r1: number; r2: number; r3: number; r4: number };
  scores: {
    r1: number;
    r2: number;
    r3: number;
    r4: number;
    total: number;
  };
  qualification: {
    r1: boolean;
    r2: boolean;
    r3: boolean;
    r4: boolean;
  };
}

export interface TeamCode {
  code: string;
  status: 'unused' | 'claimed' | 'revoked';
  claimed_by_team_id: string | null;
  claimed_by_team_name?: string | null;
  created_at: number;
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  durationSeconds: number;
  remainingSeconds: number;
  startedAt: number | null;
  endsAt: number | null;
}

// Master Scoring Engine Types
export type TieBreakCriterion =
  | 'overall_score'
  | 'r3_score'
  | 'r3_problems_solved'
  | 'r3_char_count'
  | 'r4_score'
  | 'r4_time'
  | 'r1_score'
  | 'r2_score'
  | 'earliest_submission';

export interface ScoreOverrideRecord {
  id: string;
  teamId: string;
  round: 'r1' | 'r2' | 'r3' | 'r4';
  type: 'override' | 'bonus' | 'penalty';
  value: number;
  reason: string;
  adminUser: string;
  timestamp: number;
}

export interface RoundScoreRecord {
  teamId: string;
  round: 'r1' | 'r2' | 'r3' | 'r4';
  score: number;
  rawScore: number;
  maximumScore?: number;
  scoringBreakdown: any;
  rank?: number;
  manualOverride: ScoreOverrideRecord | null;
  updatedAt: number;
}

export interface Round1ScoringConfig {
  scoringMethod: Round1ScoringMethod;
  subroundWeights: Record<string, number>;
  multiplier: number;
  maxScore?: number;
  overrides: Record<string, ScoreOverrideRecord>;
}

export interface Round2ScoringConfig {
  defaultEasyPoints: number;
  defaultMediumPoints: number;
  defaultHardPoints: number;
  pointsPerQuestion?: {
    easy: number;
    medium: number;
    hard: number;
  };
  questionPointsOverride: Record<string, number>;
  incorrectPenalty: number;
  multiplier: number;
  maxScore?: number;
  overrides: Record<string, ScoreOverrideRecord>;
}

export type CodeMinimizationMethod = 'rank_bonus' | 'percentage' | 'threshold' | 'bonus_points' | 'tie_breaker_only';

export interface Round3ScoringConfig {
  problemPoints: Record<string, number>;
  minimizationMethod: CodeMinimizationMethod;
  rankBonuses: number[];
  thresholdChars?: number;
  thresholdBonus?: number;
  multiplier: number;
  maxScore?: number;
  overrides: Record<string, ScoreOverrideRecord>;
}

export interface Round4ScoringConfig {
  challengePoints: Record<string, number>;
  speedBonusThresholdSeconds: number;
  speedBonusPoints: number;
  attemptPenalty: number;
  multiplier: number;
  maxScore?: number;
  overrides: Record<string, ScoreOverrideRecord>;
}

export interface MasterScoringConfig {
  r1: Round1ScoringConfig;
  r2: Round2ScoringConfig;
  r3: Round3ScoringConfig;
  r4: Round4ScoringConfig;
  tieBreakRules: {
    priority: TieBreakCriterion[];
  };
  maxScores?: {
    r1?: number;
    r2?: number;
    r3?: number;
    r4?: number;
  };
}

export interface ContestState {
  eventStatus: EventStatus;
  currentRound: string;
  currentStage: ContestStage;
  currentTypingRound?: string;
  activeQuestion?: string | null;
  timerStartedAt?: number | null;
  timerDuration?: number;
  leaderboardVisible?: boolean;

  stageTitle: string;
  isEmergencyLocked: boolean;
  timer: TimerState;
  // Sub-stage references
  currentTypingRoundId: string;
  currentQuizQuestionId: string | null;
  currentQuizPhase?: number;
  currentCodingProblemId: string;
  isLeaderboardVisibleToTeams: boolean;
  isLeaderboardFrozen: boolean;
  weights: {
    r1: number;
    r2: number;
    r3: number;
    r4: number;
  };
  activeAnnouncement: Announcement | null;
}

// ROUND 1: Fastest Fingers First
export type Round1ScoringMethod = 'best' | 'average' | 'total' | 'weighted';

export interface TypingRound {
  id: string;
  title: string;
  order: number;
  practicePassage: string;
  mainPassage: string;
  testDurationSeconds: number;
  minAccuracyPercent: number;
  weight?: number;
  scoringMultiplier: number;
  isPublished?: boolean;
  createdAt?: number;
}

export interface TypingSubmission {
  id: string;
  teamId: string;
  teamName: string;
  typingRoundId: string;
  isPractice: boolean;
  wpm: number;
  accuracy: number;
  charsTyped: number;
  correctChars: number;
  incorrectChars: number;
  timeTakenSeconds: number;
  score: number;
  submittedAt: number;
}

export interface TypingScoreOverride {
  id: string;
  teamId: string;
  typingRoundId?: string; // specific round or 'GLOBAL'
  type: 'override' | 'bonus' | 'penalty' | 'reset';
  value: number;
  originalScore: number;
  adjustedScore: number;
  note: string;
  adminUser: string;
  updatedAt: number;
}

export interface Round1Config {
  scoringMethod: Round1ScoringMethod;
  weights: Record<string, number>;
  minAccuracyDefault: number;
  scoreOverrides: Record<string, TypingScoreOverride>;
}

export interface TeamTypingStats {
  teamId: string;
  teamName: string;
  teamCode: string;
  subroundScores: Record<string, {
    attemptCount: number;
    practiceWpm?: number;
    practiceAccuracy?: number;
    testWpm?: number;
    testAccuracy?: number;
    testScore?: number;
    testSubmittedAt?: number;
  }>;
  calculatedScore: number;
  overrideScore?: number;
  finalRound1Score: number;
  overrideInfo?: TypingScoreOverride;
}

// ROUND 2: Byte-Sized Brains
export type QuestionType = 'mcq' | 'multi_select' | 'true_false' | 'fill_blank' | 'code_output';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionCategory = string;

export interface QuizStage {
  id: string;
  stageNumber: number;
  title: string;
  description: string;
  order: number;
}

export interface QuizQuestion {
  id: string;
  stageNumber: number; // 1: Easy, 2: Medium, 3: Hard
  category: QuestionCategory;
  type: QuestionType;
  questionText: string;
  codeSnippet?: string;
  options: string[];
  correctAnswer: string | string[] | boolean;
  difficulty: QuestionDifficulty;
  points: number;
  timeLimitSeconds: number;
  explanation?: string;
  order: number;
  isVoided: boolean;
  isFullPointsAwarded: boolean;
}

export interface QuizSubmission {
  id: string;
  teamId: string;
  teamName: string;
  questionId: string;
  answer: string | string[] | boolean;
  isCorrect: boolean;
  pointsAwarded: number;
  timeTakenSeconds: number;
  submittedAt: number;
}

export interface QuizScoreOverride {
  id: string;
  teamId: string;
  type: 'override' | 'bonus' | 'penalty' | 'reset';
  value: number;
  originalScore: number;
  adjustedScore: number;
  note: string;
  adminUser: string;
  updatedAt: number;
}

export interface QuizPhaseConfig {
  phaseNumber: number;
  title: string;
  difficulty: QuestionDifficulty;
  questionCount: number;
  defaultPoints: number;
  timePerQuestionSeconds: number;
}

export interface TeamQuizProgress {
  teamId: string;
  phaseNumber: number;
  questionIds: string[];
  currentIndex: number;
  completed: boolean;
  currentQuestionStartedAt: number;
  questionTimeLimit: number;
  pausedRemainingSeconds?: number | null;
}

export interface Round2Config {
  phases: Record<number, QuizPhaseConfig>;
  scoreOverrides: Record<string, QuizScoreOverride>;
}

export interface TeamQuizStats {
  teamId: string;
  teamName: string;
  teamCode: string;
  totalSubmissions: number;
  correctSubmissions: number;
  accuracy: number;
  totalTimeTaken: number;
  stageScores: Record<number, number>;
  categoryScores: Record<string, number>;
  calculatedScore: number;
  overrideScore?: number;
  finalRound2Score: number;
  overrideInfo?: QuizScoreOverride;
}

// ROUND 3: Code Minimalist
export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  explanation?: string;
}

export interface CodingProblem {
  id: string;
  order?: number;
  problemNumber?: number;
  title: string;
  description: string;
  statement?: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  points?: number;
  timeLimitSeconds: number;
  memoryLimitMb?: number;
  allowedLanguages: string[];
  boilerplates?: Record<string, string>;
  visibleTestCases?: TestCase[];
  sampleTestCases: TestCase[];
  hiddenTestCases: TestCase[];
  explanation?: string;
  isEnabled?: boolean;
  prohibitedKeywords: string[];
  rankingMetric: 'characters' | 'lines' | 'normalized';
  referenceLengths: Record<string, number>;
  maxSubmissions: number;
}

export interface CodeSubmission {
  id: string;
  teamId: string;
  teamName: string;
  problemId: string;
  problemTitle?: string;
  code: string;
  participantCode?: string;
  language: string;
  charCount: number;
  lineCount: number;
  executionStatus: 'passed' | 'failed' | 'compile_error' | 'timeout' | 'rejected';
  compileError?: string;
  testResults: {
    passed: boolean;
    input: string;
    expected: string;
    actual: string;
    actualOutput?: string;
    expectedOutput?: string;
    executionTimeMs: number;
    isHidden?: boolean;
    error?: string;
  }[];
  allPassed: boolean;
  score: number;
  isAccepted: boolean;
  overrideScore?: number;
  submittedAt: number;
}

// ROUND 4: Crack & Compete
export type PuzzleType = 'cipher' | 'regex' | 'binary_hex' | 'algo_logic' | 'reverse_eng';

export interface CrackChallenge {
  id: string;
  order: number;
  title: string;
  puzzleType: PuzzleType;
  prompt: string;
  cipherText?: string;
  codeOrData?: string;
  hintAfterSolve: string;
  hintFromPrevious?: string;
  correctAnswer: string;
  acceptedVariations?: string[];
  points: number;
  isManuallyUnlockedForEveryone?: boolean;
  isCompleted?: boolean;
  isCurrent?: boolean;
  isLocked?: boolean;
}

export interface CrackProgress {
  teamId: string;
  teamName: string;
  currentChallengeIndex: number;
  completedChallengeIds: string[];
  unlockedHints: { challengeId: string; hint: string }[];
  attemptsCount: Record<string, number>;
  totalSolved: number;
  lastSolveTimestamp: number | null;
  totalTimeSeconds: number;
}

export interface CrackAttempt {
  id: string;
  teamId: string;
  teamName: string;
  challengeId: string;
  submittedAnswer: string;
  isCorrect: boolean;
  timestamp: number;
}

// Leaderboard & Scoring
export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  teamCode: string;
  status: TeamStatus;
  isOnline: boolean;
  r1Score: number;
  r2Score: number;
  r3Score: number;
  r4Score: number;
  totalScore: number;
  totalWeightedScore?: number;
  scores?: {
    r1: number;
    r2: number;
    r3: number;
    r4: number;
    total: number;
  };
  breakdowns?: {
    r1?: any;
    r2?: any;
    r3?: any;
    r4?: any;
  };
  tieBreakDetails?: {
    r3Solved?: number;
    r3CharCount?: number;
    r4Solved?: number;
    r4Time?: number;
    lastActive?: number;
  };
  isQualified: boolean;
  scoreOverride?: number;
  rankOverride?: number;
}

// Announcements
export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'urgent';
  target: 'all' | string[]; // 'all' or array of team IDs
  createdAt: number;
  isActive: boolean;
}

// Audit Logs
export interface AuditLog {
  id: string;
  adminUser: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: string;
  newValue: string;
  timestamp: number;
}

// Real-Time Socket Messages
export type WSClientMessage =
  | { type: 'AUTH_TEAM'; token: string }
  | { type: 'AUTH_ADMIN'; token: string }
  | { type: 'PING' }
  | { type: 'TYPING_UPDATE'; roundId: string; wpm: number; accuracy: number; chars: number }
  | { type: 'SUBMIT_TYPING'; data: Partial<TypingSubmission> }
  | { type: 'SUBMIT_QUIZ'; questionId: string; answer: string | string[] | boolean; timeTaken: number }
  | { type: 'RUN_CODE'; problemId: string; code: string; language: string }
  | { type: 'SUBMIT_CODE'; problemId: string; code: string; language: string }
  | { type: 'SUBMIT_CRACK'; challengeId: string; answer: string };

export type WSServerMessage =
  | { type: 'STATE_SYNC'; state: ContestState }
  | { type: 'TIMER_TICK'; remainingSeconds: number; isRunning: boolean; isPaused: boolean }
  | { type: 'ANNOUNCEMENT'; announcement: Announcement | null }
  | { type: 'FORCE_LOGOUT'; reason: string }
  | { type: 'TEAM_STATUS_UPDATE'; team: Team }
  | { type: 'LEADERBOARD_UPDATE'; leaderboard: LeaderboardEntry[] }
  | { type: 'SCORING_UPDATE'; scoringConfig: MasterScoringConfig }
  | { type: 'CRACK_PROGRESS_UPDATE'; progress: CrackProgress }
  | { type: 'AUDIT_LOG_ENTRY'; log: AuditLog };
