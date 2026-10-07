import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  TypingRound,
  TypingSubmission,
  ContestState,
  Round1Config,
  TeamTypingStats,
  Round1ScoringMethod
} from '../../types/contest';
import {
  Keyboard,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Clock,
  Zap,
  CheckCircle2,
  Sliders,
  Play,
  FileText,
  ArrowUp,
  ArrowDown,
  Eye,
  Settings2,
  Award,
  AlertTriangle,
  RotateCcw,
  Check,
  Search,
  ShieldAlert,
  HelpCircle,
  BarChart3,
  Pause,
  RefreshCw,
  PlusCircle,
  MinusCircle
} from 'lucide-react';

interface Round1AdminTabProps {
  contestState: ContestState;
  onRefresh: () => void;
}

export const Round1AdminTab: React.FC<Round1AdminTabProps> = ({ contestState, onRefresh }) => {
  const { token } = useAuth();
  const [subTab, setSubTab] = useState<'BUILDER' | 'SCORING' | 'TEAM_MATRIX' | 'LOGS'>('BUILDER');
  const [typingRounds, setTypingRounds] = useState<TypingRound[]>([]);
  const [submissions, setSubmissions] = useState<TypingSubmission[]>([]);
  const [teamStats, setTeamStats] = useState<TeamTypingStats[]>([]);
  const [config, setConfig] = useState<Round1Config>({
    scoringMethod: 'best',
    weights: {},
    minAccuracyDefault: 85,
    scoreOverrides: {}
  });

  // Modal / Editor States
  const [editingRound, setEditingRound] = useState<Partial<TypingRound> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [previewRound, setPreviewRound] = useState<TypingRound | null>(null);
  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    teamId: string;
    teamName: string;
    currentScore: number;
    type: 'override' | 'bonus' | 'penalty' | 'reset';
    value: number;
    note: string;
  }>({
    isOpen: false,
    teamId: '',
    teamName: '',
    currentScore: 0,
    type: 'override',
    value: 0,
    note: ''
  });

  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTypingData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [rRes, sRes, statsRes, cfgRes] = await Promise.all([
        api.getTypingRounds(token),
        api.getTypingSubmissions(token),
        api.getTeamTypingStats(token),
        api.getRound1Config(token)
      ]);

      if (rRes?.success && rRes.rounds) {
        setTypingRounds(rRes.rounds.sort((a: TypingRound, b: TypingRound) => (a.order || 0) - (b.order || 0)));
      }
      if (sRes?.success && sRes.submissions) setSubmissions(sRes.submissions);
      if (statsRes?.success && statsRes.stats) setTeamStats(statsRes.stats);
      if (cfgRes?.success && cfgRes.config) setConfig(cfgRes.config);
    } catch (err) {
      console.error('Error fetching typing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypingData();
  }, [token]);

  const activeTypingRoundId = contestState.currentTypingRoundId || (typingRounds[0]?.id ?? '');
  const activeRound = typingRounds.find(r => r.id === activeTypingRoundId) || typingRounds[0];

  // Stage Transitions
  const handleStartInstructions = async () => {
    if (!token) return;
    await api.startTypingInstructions(token);
    onRefresh();
  };

  const handleStartPractice = async (roundId?: string) => {
    if (!token) return;
    await api.startTypingPractice(token, roundId || activeTypingRoundId);
    onRefresh();
  };

  const handleStartTest = async (roundId?: string) => {
    if (!token) return;
    await api.startTypingTest(token, roundId || activeTypingRoundId);
    onRefresh();
  };

  const handleShowResults = async () => {
    if (!token) return;
    await api.showTypingResults(token);
    onRefresh();
  };

  const handleNextRound = async (autoStartPractice = false) => {
    if (!token) return;
    await api.nextTypingRound(token, autoStartPractice);
    onRefresh();
    fetchTypingData();
  };

  const handlePrevRound = async (autoStartPractice = false) => {
    if (!token) return;
    await api.prevTypingRound(token, autoStartPractice);
    onRefresh();
    fetchTypingData();
  };

  const handleSetActiveRound = async (id: string) => {
    if (!token) return;
    await api.setActiveTypingRound(token, id);
    onRefresh();
    fetchTypingData();
  };

  // CRUD Operations
  const handleSaveRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingRound) return;
    try {
      await api.saveTypingRound(token, editingRound, isEditing);
      setEditingRound(null);
      fetchTypingData();
      onRefresh();
    } catch (err) {
      console.error('Error saving typing round:', err);
    }
  };

  const handleDeleteRound = async (id: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this typing sub-round?')) return;
    try {
      await api.deleteTypingRound(token, id);
      fetchTypingData();
      onRefresh();
    } catch (err) {
      console.error('Error deleting typing round:', err);
    }
  };

  const handleDuplicateRound = async (id: string) => {
    if (!token) return;
    try {
      await api.duplicateTypingRound(token, id);
      fetchTypingData();
    } catch (err) {
      console.error('Error duplicating typing round:', err);
    }
  };

  const handleMoveRound = async (index: number, direction: 'UP' | 'DOWN') => {
    if (!token) return;
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= typingRounds.length) return;

    const newRounds = [...typingRounds];
    const temp = newRounds[index];
    newRounds[index] = newRounds[targetIndex];
    newRounds[targetIndex] = temp;

    const orderedIds = newRounds.map(r => r.id);
    try {
      await api.reorderTypingRounds(token, orderedIds);
      fetchTypingData();
    } catch (err) {
      console.error('Error reordering rounds:', err);
    }
  };

  // Scoring config save
  const handleSaveConfig = async (updated: Partial<Round1Config>) => {
    if (!token) return;
    try {
      const res = await api.saveRound1Config(token, updated);
      if (res.success) {
        setConfig(res.config);
        fetchTypingData();
        onRefresh();
      }
    } catch (err) {
      console.error('Error updating config:', err);
    }
  };

  // Score override submission
  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !overrideModal.teamId) return;
    try {
      await api.overrideTypingScore(token, {
        teamId: overrideModal.teamId,
        type: overrideModal.type,
        value: Number(overrideModal.value),
        note: overrideModal.note,
        typingRoundId: activeTypingRoundId
      });
      setOverrideModal(prev => ({ ...prev, isOpen: false }));
      fetchTypingData();
      onRefresh();
    } catch (err) {
      console.error('Error applying score override:', err);
    }
  };

  const isCurrentStageR1 = contestState.currentStage.startsWith('R1_') || contestState.currentStage.startsWith('ROUND_1_');

  return (
    <div className="space-y-6">
      {/* 1. MASTER WORKFLOW CONTROLLER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Round 1 Orchestrator
              </span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider ${
                isCurrentStageR1 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
              }`}>
                Stage: {contestState.currentStage}
              </span>
              {activeRound && (
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Active: Sub-Round {activeRound.order} — {activeRound.title}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Fastest Fingers First Workflow
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Admins manually guide participants through Instructions &rarr; Sub-Round 1 (Practice &rarr; Test) &rarr; Sub-Round N &rarr; Final Round 1 Standings.
            </p>
          </div>

          {/* Quick Stage Action Matrix */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="admin-r1-start-instructions"
              onClick={handleStartInstructions}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                contestState.currentStage === 'R1_INSTRUCTIONS' || contestState.currentStage === 'ROUND_1_INSTRUCTIONS'
                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="Show Instructions (Shown once for entire round)"
            >
              <FileText className="w-3.5 h-3.5" /> 1. Instructions
            </button>

            <button
              id="admin-r1-start-practice"
              onClick={() => handleStartPractice()}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                contestState.currentStage === 'R1_PRACTICE' || contestState.currentStage === 'ROUND_1_PRACTICE'
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-lg shadow-blue-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="Start 1-minute practice warmup (never graded)"
            >
              <Zap className="w-3.5 h-3.5" /> 2. Practice (1m)
            </button>

            <button
              id="admin-r1-start-test"
              onClick={() => handleStartTest()}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                contestState.currentStage === 'R1_TEST' || contestState.currentStage === 'ROUND_1_TEST'
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-lg shadow-emerald-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="Start official scored typing test"
            >
              <Play className="w-3.5 h-3.5" /> 3. Main Test
            </button>

            <button
              id="admin-r1-show-results"
              onClick={handleShowResults}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                contestState.currentStage === 'R1_RESULTS' || contestState.currentStage === 'ROUND_1_RESULTS'
                  ? 'bg-purple-600 text-white ring-2 ring-purple-400 shadow-lg shadow-purple-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="Reveal Round 1 Sub-Round or Final Standings"
            >
              <Award className="w-3.5 h-3.5" /> 4. Results
            </button>

            <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block" />

            <button
              id="admin-r1-next-subround"
              onClick={() => handleNextRound(false)}
              className="px-3 py-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
              title="Switch to next sub-round without starting timer"
            >
              Next Sub-Round &rarr;
            </button>

            <button
              id="admin-r1-next-and-practice"
              onClick={() => handleNextRound(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
              title="Switch to next sub-round and immediately start 1m practice"
            >
              Next &amp; Start Practice
            </button>
          </div>
        </div>

        {/* Sub-Round Switcher Strip */}
        {typingRounds.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center gap-3 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Sub-Rounds ({typingRounds.length}):
            </span>
            <div className="flex items-center gap-2">
              {typingRounds.map(round => {
                const isActive = round.id === activeTypingRoundId;
                return (
                  <button
                    key={round.id}
                    onClick={() => handleSetActiveRound(round.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 ring-1 ring-amber-500/30'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 border border-slate-700/60 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span>#{round.order} {round.title}</span>
                    <span className="text-[10px] text-slate-500">({round.testDurationSeconds}s)</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. SUB-TAB NAVIGATION */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setSubTab('BUILDER')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'BUILDER'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" /> Sub-Round Builder ({typingRounds.length})
          </button>
          <button
            onClick={() => setSubTab('SCORING')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'SCORING'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" /> Scoring Strategy
          </button>
          <button
            onClick={() => setSubTab('TEAM_MATRIX')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'TEAM_MATRIX'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-4 h-4" /> Team Matrix &amp; Overrides
          </button>
          <button
            onClick={() => setSubTab('LOGS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'LOGS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> All Submissions ({submissions.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTypingData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {subTab === 'BUILDER' && (
            <button
              onClick={() => {
                setEditingRound({
                  title: `Typing Sub-Round ${typingRounds.length + 1}`,
                  order: typingRounds.length + 1,
                  practicePassage: 'Practice typing improves mechanical precision and cognitive rhythm.',
                  mainPassage: 'Modern software engineering demands high mechanical keyboard precision alongside sharp algorithmic problem solving.',
                  testDurationSeconds: 120,
                  minAccuracyPercent: 85,
                  weight: 1.0,
                  scoringMultiplier: 1.0,
                  isPublished: true
                });
                setIsEditing(false);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Typing Sub-Round
            </button>
          )}
        </div>
      </div>

      {/* 3. TAB 1: SUB-ROUND BUILDER */}
      {subTab === 'BUILDER' && (
        <div className="space-y-4">
          {typingRounds.length === 0 ? (
            <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
              <Keyboard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Typing Sub-Rounds Configured</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                Round 1 supports unlimited typing sub-rounds. Add your first passage challenge now.
              </p>
              <button
                onClick={() => {
                  setEditingRound({
                    title: 'Typing Sub-Round 1',
                    order: 1,
                    practicePassage: 'Practice passage warmup text goes here.',
                    mainPassage: 'Official timed typing passage text goes here.',
                    testDurationSeconds: 120,
                    minAccuracyPercent: 85,
                    weight: 1.0,
                    scoringMultiplier: 1.0
                  });
                  setIsEditing(false);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Sub-Round 1
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {typingRounds.map((round, idx) => {
                const isActive = round.id === activeTypingRoundId;
                const roundSubs = submissions.filter(s => s.typingRoundId === round.id && !s.isPractice);

                return (
                  <div
                    key={round.id}
                    className={`bg-slate-900 border rounded-2xl p-5 transition-all ${
                      isActive
                        ? 'border-amber-500/50 shadow-lg shadow-amber-500/5'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Info */}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono font-bold">
                            #{round.order}
                          </span>
                          <h3 className="text-base font-bold text-white">{round.title}</h3>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Active in Arena
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            ID: <code className="text-slate-400">{round.id}</code>
                          </span>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            Test Duration: <strong className="text-white">{round.testDurationSeconds}s</strong> (Practice: 60s)
                          </span>
                          <span className="flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            Min Accuracy: <strong className="text-white">{round.minAccuracyPercent}%</strong>
                          </span>
                          <span className="flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                            <Award className="w-3.5 h-3.5 text-indigo-400" />
                            Multiplier: <strong className="text-white">{round.scoringMultiplier}x</strong>
                          </span>
                          <span className="flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                            <Sliders className="w-3.5 h-3.5 text-purple-400" />
                            Weight: <strong className="text-white">{round.weight ?? 1.0}</strong>
                          </span>
                          <span className="text-xs text-slate-500">
                            Submissions: <strong className="text-slate-300">{roundSubs.length}</strong>
                          </span>
                        </div>

                        {/* Passage Previews */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                              <span>Practice Passage (1 min)</span>
                              <span className="text-slate-500 font-normal">{round.practicePassage?.length || 0} chars</span>
                            </div>
                            <p className="text-xs text-slate-300 line-clamp-2 font-mono leading-relaxed">
                              {round.practicePassage}
                            </p>
                          </div>

                          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                              <span>Main Test Passage ({round.testDurationSeconds}s)</span>
                              <span className="text-slate-500 font-normal">{round.mainPassage?.length || 0} chars</span>
                            </div>
                            <p className="text-xs text-slate-300 line-clamp-2 font-mono leading-relaxed">
                              {round.mainPassage}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-row md:flex-col items-center gap-2 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
                        <button
                          onClick={() => handleSetActiveRound(round.id)}
                          className={`w-full px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            isActive
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-default'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {isActive ? 'Active' : 'Set Active'}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveRound(idx, 'UP')}
                            disabled={idx === 0}
                            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 bg-slate-800 rounded-lg"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveRound(idx, 'DOWN')}
                            disabled={idx === typingRounds.length - 1}
                            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 bg-slate-800 rounded-lg"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setPreviewRound(round)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 bg-slate-800 rounded-lg"
                            title="Preview Passages"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateRound(round.id)}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-800 rounded-lg"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingRound(round);
                              setIsEditing(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-400 bg-slate-800 rounded-lg"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRound(round.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-800 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: SCORING STRATEGY & CONFIG */}
      {subTab === 'SCORING' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Round 1 Scoring Formula &amp; Multi-Round Strategy
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Configure how multiple typing sub-rounds are combined into each team's final Round 1 score.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Scoring Method */}
            <div className="space-y-3 bg-slate-950/60 p-5 rounded-xl border border-slate-800">
              <label className="block text-xs font-bold text-slate-200">
                Multi-Round Aggregation Method
              </label>
              <div className="space-y-2">
                {[
                  {
                    id: 'best',
                    title: 'Best Score (Highest Sub-Round)',
                    desc: 'Takes the maximum score achieved across all completed sub-rounds.'
                  },
                  {
                    id: 'average',
                    title: 'Average Score',
                    desc: 'Averages the scores across all completed sub-rounds.'
                  },
                  {
                    id: 'total',
                    title: 'Total Sum',
                    desc: 'Sums up all scores across all completed sub-rounds.'
                  },
                  {
                    id: 'weighted',
                    title: 'Weighted Average',
                    desc: 'Calculates the weighted average based on custom sub-round weights.'
                  }
                ].map(opt => (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      config.scoringMethod === opt.id
                        ? 'bg-indigo-600/10 border-indigo-500/50 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scoringMethod"
                      value={opt.id}
                      checked={config.scoringMethod === opt.id}
                      onChange={() => handleSaveConfig({ scoringMethod: opt.id as Round1ScoringMethod })}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-200">{opt.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Formula & Rules Explanation */}
            <div className="space-y-4 bg-slate-950/60 p-5 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                Live Scoring Math &amp; Invariants
              </h4>
              <div className="space-y-2 text-xs text-slate-300 font-mono bg-slate-900 p-3.5 rounded-lg border border-slate-800">
                <p><span className="text-indigo-400">Accuracy</span> = correctChars / totalTypedChars</p>
                <p><span className="text-blue-400">WPM</span> = (correctChars / 5) / (timeTakenSeconds / 60)</p>
                <p><span className="text-emerald-400">Sub-Round Score</span> = WPM &times; Accuracy &times; Multiplier</p>
                <p className="text-amber-400 text-[11px] font-sans pt-1">
                  * Practice attempts (60s) are for warmup only and are never included in the score calculation.
                </p>
              </div>

              {/* Default Min Accuracy */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Default Minimum Accuracy Threshold (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.minAccuracyDefault || 85}
                    onChange={(e) => handleSaveConfig({ minAccuracyDefault: Number(e.target.value) })}
                    className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold"
                  />
                  <span className="text-xs text-slate-400">
                    Submissions below this threshold yield 0 points unless overridden.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: TEAM MATRIX & SCORE OVERRIDES */}
      {subTab === 'TEAM_MATRIX' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by team name or code..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 w-full sm:w-64 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-4">
              <span>Aggregation Mode: <strong className="text-indigo-400 uppercase">{config.scoringMethod}</strong></span>
              <span>Total Teams: <strong className="text-white">{teamStats.length}</strong></span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Team</th>
                    {typingRounds.map(r => (
                      <th key={r.id} className="px-4 py-3 text-center">
                        <div>#{r.order} {r.title}</div>
                        <div className="text-[9px] text-slate-500 font-normal">WPM / Acc / Score</div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center">Calculated</th>
                    <th className="px-4 py-3 text-center">Override / Bonus</th>
                    <th className="px-4 py-3 text-right">Final R1 Score</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {teamStats
                    .filter(t => t.teamName.toLowerCase().includes(searchFilter.toLowerCase()) || t.teamCode.toLowerCase().includes(searchFilter.toLowerCase()))
                    .map(team => {
                      const hasOverride = Boolean(team.overrideInfo);

                      return (
                        <tr key={team.teamId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-white">{team.teamName}</div>
                            <div className="font-mono text-[11px] text-slate-400">{team.teamCode}</div>
                          </td>

                          {/* Per-Round Columns */}
                          {typingRounds.map(r => {
                            const sub = team.subroundScores[r.id];
                            const hasAttempt = sub && sub.testScore !== undefined;

                            return (
                              <td key={r.id} className="px-4 py-3 text-center">
                                {hasAttempt ? (
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-white">{sub.testWpm} WPM</div>
                                    <div className="text-[10px] text-slate-400">{sub.testAccuracy}% acc</div>
                                    <div className="text-[11px] font-mono text-emerald-400 font-bold">{sub.testScore} pts</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-600 font-mono">—</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Calculated */}
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-300">
                            {team.calculatedScore}
                          </td>

                          {/* Override Status */}
                          <td className="px-4 py-3 text-center">
                            {hasOverride ? (
                              <div className="inline-flex flex-col items-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  team.overrideInfo?.type === 'override' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                  team.overrideInfo?.type === 'bonus' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                  'bg-red-500/20 text-red-300 border border-red-500/30'
                                }`}>
                                  {team.overrideInfo?.type}: {team.overrideInfo?.value}
                                </span>
                                {team.overrideInfo?.note && (
                                  <span className="text-[10px] text-slate-400 max-w-[120px] truncate mt-0.5">
                                    {team.overrideInfo.note}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-600 text-[11px]">None</span>
                            )}
                          </td>

                          {/* Final Score */}
                          <td className="px-4 py-3 text-right font-mono font-black text-sm text-emerald-400">
                            {team.finalRound1Score}
                          </td>

                          {/* Action Button */}
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                setOverrideModal({
                                  isOpen: true,
                                  teamId: team.teamId,
                                  teamName: team.teamName,
                                  currentScore: team.finalRound1Score,
                                  type: team.overrideInfo?.type || 'override',
                                  value: team.overrideInfo?.value || 0,
                                  note: team.overrideInfo?.note || ''
                                });
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-lg text-xs font-bold transition-all border border-slate-700"
                            >
                              Adjust Score
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 4: SUBMISSIONS AUDIT LOG */}
      {subTab === 'LOGS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">All Participant Submissions Log</h3>
            <span className="text-xs text-slate-400">Showing {submissions.length} attempts</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Sub-Round</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-center">WPM</th>
                  <th className="px-4 py-3 text-center">Accuracy</th>
                  <th className="px-4 py-3 text-center">Time</th>
                  <th className="px-4 py-3 text-right">Awarded Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans">
                      No submissions recorded yet for Round 1.
                    </td>
                  </tr>
                ) : (
                  submissions.map(sub => (
                    <tr key={sub.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                        {new Date(sub.submittedAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2.5 font-sans font-bold text-white">
                        {sub.teamName}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 font-sans">
                        {typingRounds.find(r => r.id === sub.typingRoundId)?.title || sub.typingRoundId}
                      </td>
                      <td className="px-4 py-2.5 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sub.isPractice
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {sub.isPractice ? 'Practice' : 'Official Test'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-white">
                        {sub.wpm}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-300">
                        {sub.accuracy}%
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-400">
                        {sub.timeTakenSeconds}s
                      </td>
                      <td className="px-4 py-2.5 text-right font-black text-emerald-400 font-sans">
                        {sub.isPractice ? <span className="text-slate-600 font-normal text-xs">Ungraded</span> : `${sub.score} pts`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. MODAL: EDIT / CREATE TYPING SUB-ROUND */}
      {editingRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-indigo-400" />
                {isEditing ? 'Edit Typing Sub-Round' : 'Create Typing Sub-Round'}
              </h3>
              <button
                onClick={() => setEditingRound(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRound} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">Sub-Round Title</label>
                  <input
                    type="text"
                    required
                    value={editingRound.title || ''}
                    onChange={e => setEditingRound({ ...editingRound, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Sub-Round 1: Algorithmic Foundations"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Sequence Order</label>
                  <input
                    type="number"
                    min="1"
                    value={editingRound.order || 1}
                    onChange={e => setEditingRound({ ...editingRound, order: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Practice Passage (1 minute) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                    Practice Passage Warmup (Always 1 Minute)
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {editingRound.practicePassage?.length || 0} characters
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  value={editingRound.practicePassage || ''}
                  onChange={e => setEditingRound({ ...editingRound, practicePassage: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-indigo-500"
                  placeholder="Warmup text for participants to calibrate fingers before the official test..."
                />
              </div>

              {/* Main Test Passage */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    Main Test Passage (Scored)
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {editingRound.mainPassage?.length || 0} characters
                  </span>
                </div>
                <textarea
                  rows={5}
                  required
                  value={editingRound.mainPassage || ''}
                  onChange={e => setEditingRound({ ...editingRound, mainPassage: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-indigo-500"
                  placeholder="Official scored passage text..."
                />
              </div>

              {/* Configuration Tuning */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Test Duration (s)</label>
                  <input
                    type="number"
                    min="10"
                    max="600"
                    value={editingRound.testDurationSeconds || 120}
                    onChange={e => setEditingRound({ ...editingRound, testDurationSeconds: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Min Accuracy (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingRound.minAccuracyPercent || 85}
                    onChange={e => setEditingRound({ ...editingRound, minAccuracyPercent: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Weight</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editingRound.weight || 1.0}
                    onChange={e => setEditingRound({ ...editingRound, weight: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Score Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editingRound.scoringMultiplier || 1.0}
                    onChange={e => setEditingRound({ ...editingRound, scoringMultiplier: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRound(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
                >
                  {isEditing ? 'Save Changes' : 'Create Sub-Round'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: PASSAGE PREVIEW */}
      {previewRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-400" />
                  Passage Preview: {previewRound.title}
                </h3>
                <span className="text-xs text-slate-400">Order #{previewRound.order} &bull; {previewRound.testDurationSeconds}s Test Duration</span>
              </div>
              <button onClick={() => setPreviewRound(null)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Practice Passage (1-Minute Warmup)
                </h4>
                <p className="text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap">
                  {previewRound.practicePassage}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" /> Main Scored Passage ({previewRound.testDurationSeconds}s)
                </h4>
                <p className="text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap">
                  {previewRound.mainPassage}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewRound(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL: SCORE OVERRIDE / BONUS / PENALTY */}
      {overrideModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Score Adjustment: {overrideModal.teamName}
              </h3>
              <button
                onClick={() => setOverrideModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyOverride} className="space-y-4">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Current Round 1 Score:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">{overrideModal.currentScore} pts</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Adjustment Type</label>
                <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['override', 'bonus', 'penalty', 'reset'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOverrideModal(prev => ({ ...prev, type: t }))}
                      className={`py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                        overrideModal.type === t
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {overrideModal.type !== 'reset' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {overrideModal.type === 'override' ? 'Set Fixed Score' :
                     overrideModal.type === 'bonus' ? 'Bonus Points to Add (+)' :
                     'Penalty Points to Deduct (-)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={overrideModal.value}
                    onChange={e => setOverrideModal(prev => ({ ...prev, value: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Admin Reason / Audit Note</label>
                <input
                  type="text"
                  value={overrideModal.note}
                  onChange={e => setOverrideModal(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="e.g. Hardware freeze compensation (+10 pts)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOverrideModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
