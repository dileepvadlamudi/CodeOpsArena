import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CodingProblem, CodeSubmission, ContestState, TestCase } from '../../types/contest';
import {
  Code2,
  Plus,
  Edit2,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  Square,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode,
  Sparkles,
  Eye,
  Layers,
  ArrowUp,
  ArrowDown,
  Copy,
  Clock,
  Check,
  Shield,
  Filter,
  BarChart3,
  Cpu
} from 'lucide-react';

interface Round3AdminTabProps {
  contestState: ContestState;
  onRefresh: () => void;
}

const STANDARD_TEMPLATES: Record<'C' | 'C++' | 'Java', string> = {
  C: `#include <stdio.h>\n#include <string.h>\n#include <stdlib.h>\n\nint main() {\n    char s[1005];\n    if (scanf("%s", s) == 1) {\n        // Write your code here\n    }\n    return 0;\n}`,
  'C++': `#include <iostream>\n#include <string>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    string s;\n    if (cin >> s) {\n        // Write your code here\n    }\n    return 0;\n}`,
  Java: `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNext()) {\n            String s = sc.next();\n            // Write your code here\n        }\n    }\n}`
};

export const getBoilerplateString = (boilerplates: any, lang: 'C' | 'C++' | 'Java'): string => {
  if (!boilerplates) return STANDARD_TEMPLATES[lang];
  const raw = boilerplates[lang];
  if (typeof raw === 'string' && raw.trim().length > 0) return raw;
  if (typeof raw === 'object' && raw !== null) {
    const top = raw.top || raw.prefix || '';
    const bottom = raw.bottom || raw.suffix || '';
    return `${top}\n        // Write your code here\n${bottom}`;
  }
  return STANDARD_TEMPLATES[lang];
};

export const Round3AdminTab: React.FC<Round3AdminTabProps> = ({ contestState, onRefresh }) => {
  const { token } = useAuth();
  const [subTab, setSubTab] = useState<'CONTROLS' | 'PROBLEMS' | 'MATRIX' | 'SUBMISSIONS'>('CONTROLS');
  const [problems, setProblems] = useState<CodingProblem[]>([]);
  const [submissions, setSubmissions] = useState<CodeSubmission[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Round duration input
  const [roundDurationMinutes, setRoundDurationMinutes] = useState(30);

  // Editing Problem
  const [editingProblem, setEditingProblem] = useState<Partial<CodingProblem> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeBoilerplateLang, setActiveBoilerplateLang] = useState<'C' | 'C++' | 'Java'>('C++');

  // Dedicated Quick Boilerplate Modal State
  const [boilerplateProblem, setBoilerplateProblem] = useState<CodingProblem | null>(null);
  const [quickBoilerplateLang, setQuickBoilerplateLang] = useState<'C' | 'C++' | 'Java'>('C++');
  const [quickBoilerplates, setQuickBoilerplates] = useState<Record<string, string>>({});
  const [isSavingBoilerplate, setIsSavingBoilerplate] = useState(false);

  // Submissions filter & inspect
  const [inspectedSub, setInspectedSub] = useState<CodeSubmission | null>(null);
  const [problemFilter, setProblemFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const handleOpenBoilerplateModal = (prob: CodingProblem) => {
    setBoilerplateProblem(prob);
    setQuickBoilerplates({
      C: getBoilerplateString(prob.boilerplates, 'C'),
      'C++': getBoilerplateString(prob.boilerplates, 'C++'),
      Java: getBoilerplateString(prob.boilerplates, 'Java')
    });
    setQuickBoilerplateLang('C++');
  };

  const handleSaveQuickBoilerplates = async () => {
    if (!token || !boilerplateProblem) return;
    setIsSavingBoilerplate(true);
    try {
      const res = await api.updateProblemBoilerplates(token, boilerplateProblem.id, quickBoilerplates);
      if (res.success) {
        showFeedback(`Boilerplates successfully saved for Problem #${boilerplateProblem.problemNumber || boilerplateProblem.title}.`);
        setBoilerplateProblem(null);
        fetchRound3Data();
        onRefresh();
      } else {
        showFeedback(res.message || 'Failed to update boilerplates', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error updating boilerplates', 'error');
    } finally {
      setIsSavingBoilerplate(false);
    }
  };

  const handleResetQuickBoilerplate = (lang: 'C' | 'C++' | 'Java') => {
    setQuickBoilerplates(prev => ({
      ...prev,
      [lang]: STANDARD_TEMPLATES[lang]
    }));
  };

  const fetchRound3Data = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [pRes, sRes, statsRes] = await Promise.all([
        api.getCodingProblems(token),
        api.getCodeSubmissions(token),
        api.getRound3Stats(token)
      ]);
      if (pRes.success) setProblems(pRes.problems);
      if (sRes.success) setSubmissions(sRes.submissions);
      if (statsRes.success) setStats(statsRes);
    } catch (err) {
      console.error('Error fetching round 3 data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRound3Data();
  }, [token]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  };

  // ================= ROUND CONTROLS (ROUND-LEVEL ONLY) =================
  const handleStartRound = async () => {
    if (!token) return;
    try {
      const res = await api.startRound3(token, roundDurationMinutes * 60);
      if (res.success) {
        showFeedback(`Round 3 started (${roundDurationMinutes} mins). All enabled problems are now available.`);
        fetchRound3Data();
        onRefresh();
      } else {
        showFeedback(res.message || 'Failed to start Round 3', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error starting round', 'error');
    }
  };

  const handlePauseRound = async () => {
    if (!token) return;
    try {
      const res = await api.pauseRound3(token);
      if (res.success) {
        showFeedback('Round 3 paused.');
        fetchRound3Data();
        onRefresh();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error pausing round', 'error');
    }
  };

  const handleResumeRound = async () => {
    if (!token) return;
    try {
      const res = await api.resumeRound3(token);
      if (res.success) {
        showFeedback('Round 3 resumed.');
        fetchRound3Data();
        onRefresh();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error resuming round', 'error');
    }
  };

  const handleRestartRound = async () => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to RESTART Round 3? All participant submissions and Round 3 scores will be reset! Problems will be kept intact.')) {
      return;
    }
    try {
      const res = await api.restartRound3(token, roundDurationMinutes * 60);
      if (res.success) {
        showFeedback('Round 3 restarted. Submissions and scores reset.');
        fetchRound3Data();
        onRefresh();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error restarting round', 'error');
    }
  };

  const handleEndRound = async () => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to END Round 3? Timer will stop and final scores will be tallied.')) {
      return;
    }
    try {
      const res = await api.endRound3(token);
      if (res.success) {
        showFeedback('Round 3 ended. Final scores tallied.');
        fetchRound3Data();
        onRefresh();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error ending round', 'error');
    }
  };

  // ================= PROBLEM BANK CRUD =================
  const handleToggleEnabled = async (prob: CodingProblem) => {
    if (!token) return;
    if (!prob.isEnabled && (!prob.hiddenTestCases || prob.hiddenTestCases.length === 0)) {
      showFeedback('Cannot enable problem: A problem must have at least one hidden testcase.', 'error');
      return;
    }
    try {
      const res = await api.toggleCodingProblem(token, prob.id);
      if (res.success) {
        showFeedback(`Problem ${prob.problemNumber} ${res.isEnabled ? 'enabled' : 'disabled'}.`);
        fetchRound3Data();
        onRefresh();
      } else {
        showFeedback(res.message || 'Failed to toggle problem', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error toggling problem', 'error');
    }
  };

  const handleMoveProblem = async (index: number, direction: 'up' | 'down') => {
    if (!token) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= problems.length) return;

    const newOrder = [...problems];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    const orderedIds = newOrder.map(p => p.id);
    try {
      const res = await api.reorderCodingProblems(token, orderedIds);
      if (res.success) {
        setProblems(res.problems);
        showFeedback('Problems reordered.');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Failed to reorder', 'error');
    }
  };

  const handleDuplicateProblem = async (probId: string) => {
    if (!token) return;
    try {
      const res = await api.duplicateCodingProblem(token, probId);
      if (res.success) {
        showFeedback('Problem duplicated.');
        fetchRound3Data();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error duplicating', 'error');
    }
  };

  const handleDeleteProblem = async (probId: string) => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to delete this problem?')) return;
    try {
      const res = await api.deleteCodingProblem(token, probId);
      if (res.success) {
        showFeedback('Problem deleted.');
        fetchRound3Data();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error deleting', 'error');
    }
  };

  const handleSaveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingProblem) return;

    // Check hidden test cases constraint
    const hiddenTests = editingProblem.hiddenTestCases || [];
    if (editingProblem.isEnabled && hiddenTests.length === 0) {
      showFeedback('Cannot enable: Problem must contain at least one hidden test case.', 'error');
      return;
    }

    try {
      const res = await api.saveCodingProblem(token, editingProblem, isEditing);
      if (res.success) {
        showFeedback(`Problem saved successfully.`);
        setEditingProblem(null);
        fetchRound3Data();
        onRefresh();
      } else {
        showFeedback(res.message || 'Failed to save problem', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error saving coding problem', 'error');
    }
  };

  const handleRejudgeSubmission = async (subId: string) => {
    if (!token) return;
    try {
      const res = await api.rejudgeCodeSubmission(token, subId);
      if (res.success) {
        showFeedback(`Submission re-judged: ${res.submission.executionStatus.toUpperCase()} (${res.submission.score} pts)`);
        fetchRound3Data();
        if (inspectedSub && inspectedSub.id === subId) {
          setInspectedSub(res.submission);
        }
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error re-judging submission', 'error');
    }
  };

  // State checks
  const isRound3Active = contestState.currentStage === 'ROUND_3_CODE' || contestState.currentStage === 'R3_CODE';
  const isPaused = contestState.eventStatus === 'PAUSED' || contestState.timer?.isPaused;
  const isEnded = contestState.currentStage === 'ROUND_3_RESULTS' || contestState.currentStage === 'R3_RESULTS';

  const filteredSubmissions = submissions.filter(s => {
    if (problemFilter !== 'ALL' && s.problemId !== problemFilter) return false;
    if (statusFilter === 'ACCEPTED' && !s.isAccepted) return false;
    if (statusFilter === 'FAILED' && s.isAccepted) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Alert / Notification Feedback */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg transition-all animate-in slide-in-from-top-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-800'
              : 'bg-rose-950/90 text-rose-300 border border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setSubTab('CONTROLS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'CONTROLS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Play className="w-4 h-4" /> Round Controls & Live Status
          </button>
          <button
            onClick={() => setSubTab('PROBLEMS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'PROBLEMS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" /> Problem Bank ({problems.length})
          </button>
          <button
            onClick={() => setSubTab('MATRIX')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'MATRIX'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Live Solve Matrix
          </button>
          <button
            onClick={() => setSubTab('SUBMISSIONS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'SUBMISSIONS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileCode className="w-4 h-4" /> Submissions & Re-judge ({submissions.length})
          </button>
        </div>

        {subTab === 'PROBLEMS' && (
          <button
            onClick={() => {
              const num = problems.length + 1;
              setEditingProblem({
                id: `prob-${Date.now()}`,
                order: num,
                problemNumber: num,
                title: `Problem ${num}: Minimalist Logic Challenge`,
                description: 'Write a program in C, C++, or Java that processes the given input and produces the exact output using the minimum number of non-whitespace characters.',
                statement: 'Write a program in C, C++, or Java that processes the given input and produces the exact output using the minimum number of non-whitespace characters.',
                inputFormat: 'A single integer or formatted text from standard input.',
                outputFormat: 'Result printed to standard output.',
                constraints: '1 <= N <= 1000',
                difficulty: 'Medium',
                points: 100,
                timeLimitSeconds: 2,
                memoryLimitMb: 256,
                allowedLanguages: ['C', 'C++', 'Java'],
                isEnabled: false,
                sampleTestCases: [
                  { id: `st-${Date.now()}-1`, input: '10', expectedOutput: '20', isHidden: false, explanation: 'Sample test' }
                ],
                visibleTestCases: [
                  { id: `st-${Date.now()}-1`, input: '10', expectedOutput: '20', isHidden: false, explanation: 'Sample test' }
                ],
                hiddenTestCases: [
                  { id: `ht-${Date.now()}-1`, input: '42', expectedOutput: '84', isHidden: true }
                ],
                prohibitedKeywords: ['system', 'fork', 'exec'],
                rankingMetric: 'characters',
                referenceLengths: { C: 150, 'C++': 140, Java: 180 },
                maxSubmissions: 20
              });
              setIsEditing(false);
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Programming Problem
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* 1. ROUND CONTROLS (ROUND-LEVEL ONLY)                      */}
      {/* ======================================================== */}
      {subTab === 'CONTROLS' && (
        <div className="space-y-6">
          {/* Main Status & Action Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs font-bold uppercase tracking-wider">
                    Round 3 — Code Minimalist
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      isRound3Active
                        ? (isPaused ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800 animate-pulse')
                        : (isEnded ? 'bg-slate-800 text-slate-300' : 'bg-slate-950 text-slate-400 border border-slate-800')
                    }`}
                  >
                    {isRound3Active ? (isPaused ? 'PAUSED' : 'LIVE & ACTIVE') : (isEnded ? 'COMPLETED / RESULTS' : 'IDLE / NOT STARTED')}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white">Universal Round Controls</h2>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                  Admin controls the round, not individual problems. When Round 3 starts, all eligible teams enter simultaneously, all enabled problems become available immediately, and participants can freely choose and navigate between problems.
                </p>
              </div>

              {/* Timer status badge */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-right min-w-[160px]">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Remaining Time</span>
                <div className="text-2xl font-black font-mono text-indigo-400">
                  {Math.floor((contestState.timer?.remainingSeconds || 0) / 60)}:
                  {String((contestState.timer?.remainingSeconds || 0) % 60).padStart(2, '0')}
                </div>
                <span className="text-[10px] text-slate-500 font-medium">
                  {contestState.timer?.isRunning ? 'Running live' : (contestState.timer?.isPaused ? 'Timer paused' : 'Timer stopped')}
                </span>
              </div>
            </div>

            {/* Round Buttons Panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Start Round 3 */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-bold text-white mb-1">Start Round 3</div>
                  <p className="text-[11px] text-slate-400">Enter Round 3 and make all enabled problems live for all teams.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-400 font-mono">Mins:</label>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={roundDurationMinutes}
                      onChange={(e) => setRoundDurationMinutes(Number(e.target.value) || 30)}
                      disabled={isRound3Active}
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                  </div>
                  <button
                    onClick={handleStartRound}
                    disabled={isRound3Active && !isPaused}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
                  >
                    <Play className="w-4 h-4" /> Start Round 3
                  </button>
                </div>
              </div>

              {/* Pause Round 3 */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-bold text-white mb-1">Pause Round 3</div>
                  <p className="text-[11px] text-slate-400">Freeze countdown and block new submissions for all participants.</p>
                </div>
                <button
                  onClick={handlePauseRound}
                  disabled={!isRound3Active || isPaused}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/30 cursor-pointer"
                >
                  <Pause className="w-4 h-4" /> Pause Round
                </button>
              </div>

              {/* Resume Round 3 */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-bold text-white mb-1">Resume Round 3</div>
                  <p className="text-[11px] text-slate-400">Unfreeze countdown and re-enable code evaluation.</p>
                </div>
                <button
                  onClick={handleResumeRound}
                  disabled={!isRound3Active || !isPaused}
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  <Play className="w-4 h-4" /> Resume Round
                </button>
              </div>

              {/* Restart Round 3 */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-bold text-white mb-1">Restart Round 3</div>
                  <p className="text-[11px] text-slate-400">Clear all submissions and scores for Round 3 and reset timer.</p>
                </div>
                <button
                  onClick={handleRestartRound}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Restart Round
                </button>
              </div>

              {/* End Round 3 */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-bold text-white mb-1">End Round 3</div>
                  <p className="text-[11px] text-slate-400">Stop round, calculate final scores, and transition to Results view.</p>
                </div>
                <button
                  onClick={handleEndRound}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Square className="w-4 h-4" /> End Round 3
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Total Problems</span>
              <div className="text-2xl font-black text-white">{problems.length}</div>
              <span className="text-[11px] text-emerald-400 font-medium">{problems.filter(p => p.isEnabled).length} Enabled for Teams</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Total Submissions</span>
              <div className="text-2xl font-black text-white">{submissions.length}</div>
              <span className="text-[11px] text-indigo-400 font-medium">{submissions.filter(s => s.isAccepted).length} Accepted Solutions</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Execution Engine</span>
              <div className="text-sm font-black text-emerald-300 flex items-center gap-1.5 mt-1">
                <Cpu className="w-4 h-4" /> Native GCC / Clang / JDK
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">C, C++, Java sandboxed</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Scoring Metric</span>
              <div className="text-sm font-black text-amber-300 mt-1">Code Minimalist (Net Non-WS Chars)</div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Problems solved &gt; Chars &gt; Time</span>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. PROBLEM BANK MANAGER                                  */}
      {/* ======================================================== */}
      {subTab === 'PROBLEMS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Drag or use arrows to order problems. Only enabled problems with at least one hidden testcase appear to participants.</span>
            <span>{problems.filter(p => p.isEnabled).length} of {problems.length} active</span>
          </div>

          <div className="space-y-4">
            {problems.map((prob, idx) => (
              <div
                key={prob.id}
                className={`bg-slate-900 border rounded-2xl p-5 shadow-xl transition-all ${
                  prob.isEnabled ? 'border-slate-800' : 'border-slate-850 opacity-75'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-sm text-indigo-400">
                      #{prob.problemNumber || idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{prob.title}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            prob.difficulty === 'Easy'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : prob.difficulty === 'Hard'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {prob.difficulty || 'Medium'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-950 text-slate-300 border border-slate-800 text-[10px] font-mono">
                          {prob.points || 100} pts
                        </span>
                        {prob.isEnabled ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                            ENABLED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold">
                            DISABLED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        ID: {prob.id} • Time Limit: {prob.timeLimitSeconds || 2}s • Languages: {(prob.allowedLanguages || ['C', 'C++', 'Java']).join(', ')}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {/* Toggle Enabled */}
                    <button
                      onClick={() => handleToggleEnabled(prob)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        prob.isEnabled
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                      title={prob.isEnabled ? 'Disable this problem' : 'Enable this problem'}
                    >
                      {prob.isEnabled ? 'Enabled' : 'Enable Problem'}
                    </button>

                    {/* Move Up */}
                    <button
                      onClick={() => handleMoveProblem(idx, 'up')}
                      disabled={idx === 0}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Move Down */}
                    <button
                      onClick={() => handleMoveProblem(idx, 'down')}
                      disabled={idx === problems.length - 1}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Duplicate */}
                    <button
                      onClick={() => handleDuplicateProblem(prob.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                      title="Duplicate Problem"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Boilerplate */}
                    <button
                      onClick={() => handleOpenBoilerplateModal(prob)}
                      className="px-2.5 py-2 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Edit Starter Boilerplate"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Boilerplate</span>
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => {
                        setEditingProblem({ ...prob });
                        setIsEditing(true);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white cursor-pointer"
                      title="Edit Problem"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteProblem(prob.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900 text-rose-400 hover:text-white cursor-pointer"
                      title="Delete Problem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 mb-3 leading-relaxed">{prob.description}</p>

                {/* Test Cases summary row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Visible / Sample Testcases ({(prob.visibleTestCases || prob.sampleTestCases || []).length})
                    </span>
                    <div className="space-y-1">
                      {(prob.visibleTestCases || prob.sampleTestCases || []).slice(0, 2).map((tc, tIdx) => (
                        <div key={tc.id || tIdx} className="text-[11px] text-slate-300">
                          In: <span className="text-indigo-300">{tc.input}</span> → Out: <span className="text-emerald-300">{tc.expectedOutput}</span>
                        </div>
                      ))}
                      {(prob.visibleTestCases || prob.sampleTestCases || []).length > 2 && (
                        <span className="text-[10px] text-slate-500 block">+{(prob.visibleTestCases || prob.sampleTestCases || []).length - 2} more visible test cases</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Hidden Testcases ({(prob.hiddenTestCases || []).length}) — Judging Suite
                    </span>
                    <div className="space-y-1">
                      {(prob.hiddenTestCases || []).slice(0, 2).map((tc, tIdx) => (
                        <div key={tc.id || tIdx} className="text-[11px] text-slate-300">
                          In: <span className="text-indigo-300">{tc.input}</span> → Out: <span className="text-emerald-300">{tc.expectedOutput}</span>
                        </div>
                      ))}
                      {(prob.hiddenTestCases || []).length === 0 && (
                        <span className="text-[11px] text-rose-400">⚠️ No hidden testcases! Must add at least 1 to enable.</span>
                      )}
                      {(prob.hiddenTestCases || []).length > 2 && (
                        <span className="text-[10px] text-slate-500 block">+{(prob.hiddenTestCases || []).length - 2} more hidden test cases</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Boilerplate summary bar */}
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                      <Code2 className="w-3 h-3 text-indigo-400" />
                      Starter Boilerplates:
                    </span>
                    {(['C', 'C++', 'Java'] as const).map(l => (
                      <span key={l} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300">
                        <strong className="text-indigo-300">{l}</strong>: {getBoilerplateString(prob.boilerplates, l).replace(/\s+/g, '').length} chars
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenBoilerplateModal(prob)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    Edit Starter Code →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. LIVE MATRIX TAB                                       */}
      {/* ======================================================== */}
      {subTab === 'MATRIX' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Live Team Problem Solving Matrix</h3>
            <p className="text-xs text-slate-400 mb-4">
              Real-time matrix showing which problems have been solved by each team, with the best character count recorded for Code Minimalist ranking.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4">Solved</th>
                    <th className="py-3 px-4">Total Chars</th>
                    <th className="py-3 px-4">R3 Score</th>
                    {problems.map(p => (
                      <th key={p.id} className="py-3 px-4 text-center">
                        P{p.problemNumber || p.order}
                        <span className="block text-[9px] text-slate-500 font-normal">
                          {p.points}pts
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {stats?.matrix?.map((row: any) => (
                    <tr key={row.teamId} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-white">
                        <div>{row.teamName}</div>
                        <span className="text-[10px] text-slate-500 font-mono">{row.teamCode}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        {row.solvedCount} / {problems.filter(p => p.isEnabled).length}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {row.totalChars}c
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-indigo-300">
                        {row.scoreR3} pts
                      </td>
                      {problems.map(p => {
                        const status = row.problemStatus?.[p.id];
                        return (
                          <td key={p.id} className="py-3 px-4 text-center font-mono">
                            {status?.solved ? (
                              <span className="inline-block px-2 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-bold">
                                ✓ {status.bestChars}c
                              </span>
                            ) : status?.attempts > 0 ? (
                              <span className="inline-block px-2 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-900 text-[10px]">
                                ✗ ({status.attempts})
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {(!stats?.matrix || stats.matrix.length === 0) && (
                    <tr>
                      <td colSpan={4 + problems.length} className="py-8 text-center text-slate-500">
                        No team activity recorded for Round 3 yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. SUBMISSIONS & RE-JUDGE TAB                            */}
      {/* ======================================================== */}
      {subTab === 'SUBMISSIONS' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-300">Filter by Problem:</span>
              <select
                value={problemFilter}
                onChange={(e) => setProblemFilter(e.target.value)}
                className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="ALL">All Problems</option>
                {problems.map(p => (
                  <option key={p.id} value={p.id}>P{p.problemNumber}: {p.title}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACCEPTED">Accepted Only</option>
                <option value="FAILED">Failed / Compile Error</option>
              </select>
            </div>

            <span className="ml-auto text-xs text-slate-400 font-mono">
              Showing {filteredSubmissions.length} of {submissions.length} submissions
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4">Problem</th>
                    <th className="py-3 px-4">Lang</th>
                    <th className="py-3 px-4">Char Count</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No code submissions found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-white">{sub.teamName}</td>
                        <td className="py-3 px-4 text-slate-300">{sub.problemTitle || sub.problemId}</td>
                        <td className="py-3 px-4 font-mono text-indigo-400">{sub.language}</td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">{sub.charCount} non-ws</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              sub.isAccepted
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            {sub.executionStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">{sub.score} pts</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {new Date(sub.submittedAt).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setInspectedSub(sub)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                              title="Inspect Code & Testcases"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRejudgeSubmission(sub.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white cursor-pointer"
                              title="Re-Judge with Current Testcases"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: INSPECT SUBMISSION                                */}
      {/* ======================================================== */}
      {inspectedSub && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Submission Inspector: {inspectedSub.teamName}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  {inspectedSub.language} • {inspectedSub.charCount} non-whitespace chars • {inspectedSub.score} pts • {new Date(inspectedSub.submittedAt).toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => setInspectedSub(null)}
                className="text-slate-400 hover:text-white p-1 text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {inspectedSub.compileError && (
              <div className="mb-4 p-3 bg-rose-950/50 border border-rose-800 rounded-2xl">
                <span className="text-xs font-bold text-rose-300 block mb-1">Compilation / Build Error:</span>
                <pre className="text-xs font-mono text-rose-200 whitespace-pre-wrap">{inspectedSub.compileError}</pre>
              </div>
            )}

            <div className="mb-4">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Participant-Written Code Only</span>
              <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-300 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                {inspectedSub.participantCode || inspectedSub.code}
              </pre>
            </div>

            <div className="mb-4">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">Test Execution Breakdown</span>
              <div className="space-y-2">
                {inspectedSub.testResults?.map((tr, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${
                      tr.passed
                        ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-800/80 text-rose-300'
                    }`}
                  >
                    <div>
                      <div className="text-slate-400 font-bold">
                        {tr.isHidden ? `[Hidden Testcase #${idx + 1}]` : `[Visible Testcase #${idx + 1}]`}
                      </div>
                      <div className="text-slate-300">Input: {tr.input || '(omitted)'}</div>
                      <div>Output: {tr.actualOutput || 'No output'}</div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold">{tr.passed ? 'PASSED' : 'FAILED'}</span>
                      <div className="text-[10px] text-slate-500">{tr.executionTimeMs}ms</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => handleRejudgeSubmission(inspectedSub.id)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Re-Judge Submission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT / CREATE PROBLEM                             */}
      {/* ======================================================== */}
      {editingProblem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                {isEditing ? `Edit Problem ${editingProblem.problemNumber}` : 'Create Programming Problem'}
              </h3>
              <button
                onClick={() => setEditingProblem(null)}
                className="text-slate-400 hover:text-white p-1 text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProblem} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 mb-1">Problem Title</label>
                  <input
                    type="text"
                    value={editingProblem.title || ''}
                    onChange={(e) => setEditingProblem({ ...editingProblem, title: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Difficulty</label>
                  <select
                    value={editingProblem.difficulty || 'Medium'}
                    onChange={(e) => setEditingProblem({ ...editingProblem, difficulty: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Points</label>
                  <input
                    type="number"
                    value={editingProblem.points || 100}
                    onChange={(e) => setEditingProblem({ ...editingProblem, points: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Time Limit (sec)</label>
                  <input
                    type="number"
                    value={editingProblem.timeLimitSeconds || 2}
                    onChange={(e) => setEditingProblem({ ...editingProblem, timeLimitSeconds: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Problem Order</label>
                  <input
                    type="number"
                    value={editingProblem.order || 1}
                    onChange={(e) => setEditingProblem({ ...editingProblem, order: Number(e.target.value), problemNumber: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                    required
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="enableCheckbox"
                    checked={Boolean(editingProblem.isEnabled)}
                    onChange={(e) => setEditingProblem({ ...editingProblem, isEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700"
                  />
                  <label htmlFor="enableCheckbox" className="text-xs font-bold text-slate-300">
                    Enable for Teams
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Problem Statement & Description</label>
                <textarea
                  value={editingProblem.description || editingProblem.statement || ''}
                  onChange={(e) => setEditingProblem({ ...editingProblem, description: e.target.value, statement: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs leading-relaxed"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Input Format</label>
                  <textarea
                    value={editingProblem.inputFormat || ''}
                    onChange={(e) => setEditingProblem({ ...editingProblem, inputFormat: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Output Format</label>
                  <textarea
                    value={editingProblem.outputFormat || ''}
                    onChange={(e) => setEditingProblem({ ...editingProblem, outputFormat: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Constraints</label>
                  <textarea
                    value={editingProblem.constraints || ''}
                    onChange={(e) => setEditingProblem({ ...editingProblem, constraints: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
              </div>

              {/* TEST CASES SECTION */}
              <div className="space-y-3 pt-2">
                {/* Visible Testcases */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-300">
                      Visible / Sample Testcases ({(editingProblem.visibleTestCases || editingProblem.sampleTestCases || []).length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const current = editingProblem.visibleTestCases || editingProblem.sampleTestCases || [];
                        const updated = [
                          ...current,
                          { id: `vt-${Date.now()}`, input: '', expectedOutput: '', isHidden: false }
                        ];
                        setEditingProblem({ ...editingProblem, visibleTestCases: updated, sampleTestCases: updated });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Visible Testcase
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(editingProblem.visibleTestCases || editingProblem.sampleTestCases || []).map((tc, idx) => (
                      <div key={tc.id || idx} className="grid grid-cols-12 gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                        <div className="col-span-5">
                          <input
                            type="text"
                            placeholder="Input"
                            value={tc.input}
                            onChange={(e) => {
                              const current = [...(editingProblem.visibleTestCases || editingProblem.sampleTestCases || [])];
                              current[idx].input = e.target.value;
                              setEditingProblem({ ...editingProblem, visibleTestCases: current, sampleTestCases: current });
                            }}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white"
                          />
                        </div>
                        <div className="col-span-6">
                          <input
                            type="text"
                            placeholder="Expected Output"
                            value={tc.expectedOutput}
                            onChange={(e) => {
                              const current = [...(editingProblem.visibleTestCases || editingProblem.sampleTestCases || [])];
                              current[idx].expectedOutput = e.target.value;
                              setEditingProblem({ ...editingProblem, visibleTestCases: current, sampleTestCases: current });
                            }}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-emerald-300"
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              const current = (editingProblem.visibleTestCases || editingProblem.sampleTestCases || []).filter((_, i) => i !== idx);
                              setEditingProblem({ ...editingProblem, visibleTestCases: current, sampleTestCases: current });
                            }}
                            className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hidden Testcases */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-300">
                        Hidden Testcases ({(editingProblem.hiddenTestCases || []).length})
                      </span>
                      <span className="text-[10px] text-amber-400 font-medium">
                        * Required to enable problem
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const current = editingProblem.hiddenTestCases || [];
                        const updated = [
                          ...current,
                          { id: `ht-${Date.now()}`, input: '', expectedOutput: '', isHidden: true }
                        ];
                        setEditingProblem({ ...editingProblem, hiddenTestCases: updated });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Hidden Testcase
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(editingProblem.hiddenTestCases || []).map((tc, idx) => (
                      <div key={tc.id || idx} className="grid grid-cols-12 gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                        <div className="col-span-5">
                          <input
                            type="text"
                            placeholder="Input"
                            value={tc.input}
                            onChange={(e) => {
                              const current = [...(editingProblem.hiddenTestCases || [])];
                              current[idx].input = e.target.value;
                              setEditingProblem({ ...editingProblem, hiddenTestCases: current });
                            }}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white"
                          />
                        </div>
                        <div className="col-span-6">
                          <input
                            type="text"
                            placeholder="Expected Output"
                            value={tc.expectedOutput}
                            onChange={(e) => {
                              const current = [...(editingProblem.hiddenTestCases || [])];
                              current[idx].expectedOutput = e.target.value;
                              setEditingProblem({ ...editingProblem, hiddenTestCases: current });
                            }}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-emerald-300"
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              const current = (editingProblem.hiddenTestCases || []).filter((_, i) => i !== idx);
                              setEditingProblem({ ...editingProblem, hiddenTestCases: current });
                            }}
                            className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Starter Boilerplates Customization */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <span className="text-xs font-bold text-slate-300 block">Starter Code Boilerplates</span>
                    <span className="text-[11px] text-slate-400">
                      Starter code given to contestants. Template characters are not counted against their minimalist score.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['C', 'C++', 'Java'] as const).map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setActiveBoilerplateLang(lang)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all ${
                          activeBoilerplateLang === lang
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 text-[11px]">
                      {activeBoilerplateLang} Starter Code ({getBoilerplateString(editingProblem.boilerplates, activeBoilerplateLang).replace(/\s+/g, '').length} non-whitespace chars):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const currentBps = editingProblem.boilerplates || {};
                        setEditingProblem({
                          ...editingProblem,
                          boilerplates: {
                            ...currentBps,
                            [activeBoilerplateLang]: STANDARD_TEMPLATES[activeBoilerplateLang]
                          }
                        });
                      }}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset to Default {activeBoilerplateLang}
                    </button>
                  </div>
                  <textarea
                    value={getBoilerplateString(editingProblem.boilerplates, activeBoilerplateLang)}
                    onChange={(e) => {
                      const currentBps = editingProblem.boilerplates || {};
                      setEditingProblem({
                        ...editingProblem,
                        boilerplates: {
                          ...currentBps,
                          [activeBoilerplateLang]: e.target.value
                        }
                      });
                    }}
                    rows={8}
                    placeholder={`Enter starter boilerplate for ${activeBoilerplateLang}...`}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-indigo-200 text-xs font-mono leading-relaxed focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProblem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  Save Problem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* QUICK BOILERPLATE CUSTOMIZATION MODAL                    */}
      {/* ======================================================== */}
      {boilerplateProblem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] font-mono font-bold uppercase">
                    Problem #{boilerplateProblem.problemNumber} Boilerplate Editor
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-indigo-400" />
                  Edit Starter Code: {boilerplateProblem.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Customize the exact initial code loaded in Monaco Editor for participants. Characters in this template are deducted so participants are scored strictly on additional code written.
                </p>
              </div>

              <button
                onClick={() => setBoilerplateProblem(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Language Selection Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {(['C', 'C++', 'Java'] as const).map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setQuickBoilerplateLang(lang)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      quickBoilerplateLang === lang
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang} Template
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleResetQuickBoilerplate(quickBoilerplateLang)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset {quickBoilerplateLang} to Default
              </button>
            </div>

            {/* Editor Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>
                  Language: <strong className="text-white">{quickBoilerplateLang}</strong>
                </span>
                <span className="text-emerald-400 font-bold">
                  {(quickBoilerplates[quickBoilerplateLang] || '').replace(/\s+/g, '').length} non-whitespace characters (deducted from score)
                </span>
              </div>

              <textarea
                value={quickBoilerplates[quickBoilerplateLang] || ''}
                onChange={(e) => {
                  setQuickBoilerplates(prev => ({
                    ...prev,
                    [quickBoilerplateLang]: e.target.value
                  }));
                }}
                rows={12}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-indigo-200 text-xs font-mono leading-relaxed focus:outline-none focus:border-indigo-500 shadow-inner"
                placeholder={`Enter starter template for ${quickBoilerplateLang}...`}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBoilerplateProblem(null)}
                disabled={isSavingBoilerplate}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuickBoilerplates}
                disabled={isSavingBoilerplate}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {isSavingBoilerplate ? 'Saving Boilerplates...' : 'Save Boilerplates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
