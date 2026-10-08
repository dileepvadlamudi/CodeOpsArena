import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Team,
  TeamCode,
  TypingRound,
  TypingSubmission,
  TypingScoreOverride,
  Round1Config,
  Round1ScoringMethod,
  TeamTypingStats,
  QuizStage,
  QuizQuestion,
  QuizSubmission,
  QuizScoreOverride,
  QuizPhaseConfig,
  TeamQuizProgress,
  Round2Config,
  TeamQuizStats,
  CodingProblem,
  CodeSubmission,
  CrackChallenge,
  CrackProgress,
  CrackAttempt,
  Announcement,
  AuditLog,
  ContestState,
  LeaderboardEntry,
  MasterScoringConfig,
  RoundScoreRecord,
  ScoreOverrideRecord
} from '../src/types/contest';
import { executeCode, DEFAULT_BOILERPLATES, getFullBoilerplate } from './codeRunner';
import {
  getDefaultMasterScoringConfig,
  recalculateAllScores,
  sortLeaderboard
} from './scoringEngine';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'codex_store.json');

export interface DBStore {
  adminToken: string;
  adminTokens?: string[];
  adminPasswordHash: string;
  teamCodes: Record<string, TeamCode>;
  teams: Record<string, Team>;
  typingRounds: Record<string, TypingRound>;
  typingSubmissions: TypingSubmission[];
  round1Config: Round1Config;
  quizStages: Record<string, QuizStage>;
  quizQuestions: Record<string, QuizQuestion>;
  quizSubmissions: QuizSubmission[];
  round2Config: Round2Config;
  teamQuizProgress: Record<string, Record<number, TeamQuizProgress>>;
  codingProblems: Record<string, CodingProblem>;
  codeSubmissions: CodeSubmission[];
  crackChallenges: Record<string, CrackChallenge>;
  crackProgress: Record<string, CrackProgress>;
  crackAttempts: CrackAttempt[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
  contestState: ContestState;
  masterScoringConfig: MasterScoringConfig;
  roundScores: Record<string, Record<'r1' | 'r2' | 'r3' | 'r4', RoundScoreRecord>>;
}

function getInitialStore(): DBStore {
  const initialTypingRounds: Record<string, TypingRound> = {
    'tr-1': {
      id: 'tr-1',
      title: 'Typing Sub-Round 1: Algorithmic Foundations',
      order: 1,
      practicePassage: 'Quick algorithms conquer complex problems. Binary search executes in logarithmic time complexity, dividing the sorted search space in halves.',
      mainPassage: 'Modern software engineering demands high mechanical keyboard precision alongside sharp logical problem solving. Graph traversal algorithms such as Dijkstra and Breadth-First Search explore nodes systematically, maintaining visited sets and priority queues to compute optimal paths with zero wasted CPU cycles.',
      testDurationSeconds: 120,
      minAccuracyPercent: 85,
      weight: 1.0,
      scoringMultiplier: 1.0,
      isPublished: true,
      createdAt: Date.now() - 3600000
    },
    'tr-2': {
      id: 'tr-2',
      title: 'Typing Sub-Round 2: Distributed Systems & Consensus',
      order: 2,
      practicePassage: 'Distributed state machines replicate transaction logs across fault-tolerant clusters to ensure consistency during network partitions.',
      mainPassage: 'In Byzantine fault-tolerant networks, decentralized nodes coordinate state transitions via cryptographic signatures and quorum voting. Raft consensus simplifies cluster leadership election and log append operations, guaranteeing safety invariants even when arbitrary nodes experience transient latency.',
      testDurationSeconds: 90,
      minAccuracyPercent: 88,
      weight: 1.0,
      scoringMultiplier: 1.2,
      isPublished: true,
      createdAt: Date.now() - 3600000
    }
  };

  const initialRound1Config: Round1Config = {
    scoringMethod: 'best',
    weights: {
      'tr-1': 1.0,
      'tr-2': 1.0
    },
    minAccuracyDefault: 85,
    scoreOverrides: {}
  };

  const initialQuizStages: Record<string, QuizStage> = {
    'stage-1': {
      id: 'stage-1',
      stageNumber: 1,
      title: 'Stage 1: Syntax Sprint & Output Prediction',
      description: 'Foundational language semantics, type coercion, operator precedence, and memory basics.',
      order: 1
    },
    'stage-2': {
      id: 'stage-2',
      stageNumber: 2,
      title: 'Stage 2: Core Architecture & Database Mastery',
      description: 'ACID transaction properties, B-Tree vs LSM indexing, asynchronous queues, and scoping.',
      order: 2
    },
    'stage-3': {
      id: 'stage-3',
      stageNumber: 3,
      title: 'Stage 3: Deep Systems & Advanced Concepts',
      description: 'Bitwise manipulation, consensus models, OS page replacement, and low-level runtime execution.',
      order: 3
    }
  };

  const initialRound2Config: Round2Config = {
    phases: {
      1: {
        phaseNumber: 1,
        title: 'Phase 1 — Easy',
        difficulty: 'EASY',
        questionCount: 5,
        defaultPoints: 2,
        timePerQuestionSeconds: 30
      },
      2: {
        phaseNumber: 2,
        title: 'Phase 2 — Medium',
        difficulty: 'MEDIUM',
        questionCount: 5,
        defaultPoints: 4,
        timePerQuestionSeconds: 45
      },
      3: {
        phaseNumber: 3,
        title: 'Phase 3 — Hard',
        difficulty: 'HARD',
        questionCount: 5,
        defaultPoints: 6,
        timePerQuestionSeconds: 60
      }
    },
    scoreOverrides: {}
  };

  const initialQuizQuestions: Record<string, QuizQuestion> = {
    // PHASE 1 (EASY)
    'q-1': {
      id: 'q-1',
      stageNumber: 1,
      category: 'Programming Languages',
      type: 'code_output',
      questionText: 'What is the exact output of this JavaScript snippet?',
      codeSnippet: `console.log(typeof NaN === "number" && 3 + "3" - 1);`,
      options: ['true', '32', '"32"', 'NaN'],
      correctAnswer: '32',
      difficulty: 'EASY',
      points: 2,
      timeLimitSeconds: 30,
      explanation: 'typeof NaN is "number" (true). 3 + "3" coerces to string "33". "33" - 1 coerces to number 32. true && 32 evaluates to 32.',
      order: 1,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-2': {
      id: 'q-2',
      stageNumber: 1,
      category: 'Computer Fundamentals',
      type: 'mcq',
      questionText: 'Which cache replacement policy removes the item that was accessed longest ago?',
      options: ['FIFO (First In First Out)', 'LRU (Least Recently Used)', 'LFU (Least Frequently Used)', 'MRU (Most Recently Used)'],
      correctAnswer: 'LRU (Least Recently Used)',
      difficulty: 'EASY',
      points: 2,
      timeLimitSeconds: 30,
      explanation: 'LRU discards the least recently used items first.',
      order: 2,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-3': {
      id: 'q-3',
      stageNumber: 1,
      category: 'Databases',
      type: 'true_false',
      questionText: 'In a relational database, a B-Tree index has an average search time complexity of O(log N).',
      options: ['True', 'False'],
      correctAnswer: 'True',
      difficulty: 'EASY',
      points: 2,
      timeLimitSeconds: 30,
      explanation: 'B-Trees and B+ Trees provide logarithmic search, insertion, and deletion times.',
      order: 3,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-7': {
      id: 'q-7',
      stageNumber: 1,
      category: 'Web & Systems',
      type: 'mcq',
      questionText: 'Which HTTP status code indicates that the server cannot find the requested resource?',
      options: ['401 Unauthorized', '403 Forbidden', '404 Not Found', '500 Internal Server Error'],
      correctAnswer: '404 Not Found',
      difficulty: 'EASY',
      points: 2,
      timeLimitSeconds: 30,
      explanation: '404 Not Found indicates the origin server did not find a current representation for the target resource.',
      order: 4,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-10': {
      id: 'q-10',
      stageNumber: 1,
      category: 'Programming Languages',
      type: 'true_false',
      questionText: 'In Python, tuples are immutable while lists are mutable.',
      options: ['True', 'False'],
      correctAnswer: 'True',
      difficulty: 'EASY',
      points: 2,
      timeLimitSeconds: 30,
      explanation: 'Tuples cannot be modified after instantiation, unlike lists.',
      order: 5,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-11': {
      id: 'q-11',
      stageNumber: 1,
      category: 'General Technology Awareness',
      type: 'fill_blank',
      questionText: 'What Git command records staged snapshots permanently into the repository version history?',
      options: [],
      correctAnswer: 'git commit',
      difficulty: 'EASY',
      points: 2,
      timeLimitSeconds: 30,
      explanation: 'git commit captures a snapshot of the project currently staged changes.',
      order: 6,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-12': {
      id: 'q-12',
      stageNumber: 1,
      category: 'Databases',
      type: 'mcq',
      questionText: 'Which SQL clause is used to filter aggregated group records?',
      options: ['WHERE', 'HAVING', 'GROUP BY', 'ORDER BY'],
      correctAnswer: 'HAVING',
      difficulty: 'EASY',
      points: 2,
      timeLimitSeconds: 30,
      explanation: 'HAVING filters aggregated groups, whereas WHERE filters individual rows prior to grouping.',
      order: 7,
      isVoided: false,
      isFullPointsAwarded: false
    },

    // PHASE 2 (MEDIUM)
    'q-4': {
      id: 'q-4',
      stageNumber: 2,
      category: 'Databases',
      type: 'multi_select',
      questionText: 'Which of the following ACID transaction properties guarantee that incomplete transactions are completely rolled back upon system crash?',
      options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
      correctAnswer: ['Atomicity', 'Durability'],
      difficulty: 'MEDIUM',
      points: 4,
      timeLimitSeconds: 45,
      explanation: 'Atomicity ensures all-or-nothing completion; Durability guarantees committed data persists across failures.',
      order: 8,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-5': {
      id: 'q-5',
      stageNumber: 2,
      category: 'Programming Languages',
      type: 'code_output',
      questionText: 'What does this Python list comprehension evaluate to?',
      codeSnippet: `nums = [1, 2, 3, 4]
res = [x * 2 for x in nums if x % 2 == 0]
print(sum(res))`,
      options: ['12', '6', '20', '8'],
      correctAnswer: '12',
      difficulty: 'MEDIUM',
      points: 4,
      timeLimitSeconds: 45,
      explanation: 'Even elements are 2 and 4. Multiplied by 2: [4, 8]. Sum is 12.',
      order: 9,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-8': {
      id: 'q-8',
      stageNumber: 2,
      category: 'Web & Systems',
      type: 'mcq',
      questionText: 'In the Node.js event loop, when are microtasks and callbacks queued via process.nextTick resolved?',
      options: [
        'Immediately after the current synchronous operation, before transitioning to any other phase',
        'Inside the Poll phase only',
        'During the Timers phase before setTimeout callbacks',
        'Exclusively during the Close Callbacks phase'
      ],
      correctAnswer: 'Immediately after the current synchronous operation, before transitioning to any other phase',
      difficulty: 'MEDIUM',
      points: 4,
      timeLimitSeconds: 45,
      explanation: 'The process.nextTick queue is drained immediately after the current operation finishes, before entering the next phase of the event loop.',
      order: 10,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-13': {
      id: 'q-13',
      stageNumber: 2,
      category: 'Computer Fundamentals',
      type: 'mcq',
      questionText: 'What is the worst-case time complexity for searching in an unbalanced Binary Search Tree of N elements?',
      options: ['O(log N)', 'O(1)', 'O(N)', 'O(N log N)'],
      correctAnswer: 'O(N)',
      difficulty: 'MEDIUM',
      points: 4,
      timeLimitSeconds: 45,
      explanation: 'In the worst case (skewed degenerate tree), a BST behaves like a linked list with O(N) search.',
      order: 11,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-14': {
      id: 'q-14',
      stageNumber: 2,
      category: 'Web & Systems',
      type: 'multi_select',
      questionText: 'Which HTTP request methods are strictly defined as idempotent according to RFC 7231?',
      options: ['GET', 'PUT', 'DELETE', 'POST'],
      correctAnswer: ['GET', 'PUT', 'DELETE'],
      difficulty: 'MEDIUM',
      points: 4,
      timeLimitSeconds: 45,
      explanation: 'GET, PUT, and DELETE are idempotent. POST is not idempotent.',
      order: 12,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-15': {
      id: 'q-15',
      stageNumber: 2,
      category: 'Databases',
      type: 'fill_blank',
      questionText: 'In database normalization, what normal form eliminates transitive dependencies among non-prime attributes?',
      options: [],
      correctAnswer: '3NF',
      difficulty: 'MEDIUM',
      points: 4,
      timeLimitSeconds: 45,
      explanation: 'Third Normal Form (3NF) requires 2NF and that no non-prime attribute depends transitively on any candidate key.',
      order: 13,
      isVoided: false,
      isFullPointsAwarded: false
    },

    // PHASE 3 (HARD)
    'q-6': {
      id: 'q-6',
      stageNumber: 3,
      category: 'General Technology Awareness',
      type: 'fill_blank',
      questionText: 'What is the standard name of the cryptographic consensus mechanism introduced by Bitcoin that requires computational hashing work?',
      options: [],
      correctAnswer: 'Proof of Work',
      difficulty: 'HARD',
      points: 6,
      timeLimitSeconds: 60,
      explanation: 'Proof of Work (PoW) is the consensus mechanism.',
      order: 14,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-9': {
      id: 'q-9',
      stageNumber: 3,
      category: 'Computer Fundamentals',
      type: 'code_output',
      questionText: 'What is the decimal output of the bitwise expression: (1 << 5) | (1 << 2)?',
      options: ['36', '34', '32', '38'],
      correctAnswer: '36',
      difficulty: 'HARD',
      points: 6,
      timeLimitSeconds: 60,
      explanation: '(1 << 5) is 32 (binary 100000). (1 << 2) is 4 (binary 100). Bitwise OR gives 36 (binary 100100).',
      order: 15,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-16': {
      id: 'q-16',
      stageNumber: 3,
      category: 'Web & Systems',
      type: 'mcq',
      questionText: 'In distributed systems consensus, what problem does the Raft consensus algorithm split into distinct subproblems?',
      options: [
        'Leader Election, Log Replication, and Safety',
        'Sharding, Master Election, and Quorum Hashing',
        'Gossip Propagation, Partitioning, and Anti-entropy',
        'Merkle Tree verification, Staking, and Slashing'
      ],
      correctAnswer: 'Leader Election, Log Replication, and Safety',
      difficulty: 'HARD',
      points: 6,
      timeLimitSeconds: 60,
      explanation: 'Raft decomposes distributed consensus into leader election, log replication, and safety invariants for understandability.',
      order: 16,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-17': {
      id: 'q-17',
      stageNumber: 3,
      category: 'Computer Fundamentals',
      type: 'mcq',
      questionText: 'In an operating system virtual memory architecture, what causes a Page Fault interrupt?',
      options: [
        'Accessing a page whose Present bit in the Page Table Entry is 0',
        'A physical RAM parity failure',
        'Executing an unprivileged instruction in kernel mode',
        'Exceeding maximum CPU instruction cache size'
      ],
      correctAnswer: 'Accessing a page whose Present bit in the Page Table Entry is 0',
      difficulty: 'HARD',
      points: 6,
      timeLimitSeconds: 60,
      explanation: 'A page fault is an MMU hardware trap raised when a program accesses a page marked not present in physical RAM.',
      order: 17,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-18': {
      id: 'q-18',
      stageNumber: 3,
      category: 'Databases',
      type: 'true_false',
      questionText: 'In Two-Phase Locking (2PL), once a transaction releases any lock, it can never acquire any subsequent lock.',
      options: ['True', 'False'],
      correctAnswer: 'True',
      difficulty: 'HARD',
      points: 6,
      timeLimitSeconds: 60,
      explanation: 'Strict 2PL divides execution into an expanding/growing phase and a shrinking phase. No new locks can be acquired in the shrinking phase.',
      order: 18,
      isVoided: false,
      isFullPointsAwarded: false
    },
    'q-19': {
      id: 'q-19',
      stageNumber: 3,
      category: 'Programming Languages',
      type: 'code_output',
      questionText: 'What is the output of evaluating this JavaScript expression: [1, 2, 3] + [4, 5, 6]?',
      options: ['"1,2,34,5,6"', '[1, 2, 3, 4, 5, 6]', 'NaN', 'TypeError'],
      correctAnswer: '"1,2,34,5,6"',
      difficulty: 'HARD',
      points: 6,
      timeLimitSeconds: 60,
      explanation: 'Both arrays coerce to strings: "1,2,3" + "4,5,6" = "1,2,34,5,6".',
      order: 19,
      isVoided: false,
      isFullPointsAwarded: false
    }
  };

  const initialCodingProblems: Record<string, CodingProblem> = {
    'prob-1': {
      id: 'prob-1',
      order: 1,
      problemNumber: 1,
      title: 'Problem 1: Run-Length Compression (Code Minimalist)',
      description: 'Write a program that takes a single line string of lowercase English letters from standard input and prints the run-length compressed version. For example, "aaabbc" becomes "a3b2c1". Your objective is to submit the shortest working code in characters.',
      statement: 'Write a program that takes a single line string of lowercase English letters from standard input and prints the run-length compressed version. For example, "aaabbc" becomes "a3b2c1". Your objective is to submit the shortest working code in characters.',
      inputFormat: 'A single non-empty string S containing lowercase letters a-z.',
      outputFormat: 'Print the run-length encoded string followed by a newline.',
      constraints: '1 <= |S| <= 1000',
      difficulty: 'Easy',
      points: 100,
      timeLimitSeconds: 2,
      memoryLimitMb: 256,
      allowedLanguages: ['C', 'C++', 'Java'],
      isEnabled: true,
      boilerplates: {
        C: getFullBoilerplate('C'),
        'C++': getFullBoilerplate('C++'),
        Java: getFullBoilerplate('Java')
      },
      sampleTestCases: [
        {
          id: 'tc-1',
          input: 'aaabbc',
          expectedOutput: 'a3b2c1',
          isHidden: false,
          explanation: '3 a\'s, 2 b\'s, 1 c'
        },
        {
          id: 'tc-2',
          input: 'wwwwaaadexxxxxx',
          expectedOutput: 'w4a3d1e1x6',
          isHidden: false
        }
      ],
      visibleTestCases: [
        {
          id: 'tc-1',
          input: 'aaabbc',
          expectedOutput: 'a3b2c1',
          isHidden: false,
          explanation: '3 a\'s, 2 b\'s, 1 c'
        },
        {
          id: 'tc-2',
          input: 'wwwwaaadexxxxxx',
          expectedOutput: 'w4a3d1e1x6',
          isHidden: false
        }
      ],
      hiddenTestCases: [
        {
          id: 'tc-h1',
          input: 'z',
          expectedOutput: 'z1',
          isHidden: true
        },
        {
          id: 'tc-h2',
          input: 'codexclub',
          expectedOutput: 'c1o1d1e1x1c1l1u1b1',
          isHidden: true
        },
        {
          id: 'tc-h3',
          input: 'aaaaabbbbbcccccdddddeeeee',
          expectedOutput: 'a5b5c5d5e5',
          isHidden: true
        }
      ],
      prohibitedKeywords: ['system', 'fork', 'exec'],
      rankingMetric: 'characters',
      referenceLengths: {
        'C++': 140,
        'C': 150,
        'Java': 180
      },
      maxSubmissions: 20
    },
    'prob-2': {
      id: 'prob-2',
      order: 2,
      problemNumber: 2,
      title: 'Problem 2: Matrix Diagonal Sum Reducer',
      description: 'Given an integer N followed by an N x N matrix of integers on subsequent lines, output the sum of both the primary and secondary diagonals. If N is odd, count the center element only once.',
      statement: 'Given an integer N followed by an N x N matrix of integers on subsequent lines, output the sum of both the primary and secondary diagonals. If N is odd, count the center element only once.',
      inputFormat: 'First line: N. Next N lines: N space-separated integers.',
      outputFormat: 'A single integer representing the total diagonal sum.',
      constraints: '1 <= N <= 100',
      difficulty: 'Medium',
      points: 150,
      timeLimitSeconds: 2,
      memoryLimitMb: 256,
      allowedLanguages: ['C', 'C++', 'Java'],
      isEnabled: true,
      boilerplates: {
        C: getFullBoilerplate('C'),
        'C++': getFullBoilerplate('C++'),
        Java: getFullBoilerplate('Java')
      },
      sampleTestCases: [
        {
          id: 'tc-p2-1',
          input: '3\n1 2 3\n4 5 6\n7 8 9',
          expectedOutput: '25',
          isHidden: false,
          explanation: 'Primary diagonal: 1+5+9=15. Secondary: 3+5+7=15. Center 5 is shared: 15 + 15 - 5 = 25.'
        }
      ],
      visibleTestCases: [
        {
          id: 'tc-p2-1',
          input: '3\n1 2 3\n4 5 6\n7 8 9',
          expectedOutput: '25',
          isHidden: false,
          explanation: 'Primary diagonal: 1+5+9=15. Secondary: 3+5+7=15. Center 5 is shared: 15 + 15 - 5 = 25.'
        }
      ],
      hiddenTestCases: [
        {
          id: 'tc-p2-h1',
          input: '1\n42',
          expectedOutput: '42',
          isHidden: true
        },
        {
          id: 'tc-p2-h2',
          input: '2\n1 2\n3 4',
          expectedOutput: '10',
          isHidden: true
        },
        {
          id: 'tc-p2-h3',
          input: '3\n2 0 0\n0 3 0\n0 0 5',
          expectedOutput: '10',
          isHidden: true
        }
      ],
      prohibitedKeywords: ['system', 'fork', 'exec'],
      rankingMetric: 'characters',
      referenceLengths: {
        'C++': 160,
        'C': 170,
        'Java': 200
      },
      maxSubmissions: 20
    },
    'prob-3': {
      id: 'prob-3',
      order: 3,
      problemNumber: 3,
      title: 'Problem 3: Anagram Palindrome Key',
      description: 'Given a single word consisting of lowercase English letters, output "YES" if any permutation of the word can form a palindrome, or "NO" otherwise.',
      statement: 'Given a single word consisting of lowercase English letters, output "YES" if any permutation of the word can form a palindrome, or "NO" otherwise.',
      inputFormat: 'A single non-empty string of lowercase English letters.',
      outputFormat: 'Print YES or NO followed by a newline.',
      constraints: '1 <= length <= 1000',
      difficulty: 'Hard',
      points: 200,
      timeLimitSeconds: 2,
      memoryLimitMb: 256,
      allowedLanguages: ['C', 'C++', 'Java'],
      isEnabled: true,
      boilerplates: {
        C: getFullBoilerplate('C'),
        'C++': getFullBoilerplate('C++'),
        Java: getFullBoilerplate('Java')
      },
      sampleTestCases: [
        {
          id: 'tc-p3-1',
          input: 'carrace',
          expectedOutput: 'YES',
          isHidden: false,
          explanation: '"racecar" is a palindrome permutation.'
        },
        {
          id: 'tc-p3-2',
          input: 'daily',
          expectedOutput: 'NO',
          isHidden: false
        }
      ],
      visibleTestCases: [
        {
          id: 'tc-p3-1',
          input: 'carrace',
          expectedOutput: 'YES',
          isHidden: false,
          explanation: '"racecar" is a palindrome permutation.'
        },
        {
          id: 'tc-p3-2',
          input: 'daily',
          expectedOutput: 'NO',
          isHidden: false
        }
      ],
      hiddenTestCases: [
        {
          id: 'tc-p3-h1',
          input: 'aaabbbb',
          expectedOutput: 'YES',
          isHidden: true
        },
        {
          id: 'tc-p3-h2',
          input: 'code',
          expectedOutput: 'NO',
          isHidden: true
        },
        {
          id: 'tc-p3-h3',
          input: 'civic',
          expectedOutput: 'YES',
          isHidden: true
        }
      ],
      prohibitedKeywords: ['system', 'fork', 'exec'],
      rankingMetric: 'characters',
      referenceLengths: {
        'C++': 180,
        'C': 190,
        'Java': 220
      },
      maxSubmissions: 20
    }
  };

  const initialCrackChallenges: Record<string, CrackChallenge> = {
    'chk-1': {
      id: 'chk-1',
      order: 1,
      title: 'Challenge 1: The Caesar Breach',
      puzzleType: 'cipher',
      prompt: 'An encrypted transmission was intercepted from the server kernel. It was shifted using Caesar Cipher ROT-13. Decrypt the ciphertext to retrieve the authentication passphrase.',
      cipherText: 'PBQRKPYHO_2026_YVIR',
      hintAfterSolve: 'Hint for Challenge 2: The next passcode resides within standard ASCII hexadecimal stream. Notice byte pairs.',
      correctAnswer: 'CODEXCLUB_2026_LIVE',
      acceptedVariations: ['CODEXCLUB_2026_LIVE', 'codexclub_2026_live', 'CODEXCLUB-2026-LIVE', 'codexclub-2026-live'],
      points: 25
    },
    'chk-2': {
      id: 'chk-2',
      order: 2,
      title: 'Challenge 2: Hexadecimal Memory Dump',
      puzzleType: 'binary_hex',
      prompt: 'Inspect this raw byte memory dump extracted from an active socket buffer: 43 79 62 65 72 53 65 63 75 72 69 74 79. Decode the ASCII string.',
      codeOrData: '43 79 62 65 72 53 65 63 75 72 69 74 79',
      hintAfterSolve: 'Hint for Challenge 3: In the next challenge, solve the algorithmic riddle to determine the smallest positive integer.',
      correctAnswer: 'CyberSecurity',
      acceptedVariations: ['CyberSecurity', 'cybersecurity', 'CYBERSECURITY'],
      points: 35
    },
    'chk-3': {
      id: 'chk-3',
      order: 3,
      title: 'Challenge 3: Regex Pattern Vault',
      puzzleType: 'regex',
      prompt: 'Find the single token hidden in the following text that matches the pattern /^KEY-[A-Z]{3}-[0-9]{4}$/:\n"KEY-123-ABCD, KEY-ABC-2026, KEY-XYZ-9999X, KEY-CDX-4040, KEY-A1B-5555"',
      codeOrData: 'KEY-123-ABCD, KEY-ABC-2026, KEY-XYZ-9999X, KEY-CDX-4040, KEY-A1B-5555',
      hintAfterSolve: 'Hint for Challenge 4: Final Challenge! Evaluate the recursive Fibonacci sequence index.',
      correctAnswer: 'KEY-CDX-4040',
      acceptedVariations: ['KEY-CDX-4040', 'key-cdx-4040', 'KEY-ABC-2026', 'key-abc-2026'],
      points: 40
    },
    'chk-4': {
      id: 'chk-4',
      order: 4,
      title: 'Final Challenge: The Grand Algorithmic Gate',
      puzzleType: 'algo_logic',
      prompt: 'What is the exact value of F(10) where F(0)=0, F(1)=1, and F(n)=F(n-1)+F(n-2)? Submit the numerical answer to unlock the champion flag.',
      codeOrData: 'F(n) = F(n-1) + F(n-2) for n >= 2',
      hintAfterSolve: 'Congratulations! You have completed the entire Crack & Compete chain!',
      correctAnswer: '55',
      acceptedVariations: ['55', 'f(10)=55'],
      points: 50
    }
  };

  const initialTeamCodes: Record<string, TeamCode> = {
    'CDX26-A7K9P2': {
      code: 'CDX26-A7K9P2',
      status: 'claimed',
      claimed_by_team_id: 'team-warriors',
      claimed_by_team_name: 'Code Warriors',
      created_at: Date.now() - 3600000
    },
    'CDX26-F3M8Q1': {
      code: 'CDX26-F3M8Q1',
      status: 'claimed',
      claimed_by_team_id: 'team-cyber',
      claimed_by_team_name: 'CyberKnights',
      created_at: Date.now() - 3600000
    },
    'CDX26-X8L4T7': {
      code: 'CDX26-X8L4T7',
      status: 'claimed',
      claimed_by_team_id: 'team-byte',
      claimed_by_team_name: 'ByteForce',
      created_at: Date.now() - 3600000
    },
    'CDX26-B2V9N4': {
      code: 'CDX26-B2V9N4',
      status: 'unused',
      claimed_by_team_id: null,
      created_at: Date.now() - 3600000
    },
    'CDX26-K4R1W8': {
      code: 'CDX26-K4R1W8',
      status: 'unused',
      claimed_by_team_id: null,
      created_at: Date.now() - 3600000
    },
    'CDX26-M9P3Z6': {
      code: 'CDX26-M9P3Z6',
      status: 'unused',
      claimed_by_team_id: null,
      created_at: Date.now() - 3600000
    },
    'CDX26-Y5L2J1': {
      code: 'CDX26-Y5L2J1',
      status: 'unused',
      claimed_by_team_id: null,
      created_at: Date.now() - 3600000
    },
    'CDX26-Q8D6H4': {
      code: 'CDX26-Q8D6H4',
      status: 'unused',
      claimed_by_team_id: null,
      created_at: Date.now() - 3600000
    }
  };

  const initialTeams: Record<string, Team> = {
    'team-warriors': {
      id: 'team-warriors',
      team_code: 'CDX26-A7K9P2',
      name: 'Code Warriors',
      status: 'active',
      session_token: 'tok-warriors-initial',
      last_active: Date.now(),
      is_online: true,
      fullscreenWarnings: { r1: 0, r2: 0, r3: 0, r4: 0 },
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
    },
    'team-cyber': {
      id: 'team-cyber',
      team_code: 'CDX26-F3M8Q1',
      name: 'CyberKnights',
      status: 'active',
      session_token: 'tok-cyber-initial',
      last_active: Date.now() - 10000,
      is_online: true,
      fullscreenWarnings: { r1: 0, r2: 0, r3: 0, r4: 0 },
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
    },
    'team-byte': {
      id: 'team-byte',
      team_code: 'CDX26-X8L4T7',
      name: 'ByteForce',
      status: 'active',
      session_token: 'tok-byte-initial',
      last_active: Date.now() - 20000,
      is_online: true,
      fullscreenWarnings: { r1: 0, r2: 0, r3: 0, r4: 0 },
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
    }
  };

  const initialCrackProgress: Record<string, CrackProgress> = {};

  const initialContestState: ContestState = {
    eventStatus: 'LIVE',
    currentRound: 'LOBBY',
    currentStage: 'LOBBY',
    stageTitle: 'Event Waiting Lobby',
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
    currentQuizQuestionId: 'q-1',
    currentCodingProblemId: 'prob-1',
    isLeaderboardVisibleToTeams: true,
    isLeaderboardFrozen: false,
    weights: {
      r1: 15,
      r2: 25,
      r3: 30,
      r4: 30
    },
    activeAnnouncement: null
  };

  const initialAuditLogs: AuditLog[] = [
    {
      id: 'log-1',
      adminUser: 'System',
      action: 'CONTEST_INITIALIZED',
      entityType: 'CONTEST',
      entityId: 'CODEXCLUB_2026',
      previousValue: 'NONE',
      newValue: 'INITIALIZED',
      timestamp: Date.now() - 7200000
    },
    {
      id: 'log-2',
      adminUser: 'Admin Lead',
      action: 'TEAM_CODES_GENERATED',
      entityType: 'TEAM_CODES',
      entityId: 'BATCH_01',
      previousValue: '0',
      newValue: '8 Codes Generated',
      timestamp: Date.now() - 3600000
    }
  ];

  return {
    adminToken: 'admin_codex_secret_session_key',
    adminTokens: ['admin_codex_secret_session_key'],
    adminPasswordHash: 'codex2026admin', // Simple admin passcode
    teamCodes: initialTeamCodes,
    teams: initialTeams,
    typingRounds: initialTypingRounds,
    typingSubmissions: [],
    round1Config: initialRound1Config,
    quizStages: initialQuizStages,
    quizQuestions: initialQuizQuestions,
    quizSubmissions: [],
    round2Config: initialRound2Config,
    teamQuizProgress: {},
    codingProblems: initialCodingProblems,
    codeSubmissions: [],
    crackChallenges: initialCrackChallenges,
    crackProgress: initialCrackProgress,
    crackAttempts: [],
    announcements: [],
    auditLogs: initialAuditLogs,
    contestState: initialContestState,
    masterScoringConfig: getDefaultMasterScoringConfig(),
    roundScores: {}
  };
}

class DatabaseService {
  private store: DBStore;

  constructor() {
    this.ensureDataDir();
    this.store = this.loadData();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error('Error creating data directory:', err);
      }
    }
  }

  private loadData(): DBStore {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        const initial = getInitialStore();
        const mergedRound2Config: Round2Config = {
          ...initial.round2Config,
          ...(data.round2Config || {}),
          phases: {
            ...initial.round2Config.phases,
            ...((data.round2Config && data.round2Config.phases) || {})
          },
          scoreOverrides: (data.round2Config && data.round2Config.scoreOverrides) || {}
        };
        const loadedProblems = (data.codingProblems && Object.keys(data.codingProblems).length > 0)
          ? data.codingProblems
          : initial.codingProblems;

        Object.keys(loadedProblems).forEach((id, idx) => {
          const p = loadedProblems[id];
          p.order = p.order ?? (idx + 1);
          p.problemNumber = p.problemNumber ?? (idx + 1);
          p.difficulty = p.difficulty || (idx === 0 ? 'Easy' : idx === 1 ? 'Medium' : 'Hard');
          p.points = p.points || (idx === 0 ? 100 : idx === 1 ? 150 : 200);
          p.timeLimitSeconds = p.timeLimitSeconds || 2;
          p.memoryLimitMb = p.memoryLimitMb || 256;
          p.allowedLanguages = ['C', 'C++', 'Java'];
          p.isEnabled = p.isEnabled !== undefined ? p.isEnabled : true;
          p.visibleTestCases = p.visibleTestCases || p.sampleTestCases || [];
          p.sampleTestCases = p.sampleTestCases || p.visibleTestCases || [];
          p.boilerplates = p.boilerplates || {
            C: getFullBoilerplate('C'),
            'C++': getFullBoilerplate('C++'),
            Java: getFullBoilerplate('Java')
          };
        });

        const loadedChallenges: Record<string, CrackChallenge> = (data.crackChallenges && Object.keys(data.crackChallenges).length > 0)
          ? data.crackChallenges
          : initial.crackChallenges;

        // Ensure challenges have the latest prompt/answers and no default manual unlocks
        Object.values(loadedChallenges).forEach(c => {
          c.isManuallyUnlockedForEveryone = false;
          const initC = initial.crackChallenges[c.id];
          if (initC) {
            c.correctAnswer = initC.correctAnswer;
            c.acceptedVariations = initC.acceptedVariations;
            if (initC.cipherText) c.cipherText = initC.cipherText;
          }
        });

        // Ensure teams start clean from question 1 without pre-defaulted answers or pre-awarded R4 points
        const loadedTeams: Record<string, Team> = data.teams || initial.teams;
        Object.values(loadedTeams).forEach(t => {
          if (!t.scores) t.scores = { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
          if (!t.fullscreenWarnings) t.fullscreenWarnings = { r1: 0, r2: 0, r3: 0, r4: 0 };
          t.scores.r4 = 0;
        });

        return {
          ...initial,
          ...data,
          adminTokens: (Array.isArray(data.adminTokens) && data.adminTokens.length > 0)
            ? data.adminTokens
            : [initial.adminToken],
          teams: loadedTeams,
          codingProblems: loadedProblems,
          crackChallenges: loadedChallenges,
          crackProgress: {}, // Start everyone at question 1, unlocking sequential progress genuinely
          crackAttempts: [],
          round1Config: data.round1Config ? { ...initial.round1Config, ...data.round1Config } : initial.round1Config,
          round2Config: mergedRound2Config,
          quizStages: data.quizStages ? { ...initial.quizStages, ...data.quizStages } : initial.quizStages,
          quizQuestions: data.quizQuestions ? { ...initial.quizQuestions, ...data.quizQuestions } : initial.quizQuestions,
          teamQuizProgress: data.teamQuizProgress || {},
          masterScoringConfig: data.masterScoringConfig
            ? { ...getDefaultMasterScoringConfig(), ...data.masterScoringConfig }
            : getDefaultMasterScoringConfig(),
          roundScores: data.roundScores || {}
        };
      }
    } catch (err) {
      console.error('Error loading codex_store.json, falling back to initial data:', err);
    }
    const initial = getInitialStore();
    this.saveData(initial);
    return initial;
  }

  public saveData(data?: DBStore) {
    const toSave = data || this.store;
    try {
      this.ensureDataDir();
      fs.writeFileSync(DB_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving data to codex_store.json:', err);
    }
  }

  public getStore(): DBStore {
    return this.store;
  }

  // Audit Log helper
  public logAction(adminUser: string, action: string, entityType: string, entityId: string, previousValue: any, newValue: any): AuditLog {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      adminUser: adminUser || 'Admin',
      action,
      entityType,
      entityId,
      previousValue: typeof previousValue === 'object' ? JSON.stringify(previousValue) : String(previousValue),
      newValue: typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue),
      timestamp: Date.now()
    };
    this.store.auditLogs.unshift(log);
    if (this.store.auditLogs.length > 500) {
      this.store.auditLogs = this.store.auditLogs.slice(0, 500);
    }
    this.saveData();
    return log;
  }

  // Generate Unique Team Code
  public generateUniqueTeamCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      let randomPart = '';
      for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      code = `CDX26-${randomPart.substring(0, 3)}${randomPart.substring(3)}`;
    } while (this.store.teamCodes[code]);
    return code;
  }

  // ================= ROUND 1: FASTEST FINGERS FIRST =================

  public getTypingRounds(): TypingRound[] {
    const rounds = Object.values(this.store.typingRounds);
    return rounds.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  public getTypingRound(id: string): TypingRound | null {
    return this.store.typingRounds[id] || null;
  }

  public saveTypingRound(roundData: Partial<TypingRound>, isEdit: boolean, adminUser = 'Admin'): TypingRound {
    const rounds = this.getTypingRounds();
    let id = roundData.id;
    if (!id || !isEdit) {
      id = `tr-${Date.now()}`;
    }

    const previousValue = isEdit ? this.store.typingRounds[id] : null;

    const round: TypingRound = {
      id,
      title: roundData.title || `Typing Sub-Round ${rounds.length + 1}`,
      order: roundData.order !== undefined ? roundData.order : (rounds.length + 1),
      practicePassage: roundData.practicePassage || 'Quick algorithms conquer complex problems.',
      mainPassage: roundData.mainPassage || 'Modern software engineering demands high mechanical keyboard precision.',
      testDurationSeconds: Math.max(10, Number(roundData.testDurationSeconds) || 120),
      minAccuracyPercent: Math.min(100, Math.max(0, Number(roundData.minAccuracyPercent) || 85)),
      weight: Number(roundData.weight) || 1.0,
      scoringMultiplier: Number(roundData.scoringMultiplier) || 1.0,
      isPublished: roundData.isPublished !== undefined ? roundData.isPublished : true,
      createdAt: roundData.createdAt || Date.now()
    };

    this.store.typingRounds[id] = round;

    // Ensure weight is tracked in round1Config
    if (!this.store.round1Config.weights[id]) {
      this.store.round1Config.weights[id] = round.weight || 1.0;
    }

    this.logAction(
      adminUser,
      isEdit ? 'UPDATE_TYPING_ROUND' : 'CREATE_TYPING_ROUND',
      'TYPING_ROUND',
      id,
      previousValue,
      round
    );

    this.saveData();
    return round;
  }

  public deleteTypingRound(id: string, adminUser = 'Admin'): boolean {
    if (!this.store.typingRounds[id]) return false;
    const prev = this.store.typingRounds[id];
    delete this.store.typingRounds[id];
    delete this.store.round1Config.weights[id];

    // If active round was deleted, pick first available
    if (this.store.contestState.currentTypingRoundId === id) {
      const remaining = this.getTypingRounds();
      this.store.contestState.currentTypingRoundId = remaining.length > 0 ? remaining[0].id : '';
    }

    this.logAction(adminUser, 'DELETE_TYPING_ROUND', 'TYPING_ROUND', id, prev, 'DELETED');
    this.recalculateRound1Scores();
    this.saveData();
    return true;
  }

  public duplicateTypingRound(id: string, adminUser = 'Admin'): TypingRound | null {
    const src = this.store.typingRounds[id];
    if (!src) return null;

    const rounds = this.getTypingRounds();
    const newId = `tr-${Date.now()}`;
    const duplicated: TypingRound = {
      ...src,
      id: newId,
      title: `${src.title} (Copy)`,
      order: rounds.length + 1,
      createdAt: Date.now()
    };

    this.store.typingRounds[newId] = duplicated;
    this.store.round1Config.weights[newId] = duplicated.weight || 1.0;

    this.logAction(adminUser, 'DUPLICATE_TYPING_ROUND', 'TYPING_ROUND', newId, src.id, duplicated);
    this.saveData();
    return duplicated;
  }

  public reorderTypingRounds(orderedIds: string[], adminUser = 'Admin') {
    orderedIds.forEach((id, index) => {
      if (this.store.typingRounds[id]) {
        this.store.typingRounds[id].order = index + 1;
      }
    });

    this.logAction(adminUser, 'REORDER_TYPING_ROUNDS', 'TYPING_ROUNDS', 'ALL', 'PREVIOUS_ORDER', orderedIds);
    this.saveData();
  }

  public getRound1Config(): Round1Config {
    return this.store.round1Config;
  }

  public updateRound1Config(newConfig: Partial<Round1Config>, adminUser = 'Admin'): Round1Config {
    const prev = { ...this.store.round1Config };
    this.store.round1Config = {
      ...this.store.round1Config,
      ...newConfig,
      weights: newConfig.weights ? { ...this.store.round1Config.weights, ...newConfig.weights } : this.store.round1Config.weights
    };

    this.logAction(adminUser, 'UPDATE_ROUND1_CONFIG', 'ROUND1_CONFIG', 'GLOBAL', prev, this.store.round1Config);
    this.recalculateRound1Scores();
    this.saveData();
    return this.store.round1Config;
  }

  public overrideTypingScore(
    teamId: string,
    type: 'override' | 'bonus' | 'penalty' | 'reset',
    value: number,
    note: string,
    adminUser = 'Admin',
    typingRoundId?: string
  ): TypingScoreOverride {
    const team = this.store.teams[teamId];
    if (!team) throw new Error('Team not found');

    const originalR1 = team.scores.r1 || 0;
    let adjusted = originalR1;

    if (type === 'override') {
      adjusted = Number(value);
    } else if (type === 'bonus') {
      adjusted = Number((originalR1 + value).toFixed(2));
    } else if (type === 'penalty') {
      adjusted = Number(Math.max(0, originalR1 - value).toFixed(2));
    } else if (type === 'reset') {
      delete this.store.round1Config.scoreOverrides[teamId];
      this.recalculateRound1Scores();
      adjusted = team.scores.r1 || 0;
    }

    const overrideObj: TypingScoreOverride = {
      id: `ovr-${Date.now()}`,
      teamId,
      typingRoundId: typingRoundId || 'GLOBAL',
      type,
      value,
      originalScore: originalR1,
      adjustedScore: adjusted,
      note: note || `Admin ${type} adjustment of ${value}`,
      adminUser,
      updatedAt: Date.now()
    };

    if (type !== 'reset') {
      this.store.round1Config.scoreOverrides[teamId] = overrideObj;
    }

    this.logAction(adminUser, `TYPING_SCORE_${type.toUpperCase()}`, 'TEAM_SCORE_R1', teamId, originalR1, {
      adjusted,
      type,
      value,
      note
    });

    this.recalculateRound1Scores();
    this.saveData();
    return overrideObj;
  }

  public recalculateRound1Scores() {
    const method = this.store.round1Config.scoringMethod || 'best';
    const weights = this.store.round1Config.weights || {};
    const overrides = this.store.round1Config.scoreOverrides || {};
    const submissions = this.store.typingSubmissions;

    Object.values(this.store.teams).forEach(team => {
      // Get all non-practice submissions for this team
      const teamSubs = submissions.filter(s => s.teamId === team.id && !s.isPractice);

      // Best score per typing round
      const subroundBestScores: Record<string, number> = {};
      teamSubs.forEach(s => {
        const cur = subroundBestScores[s.typingRoundId] || 0;
        if (s.score > cur) {
          subroundBestScores[s.typingRoundId] = s.score;
        }
      });

      const completedRoundIds = Object.keys(subroundBestScores);
      let calculatedR1 = 0;

      if (completedRoundIds.length > 0) {
        if (method === 'best') {
          calculatedR1 = Math.max(...Object.values(subroundBestScores));
        } else if (method === 'average') {
          const sum = Object.values(subroundBestScores).reduce((a, b) => a + b, 0);
          calculatedR1 = sum / completedRoundIds.length;
        } else if (method === 'total') {
          calculatedR1 = Object.values(subroundBestScores).reduce((a, b) => a + b, 0);
        } else if (method === 'weighted') {
          let weightedSum = 0;
          let totalWeight = 0;
          completedRoundIds.forEach(rId => {
            const w = weights[rId] !== undefined ? weights[rId] : 1.0;
            weightedSum += (subroundBestScores[rId] || 0) * w;
            totalWeight += w;
          });
          calculatedR1 = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
        }
      }

      calculatedR1 = Number(calculatedR1.toFixed(2));

      // Apply override if active
      let finalR1 = calculatedR1;
      const override = overrides[team.id];
      if (override) {
        if (override.type === 'override') {
          finalR1 = override.value;
        } else if (override.type === 'bonus') {
          finalR1 = Number((calculatedR1 + override.value).toFixed(2));
        } else if (override.type === 'penalty') {
          finalR1 = Number(Math.max(0, calculatedR1 - override.value).toFixed(2));
        }
      }

      team.scores.r1 = finalR1;
    });

    this.recalculateTeamScores();
  }

  public getTeamTypingStats(): TeamTypingStats[] {
    this.recalculateRound1Scores();
    const teams = Object.values(this.store.teams);
    const submissions = this.store.typingSubmissions;
    const overrides = this.store.round1Config.scoreOverrides || {};

    return teams.map(team => {
      const teamSubs = submissions.filter(s => s.teamId === team.id);
      const subroundScores: Record<string, any> = {};

      Object.keys(this.store.typingRounds).forEach(rId => {
        const roundSubs = teamSubs.filter(s => s.typingRoundId === rId);
        const practiceSub = roundSubs.find(s => s.isPractice);
        const testSub = roundSubs.find(s => !s.isPractice);

        subroundScores[rId] = {
          attemptCount: roundSubs.length,
          practiceWpm: practiceSub?.wpm,
          practiceAccuracy: practiceSub?.accuracy,
          testWpm: testSub?.wpm,
          testAccuracy: testSub?.accuracy,
          testScore: testSub?.score,
          testSubmittedAt: testSub?.submittedAt
        };
      });

      const override = overrides[team.id];

      return {
        teamId: team.id,
        teamName: team.name,
        teamCode: team.team_code,
        subroundScores,
        calculatedScore: team.scores.r1 || 0,
        overrideScore: override ? override.adjustedScore : undefined,
        finalRound1Score: team.scores.r1 || 0,
        overrideInfo: override
      };
    });
  }

  // ================= ROUND 2: BYTE-SIZED BRAINS =================
  public getQuizStages(): QuizStage[] {
    const stages = Object.values(this.store.quizStages || {});
    return stages.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  public saveQuizStage(stageData: Partial<QuizStage>, isEdit: boolean, adminUser = 'Admin'): QuizStage {
    if (!this.store.quizStages) this.store.quizStages = {};
    const stages = this.getQuizStages();
    let id = stageData.id;
    if (!id || !isEdit) {
      id = `stage-${Date.now()}`;
    }
    const stage: QuizStage = {
      id,
      stageNumber: Number(stageData.stageNumber) || (stages.length + 1),
      title: stageData.title || `Stage ${stages.length + 1}`,
      description: stageData.description || '',
      order: stageData.order !== undefined ? Number(stageData.order) : (stages.length + 1)
    };
    const prev = isEdit ? this.store.quizStages[id] : null;
    this.store.quizStages[id] = stage;
    this.logAction(adminUser, isEdit ? 'UPDATE_QUIZ_STAGE' : 'CREATE_QUIZ_STAGE', 'QUIZ_STAGE', id, prev, stage);
    this.saveData();
    return stage;
  }

  public deleteQuizStage(id: string, adminUser = 'Admin'): boolean {
    if (!this.store.quizStages || !this.store.quizStages[id]) return false;
    const prev = this.store.quizStages[id];
    delete this.store.quizStages[id];
    this.logAction(adminUser, 'DELETE_QUIZ_STAGE', 'QUIZ_STAGE', id, prev, 'DELETED');
    this.saveData();
    return true;
  }

  public getQuizQuestions(): QuizQuestion[] {
    const questions = Object.values(this.store.quizQuestions || {});
    return questions.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  public getQuizQuestion(id: string): QuizQuestion | null {
    return this.store.quizQuestions[id] || null;
  }

  public saveQuizQuestion(qData: Partial<QuizQuestion>, isEdit: boolean, adminUser = 'Admin'): QuizQuestion {
    const questions = this.getQuizQuestions();
    let id = qData.id;
    if (!id || !isEdit) {
      id = `q-${Date.now()}`;
    }
    const prev = isEdit ? this.store.quizQuestions[id] : null;

    const question: QuizQuestion = {
      id,
      stageNumber: Number(qData.stageNumber) || 1,
      category: qData.category || 'Programming Languages',
      type: qData.type || 'mcq',
      questionText: qData.questionText || '',
      codeSnippet: qData.codeSnippet ? String(qData.codeSnippet).trim() : undefined,
      options: Array.isArray(qData.options) ? qData.options : [],
      correctAnswer: qData.correctAnswer !== undefined ? qData.correctAnswer : '',
      difficulty: qData.difficulty || 'EASY',
      points: Math.max(1, Number(qData.points) || 2),
      timeLimitSeconds: Math.max(5, Number(qData.timeLimitSeconds) || 30),
      explanation: qData.explanation ? String(qData.explanation).trim() : '',
      order: qData.order !== undefined ? Number(qData.order) : (questions.length + 1),
      isVoided: Boolean(qData.isVoided),
      isFullPointsAwarded: Boolean(qData.isFullPointsAwarded)
    };

    this.store.quizQuestions[id] = question;
    this.logAction(adminUser, isEdit ? 'UPDATE_QUIZ_QUESTION' : 'CREATE_QUIZ_QUESTION', 'QUIZ_QUESTION', id, prev, question);
    this.recalculateRound2Scores();
    this.saveData();
    return question;
  }

  public deleteQuizQuestion(id: string, adminUser = 'Admin'): boolean {
    const cleanId = (id || '').trim();
    let targetKey = cleanId;
    if (!this.store.quizQuestions[targetKey]) {
      const match = Object.keys(this.store.quizQuestions).find(k => k.trim() === cleanId || k.toLowerCase() === cleanId.toLowerCase());
      if (match) {
        targetKey = match;
      } else {
        return false;
      }
    }
    const prev = this.store.quizQuestions[targetKey];
    delete this.store.quizQuestions[targetKey];

    if (this.store.contestState.currentQuizQuestionId === targetKey) {
      const remaining = this.getQuizQuestions();
      this.store.contestState.currentQuizQuestionId = remaining.length > 0 ? remaining[0].id : null;
    }

    this.logAction(adminUser, 'DELETE_QUIZ_QUESTION', 'QUIZ_QUESTION', targetKey, prev, 'DELETED');
    this.recalculateRound2Scores();
    this.saveData();
    return true;
  }

  public bulkDeleteQuizQuestions(ids: string[], adminUser = 'Admin'): { deletedCount: number } {
    let deletedCount = 0;
    if (Array.isArray(ids)) {
      ids.forEach(rawId => {
        const cleanId = (rawId || '').trim();
        let targetKey = cleanId;
        if (!this.store.quizQuestions[targetKey]) {
          const match = Object.keys(this.store.quizQuestions).find(k => k.trim() === cleanId);
          if (match) targetKey = match;
        }
        if (this.store.quizQuestions[targetKey]) {
          delete this.store.quizQuestions[targetKey];
          deletedCount++;
        }
      });
    }

    const remaining = this.getQuizQuestions();
    if (this.store.contestState.currentQuizQuestionId && !this.store.quizQuestions[this.store.contestState.currentQuizQuestionId]) {
      this.store.contestState.currentQuizQuestionId = remaining.length > 0 ? remaining[0].id : null;
    }

    this.logAction(adminUser, 'BULK_DELETE_QUIZ_QUESTIONS', 'QUIZ_QUESTION', 'MULTIPLE', ids, `Deleted ${deletedCount} questions`);
    this.recalculateRound2Scores();
    this.saveData();
    return { deletedCount };
  }

  public clearAllQuizQuestions(stageNumber?: number, adminUser = 'Admin'): { deletedCount: number } {
    let deletedCount = 0;
    if (stageNumber !== undefined && stageNumber !== null) {
      Object.keys(this.store.quizQuestions).forEach(key => {
        if (this.store.quizQuestions[key]?.stageNumber === stageNumber) {
          delete this.store.quizQuestions[key];
          deletedCount++;
        }
      });
    } else {
      deletedCount = Object.keys(this.store.quizQuestions).length;
      this.store.quizQuestions = {};
    }

    const remaining = this.getQuizQuestions();
    this.store.contestState.currentQuizQuestionId = remaining.length > 0 ? remaining[0].id : null;

    this.logAction(adminUser, 'CLEAR_QUIZ_QUESTIONS', 'QUIZ_QUESTION', 'ALL', stageNumber || 'ALL', `Cleared ${deletedCount} questions`);
    this.recalculateRound2Scores();
    this.saveData();
    return { deletedCount };
  }

  public duplicateQuizQuestion(id: string, adminUser = 'Admin'): QuizQuestion | null {
    const src = this.store.quizQuestions[id];
    if (!src) return null;
    const questions = this.getQuizQuestions();
    const newId = `q-${Date.now()}`;
    const duplicated: QuizQuestion = {
      ...src,
      id: newId,
      questionText: `${src.questionText} (Copy)`,
      order: questions.length + 1,
      isVoided: false,
      isFullPointsAwarded: false
    };
    this.store.quizQuestions[newId] = duplicated;
    this.logAction(adminUser, 'DUPLICATE_QUIZ_QUESTION', 'QUIZ_QUESTION', newId, src.id, duplicated);
    this.saveData();
    return duplicated;
  }

  public reorderQuizQuestions(orderedIds: string[], adminUser = 'Admin') {
    orderedIds.forEach((id, index) => {
      if (this.store.quizQuestions[id]) {
        this.store.quizQuestions[id].order = index + 1;
      }
    });
    this.logAction(adminUser, 'REORDER_QUIZ_QUESTIONS', 'QUIZ_QUESTIONS', 'ALL', 'PREVIOUS_ORDER', orderedIds);
    this.saveData();
  }

  public voidQuizQuestion(id: string, adminUser = 'Admin'): QuizQuestion {
    const q = this.store.quizQuestions[id];
    if (!q) throw new Error('Question not found');
    q.isVoided = !q.isVoided;
    this.logAction(adminUser, 'VOID_QUIZ_QUESTION', 'QUIZ_QUESTION', id, !q.isVoided, q.isVoided);
    this.recalculateRound2Scores();
    this.saveData();
    return q;
  }

  public awardAllQuizPoints(id: string, adminUser = 'Admin'): QuizQuestion {
    const q = this.store.quizQuestions[id];
    if (!q) throw new Error('Question not found');
    q.isFullPointsAwarded = !q.isFullPointsAwarded;
    this.logAction(adminUser, 'AWARD_ALL_QUIZ_POINTS', 'QUIZ_QUESTION', id, !q.isFullPointsAwarded, q.isFullPointsAwarded);
    this.recalculateRound2Scores();
    this.saveData();
    return q;
  }

  public getRound2Config(): Round2Config {
    if (!this.store.round2Config) {
      this.store.round2Config = { phases: {}, scoreOverrides: {} };
    }
    return this.store.round2Config;
  }

  public updateRound2Config(newConfig: Partial<Round2Config>, adminUser = 'Admin'): Round2Config {
    if (!this.store.round2Config) this.store.round2Config = { phases: {}, scoreOverrides: {} };
    const prev = { ...this.store.round2Config };
    this.store.round2Config = {
      ...this.store.round2Config,
      ...newConfig,
      phases: newConfig.phases ? { ...this.store.round2Config.phases, ...newConfig.phases } : this.store.round2Config.phases
    };
    this.logAction(adminUser, 'UPDATE_ROUND2_CONFIG', 'ROUND2_CONFIG', 'GLOBAL', prev, this.store.round2Config);
    this.recalculateRound2Scores();
    this.saveData();
    return this.store.round2Config;
  }

  public getQuizPhaseConfig(phaseNumber: number): QuizPhaseConfig {
    const cfg = this.store.round2Config?.phases?.[phaseNumber];
    if (cfg) return cfg;
    const defaults: Record<number, QuizPhaseConfig> = {
      1: { phaseNumber: 1, title: 'Phase 1 — Easy', difficulty: 'EASY', questionCount: 5, defaultPoints: 2, timePerQuestionSeconds: 30 },
      2: { phaseNumber: 2, title: 'Phase 2 — Medium', difficulty: 'MEDIUM', questionCount: 5, defaultPoints: 4, timePerQuestionSeconds: 45 },
      3: { phaseNumber: 3, title: 'Phase 3 — Hard', difficulty: 'HARD', questionCount: 5, defaultPoints: 6, timePerQuestionSeconds: 60 }
    };
    return defaults[phaseNumber] || defaults[1];
  }

  public updateQuizPhaseConfig(phaseNumber: number, updates: Partial<QuizPhaseConfig>, adminUser = 'Admin'): QuizPhaseConfig {
    if (!this.store.round2Config) this.store.round2Config = { phases: {}, scoreOverrides: {} };
    if (!this.store.round2Config.phases) this.store.round2Config.phases = {};
    const existing = this.getQuizPhaseConfig(phaseNumber);
    const updated: QuizPhaseConfig = {
      ...existing,
      ...updates,
      phaseNumber
    };
    const prev = this.store.round2Config.phases[phaseNumber];
    this.store.round2Config.phases[phaseNumber] = updated;
    this.logAction(adminUser, 'UPDATE_QUIZ_PHASE_CONFIG', 'QUIZ_PHASE_CONFIG', `Phase-${phaseNumber}`, prev, updated);
    this.saveData();
    return updated;
  }

  public startQuizPhase(phaseNumber: number, adminUser = 'Admin') {
    if (!this.store.teamQuizProgress) this.store.teamQuizProgress = {};
    const phaseConfig = this.getQuizPhaseConfig(phaseNumber);
    const allQuestions = this.getQuizQuestions();

    // Find non-voided questions matching this phase
    let candidateQuestions = allQuestions.filter(q => !q.isVoided && q.stageNumber === phaseNumber);
    if (candidateQuestions.length < phaseConfig.questionCount) {
      // Fallback: match by difficulty if needed
      const byDiff = allQuestions.filter(q => !q.isVoided && q.difficulty === phaseConfig.difficulty);
      const combined = Array.from(new Set([...candidateQuestions, ...byDiff]));
      candidateQuestions = combined.length > 0 ? combined : allQuestions.filter(q => !q.isVoided);
    }

    const targetCount = Math.min(phaseConfig.questionCount, candidateQuestions.length);

    Object.values(this.store.teams).forEach(team => {
      if (!this.store.teamQuizProgress[team.id]) {
        this.store.teamQuizProgress[team.id] = {};
      }

      // If progress for this phase doesn't exist yet, initialize independent randomized question sequence
      if (!this.store.teamQuizProgress[team.id][phaseNumber]) {
        const shuffled = [...candidateQuestions].map(q => q.id);
        // Fisher-Yates shuffle
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const selectedQuestionIds = shuffled.slice(0, targetCount);
        const firstQId = selectedQuestionIds[0];
        const firstQ = firstQId ? this.store.quizQuestions[firstQId] : null;
        const timeLimit = firstQ ? firstQ.timeLimitSeconds : phaseConfig.timePerQuestionSeconds;

        this.store.teamQuizProgress[team.id][phaseNumber] = {
          teamId: team.id,
          phaseNumber,
          questionIds: selectedQuestionIds,
          currentIndex: 0,
          completed: selectedQuestionIds.length === 0,
          currentQuestionStartedAt: Date.now(),
          questionTimeLimit: timeLimit,
          pausedRemainingSeconds: null
        };
      } else {
        // Resume if paused
        const prog = this.store.teamQuizProgress[team.id][phaseNumber];
        if (!prog.completed && prog.pausedRemainingSeconds !== null && prog.pausedRemainingSeconds !== undefined) {
          prog.currentQuestionStartedAt = Date.now() - ((prog.questionTimeLimit - prog.pausedRemainingSeconds) * 1000);
          prog.pausedRemainingSeconds = null;
        }
      }
    });

    this.saveData();
  }

  public getTeamQuizProgress(teamId: string, phaseNumber: number): TeamQuizProgress | null {
    if (!this.store.teamQuizProgress) this.store.teamQuizProgress = {};
    if (!this.store.teamQuizProgress[teamId]) {
      this.store.teamQuizProgress[teamId] = {};
    }

    let prog = this.store.teamQuizProgress[teamId][phaseNumber];
    if (!prog) {
      this.startQuizPhase(phaseNumber);
      prog = this.store.teamQuizProgress[teamId][phaseNumber];
    }

    if (!prog || prog.completed) return prog || null;

    // Check if current question timed out
    const isPaused = this.store.contestState.timer.isPaused || this.store.contestState.eventStatus === 'PAUSED';
    if (!isPaused && prog.pausedRemainingSeconds === null) {
      const elapsed = (Date.now() - prog.currentQuestionStartedAt) / 1000;
      if (elapsed >= prog.questionTimeLimit + 1) { // 1 second grace
        this.advanceTeamQuizQuestion(teamId, phaseNumber, true);
        prog = this.store.teamQuizProgress[teamId][phaseNumber];
      }
    }

    return prog;
  }

  public advanceTeamQuizQuestion(teamId: string, phaseNumber: number, timedOut = false) {
    const prog = this.store.teamQuizProgress?.[teamId]?.[phaseNumber];
    if (!prog || prog.completed) return;

    const currentQId = prog.questionIds[prog.currentIndex];
    if (currentQId && timedOut) {
      const existingSub = this.store.quizSubmissions.find(s => s.teamId === teamId && s.questionId === currentQId);
      if (!existingSub) {
        const team = this.store.teams[teamId];
        const sub: QuizSubmission = {
          id: `sub-timeout-${Date.now()}-${teamId}`,
          teamId,
          teamName: team?.name || 'Unknown',
          questionId: currentQId,
          answer: '__TIMEOUT__',
          isCorrect: false,
          pointsAwarded: 0,
          timeTakenSeconds: prog.questionTimeLimit,
          submittedAt: Date.now()
        };
        this.store.quizSubmissions.push(sub);
        this.recalculateRound2Scores();
      }
    }

    prog.currentIndex += 1;
    if (prog.currentIndex >= prog.questionIds.length) {
      prog.completed = true;
    } else {
      const nextQId = prog.questionIds[prog.currentIndex];
      const nextQ = this.store.quizQuestions[nextQId];
      const phaseConfig = this.getQuizPhaseConfig(phaseNumber);
      prog.questionTimeLimit = nextQ ? nextQ.timeLimitSeconds : phaseConfig.timePerQuestionSeconds;
      prog.currentQuestionStartedAt = Date.now();
      prog.pausedRemainingSeconds = null;
    }

    this.saveData();
  }

  public submitQuizAnswer(
    teamId: string,
    questionId: string,
    answer: any,
    timeTakenSeconds: number,
    phaseNumber: number = 1
  ): { submission: QuizSubmission; progress: TeamQuizProgress | null } {
    const q = this.store.quizQuestions[questionId];
    if (!q) throw new Error('Question not found');
    const team = this.store.teams[teamId];
    if (!team) throw new Error('Team not found');

    // Helper to normalize strings (trim, lowercase, strip surrounding quotes)
    const normalizeStr = (s: any) => {
      let str = String(s ?? '').trim().toLowerCase();
      if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
        str = str.slice(1, -1).trim();
      }
      return str;
    };

    // Check correctness
    let isCorrect = false;
    if (q.isVoided) {
      isCorrect = false;
    } else if (q.isFullPointsAwarded) {
      isCorrect = true;
    } else if (q.type === 'multi_select') {
      const submittedArr = Array.isArray(answer) ? answer.map(normalizeStr).sort() : [];
      const correctArr = Array.isArray(q.correctAnswer)
        ? q.correctAnswer.map(normalizeStr).sort()
        : [normalizeStr(q.correctAnswer)];
      isCorrect = (
        submittedArr.length === correctArr.length &&
        submittedArr.every((val, idx) => val === correctArr[idx])
      );
    } else if (q.type === 'fill_blank') {
      const subTrim = normalizeStr(answer);
      const corTrim = String(q.correctAnswer || '').toLowerCase();
      // Allow minor flexible matching (exact or semicolon-separated accepted answers)
      const allowed = corTrim.split(';').map(s => normalizeStr(s));
      isCorrect = allowed.includes(subTrim);
    } else {
      // mcq, true_false, code_output
      const subNorm = normalizeStr(answer);
      const corNorm = normalizeStr(q.correctAnswer);
      isCorrect = subNorm === corNorm;
    }

    const r2Cfg = (this.store as any).masterScoringConfig?.r2;
    let weight = q.points;
    if (r2Cfg) {
      if (r2Cfg.questionPointsOverride && r2Cfg.questionPointsOverride[q.id] !== undefined) {
        weight = r2Cfg.questionPointsOverride[q.id];
      } else if (q.difficulty === 'EASY') {
        weight = r2Cfg.pointsPerQuestion?.easy ?? r2Cfg.defaultEasyPoints ?? q.points ?? 2;
      } else if (q.difficulty === 'MEDIUM') {
        weight = r2Cfg.pointsPerQuestion?.medium ?? r2Cfg.defaultMediumPoints ?? q.points ?? 4;
      } else if (q.difficulty === 'HARD') {
        weight = r2Cfg.pointsPerQuestion?.hard ?? r2Cfg.defaultHardPoints ?? q.points ?? 6;
      }
    }
    if (!weight || weight <= 0) {
      weight = q.difficulty === 'HARD' ? 6 : q.difficulty === 'MEDIUM' ? 4 : 2;
    }

    const pointsAwarded = (q.isFullPointsAwarded || isCorrect) ? (q.isVoided ? 0 : weight) : 0;

    const submission: QuizSubmission = {
      id: `sub-quiz-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      teamId,
      teamName: team.name,
      questionId,
      answer,
      isCorrect,
      pointsAwarded,
      timeTakenSeconds: Math.max(0, Number(timeTakenSeconds) || 0),
      submittedAt: Date.now()
    };

    // Remove any previous submission for this question by this team
    this.store.quizSubmissions = this.store.quizSubmissions.filter(
      s => !(s.teamId === teamId && s.questionId === questionId)
    );
    this.store.quizSubmissions.push(submission);

    this.recalculateRound2Scores();
    this.saveData();

    return { submission, progress: null };
  }

  public pauseQuizPhase() {
    const currentPhase = this.store.contestState.currentQuizPhase || 1;
    Object.values(this.store.teamQuizProgress || {}).forEach(teamProgs => {
      const prog = teamProgs[currentPhase];
      if (prog && !prog.completed && prog.pausedRemainingSeconds === null) {
        const elapsed = Math.max(0, Math.floor((Date.now() - prog.currentQuestionStartedAt) / 1000));
        prog.pausedRemainingSeconds = Math.max(0, prog.questionTimeLimit - elapsed);
      }
    });
    this.saveData();
  }

  public resumeQuizPhase() {
    const currentPhase = this.store.contestState.currentQuizPhase || 1;
    Object.values(this.store.teamQuizProgress || {}).forEach(teamProgs => {
      const prog = teamProgs[currentPhase];
      if (prog && !prog.completed && prog.pausedRemainingSeconds !== null && prog.pausedRemainingSeconds !== undefined) {
        prog.currentQuestionStartedAt = Date.now() - ((prog.questionTimeLimit - prog.pausedRemainingSeconds) * 1000);
        prog.pausedRemainingSeconds = null;
      }
    });
    this.saveData();
  }

  public addTimeQuizPhase(seconds: number) {
    const currentPhase = this.store.contestState.currentQuizPhase || 1;
    Object.values(this.store.teamQuizProgress || {}).forEach(teamProgs => {
      const prog = teamProgs[currentPhase];
      if (prog && !prog.completed) {
        prog.questionTimeLimit += seconds;
        if (prog.pausedRemainingSeconds !== null && prog.pausedRemainingSeconds !== undefined) {
          prog.pausedRemainingSeconds += seconds;
        }
      }
    });
    this.saveData();
  }

  public getAdminQuizMonitoring(phaseNumber?: number) {
    const activePhase = phaseNumber || this.store.contestState.currentQuizPhase || 1;
    const phaseConfig = this.getQuizPhaseConfig(activePhase);
    const teams = Object.values(this.store.teams);
    const questions = this.store.quizQuestions;
    const submissions = this.store.quizSubmissions;

    let connectedCount = 0;
    let completedCount = 0;

    const teamList = teams.map(team => {
      if (team.is_online) connectedCount++;
      const teamProgs = this.store.teamQuizProgress?.[team.id] || {};
      const prog = teamProgs[activePhase];

      const currentIdx = prog ? prog.currentIndex : 0;
      const totalQ = prog ? prog.questionIds.length : phaseConfig.questionCount;
      const isCompleted = prog ? prog.completed : false;
      if (isCompleted) completedCount++;

      const currentQId = prog && prog.questionIds && prog.questionIds[prog.currentIndex];
      const currentQ = currentQId ? questions[currentQId] : null;

      // Calculate phase score for this team
      const phaseSubs = submissions.filter(s => {
        if (s.teamId !== team.id) return false;
        const q = questions[s.questionId];
        return q && q.stageNumber === activePhase;
      });

      const phaseScore = phaseSubs.reduce((sum, s) => {
        const q = questions[s.questionId];
        if (!q || q.isVoided) return sum;
        if (q.isFullPointsAwarded || s.isCorrect) return sum + q.points;
        return sum;
      }, 0);

      // Remaining seconds on current question
      let remainingSeconds = 0;
      if (prog && !isCompleted) {
        if (prog.pausedRemainingSeconds !== null && prog.pausedRemainingSeconds !== undefined) {
          remainingSeconds = prog.pausedRemainingSeconds;
        } else {
          const elapsed = Math.floor((Date.now() - prog.currentQuestionStartedAt) / 1000);
          remainingSeconds = Math.max(0, prog.questionTimeLimit - elapsed);
        }
      }

      return {
        teamId: team.id,
        teamName: team.name,
        teamCode: team.team_code,
        isOnline: team.is_online,
        status: team.status,
        progressStr: `${Math.min(currentIdx, totalQ)} / ${totalQ}`,
        currentIndex: currentIdx,
        currentQuestionIndex: currentIdx,
        answeredCount: Math.min(currentIdx, totalQ),
        totalQuestions: totalQ,
        isCompleted,
        currentQuestionId: currentQId || null,
        currentQuestionText: currentQ ? currentQ.questionText : (isCompleted ? 'Phase Completed' : 'Awaiting start'),
        remainingSeconds,
        timeSpentOnCurrentQuestion: prog && !isCompleted ? Math.max(0, Math.floor((Date.now() - (prog.currentQuestionStartedAt || Date.now())) / 1000)) : 0,
        phaseScore,
        totalR2Score: team.scores.r2 || 0,
        totalRound2Score: team.scores.r2 || 0
      };
    });

    return {
      phaseNumber: activePhase,
      phaseTitle: phaseConfig.title,
      difficulty: phaseConfig.difficulty,
      totalTeams: teams.length,
      connectedTeams: connectedCount,
      completedTeams: completedCount,
      isPaused: Boolean(this.store.contestState.timer.isPaused || this.store.contestState.eventStatus === 'PAUSED'),
      teams: teamList
    };
  }

  public importQuizQuestions(
    imported: Partial<QuizQuestion>[],
    assignPhase: 'difficulty' | 1 | 2 | 3,
    overwrite: boolean,
    adminUser = 'Admin'
  ): { addedCount: number; updatedCount: number } {
    if (overwrite) {
      this.store.quizQuestions = {};
    }

    let addedCount = 0;
    let updatedCount = 0;
    const existing = this.getQuizQuestions();

    imported.forEach((item, index) => {
      if (!item.questionText) return;

      let stageNumber = 1;
      if (typeof assignPhase === 'number') {
        stageNumber = assignPhase;
      } else {
        const diff = String(item.difficulty || 'EASY').toUpperCase();
        if (diff === 'HARD') stageNumber = 3;
        else if (diff === 'MEDIUM') stageNumber = 2;
        else stageNumber = 1;
      }

      const id = item.id || `q-imp-${Date.now()}-${index}`;
      const isExisting = Boolean(this.store.quizQuestions[id]);

      const question: QuizQuestion = {
        id,
        stageNumber: Number(item.stageNumber) || stageNumber,
        category: item.category || 'General Technology Awareness',
        type: item.type || 'mcq',
        questionText: String(item.questionText).trim(),
        codeSnippet: item.codeSnippet ? String(item.codeSnippet).trim() : undefined,
        options: Array.isArray(item.options) ? item.options : [],
        correctAnswer: item.correctAnswer !== undefined ? item.correctAnswer : '',
        difficulty: (item.difficulty as any) || (stageNumber === 3 ? 'HARD' : stageNumber === 2 ? 'MEDIUM' : 'EASY'),
        points: Number(item.points) || (stageNumber === 3 ? 6 : stageNumber === 2 ? 4 : 2),
        timeLimitSeconds: Number(item.timeLimitSeconds) || (stageNumber === 3 ? 60 : stageNumber === 2 ? 45 : 30),
        explanation: item.explanation ? String(item.explanation).trim() : '',
        order: existing.length + index + 1,
        isVoided: false,
        isFullPointsAwarded: false
      };

      this.store.quizQuestions[id] = question;
      if (isExisting) updatedCount++;
      else addedCount++;
    });

    this.logAction(adminUser, 'IMPORT_QUIZ_QUESTIONS', 'QUIZ_QUESTIONS', 'BULK', null, { addedCount, updatedCount });
    this.recalculateRound2Scores();
    this.saveData();

    return { addedCount, updatedCount };
  }

  public qualifyQuizTeams(
    options: { topN?: number; minScore?: number; percentage?: number; teamIds?: string[] },
    adminUser = 'Admin'
  ) {
    const teams = Object.values(this.store.teams);
    teams.sort((a, b) => (b.scores.r2 || 0) - (a.scores.r2 || 0));

    let qualifiedIds = new Set<string>();

    if (options.teamIds && options.teamIds.length > 0) {
      options.teamIds.forEach(id => qualifiedIds.add(id));
    } else if (options.topN && options.topN > 0) {
      teams.slice(0, options.topN).forEach(t => qualifiedIds.add(t.id));
    } else if (options.minScore !== undefined) {
      teams.filter(t => (t.scores.r2 || 0) >= options.minScore!).forEach(t => qualifiedIds.add(t.id));
    } else if (options.percentage && options.percentage > 0) {
      const count = Math.ceil(teams.length * (options.percentage / 100));
      teams.slice(0, count).forEach(t => qualifiedIds.add(t.id));
    }

    teams.forEach(team => {
      const qual = qualifiedIds.has(team.id);
      team.qualification.r2 = qual;
    });

    this.logAction(adminUser, 'QUALIFY_QUIZ_TEAMS', 'TEAM_QUALIFICATION_R2', 'ALL', null, {
      qualifiedCount: qualifiedIds.size,
      options
    });
    this.saveData();
  }

  public overrideQuizScore(
    teamId: string,
    type: 'override' | 'bonus' | 'penalty' | 'reset',
    value: number,
    note: string,
    adminUser = 'Admin'
  ): QuizScoreOverride {
    const team = this.store.teams[teamId];
    if (!team) throw new Error('Team not found');
    if (!this.store.round2Config) this.store.round2Config = { phases: {}, scoreOverrides: {} };

    const originalR2 = team.scores.r2 || 0;
    let adjusted = originalR2;

    if (type === 'override') {
      adjusted = Number(value);
    } else if (type === 'bonus') {
      adjusted = Number((originalR2 + value).toFixed(2));
    } else if (type === 'penalty') {
      adjusted = Number(Math.max(0, originalR2 - value).toFixed(2));
    } else if (type === 'reset') {
      delete this.store.round2Config.scoreOverrides[teamId];
      this.recalculateRound2Scores();
      adjusted = team.scores.r2 || 0;
    }

    const overrideObj: QuizScoreOverride = {
      id: `ovr-r2-${Date.now()}`,
      teamId,
      type,
      value,
      originalScore: originalR2,
      adjustedScore: adjusted,
      note: note || `Admin ${type} adjustment of ${value}`,
      adminUser,
      updatedAt: Date.now()
    };

    if (type !== 'reset') {
      this.store.round2Config.scoreOverrides[teamId] = overrideObj;
    }

    this.logAction(adminUser, `QUIZ_SCORE_${type.toUpperCase()}`, 'TEAM_SCORE_R2', teamId, originalR2, {
      adjusted,
      type,
      value,
      note
    });

    this.recalculateRound2Scores();
    this.saveData();
    return overrideObj;
  }

  public recalculateRound2Scores() {
    if (!this.store.round2Config) this.store.round2Config = { phases: {}, scoreOverrides: {} };
    const overrides = this.store.round2Config.scoreOverrides || {};
    const submissions = this.store.quizSubmissions;
    const questions = this.store.quizQuestions;

    const r2Cfg = (this.store as any).masterScoringConfig?.r2;

    Object.values(this.store.teams).forEach(team => {
      const teamSubs = submissions.filter(s => s.teamId === team.id);
      
      const questionScores: Record<string, number> = {};
      teamSubs.forEach(s => {
        const q = questions[s.questionId];
        if (!q || q.isVoided) {
          questionScores[s.questionId] = 0;
          return;
        }

        // Calculate authoritative question weight
        let weight = q.points;
        if (r2Cfg) {
          if (r2Cfg.questionPointsOverride && r2Cfg.questionPointsOverride[q.id] !== undefined) {
            weight = r2Cfg.questionPointsOverride[q.id];
          } else if (q.difficulty === 'EASY') {
            weight = r2Cfg.pointsPerQuestion?.easy ?? r2Cfg.defaultEasyPoints ?? q.points ?? 2;
          } else if (q.difficulty === 'MEDIUM') {
            weight = r2Cfg.pointsPerQuestion?.medium ?? r2Cfg.defaultMediumPoints ?? q.points ?? 4;
          } else if (q.difficulty === 'HARD') {
            weight = r2Cfg.pointsPerQuestion?.hard ?? r2Cfg.defaultHardPoints ?? q.points ?? 6;
          }
        }
        if (!weight || weight <= 0) {
          weight = q.difficulty === 'HARD' ? 6 : q.difficulty === 'MEDIUM' ? 4 : 2;
        }

        if (q.isFullPointsAwarded || s.isCorrect) {
          questionScores[s.questionId] = weight;
        } else {
          const penalty = r2Cfg?.penaltyPerIncorrect ?? r2Cfg?.incorrectPenalty ?? 0;
          questionScores[s.questionId] = penalty > 0 ? -penalty : 0;
        }
      });

      // Questions with isFullPointsAwarded given to all teams
      Object.values(questions).forEach(q => {
        if (q.isFullPointsAwarded && !q.isVoided && questionScores[q.id] === undefined) {
          let weight = q.points;
          if (r2Cfg) {
            if (r2Cfg.questionPointsOverride && r2Cfg.questionPointsOverride[q.id] !== undefined) {
              weight = r2Cfg.questionPointsOverride[q.id];
            } else if (q.difficulty === 'EASY') {
              weight = r2Cfg.pointsPerQuestion?.easy ?? r2Cfg.defaultEasyPoints ?? q.points ?? 2;
            } else if (q.difficulty === 'MEDIUM') {
              weight = r2Cfg.pointsPerQuestion?.medium ?? r2Cfg.defaultMediumPoints ?? q.points ?? 4;
            } else if (q.difficulty === 'HARD') {
              weight = r2Cfg.pointsPerQuestion?.hard ?? r2Cfg.defaultHardPoints ?? q.points ?? 6;
            }
          }
          if (!weight || weight <= 0) {
            weight = q.difficulty === 'HARD' ? 6 : q.difficulty === 'MEDIUM' ? 4 : 2;
          }
          questionScores[q.id] = weight;
        }
      });

      const calculatedR2 = Object.values(questionScores).reduce((sum, pts) => sum + pts, 0);

      let finalR2 = calculatedR2;
      const override = overrides[team.id];
      if (override) {
        if (override.type === 'override') {
          finalR2 = override.value;
        } else if (override.type === 'bonus') {
          finalR2 = Number((calculatedR2 + override.value).toFixed(2));
        } else if (override.type === 'penalty') {
          finalR2 = Number(Math.max(0, calculatedR2 - override.value).toFixed(2));
        }
      }

      team.scores.r2 = finalR2;
    });

    this.recalculateTeamScores();
  }

  public getTeamQuizStats(): TeamQuizStats[] {
    this.recalculateRound2Scores();
    const teams = Object.values(this.store.teams);
    const submissions = this.store.quizSubmissions;
    const questions = this.store.quizQuestions;
    const overrides = this.store.round2Config?.scoreOverrides || {};

    return teams.map(team => {
      const teamSubs = submissions.filter(s => s.teamId === team.id);
      const stageScores: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      const categoryScores: Record<string, number> = {};
      let totalTime = 0;
      let correctCount = 0;

      teamSubs.forEach(s => {
        totalTime += (s.timeTakenSeconds || 0);
        const q = questions[s.questionId];
        if (q) {
          const isCorrect = q.isFullPointsAwarded || (!q.isVoided && s.isCorrect);
          if (isCorrect) {
            correctCount++;
            const pts = q.points;
            stageScores[q.stageNumber] = (stageScores[q.stageNumber] || 0) + pts;
            categoryScores[q.category] = (categoryScores[q.category] || 0) + pts;
          }
        }
      });

      const override = overrides[team.id];

      return {
        teamId: team.id,
        teamName: team.name,
        teamCode: team.team_code,
        totalSubmissions: teamSubs.length,
        correctSubmissions: correctCount,
        accuracy: teamSubs.length > 0 ? Number(((correctCount / teamSubs.length) * 100).toFixed(1)) : 0,
        totalTimeTaken: totalTime,
        stageScores,
        categoryScores,
        calculatedScore: team.scores.r2 || 0,
        overrideScore: override ? override.adjustedScore : undefined,
        finalRound2Score: team.scores.r2 || 0,
        overrideInfo: override
      };
    });
  }

  public getMasterScoringConfig(): MasterScoringConfig {
    if (!this.store.masterScoringConfig) {
      this.store.masterScoringConfig = getDefaultMasterScoringConfig();
    }
    return this.store.masterScoringConfig;
  }

  public updateMasterScoringConfig(
    newConfig: Partial<MasterScoringConfig>,
    adminUser = 'Admin'
  ): MasterScoringConfig {
    const prev = JSON.parse(JSON.stringify(this.getMasterScoringConfig()));
    this.store.masterScoringConfig = {
      ...this.store.masterScoringConfig,
      ...newConfig,
      r1: { ...this.store.masterScoringConfig.r1, ...(newConfig.r1 || {}) },
      r2: { ...this.store.masterScoringConfig.r2, ...(newConfig.r2 || {}) },
      r3: { ...this.store.masterScoringConfig.r3, ...(newConfig.r3 || {}) },
      r4: { ...this.store.masterScoringConfig.r4, ...(newConfig.r4 || {}) },
      tieBreakRules: {
        ...this.store.masterScoringConfig.tieBreakRules,
        ...(newConfig.tieBreakRules || {})
      },
      maxScores: {
        ...this.store.masterScoringConfig.maxScores,
        ...(newConfig.maxScores || {})
      }
    };

    this.recalculateTeamScores();
    this.logAction(
      adminUser,
      'UPDATE_MASTER_SCORING_CONFIG',
      'SCORING_CONFIG',
      'GLOBAL',
      prev,
      this.store.masterScoringConfig
    );
    this.saveData();
    return this.store.masterScoringConfig;
  }

  public overrideTeamScore(
    teamId: string,
    round: 'r1' | 'r2' | 'r3' | 'r4',
    type: 'override' | 'bonus' | 'penalty' | 'reset',
    value: number,
    reason: string,
    adminUser = 'Admin'
  ): ScoreOverrideRecord | null {
    const team = this.store.teams[teamId];
    if (!team) throw new Error('Team not found');

    const config = this.getMasterScoringConfig();
    const prevScore = team.scores?.[round] || 0;

    if (type === 'reset') {
      if (config[round]?.overrides) {
        delete config[round].overrides[teamId];
      }
      this.recalculateTeamScores();
      this.logAction(adminUser, 'RESET_TEAM_SCORE_OVERRIDE', 'TEAM_SCORE', `${team.name} - Round ${round}`, prevScore, {
        teamId,
        round,
        type: 'reset',
        newScore: team.scores[round]
      });
      this.saveData();
      return null;
    }

    const overrideRecord: ScoreOverrideRecord = {
      id: `ovr-${round}-${Date.now()}`,
      teamId,
      round,
      type,
      value: Number(value),
      reason: reason || `Admin score adjustment of ${value}`,
      adminUser,
      timestamp: Date.now()
    };

    if (!config[round].overrides) {
      config[round].overrides = {};
    }
    config[round].overrides[teamId] = overrideRecord;
    this.recalculateTeamScores();

    this.logAction(
      adminUser,
      `OVERRIDE_${round.toUpperCase()}_SCORE`,
      'TEAM_SCORE',
      `${team.name} - Round ${round}`,
      prevScore,
      {
        teamId,
        round,
        type,
        value,
        reason,
        finalScore: team.scores[round]
      }
    );
    this.saveData();
    return overrideRecord;
  }

  public getRoundScores(): Record<string, Record<'r1' | 'r2' | 'r3' | 'r4', RoundScoreRecord>> {
    if (!this.store.roundScores || Object.keys(this.store.roundScores).length === 0) {
      this.recalculateTeamScores();
    }
    return this.store.roundScores;
  }

  public recalculateTeamScores() {
    const config = this.getMasterScoringConfig();
    const { roundScores } = recalculateAllScores(this.store, config);
    this.store.roundScores = roundScores;
    this.saveData();
  }

  // ==========================================
  // ROUND 3: Code Minimalist Methods
  // ==========================================

  public getCodingProblems(): CodingProblem[] {
    const problems = Object.values(this.store.codingProblems);
    problems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.problemNumber ?? 0) - (b.problemNumber ?? 0));
    return problems.map((p, idx) => ({
      ...p,
      order: p.order ?? (idx + 1),
      problemNumber: p.problemNumber ?? (idx + 1),
      difficulty: p.difficulty || (idx === 0 ? 'Easy' : idx === 1 ? 'Medium' : 'Hard'),
      points: p.points || (idx === 0 ? 100 : idx === 1 ? 150 : 200),
      timeLimitSeconds: p.timeLimitSeconds || 2,
      memoryLimitMb: p.memoryLimitMb || 256,
      allowedLanguages: p.allowedLanguages && p.allowedLanguages.length > 0 ? p.allowedLanguages : ['C', 'C++', 'Java'],
      isEnabled: p.isEnabled !== undefined ? p.isEnabled : true,
      visibleTestCases: p.visibleTestCases || p.sampleTestCases || [],
      sampleTestCases: p.sampleTestCases || p.visibleTestCases || [],
      hiddenTestCases: p.hiddenTestCases || [],
      boilerplates: p.boilerplates || {
        C: getFullBoilerplate('C'),
        'C++': getFullBoilerplate('C++'),
        Java: getFullBoilerplate('Java')
      }
    }));
  }

  public getCodingProblem(id: string): CodingProblem | null {
    const p = this.store.codingProblems[id];
    if (!p) return null;
    return {
      ...p,
      order: p.order ?? 1,
      problemNumber: p.problemNumber ?? 1,
      difficulty: p.difficulty || 'Medium',
      points: p.points || 100,
      timeLimitSeconds: p.timeLimitSeconds || 2,
      memoryLimitMb: p.memoryLimitMb || 256,
      allowedLanguages: p.allowedLanguages || ['C', 'C++', 'Java'],
      isEnabled: p.isEnabled !== undefined ? p.isEnabled : true,
      visibleTestCases: p.visibleTestCases || p.sampleTestCases || [],
      sampleTestCases: p.sampleTestCases || p.visibleTestCases || [],
      hiddenTestCases: p.hiddenTestCases || [],
      boilerplates: p.boilerplates || {
        C: getFullBoilerplate('C'),
        'C++': getFullBoilerplate('C++'),
        Java: getFullBoilerplate('Java')
      }
    };
  }

  /**
   * Participant-safe view of problems: NEVER reveals hidden test cases
   */
  public getParticipantCodingProblems(): Partial<CodingProblem>[] {
    const problems = this.getCodingProblems().filter(p => p.isEnabled);
    return problems.map(p => ({
      id: p.id,
      order: p.order,
      problemNumber: p.problemNumber,
      title: p.title,
      description: p.description,
      statement: p.statement || p.description,
      inputFormat: p.inputFormat,
      outputFormat: p.outputFormat,
      constraints: p.constraints,
      difficulty: p.difficulty,
      points: p.points,
      timeLimitSeconds: p.timeLimitSeconds,
      memoryLimitMb: p.memoryLimitMb,
      allowedLanguages: p.allowedLanguages,
      boilerplates: p.boilerplates,
      sampleTestCases: p.sampleTestCases,
      visibleTestCases: p.visibleTestCases,
      prohibitedKeywords: p.prohibitedKeywords || [],
      rankingMetric: p.rankingMetric || 'characters',
      maxSubmissions: p.maxSubmissions || 20
    }));
  }

  public saveCodingProblem(problemData: Partial<CodingProblem>, isEdit: boolean, adminUser = 'Admin'): CodingProblem {
    const existingList = this.getCodingProblems();
    const id = problemData.id || `prob-${Date.now()}`;
    const existing = this.store.codingProblems[id];

    const sampleTests = problemData.visibleTestCases || problemData.sampleTestCases || (existing ? existing.sampleTestCases : []);
    const hiddenTests = problemData.hiddenTestCases || (existing ? existing.hiddenTestCases : []);

    let isEnabled = problemData.isEnabled !== undefined ? problemData.isEnabled : (existing ? existing.isEnabled : true);

    // Validation: Cannot enable a problem without at least one hidden test case
    if (isEnabled && (!hiddenTests || hiddenTests.length === 0)) {
      if (!isEdit) {
        isEnabled = false;
      } else {
        throw new Error('A problem cannot be enabled without at least one hidden testcase.');
      }
    }

    const defaultBoilerplates = {
      C: getFullBoilerplate('C'),
      'C++': getFullBoilerplate('C++'),
      Java: getFullBoilerplate('Java')
    };

    const updatedProblem: CodingProblem = {
      id,
      order: Number(problemData.order) || (existing ? existing.order : existingList.length + 1) || 1,
      problemNumber: Number(problemData.problemNumber) || (existing ? existing.problemNumber : existingList.length + 1) || 1,
      title: String(problemData.title || 'Untitled Problem').trim(),
      description: String(problemData.description || problemData.statement || '').trim(),
      statement: String(problemData.statement || problemData.description || '').trim(),
      inputFormat: String(problemData.inputFormat || '').trim(),
      outputFormat: String(problemData.outputFormat || '').trim(),
      constraints: String(problemData.constraints || '').trim(),
      difficulty: (problemData.difficulty as any) || 'Medium',
      points: Number(problemData.points) || 100,
      timeLimitSeconds: Number(problemData.timeLimitSeconds) || 2,
      memoryLimitMb: Number(problemData.memoryLimitMb) || 256,
      allowedLanguages: problemData.allowedLanguages && problemData.allowedLanguages.length > 0
        ? problemData.allowedLanguages
        : ['C', 'C++', 'Java'],
      boilerplates: {
        ...defaultBoilerplates,
        ...(existing?.boilerplates || {}),
        ...(problemData.boilerplates || {})
      },
      visibleTestCases: sampleTests,
      sampleTestCases: sampleTests,
      hiddenTestCases: hiddenTests,
      explanation: problemData.explanation || '',
      isEnabled: Boolean(isEnabled),
      prohibitedKeywords: problemData.prohibitedKeywords || ['system', 'fork', 'exec'],
      rankingMetric: problemData.rankingMetric || 'characters',
      referenceLengths: problemData.referenceLengths || { C: 150, 'C++': 140, Java: 180 },
      maxSubmissions: Number(problemData.maxSubmissions) || 20
    };

    this.store.codingProblems[id] = updatedProblem;
    this.logAction(adminUser, isEdit ? 'UPDATE_CODING_PROBLEM' : 'CREATE_CODING_PROBLEM', 'CODING_PROBLEM', id, existing, updatedProblem);
    this.saveData();
    return updatedProblem;
  }

  public updateProblemBoilerplates(id: string, boilerplates: Record<string, string>, adminUser = 'Admin'): CodingProblem {
    const existing = this.store.codingProblems[id];
    if (!existing) throw new Error('Problem not found');
    existing.boilerplates = {
      ...(existing.boilerplates || {}),
      ...boilerplates
    };
    this.logAction(adminUser, 'UPDATE_BOILERPLATE', 'CODING_PROBLEM', id, null, existing.boilerplates);
    this.saveData();
    return existing;
  }

  public deleteCodingProblem(id: string, adminUser = 'Admin') {
    const existing = this.store.codingProblems[id];
    if (!existing) throw new Error('Problem not found');

    delete this.store.codingProblems[id];
    this.logAction(adminUser, 'DELETE_CODING_PROBLEM', 'CODING_PROBLEM', id, existing, null);
    this.saveData();
  }

  public duplicateCodingProblem(id: string, adminUser = 'Admin'): CodingProblem {
    const orig = this.getCodingProblem(id);
    if (!orig) throw new Error('Original problem not found');

    const newId = `prob-${Date.now()}`;
    const count = Object.keys(this.store.codingProblems).length + 1;

    const copy: CodingProblem = {
      ...orig,
      id: newId,
      order: count,
      problemNumber: count,
      title: `Copy of ${orig.title}`,
      isEnabled: false
    };

    this.store.codingProblems[newId] = copy;
    this.logAction(adminUser, 'DUPLICATE_CODING_PROBLEM', 'CODING_PROBLEM', newId, null, copy);
    this.saveData();
    return copy;
  }

  public reorderCodingProblems(orderedIds: string[], adminUser = 'Admin') {
    orderedIds.forEach((id, index) => {
      const p = this.store.codingProblems[id];
      if (p) {
        p.order = index + 1;
        p.problemNumber = index + 1;
      }
    });

    this.logAction(adminUser, 'REORDER_CODING_PROBLEMS', 'CODING_PROBLEMS', 'BULK', null, { orderedIds });
    this.saveData();
  }

  public toggleCodingProblemEnabled(id: string, adminUser = 'Admin'): boolean {
    const p = this.store.codingProblems[id];
    if (!p) throw new Error('Problem not found');

    const willBeEnabled = !p.isEnabled;
    if (willBeEnabled && (!p.hiddenTestCases || p.hiddenTestCases.length === 0)) {
      throw new Error('A problem cannot be enabled without at least one hidden testcase.');
    }

    p.isEnabled = willBeEnabled;
    this.logAction(adminUser, willBeEnabled ? 'ENABLE_CODING_PROBLEM' : 'DISABLE_CODING_PROBLEM', 'CODING_PROBLEM', id, !willBeEnabled, willBeEnabled);
    this.saveData();
    return p.isEnabled;
  }

  public getCodeSubmissions(): CodeSubmission[] {
    return this.store.codeSubmissions || [];
  }

  public getTeamCodeSubmissions(teamId: string, problemId?: string): CodeSubmission[] {
    const subs = (this.store.codeSubmissions || []).filter(s => s.teamId === teamId);
    if (problemId) {
      return subs.filter(s => s.problemId === problemId);
    }
    return subs;
  }

  public saveCodeSubmission(submission: CodeSubmission): CodeSubmission {
    if (!this.store.codeSubmissions) {
      this.store.codeSubmissions = [];
    }
    this.store.codeSubmissions.unshift(submission);
    this.recalculateRound3Scores();
    this.saveData();
    return submission;
  }

  public async rejudgeCodeSubmission(subId: string, adminUser = 'Admin'): Promise<CodeSubmission> {
    const sub = (this.store.codeSubmissions || []).find(s => s.id === subId);
    if (!sub) throw new Error('Submission not found');

    const prob = this.store.codingProblems[sub.problemId];
    if (!prob) throw new Error('Problem associated with submission not found');

    const allTestCases = [...(prob.sampleTestCases || prob.visibleTestCases || []), ...(prob.hiddenTestCases || [])];
    const execResult = await executeCode(
      sub.language,
      sub.code,
      allTestCases,
      prob.prohibitedKeywords || [],
      sub.participantCode,
      prob.timeLimitSeconds || 2,
      prob.boilerplates
    );

    sub.allPassed = execResult.allPassed;
    sub.isAccepted = execResult.allPassed;
    sub.charCount = execResult.charCount;
    sub.executionStatus = execResult.allPassed
      ? 'passed'
      : (execResult.compileError ? 'compile_error' : 'failed');
    sub.compileError = execResult.compileError;
    sub.testResults = execResult.results;

    if (execResult.allPassed) {
      const basePoints = prob.points || 100;
      sub.score = basePoints;
    } else {
      sub.score = 0;
    }

    this.logAction(adminUser, 'REJUDGE_CODE_SUBMISSION', 'CODE_SUBMISSION', subId, null, {
      allPassed: sub.allPassed,
      executionStatus: sub.executionStatus,
      score: sub.score
    });

    this.recalculateRound3Scores();
    this.saveData();
    return sub;
  }

  public recalculateRound3Scores() {
    const submissions = this.store.codeSubmissions || [];
    const problems = this.store.codingProblems;

    Object.values(this.store.teams).forEach(team => {
      const teamSubs = submissions.filter(s => s.teamId === team.id);
      const bestSubsByProblem: Record<string, CodeSubmission> = {};

      teamSubs.forEach(s => {
        if (s.isAccepted || s.allPassed) {
          const existing = bestSubsByProblem[s.problemId];
          // Prefer lowest char count
          if (!existing || s.charCount < existing.charCount) {
            bestSubsByProblem[s.problemId] = s;
          }
        }
      });

      let r3TotalScore = 0;
      Object.values(bestSubsByProblem).forEach(sub => {
        const prob = problems[sub.problemId];
        const basePts = prob ? (prob.points || 100) : 100;
        r3TotalScore += (sub.overrideScore !== undefined ? sub.overrideScore : (sub.score || basePts));
      });

      team.scores.r3 = r3TotalScore;
    });

    this.recalculateTeamScores();
  }

  public restartRound3(adminUser = 'Admin') {
    this.store.codeSubmissions = [];
    Object.values(this.store.teams).forEach(t => {
      t.scores.r3 = 0;
    });

    this.logAction(adminUser, 'RESTART_ROUND_3', 'CONTEST_STATE', 'ROUND_3', null, {
      message: 'Round 3 submissions and scores reset. Problems preserved.'
    });

    this.recalculateTeamScores();
    this.saveData();
  }

  public restartRound4(adminUser = 'Admin') {
    this.store.crackProgress = {};
    this.store.crackAttempts = [];
    Object.values(this.store.crackChallenges).forEach(c => {
      c.isManuallyUnlockedForEveryone = false;
    });
    Object.values(this.store.teams).forEach(t => {
      if (!t.scores) t.scores = { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
      t.scores.r4 = 0;
    });

    this.logAction(adminUser, 'RESTART_ROUND_4', 'CONTEST_STATE', 'ROUND_4', null, {
      message: 'Round 4 challenge progress, attempts, and scores reset. All users start at Question 1.'
    });

    this.recalculateTeamScores();
    this.saveData();
  }

  public getLeaderboard(): LeaderboardEntry[] {
    this.recalculateTeamScores();
    const config = this.getMasterScoringConfig();
    return sortLeaderboard(
      Object.values(this.store.teams),
      this.store,
      config,
      this.store.roundScores || {}
    );
  }
}

export const db = new DatabaseService();
