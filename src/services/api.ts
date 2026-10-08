import {
  ContestState,
  Team,
  TeamCode,
  TypingRound,
  QuizStage,
  QuizQuestion,
  CodingProblem,
  CrackChallenge,
  CrackProgress,
  LeaderboardEntry,
  Announcement,
  AuditLog,
  Round1Config,
  MasterScoringConfig
} from '../types/contest';

const BASE_URL = '/api';

const nativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch;

async function fetch(input: RequestInfo | URL, init?: RequestInit, customTimeoutMs?: number): Promise<{
  ok: boolean;
  status: number;
  headers: Headers;
  json: () => Promise<any>;
  text: () => Promise<string>;
}> {
  const timeoutMs = customTimeoutMs || 35000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await nativeFetch(input, {
      ...init,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      json: async () => {
        try {
          return await res.json();
        } catch {
          return { success: res.ok, status: res.status, error: 'Invalid response format' };
        }
      },
      text: async () => {
        try {
          return await res.text();
        } catch {
          return '';
        }
      }
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    if (isTimeout) {
      console.warn(`[API] Request timed out after ${timeoutMs}ms for ${input.toString()}`);
    } else {
      console.warn(`[API] Request failed for ${input.toString()}:`, err.message);
    }
    const errMsg = isTimeout
      ? `Execution Timed Out after ${timeoutMs / 1000}s: The server or compiler took longer than expected. Check for infinite loops or try again.`
      : (err.message || 'Network error');
    return {
      ok: false,
      status: isTimeout ? 408 : 500,
      headers: new Headers(),
      json: async () => ({
        success: false,
        error: errMsg,
        message: errMsg,
        compileError: errMsg
      }),
      text: async () => errMsg
    };
  }
}

function getHeaders(token?: string | null, previewTeamId?: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (previewTeamId) {
    headers['x-preview-team-id'] = previewTeamId;
  }
  return headers;
}

export const api = {
  // Auth
  async adminLogin(password: string, username?: string) {
    const res = await fetch(`${BASE_URL}/auth/admin-login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password, username })
    });
    return res.json();
  },

  async teamLogin(teamCode: string, accessKey?: string, forceLogin?: boolean) {
    const res = await fetch(`${BASE_URL}/auth/team-login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ teamCode, accessKey, forceLogin })
    });
    return res.json();
  },

  async logout(token: string) {
    const res = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async verifyTeamCode(code: string) {
    const res = await fetch(`${BASE_URL}/auth/verify-code`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code })
    });
    return res.json();
  },

  async joinTeam(code: string, teamName: string) {
    const res = await fetch(`${BASE_URL}/auth/join-team`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code, teamName })
    });
    return res.json();
  },

  async getMe(token: string) {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Participant endpoints
  async getParticipantViewData(token: string, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/view-data`, {
      headers: getHeaders(token, previewTeamId)
    });
    return res.json();
  },

  async submitTyping(token: string, data: any, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/round1/submit`, {
      method: 'POST',
      headers: getHeaders(token, previewTeamId),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async submitQuiz(token: string, data: { questionId: string; answer: any; timeTakenSeconds: number }, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/round2/submit`, {
      method: 'POST',
      headers: getHeaders(token, previewTeamId),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async timeoutQuiz(token: string, data: { questionId?: string; phaseNumber?: number } = {}, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/round2/timeout`, {
      method: 'POST',
      headers: getHeaders(token, previewTeamId),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getParticipantQuizQuestions(token: string, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/round2/questions`, {
      headers: getHeaders(token, previewTeamId)
    });
    return res.json();
  },

  async completeQuiz(token: string, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/round2/complete`, {
      method: 'POST',
      headers: getHeaders(token, previewTeamId),
      body: JSON.stringify({})
    });
    return res.json();
  },

  // Round 3 Participant
  async getParticipantCodingProblems(token: string, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/round3/problems`, {
      headers: getHeaders(token, previewTeamId)
    });
    return res.json();
  },

  async runCode(token: string, data: { problemId: string; code?: string; participantCode?: string; language: string }, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/round3/run`, {
      method: 'POST',
      headers: getHeaders(token, previewTeamId),
      body: JSON.stringify(data)
    }, 45000);
    return res.json();
  },

  async submitCode(token: string, data: { problemId: string; code?: string; participantCode?: string; language: string; timeTakenSeconds?: number }, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/round3/submit`, {
      method: 'POST',
      headers: getHeaders(token, previewTeamId),
      body: JSON.stringify(data)
    }, 60000);
    return res.json();
  },

  async testCode(token: string, data: { problemId: string; code?: string; participantCode?: string; language: string }, previewTeamId?: string | null) {
    return this.runCode(token, data, previewTeamId);
  },

  async submitCrack(token: string, data: { challengeId: string; answer: string; timeTakenSeconds?: number }, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/round4/submit`, {
      method: 'POST',
      headers: getHeaders(token, previewTeamId),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async solveCrackChallenge(token: string, data: { challengeId: string; answer: string; timeTakenSeconds?: number }, previewTeamId?: string | null) {
    return this.submitCrack(token, data, previewTeamId);
  },

  async getStageData(token: string, previewTeamId?: string | null) {
    return this.getParticipantViewData(token, previewTeamId);
  },

  async getTeamProfile(token: string, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/profile`, {
      headers: getHeaders(token, previewTeamId)
    });
    return res.json();
  },

  async recordFullscreenViolation(token: string, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/fullscreen-violation`, {
      method: 'POST',
      headers: getHeaders(token, previewTeamId),
      body: JSON.stringify({})
    });
    return res.json();
  },
  async fullscreenTimeout(token: string, previewTeamId?: string | null) {
    const res = await fetch(`${BASE_URL}/participant/fullscreen-timeout`, {
      method: 'POST',
      headers: getHeaders(token, previewTeamId),
      body: JSON.stringify({})
    });
    return res.json();
  },

  async getTeams(token: string) {
    return this.getAdminTeams(token);
  },

  async getParticipantLeaderboard(token: string) {
    const res = await fetch(`${BASE_URL}/participant/leaderboard`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Admin Endpoints
  async setStage(token: string, stage: string) {
    const res = await fetch(`${BASE_URL}/admin/set-stage`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ stage })
    });
    return res.json();
  },

  async controlTimer(token: string, action: 'start' | 'pause' | 'resume' | 'end', extra?: any) {
    const endpoint = action === 'end' ? 'end' : action;
    const res = await fetch(`${BASE_URL}/admin/timer/${endpoint}`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(extra || {})
    });
    return res.json();
  },

  async restartRound(token: string, round?: string, durationSeconds?: number) {
    const res = await fetch(`${BASE_URL}/admin/round/restart`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ round, durationSeconds })
    });
    return res.json();
  },

  async endStage(token: string) {
    const res = await fetch(`${BASE_URL}/admin/end-stage`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async addTimerTime(token: string, seconds: number) {
    const res = await fetch(`${BASE_URL}/admin/timer/add-time`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ seconds })
    });
    return res.json();
  },

  async setTimerDuration(token: string, seconds: number, autoStart: boolean = false) {
    const res = await fetch(`${BASE_URL}/admin/timer/set`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ seconds, autoStart })
    });
    return res.json();
  },

  async toggleEmergencyLock(token: string, locked?: boolean) {
    const res = await fetch(`${BASE_URL}/admin/emergency-lock`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ locked })
    });
    return res.json();
  },

  async setSubround(token: string, data: { typingRoundId?: string; quizQuestionId?: string | null; codingProblemId?: string }) {
    const res = await fetch(`${BASE_URL}/admin/set-subround`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Team Codes
  async getTeamCodes(token: string) {
    const res = await fetch(`${BASE_URL}/admin/team-codes`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async generateTeamCodes(token: string, count: number) {
    const res = await fetch(`${BASE_URL}/admin/team-codes/generate`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ count })
    });
    return res.json();
  },

  async importTeamCodesCSV(token: string, csvText: string) {
    const res = await fetch(`${BASE_URL}/admin/team-codes/import`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ csvText })
    });
    return res.json();
  },

  async revokeTeamCode(token: string, code: string) {
    const res = await fetch(`${BASE_URL}/admin/team-codes/revoke`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ code })
    });
    return res.json();
  },

  async deleteTeamCode(token: string, code: string) {
    const res = await fetch(`${BASE_URL}/admin/team-codes/${code}`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Teams
  async getAdminTeams(token: string) {
    const res = await fetch(`${BASE_URL}/admin/teams`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async deleteTeam(token: string, teamId: string) {
    const res = await fetch(`${BASE_URL}/admin/teams/${encodeURIComponent(teamId)}`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || `Failed to delete team (HTTP ${res.status})`);
    }
    return data;
  },

  async toggleTeamLock(token: string, teamId: string) {
    const res = await fetch(`${BASE_URL}/admin/teams/${teamId}/lock`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async disqualifyTeam(token: string, teamId: string, reason?: string, restore?: boolean) {
    const res = await fetch(`${BASE_URL}/admin/teams/${teamId}/disqualify`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ reason, restore })
    });
    return res.json();
  },

  async renameTeam(token: string, teamId: string, name: string) {
    const res = await fetch(`${BASE_URL}/admin/teams/${teamId}/rename`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ name })
    });
    return res.json();
  },

  async forceLogoutTeam(token: string, teamId: string) {
    const res = await fetch(`${BASE_URL}/admin/teams/${teamId}/force-logout`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async overrideTeamScore(token: string, teamId: string, round: string, score: number) {
    const res = await fetch(`${BASE_URL}/admin/teams/${teamId}/override-score`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ round, score })
    });
    return res.json();
  },

  // Round 1
  async getTypingRounds(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round1/typing-rounds`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async saveTypingRound(token: string, round: Partial<TypingRound>, isEdit: boolean = false) {
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `${BASE_URL}/admin/round1/typing-rounds/${round.id}` : `${BASE_URL}/admin/round1/typing-rounds`;
    const res = await fetch(url, {
      method,
      headers: getHeaders(token),
      body: JSON.stringify(round)
    });
    return res.json();
  },

  async deleteTypingRound(token: string, id: string) {
    const res = await fetch(`${BASE_URL}/admin/round1/typing-rounds/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async duplicateTypingRound(token: string, id: string) {
    const res = await fetch(`${BASE_URL}/admin/round1/typing-rounds/${id}/duplicate`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async reorderTypingRounds(token: string, orderedIds: string[]) {
    const res = await fetch(`${BASE_URL}/admin/round1/typing-rounds/reorder`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ orderedIds })
    });
    return res.json();
  },

  async setActiveTypingRound(token: string, typingRoundId: string) {
    const res = await fetch(`${BASE_URL}/admin/round1/set-active`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ typingRoundId })
    });
    return res.json();
  },

  async getRound1Config(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round1/config`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async saveRound1Config(token: string, config: Partial<Round1Config>) {
    const res = await fetch(`${BASE_URL}/admin/round1/config`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(config)
    });
    return res.json();
  },

  async overrideTypingScore(token: string, data: { teamId: string; type: 'override' | 'bonus' | 'penalty' | 'reset'; value: number; note: string; typingRoundId?: string }) {
    const res = await fetch(`${BASE_URL}/admin/round1/score-override`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getTeamTypingStats(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round1/team-stats`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async startTypingInstructions(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round1/start-instructions`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async startTypingPractice(token: string, typingRoundId?: string) {
    const res = await fetch(`${BASE_URL}/admin/round1/start-practice`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ typingRoundId })
    });
    return res.json();
  },

  async startTypingTest(token: string, typingRoundId?: string) {
    const res = await fetch(`${BASE_URL}/admin/round1/start-test`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ typingRoundId })
    });
    return res.json();
  },

  async showTypingResults(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round1/show-results`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async nextTypingRound(token: string, autoStartPractice = false) {
    const res = await fetch(`${BASE_URL}/admin/round1/next-round`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ autoStartPractice })
    });
    return res.json();
  },

  async prevTypingRound(token: string, autoStartPractice = false) {
    const res = await fetch(`${BASE_URL}/admin/round1/prev-round`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ autoStartPractice })
    });
    return res.json();
  },

  async endRound1(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round1/end-round`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async getTypingSubmissions(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round1/submissions`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Round 2
  async getQuizPhases(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/phases`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async updateQuizPhase(token: string, phaseNumber: number, data: any) {
    const res = await fetch(`${BASE_URL}/admin/round2/phases/${phaseNumber}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async startQuizArena(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/start-arena`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async startQuizPhase(token: string, phaseNumber: number) {
    const res = await fetch(`${BASE_URL}/admin/round2/start-phase`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ phaseNumber })
    });
    return res.json();
  },

  async pauseQuizPhase(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/pause-phase`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async resumeQuizPhase(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/resume-phase`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async addTimeQuizPhase(token: string, seconds: number = 30) {
    const res = await fetch(`${BASE_URL}/admin/round2/add-time`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ seconds })
    });
    return res.json();
  },

  async getAdminQuizMonitoring(token: string, phase?: number) {
    const url = phase ? `${BASE_URL}/admin/round2/monitoring?phase=${phase}` : `${BASE_URL}/admin/round2/monitoring`;
    const res = await fetch(url, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async endRound2(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/end-round`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async getQuizStages(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/stages`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async saveQuizStage(token: string, stage: Partial<QuizStage>, isEdit: boolean = false) {
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `${BASE_URL}/admin/round2/stages/${stage.id}` : `${BASE_URL}/admin/round2/stages`;
    const res = await fetch(url, {
      method,
      headers: getHeaders(token),
      body: JSON.stringify(stage)
    });
    return res.json();
  },

  async deleteQuizStage(token: string, id: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/stages/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async getQuizQuestions(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/questions`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async bulkImportQuizQuestions(token: string, data: { questions?: Partial<QuizQuestion>[]; csvText?: string; overwrite?: boolean }) {
    const res = await fetch(`${BASE_URL}/admin/round2/questions/bulk-import`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async saveQuizQuestion(token: string, question: Partial<QuizQuestion>, isEdit: boolean = false) {
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `${BASE_URL}/admin/round2/questions/${question.id}` : `${BASE_URL}/admin/round2/questions`;
    const res = await fetch(url, {
      method,
      headers: getHeaders(token),
      body: JSON.stringify(question)
    });
    return res.json();
  },

  async deleteQuizQuestion(token: string, id: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/questions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async bulkDeleteQuizQuestions(token: string, data: { ids?: string[]; stageNumber?: number; clearAll?: boolean }) {
    const res = await fetch(`${BASE_URL}/admin/round2/questions/bulk-delete`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async duplicateQuizQuestion(token: string, id: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/questions/${id}/duplicate`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async reorderQuizQuestions(token: string, orderedIds: string[]) {
    const res = await fetch(`${BASE_URL}/admin/round2/questions/reorder`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ orderedIds })
    });
    return res.json();
  },

  async voidQuizQuestion(token: string, id: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/questions/${id}/void`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async awardAllQuizPoints(token: string, id: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/questions/${id}/award-all`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async launchQuizQuestion(token: string, questionId: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/launch-question`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ questionId })
    });
    return res.json();
  },

  async startQuizInstructions(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/start-instructions`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async closeQuizQuestion(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/close-question`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async nextQuizQuestion(token: string, autoLaunch: boolean = false) {
    const res = await fetch(`${BASE_URL}/admin/round2/next-question`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ autoLaunch })
    });
    return res.json();
  },

  async prevQuizQuestion(token: string, autoLaunch: boolean = false) {
    const res = await fetch(`${BASE_URL}/admin/round2/prev-question`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ autoLaunch })
    });
    return res.json();
  },

  async showQuizResults(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/show-results`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async toggleQuizLeaderboard(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/toggle-leaderboard`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async getQuizSubmissions(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/submissions`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async getTeamQuizStats(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round2/team-stats`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async overrideQuizScore(token: string, data: { teamId: string; type: 'override' | 'bonus' | 'penalty' | 'reset'; value: number; note: string }) {
    const res = await fetch(`${BASE_URL}/admin/round2/score-override`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async qualifyQuizTeams(token: string, data: { teamIds?: string[]; topN?: number; minScore?: number }) {
    const res = await fetch(`${BASE_URL}/admin/round2/qualify-teams`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Round 3
  async startRound3(token: string, durationSeconds: number = 1800) {
    const res = await fetch(`${BASE_URL}/admin/round3/start`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ durationSeconds })
    });
    return res.json();
  },

  async pauseRound3(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round3/pause`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async resumeRound3(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round3/resume`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async restartRound3(token: string, durationSeconds: number = 1800) {
    const res = await fetch(`${BASE_URL}/admin/round3/restart`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ durationSeconds })
    });
    return res.json();
  },

  async endRound3(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round3/end`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async getCodingProblems(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round3/problems`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async saveCodingProblem(token: string, prob: Partial<CodingProblem>, isEdit: boolean = false) {
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `${BASE_URL}/admin/round3/problems/${prob.id}` : `${BASE_URL}/admin/round3/problems`;
    const res = await fetch(url, {
      method,
      headers: getHeaders(token),
      body: JSON.stringify(prob)
    });
    return res.json();
  },

  async updateProblemBoilerplates(token: string, problemId: string, boilerplates: Record<string, string>) {
    const res = await fetch(`${BASE_URL}/admin/round3/problems/${problemId}/boilerplate`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify({ boilerplates })
    });
    return res.json();
  },

  async deleteCodingProblem(token: string, id: string) {
    const res = await fetch(`${BASE_URL}/admin/round3/problems/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async duplicateCodingProblem(token: string, id: string) {
    const res = await fetch(`${BASE_URL}/admin/round3/problems/${id}/duplicate`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async reorderCodingProblems(token: string, orderedIds: string[]) {
    const res = await fetch(`${BASE_URL}/admin/round3/problems/reorder`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ orderedIds })
    });
    return res.json();
  },

  async toggleCodingProblem(token: string, id: string) {
    const res = await fetch(`${BASE_URL}/admin/round3/problems/${id}/toggle`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async getCodeSubmissions(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round3/submissions`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async rejudgeCodeSubmission(token: string, id: string) {
    const res = await fetch(`${BASE_URL}/admin/round3/submissions/${id}/rejudge`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async getRound3Stats(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round3/stats`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Round 4
  async getCrackChallenges(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round4/challenges`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async saveCrackChallenge(token: string, ch: Partial<CrackChallenge>, isEdit: boolean = false) {
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `${BASE_URL}/admin/round4/challenges/${ch.id}` : `${BASE_URL}/admin/round4/challenges`;
    const res = await fetch(url, {
      method,
      headers: getHeaders(token),
      body: JSON.stringify(ch)
    });
    return res.json();
  },

  async getCrackProgress(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round4/progress`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async manualUnlockChallenge(token: string, challengeId: string, teamId?: string) {
    const res = await fetch(`${BASE_URL}/admin/round4/manual-unlock`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ challengeId, teamId })
    });
    return res.json();
  },

  async startRound4(token: string, durationSeconds: number = 1800) {
    const res = await fetch(`${BASE_URL}/admin/round4/start`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ durationSeconds })
    });
    return res.json();
  },

  async pauseRound4(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round4/pause`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async resumeRound4(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round4/resume`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async restartRound4(token: string, durationSeconds: number = 1800) {
    const res = await fetch(`${BASE_URL}/admin/round4/restart`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ durationSeconds })
    });
    return res.json();
  },

  async endRound4(token: string) {
    const res = await fetch(`${BASE_URL}/admin/round4/end`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Leaderboard & Qualification
  async getAdminLeaderboard(token: string) {
    const res = await fetch(`${BASE_URL}/admin/leaderboard`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async applyQualificationRule(token: string, data: { round: string; ruleType: string; value: any }) {
    const res = await fetch(`${BASE_URL}/admin/qualification/apply-rule`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async toggleManualQualification(token: string, teamId: string, round: string, qualified: boolean) {
    const res = await fetch(`${BASE_URL}/admin/qualification/manual-toggle`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ teamId, round, qualified })
    });
    return res.json();
  },

  async toggleLeaderboardVisibility(token: string, visible?: boolean) {
    const res = await fetch(`${BASE_URL}/admin/leaderboard/toggle-visibility`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ visible })
    });
    return res.json();
  },

  async toggleLeaderboardFreeze(token: string, frozen?: boolean) {
    const res = await fetch(`${BASE_URL}/admin/leaderboard/toggle-freeze`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ frozen })
    });
    return res.json();
  },

  async updateScoringWeights(token: string, weights: { r1: number; r2: number; r3: number; r4: number }) {
    const res = await fetch(`${BASE_URL}/admin/scoring/weights`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(weights)
    });
    return res.json();
  },

  // Central Configurable Scoring Engine
  async getMasterScoringConfig(token: string) {
    const res = await fetch(`${BASE_URL}/admin/scoring/config`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async updateMasterScoringConfig(token: string, config: Partial<MasterScoringConfig>) {
    const res = await fetch(`${BASE_URL}/admin/scoring/config`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(config)
    });
    return res.json();
  },

  async recalculateScores(token: string) {
    const res = await fetch(`${BASE_URL}/admin/scoring/recalculate`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  async overrideScore(token: string, data: {
    teamId: string;
    round: 'r1' | 'r2' | 'r3' | 'r4';
    type?: 'override' | 'bonus' | 'penalty' | 'reset';
    value?: number;
    reason?: string;
  }) {
    const res = await fetch(`${BASE_URL}/admin/scoring/override`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getRoundScores(token: string) {
    const res = await fetch(`${BASE_URL}/admin/scoring/round-scores`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Announcements
  async getAnnouncements(token: string) {
    const res = await fetch(`${BASE_URL}/admin/announcements`, {
      headers: getHeaders(token)
    });
    return res.json();
  },

  async createAnnouncement(token: string, data: { title: string; message: string; type: string; target: any }) {
    const res = await fetch(`${BASE_URL}/admin/announcements`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async dismissAnnouncement(token: string) {
    const res = await fetch(`${BASE_URL}/admin/announcements/dismiss`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Audit Logs
  async getAuditLogs(token: string) {
    const res = await fetch(`${BASE_URL}/admin/audit-logs`, {
      headers: getHeaders(token)
    });
    return res.json();
  }
};
