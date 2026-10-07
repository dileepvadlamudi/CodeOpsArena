import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  LeaderboardEntry,
  ContestState,
  MasterScoringConfig,
  RoundScoreRecord
} from '../../types/contest';
import {
  Trophy,
  Sliders,
  Eye,
  EyeOff,
  Snowflake,
  Download,
  CheckCircle2,
  RefreshCw,
  Award,
  TrendingUp,
  Percent,
  Settings2,
  Wrench,
  Calculator,
  ChevronRight,
  Info,
  Edit3,
  RotateCcw,
  Sparkles,
  Zap,
  Target,
  FileSpreadsheet,
  AlertTriangle,
  HelpCircle,
  X
} from 'lucide-react';

interface LeaderboardScoringTabProps {
  contestState: ContestState;
  onRefresh: () => void;
}

export const LeaderboardScoringTab: React.FC<LeaderboardScoringTabProps> = ({
  contestState,
  onRefresh
}) => {
  const { token } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [scoringConfig, setScoringConfig] = useState<MasterScoringConfig | null>(null);
  const [roundScores, setRoundScores] = useState<Record<string, Record<'r1' | 'r2' | 'r3' | 'r4', RoundScoreRecord>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [selectedTeamBreakdown, setSelectedTeamBreakdown] = useState<LeaderboardEntry | null>(null);

  // Active sub-tab in config modal
  const [activeConfigTab, setActiveConfigTab] = useState<'r1' | 'r2' | 'r3' | 'r4' | 'tiebreak' | 'caps'>('r1');

  // Override Form state
  const [overrideForm, setOverrideForm] = useState<{
    teamId: string;
    round: 'r1' | 'r2' | 'r3' | 'r4';
    type: 'override' | 'bonus' | 'penalty' | 'reset';
    value: number;
    reason: string;
  }>({
    teamId: '',
    round: 'r1',
    type: 'override',
    value: 0,
    reason: ''
  });

  const fetchData = async (isBackground = false) => {
    if (!token) return;
    if (!isBackground) setIsLoading(true);
    try {
      const [lbRes, cfgRes, rsRes] = await Promise.all([
        api.getAdminLeaderboard(token),
        api.getMasterScoringConfig(token),
        api.getRoundScores(token)
      ]);

      if (lbRes.success) setLeaderboard(lbRes.leaderboard);
      if (cfgRes.success && (!showConfigModal || !isBackground)) {
        // Only update scoring config if user isn't currently editing in the modal
        if (!showConfigModal) setScoringConfig(cfgRes.config);
      }
      if (rsRes.success) setRoundScores(rsRes.roundScores);
    } catch (err) {
      console.error('Error fetching scoring data:', err);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [token, showConfigModal]);

  const handleToggleVisibility = async () => {
    if (!token) return;
    try {
      await api.toggleLeaderboardVisibility(token);
      onRefresh();
    } catch (err) {
      console.error('Error toggling visibility:', err);
    }
  };

  const handleToggleFreeze = async () => {
    if (!token) return;
    try {
      await api.toggleLeaderboardFreeze(token);
      onRefresh();
    } catch (err) {
      console.error('Error toggling freeze:', err);
    }
  };

  const handleRecalculateAll = async () => {
    if (!token) return;
    setIsRecalculating(true);
    try {
      const res = await api.recalculateScores(token);
      if (res.success) {
        setLeaderboard(res.leaderboard);
        if (res.roundScores) setRoundScores(res.roundScores);
        onRefresh();
      }
    } catch (err) {
      console.error('Error recalculating scores:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !scoringConfig) return;
    setIsLoading(true);
    try {
      const res = await api.updateMasterScoringConfig(token, scoringConfig);
      if (res.success) {
        setScoringConfig(res.config);
        if (res.leaderboard) setLeaderboard(res.leaderboard);
        setShowConfigModal(false);
        onRefresh();
      }
    } catch (err) {
      console.error('Error saving scoring configuration:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !overrideForm.teamId) return;
    try {
      const res = await api.overrideScore(token, overrideForm);
      if (res.success) {
        if (res.leaderboard) setLeaderboard(res.leaderboard);
        if (res.roundScores) setRoundScores(res.roundScores);
        setShowOverrideModal(false);
        setOverrideForm({
          teamId: '',
          round: 'r1',
          type: 'override',
          value: 0,
          reason: ''
        });
        onRefresh();
      }
    } catch (err) {
      console.error('Error applying score override:', err);
    }
  };

  const openOverrideModalForTeam = (teamId: string, round: 'r1' | 'r2' | 'r3' | 'r4' = 'r1') => {
    setOverrideForm({
      teamId,
      round,
      type: 'override',
      value: 0,
      reason: ''
    });
    setShowOverrideModal(true);
  };

  const exportCSV = () => {
    const headers = [
      'Rank',
      'Team Name',
      'Team Code',
      'R1 Score',
      'R2 Score',
      'R3 Score',
      'R4 Score',
      'Final Score (Sum)',
      'Status'
    ];
    const rows = leaderboard.map(l => [
      l.rank,
      `"${l.teamName.replace(/"/g, '""')}"`,
      l.teamCode,
      l.scores.r1,
      l.scores.r2,
      l.scores.r3,
      l.scores.r4,
      l.scores.total,
      l.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `codeops_official_scoring_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate dynamic maximum possible points if capped or estimated
  const maxR1 = scoringConfig?.maxScores?.r1 ? `${scoringConfig.maxScores.r1} pts` : 'Uncapped';
  const maxR2 = scoringConfig?.maxScores?.r2 ? `${scoringConfig.maxScores.r2} pts` : 'Uncapped';
  const maxR3 = scoringConfig?.maxScores?.r3 ? `${scoringConfig.maxScores.r3} pts` : 'Uncapped';
  const maxR4 = scoringConfig?.maxScores?.r4 ? `${scoringConfig.maxScores.r4} pts` : 'Uncapped';

  return (
    <div className="space-y-6">
      {/* Top Banner: Core Scoring Formula & Action Buttons */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Trophy className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Authoritative Scoring Engine & Standings
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 font-mono font-bold flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                    Final Score = R1 + R2 + R3 + R4
                  </span>
                  <span className="text-slate-400">
                    No fixed 100 pt cap • Max is determined dynamically by round scoring configurations
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Configure Engine */}
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <Settings2 className="w-4 h-4" /> Configure Scoring Rules
            </button>

            {/* Recalculate Button */}
            <button
              onClick={handleRecalculateAll}
              disabled={isRecalculating}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-amber-500/20"
              title="Re-run all calculations from raw submissions against current scoring rules"
            >
              <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
              {isRecalculating ? 'Recalculating...' : 'Recalculate All'}
            </button>

            {/* Manual Override */}
            <button
              onClick={() => setShowOverrideModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Wrench className="w-4 h-4 text-emerald-400" /> Admin Override
            </button>

            {/* Freeze toggle */}
            <button
              onClick={handleToggleFreeze}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                contestState.isLeaderboardFrozen
                  ? 'bg-cyan-950 border border-cyan-700 text-cyan-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title={contestState.isLeaderboardFrozen ? 'Unfreeze live rankings' : 'Freeze rankings for suspense'}
            >
              <Snowflake className="w-4 h-4 text-cyan-400" />
              {contestState.isLeaderboardFrozen ? 'Board Frozen' : 'Freeze Board'}
            </button>

            {/* Visibility toggle */}
            <button
              onClick={handleToggleVisibility}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                contestState.isLeaderboardVisibleToTeams
                  ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                  : 'bg-amber-950 border border-amber-700 text-amber-300'
              }`}
            >
              {contestState.isLeaderboardVisibleToTeams ? (
                <>
                  <Eye className="w-4 h-4" /> Visible to Teams
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" /> Hidden from Teams
                </>
              )}
            </button>

            {/* Export CSV */}
            <button
              onClick={exportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Round Limits and Config Snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div className="text-[10px] uppercase font-bold text-slate-400">Round 1 (Typing)</div>
            <div className="text-sm font-bold text-slate-200 mt-0.5 capitalize">
              {scoringConfig?.r1?.scoringMethod?.replace('_', ' ') || 'Best Subround'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Multiplier: {scoringConfig?.r1?.multiplier ?? 1.0}x • Cap: {maxR1}
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div className="text-[10px] uppercase font-bold text-slate-400">Round 2 (Quiz)</div>
            <div className="text-sm font-bold text-slate-200 mt-0.5">
              E: {scoringConfig?.r2?.pointsPerQuestion?.easy ?? 1} | M: {scoringConfig?.r2?.pointsPerQuestion?.medium ?? 2} | H: {scoringConfig?.r2?.pointsPerQuestion?.hard ?? 3}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Penalty: -{scoringConfig?.r2?.penaltyPerIncorrect ?? 0} • Cap: {maxR2}
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div className="text-[10px] uppercase font-bold text-slate-400">Round 3 (Minimalist)</div>
            <div className="text-sm font-bold text-slate-200 mt-0.5 capitalize">
              {scoringConfig?.r3?.charCountScoringMethod?.replace('_', ' ') || 'Rank Bonus'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Multiplier: {scoringConfig?.r3?.multiplier ?? 1.0}x • Cap: {maxR3}
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div className="text-[10px] uppercase font-bold text-slate-400">Round 4 (Crack)</div>
            <div className="text-sm font-bold text-slate-200 mt-0.5">
              Speed: +{scoringConfig?.r4?.speedBonusPoints ?? 5} | Pen: -{scoringConfig?.r4?.penaltyPerAttempt ?? 2}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Multiplier: {scoringConfig?.r4?.multiplier ?? 1.0}x • Cap: {maxR4}
            </div>
          </div>
        </div>
      </div>

      {/* Main Official Standings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Live Official Standings ({leaderboard.length} Teams)
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Click any team to inspect full scoring breakdown
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400">
              <tr>
                <th className="py-3.5 px-4 w-16">Rank</th>
                <th className="py-3.5 px-4">Team</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4 text-right">R1 Typing</th>
                <th className="py-3.5 px-4 text-right">R2 Quiz</th>
                <th className="py-3.5 px-4 text-right">R3 Minimalist</th>
                <th className="py-3.5 px-4 text-right">R4 Crack</th>
                <th className="py-3.5 px-4 text-right font-black text-amber-400">Final Score</th>
                <th className="py-3.5 px-4 text-center">Tie Break</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No leaderboard data available. Run recalculation or wait for participants to submit.
                  </td>
                </tr>
              ) : (
                leaderboard.map((entry) => {
                  const teamR1 = roundScores[entry.teamId]?.r1;
                  const teamR2 = roundScores[entry.teamId]?.r2;
                  const teamR3 = roundScores[entry.teamId]?.r3;
                  const teamR4 = roundScores[entry.teamId]?.r4;

                  return (
                    <tr
                      key={entry.teamId}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        entry.rank === 1
                          ? 'bg-amber-500/5'
                          : entry.rank === 2
                          ? 'bg-slate-400/5'
                          : entry.rank === 3
                          ? 'bg-amber-700/5'
                          : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <span
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                            entry.rank === 1
                              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                              : entry.rank === 2
                              ? 'bg-slate-300 text-slate-950'
                              : entry.rank === 3
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {entry.rank}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setSelectedTeamBreakdown(entry)}
                          className="font-bold text-white text-sm hover:text-indigo-400 text-left transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{entry.teamName}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-indigo-400">
                        {entry.teamCode}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-right text-slate-200">
                        <span className="flex items-center justify-end gap-1">
                          {teamR1?.manualOverride && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Manual Override Active" />
                          )}
                          <span>{entry.scores.r1}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-right text-slate-200">
                        <span className="flex items-center justify-end gap-1">
                          {teamR2?.manualOverride && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Manual Override Active" />
                          )}
                          <span>{entry.scores.r2}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-right text-slate-200">
                        <span className="flex items-center justify-end gap-1">
                          {teamR3?.manualOverride && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Manual Override Active" />
                          )}
                          <span>{entry.scores.r3}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-right text-slate-200">
                        <span className="flex items-center justify-end gap-1">
                          {teamR4?.manualOverride && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Manual Override Active" />
                          )}
                          <span>{entry.scores.r4}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-black text-right text-white text-base">
                        <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {entry.scores.total}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {entry.tieBreakDetails?.r3ShortestChars ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300" title={`Shortest code: ${entry.tieBreakDetails.r3ShortestChars} chars`}>
                            {entry.tieBreakDetails.r3ShortestChars}c
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedTeamBreakdown(entry)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold"
                            title="Inspect Details"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openOverrideModalForTeam(entry.teamId)}
                            className="p-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 text-[11px] font-bold"
                            title="Adjust / Override"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: MASTER SCORING ENGINE CONFIGURATION */}
      {showConfigModal && scoringConfig && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Central Scoring Engine Rules</h3>
                  <p className="text-xs text-slate-400">
                    Configure scoring formulas, multipliers, and caps per round. Sum = Final Score.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-800 bg-slate-950/40 shrink-0">
              <button
                onClick={() => setActiveConfigTab('r1')}
                className={`px-3 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  activeConfigTab === 'r1'
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Round 1: Typing
              </button>
              <button
                onClick={() => setActiveConfigTab('r2')}
                className={`px-3 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  activeConfigTab === 'r2'
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Round 2: Quiz
              </button>
              <button
                onClick={() => setActiveConfigTab('r3')}
                className={`px-3 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  activeConfigTab === 'r3'
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Round 3: Code Minimalist
              </button>
              <button
                onClick={() => setActiveConfigTab('r4')}
                className={`px-3 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  activeConfigTab === 'r4'
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Round 4: Crack
              </button>
              <button
                onClick={() => setActiveConfigTab('tiebreak')}
                className={`px-3 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  activeConfigTab === 'tiebreak'
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Tie Breaks
              </button>
              <button
                onClick={() => setActiveConfigTab('caps')}
                className={`px-3 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  activeConfigTab === 'caps'
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Max Caps
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSaveConfig} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* ROUND 1 */}
              {activeConfigTab === 'r1' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Scoring Method across Subrounds
                    </label>
                    <select
                      value={scoringConfig.r1.scoringMethod}
                      onChange={(e) =>
                        setScoringConfig({
                          ...scoringConfig,
                          r1: {
                            ...scoringConfig.r1,
                            scoringMethod: e.target.value as any
                          }
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                    >
                      <option value="best_subround">Best Subround (Take highest score)</option>
                      <option value="average_subrounds">Average of Subrounds</option>
                      <option value="total_subrounds">Sum of all Subrounds</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Round Multiplier (Scaling)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={scoringConfig?.r1?.multiplier ?? 1.0}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            r1: {
                              ...scoringConfig.r1,
                              multiplier: Number(e.target.value)
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Maximum Score Cap (Optional)
                      </label>
                      <input
                        type="number"
                        placeholder="Leave empty for uncapped"
                        value={scoringConfig?.r1?.maximumScore ?? ''}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            r1: {
                              ...scoringConfig.r1,
                              maximumScore: e.target.value ? Number(e.target.value) : undefined
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ROUND 2 */}
              {activeConfigTab === 'r2' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Easy Points
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={
                          scoringConfig?.r2?.pointsPerQuestion?.easy ??
                          scoringConfig?.r2?.defaultEasyPoints ??
                          2
                        }
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setScoringConfig({
                            ...scoringConfig,
                            r2: {
                              ...scoringConfig.r2,
                              defaultEasyPoints: val,
                              pointsPerQuestion: {
                                ...(scoringConfig.r2?.pointsPerQuestion || {}),
                                easy: val
                              }
                            }
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Medium Points
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={
                          scoringConfig?.r2?.pointsPerQuestion?.medium ??
                          scoringConfig?.r2?.defaultMediumPoints ??
                          4
                        }
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setScoringConfig({
                            ...scoringConfig,
                            r2: {
                              ...scoringConfig.r2,
                              defaultMediumPoints: val,
                              pointsPerQuestion: {
                                ...(scoringConfig.r2?.pointsPerQuestion || {}),
                                medium: val
                              }
                            }
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Hard Points
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={
                          scoringConfig?.r2?.pointsPerQuestion?.hard ??
                          scoringConfig?.r2?.defaultHardPoints ??
                          6
                        }
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setScoringConfig({
                            ...scoringConfig,
                            r2: {
                              ...scoringConfig.r2,
                              defaultHardPoints: val,
                              pointsPerQuestion: {
                                ...(scoringConfig.r2?.pointsPerQuestion || {}),
                                hard: val
                              }
                            }
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Penalty per Incorrect Answer
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={
                          scoringConfig?.r2?.penaltyPerIncorrect ??
                          scoringConfig?.r2?.incorrectPenalty ??
                          0
                        }
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setScoringConfig({
                            ...scoringConfig,
                            r2: {
                              ...scoringConfig.r2,
                              incorrectPenalty: val,
                              penaltyPerIncorrect: val
                            }
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Round Multiplier
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={scoringConfig?.r2?.multiplier ?? 1.0}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            r2: {
                              ...scoringConfig.r2,
                              multiplier: Number(e.target.value)
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ROUND 3 */}
              {activeConfigTab === 'r3' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Code Minimization Scoring Policy
                    </label>
                    <select
                      value={scoringConfig?.r3?.charCountScoringMethod ?? scoringConfig?.r3?.minimizationMethod ?? 'rank_bonus'}
                      onChange={(e) =>
                        setScoringConfig({
                          ...scoringConfig,
                          r3: {
                            ...scoringConfig.r3,
                            charCountScoringMethod: e.target.value as any,
                            minimizationMethod: e.target.value as any
                          }
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                    >
                      <option value="rank_bonus">Rank Bonus (Shortest code gets +25, +18, +12, +8, +5)</option>
                      <option value="percentage">Percentage Bonus based on code reduction</option>
                      <option value="threshold">Threshold Bonus (Solutions under target char count)</option>
                      <option value="bonus_points">Flat Bonus for shortest valid solution</option>
                      <option value="tie_breaker_only">Tie Breaker Only (No direct point bonus)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Round Multiplier
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={scoringConfig?.r3?.multiplier ?? 1.0}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            r3: {
                              ...scoringConfig.r3,
                              multiplier: Number(e.target.value)
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Max Score Cap (Optional)
                      </label>
                      <input
                        type="number"
                        placeholder="Leave empty for uncapped"
                        value={scoringConfig?.r3?.maximumScore ?? ''}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            r3: {
                              ...scoringConfig.r3,
                              maximumScore: e.target.value ? Number(e.target.value) : undefined
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ROUND 4 */}
              {activeConfigTab === 'r4' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Speed Bonus (pts)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={scoringConfig?.r4?.speedBonusPoints ?? 10}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            r4: {
                              ...scoringConfig.r4,
                              speedBonusPoints: Number(e.target.value)
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Speed Threshold (sec)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={scoringConfig?.r4?.speedBonusThresholdSeconds ?? 120}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            r4: {
                              ...scoringConfig.r4,
                              speedBonusThresholdSeconds: Number(e.target.value)
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Attempt Penalty (pts)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={scoringConfig?.r4?.penaltyPerAttempt ?? scoringConfig?.r4?.attemptPenalty ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setScoringConfig({
                            ...scoringConfig,
                            r4: {
                              ...scoringConfig.r4,
                              attemptPenalty: val,
                              penaltyPerAttempt: val
                            }
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Round Multiplier
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={scoringConfig?.r4?.multiplier ?? 1.0}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            r4: {
                              ...scoringConfig.r4,
                              multiplier: Number(e.target.value)
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Max Score Cap (Optional)
                      </label>
                      <input
                        type="number"
                        placeholder="Leave empty for uncapped"
                        value={scoringConfig?.r4?.maximumScore ?? ''}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            r4: {
                              ...scoringConfig.r4,
                              maximumScore: e.target.value ? Number(e.target.value) : undefined
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TIE BREAK RULES */}
              {activeConfigTab === 'tiebreak' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">
                    When two teams have the same Final Score, tie-break priorities are evaluated sequentially:
                  </p>
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    {(scoringConfig?.tieBreakRules?.priority || []).map((rule, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-xs text-slate-300">
                        <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-400">
                          {idx + 1}
                        </span>
                        <span className="font-mono font-bold text-indigo-300">
                          {rule.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MAX CAPS */}
              {activeConfigTab === 'caps' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">
                    Configure optional upper bounds for individual rounds. Leave blank for uncapped scores.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        R1 Cap
                      </label>
                      <input
                        type="number"
                        placeholder="Uncapped"
                        value={scoringConfig.maxScores?.r1 ?? ''}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            maxScores: {
                              ...scoringConfig.maxScores,
                              r1: e.target.value ? Number(e.target.value) : undefined
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        R2 Cap
                      </label>
                      <input
                        type="number"
                        placeholder="Uncapped"
                        value={scoringConfig.maxScores?.r2 ?? ''}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            maxScores: {
                              ...scoringConfig.maxScores,
                              r2: e.target.value ? Number(e.target.value) : undefined
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        R3 Cap
                      </label>
                      <input
                        type="number"
                        placeholder="Uncapped"
                        value={scoringConfig.maxScores?.r3 ?? ''}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            maxScores: {
                              ...scoringConfig.maxScores,
                              r3: e.target.value ? Number(e.target.value) : undefined
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        R4 Cap
                      </label>
                      <input
                        type="number"
                        placeholder="Uncapped"
                        value={scoringConfig.maxScores?.r4 ?? ''}
                        onChange={(e) =>
                          setScoringConfig({
                            ...scoringConfig,
                            maxScores: {
                              ...scoringConfig.maxScores,
                              r4: e.target.value ? Number(e.target.value) : undefined
                            }
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  {isLoading ? 'Saving...' : 'Apply & Recalculate Live'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL SCORE OVERRIDE */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-400" />
                Admin Manual Score Adjustment
              </h3>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyOverride} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Target Team
                </label>
                <select
                  value={overrideForm.teamId}
                  onChange={(e) => setOverrideForm({ ...overrideForm, teamId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  required
                >
                  <option value="">Select Team...</option>
                  {leaderboard.map((team) => (
                    <option key={team.teamId} value={team.teamId}>
                      {team.teamName} ({team.teamCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Round
                  </label>
                  <select
                    value={overrideForm.round}
                    onChange={(e) =>
                      setOverrideForm({
                        ...overrideForm,
                        round: e.target.value as any
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  >
                    <option value="r1">Round 1: Typing</option>
                    <option value="r2">Round 2: Quiz</option>
                    <option value="r3">Round 3: Code</option>
                    <option value="r4">Round 4: Crack</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Adjustment Type
                  </label>
                  <select
                    value={overrideForm.type}
                    onChange={(e) =>
                      setOverrideForm({
                        ...overrideForm,
                        type: e.target.value as any
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  >
                    <option value="override">Direct Fixed Score</option>
                    <option value="bonus">Bonus Points (+X)</option>
                    <option value="penalty">Penalty Deduct (-X)</option>
                    <option value="reset">Reset to Calculated</option>
                  </select>
                </div>
              </div>

              {overrideForm.type !== 'reset' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {overrideForm.type === 'override'
                      ? 'New Final Round Score'
                      : overrideForm.type === 'bonus'
                      ? 'Bonus Value'
                      : 'Penalty Value'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={overrideForm.value}
                    onChange={(e) =>
                      setOverrideForm({ ...overrideForm, value: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Reason for Adjustment (Logged to Audit Trail)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Hardware restart compensation, Fair play penalty"
                  value={overrideForm.reason}
                  onChange={(e) =>
                    setOverrideForm({ ...overrideForm, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500"
                >
                  Apply & Recalculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GRANULAR TEAM SCORE BREAKDOWN */}
      {selectedTeamBreakdown && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  {selectedTeamBreakdown.teamName}
                </h3>
                <p className="text-xs font-mono text-indigo-400">
                  {selectedTeamBreakdown.teamCode} • Rank #{selectedTeamBreakdown.rank}
                </p>
              </div>
              <button
                onClick={() => setSelectedTeamBreakdown(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="font-bold text-white">Final Score (R1 + R2 + R3 + R4):</span>
                <span className="font-black text-base text-amber-300 font-mono">
                  {selectedTeamBreakdown.scores.total}
                </span>
              </div>

              {/* R1 Breakdown */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between font-bold text-slate-200">
                  <span>Round 1: Fastest Fingers First</span>
                  <span className="font-mono text-indigo-300">{selectedTeamBreakdown.scores.r1} pts</span>
                </div>
                {roundScores[selectedTeamBreakdown.teamId]?.r1 && (
                  <div className="mt-2 text-[11px] text-slate-400 space-y-1 font-mono">
                    <div>Raw Score: {roundScores[selectedTeamBreakdown.teamId].r1.rawScore}</div>
                    {roundScores[selectedTeamBreakdown.teamId].r1.manualOverride && (
                      <div className="text-amber-400 font-bold">
                        Override: {roundScores[selectedTeamBreakdown.teamId].r1.manualOverride?.type} ({roundScores[selectedTeamBreakdown.teamId].r1.manualOverride?.value}) - {roundScores[selectedTeamBreakdown.teamId].r1.manualOverride?.reason}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* R2 Breakdown */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between font-bold text-slate-200">
                  <span>Round 2: Byte-Sized Brains</span>
                  <span className="font-mono text-indigo-300">{selectedTeamBreakdown.scores.r2} pts</span>
                </div>
                {roundScores[selectedTeamBreakdown.teamId]?.r2 && (
                  <div className="mt-2 text-[11px] text-slate-400 space-y-1 font-mono">
                    <div>Raw Score: {roundScores[selectedTeamBreakdown.teamId].r2.rawScore}</div>
                    {roundScores[selectedTeamBreakdown.teamId].r2.manualOverride && (
                      <div className="text-amber-400 font-bold">
                        Override: {roundScores[selectedTeamBreakdown.teamId].r2.manualOverride?.type} ({roundScores[selectedTeamBreakdown.teamId].r2.manualOverride?.value}) - {roundScores[selectedTeamBreakdown.teamId].r2.manualOverride?.reason}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* R3 Breakdown */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between font-bold text-slate-200">
                  <span>Round 3: Code Minimalist</span>
                  <span className="font-mono text-indigo-300">{selectedTeamBreakdown.scores.r3} pts</span>
                </div>
                {roundScores[selectedTeamBreakdown.teamId]?.r3 && (
                  <div className="mt-2 text-[11px] text-slate-400 space-y-1 font-mono">
                    <div>Raw Score: {roundScores[selectedTeamBreakdown.teamId].r3.rawScore}</div>
                    {roundScores[selectedTeamBreakdown.teamId].r3.manualOverride && (
                      <div className="text-amber-400 font-bold">
                        Override: {roundScores[selectedTeamBreakdown.teamId].r3.manualOverride?.type} ({roundScores[selectedTeamBreakdown.teamId].r3.manualOverride?.value}) - {roundScores[selectedTeamBreakdown.teamId].r3.manualOverride?.reason}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* R4 Breakdown */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between font-bold text-slate-200">
                  <span>Round 4: Crack & Compete</span>
                  <span className="font-mono text-indigo-300">{selectedTeamBreakdown.scores.r4} pts</span>
                </div>
                {roundScores[selectedTeamBreakdown.teamId]?.r4 && (
                  <div className="mt-2 text-[11px] text-slate-400 space-y-1 font-mono">
                    <div>Raw Score: {roundScores[selectedTeamBreakdown.teamId].r4.rawScore}</div>
                    {roundScores[selectedTeamBreakdown.teamId].r4.manualOverride && (
                      <div className="text-amber-400 font-bold">
                        Override: {roundScores[selectedTeamBreakdown.teamId].r4.manualOverride?.type} ({roundScores[selectedTeamBreakdown.teamId].r4.manualOverride?.value}) - {roundScores[selectedTeamBreakdown.teamId].r4.manualOverride?.reason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-between">
              <button
                onClick={() => {
                  const tId = selectedTeamBreakdown.teamId;
                  setSelectedTeamBreakdown(null);
                  openOverrideModalForTeam(tId);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" /> Adjust This Team
              </button>
              <button
                onClick={() => setSelectedTeamBreakdown(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

