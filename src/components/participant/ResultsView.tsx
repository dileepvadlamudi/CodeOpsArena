import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { LeaderboardEntry, ContestState } from '../../types/contest';
import {
  Trophy,
  Award,
  Sparkles,
  Medal,
  Star,
  CheckCircle2,
  TrendingUp,
  Download,
  Keyboard,
  Clock,
  Zap,
  Sliders,
  Check,
  Code,
  Lock,
  Unlock,
  Terminal,
  FileCode,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ResultsViewProps {
  contestState: ContestState;
  stageData?: any;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ contestState, stageData }) => {
  const { token, user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const stage = String(contestState.currentStage || '');
  const isRound1Results = stage === 'R1_RESULTS' || stage === 'ROUND_1_RESULTS';
  const isRound2Results = stage === 'R2_RESULTS' || stage === 'ROUND_2_RESULTS';
  const isRound3Results = stage === 'R3_RESULTS' || stage === 'ROUND_3_RESULTS';
  const isRound4Results = stage === 'R4_RESULTS' || stage === 'ROUND_4_RESULTS';
  const isFinalResults = stage === 'FINAL_RESULTS' || stage === 'CONTEST_ENDED' || stage === 'ENDED';

  // Safe score extractors
  const getR1 = (e: any) => Number(e?.scores?.r1 ?? e?.r1Score ?? 0);
  const getR2 = (e: any) => Number(e?.scores?.r2 ?? e?.r2Score ?? 0);
  const getR3 = (e: any) => Number(e?.scores?.r3 ?? e?.r3Score ?? 0);
  const getR4 = (e: any) => Number(e?.scores?.r4 ?? e?.r4Score ?? 0);
  const getTotal = (e: any) => Number(e?.totalWeightedScore ?? e?.scores?.total ?? e?.totalScore ?? 0);

  const fetchLeaderboard = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      let res = await api.getParticipantLeaderboard(token);
      if (!res || !res.success) {
        if (user?.role === 'admin') {
          res = await api.getAdminLeaderboard(token);
        }
      }
      if (res && res.success && Array.isArray(res.leaderboard)) {
        setLeaderboard(res.leaderboard);
      } else if (stageData?.leaderboard && Array.isArray(stageData.leaderboard)) {
        setLeaderboard(stageData.leaderboard);
      } else if (stageData?.round1Results?.leaderboard) {
        setLeaderboard(stageData.round1Results.leaderboard);
      } else if (stageData?.round2Results?.leaderboard) {
        setLeaderboard(stageData.round2Results.leaderboard);
      } else if (stageData?.round3Results?.leaderboard) {
        setLeaderboard(stageData.round3Results.leaderboard);
      } else if (stageData?.round4Results?.leaderboard) {
        setLeaderboard(stageData.round4Results.leaderboard);
      }
    } catch (err) {
      console.warn('Fallback: reading leaderboard from stageData', err);
      const fallbackList =
        stageData?.leaderboard ||
        stageData?.round1Results?.leaderboard ||
        stageData?.round2Results?.leaderboard ||
        stageData?.round3Results?.leaderboard ||
        stageData?.round4Results?.leaderboard ||
        stageData?.finalResults?.leaderboard;
      if (Array.isArray(fallbackList)) {
        setLeaderboard(fallbackList);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      console.warn('Confetti animation skipped', e);
    }
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 3000);
    return () => clearInterval(interval);
  }, [token, stage]);

  const currentTeamEntry = leaderboard.find(
    (l) => l.teamName === user?.teamName || l.teamCode === user?.teamCode || l.teamId === user?.id
  );

  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

  // =========================================================================
  // 1. ROUND 1 RESULTS
  // =========================================================================
  if (isRound1Results) {
    const r1ResultsData = stageData?.round1Results || {};
    const myStats = r1ResultsData?.myStats || null;
    const sortedR1Teams = [...leaderboard].sort((a, b) => getR1(b) - getR1(a));

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Banner */}
        <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-3 relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-700/60 text-purple-300 text-xs font-bold uppercase tracking-wider">
            <Keyboard className="w-4 h-4 text-purple-400" />
            Round 1 Concluded &bull; Fastest Fingers First
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Round 1 Final Standings &amp; Results
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-lg mx-auto">
            All typing sub-rounds have completed. Below is the official performance summary for your team and the overall standings.
          </p>

          {/* Current Team Standing Card */}
          {currentTeamEntry && (
            <div className="bg-slate-950/80 border border-purple-500/30 rounded-2xl p-4 mt-3 max-w-md mx-auto flex items-center justify-around">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Your Round 1 Score</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {getR1(currentTeamEntry)} <span className="text-xs text-slate-500 font-sans">pts</span>
                </span>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Overall Rank</span>
                <span className="text-2xl font-black text-white font-mono">
                  #{currentTeamEntry.rank || '-'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sub-Round Breakdown for this team if available */}
        {myStats && myStats.subroundScores && Object.keys(myStats.subroundScores).length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Your Sub-Round Performance Breakdown
              </h3>
              <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-800">
                Scoring Rule: {r1ResultsData?.scoringMethod ? String(r1ResultsData.scoringMethod).toUpperCase() : 'BEST'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(myStats.subroundScores).map(([roundId, sub]: [string, any], idx) => (
                <div key={roundId} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Sub-Round #{idx + 1}</span>
                    <span className="text-emerald-400 font-mono">{sub.testScore !== undefined ? `${sub.testScore} pts` : 'No Attempt'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 text-center">
                      <span className="text-[9px] uppercase font-sans text-slate-500 block">Test WPM</span>
                      <span className="font-bold text-white">{sub.testWpm || 0}</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 text-center">
                      <span className="text-[9px] uppercase font-sans text-slate-500 block">Accuracy</span>
                      <span className="font-bold text-indigo-300">{sub.testAccuracy || 0}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Round 1 Leaderboard Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Round 1 Leaderboard Standings</h3>
              <p className="text-xs text-slate-400">Ranked by official Round 1 typing points.</p>
            </div>
            <button
              onClick={fetchLeaderboard}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Refresh Standings"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400">
                <tr>
                  <th className="py-3 px-4 w-16">Rank</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">Team Code</th>
                  <th className="py-3 px-4 text-right">Round 1 Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {sortedR1Teams.map((entry, idx) => (
                  <tr
                    key={entry.teamId || idx}
                    className={`hover:bg-slate-800/40 ${
                      idx === 0 ? 'bg-amber-500/5' : ''
                    } ${entry.teamName === user?.teamName ? 'bg-indigo-600/10' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <span className="font-bold font-mono text-xs">#{idx + 1}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white">{entry.teamName}</td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{entry.teamCode}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                      {getR1(entry)} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Next Round Indicator */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>Round 1 complete. Stand by for the Administrator to introduce the next round.</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. ROUND 2 RESULTS
  // =========================================================================
  if (isRound2Results) {
    const r2ResultsData = stageData?.round2Results || {};
    const myStatsR2 = r2ResultsData?.myStats || null;
    const reviewQuestions = r2ResultsData?.reviewQuestions || [];
    const sortedR2Teams = [...leaderboard].sort((a, b) => getR2(b) - getR2(a));

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Banner */}
        <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-3 relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <Zap className="w-4 h-4 text-indigo-400" />
            Round 2 Concluded &bull; Byte-Sized Brains
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Round 2 Final Standings &amp; Results
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-lg mx-auto">
            All stages of the technical quiz have concluded. Below is your official performance summary, stage breakdown, and question review.
          </p>

          {currentTeamEntry && (
            <div className="inline-block bg-slate-950 border border-indigo-500/50 rounded-2xl px-6 py-2.5 mt-2">
              <span className="text-xs text-slate-400 block font-medium">Your Round 2 Score</span>
              <span className="text-xl font-extrabold text-white">
                {getR2(currentTeamEntry)} Points &bull; Total Weighted: {getTotal(currentTeamEntry)}
              </span>
            </div>
          )}
        </div>

        {/* My Performance Card */}
        {myStatsR2 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Your Team Summary
              </h3>
              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950 px-2.5 py-1 rounded-full border border-indigo-800">
                {myStatsR2.teamName} ({myStatsR2.teamCode})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Accuracy</span>
                <span className="text-xl font-mono font-bold text-emerald-400">
                  {myStatsR2.accuracy || 0}%
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Correct</span>
                <span className="text-xl font-mono font-bold text-white">
                  {myStatsR2.correctSubmissions || 0} / {myStatsR2.totalSubmissions || 0}
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Final Points</span>
                <span className="text-xl font-mono font-bold text-amber-400">
                  {myStatsR2.finalRound2Score || 0}
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Time Taken</span>
                <span className="text-xl font-mono font-bold text-indigo-300">
                  {myStatsR2.totalTimeTaken || 0}s
                </span>
              </div>
            </div>

            {/* Stage Breakdown */}
            {myStatsR2.stageScores && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">Stage 1 (Easy)</span>
                  <span className="text-sm font-mono font-bold text-white">
                    {myStatsR2.stageScores[1] || 0} pts
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">Stage 2 (Medium)</span>
                  <span className="text-sm font-mono font-bold text-white">
                    {myStatsR2.stageScores[2] || 0} pts
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">Stage 3 (Hard)</span>
                  <span className="text-sm font-mono font-bold text-white">
                    {myStatsR2.stageScores[3] || 0} pts
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Round 2 Standings Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Round 2 Official Leaderboard
            </h3>
            <button
              onClick={fetchLeaderboard}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4 text-center">R1 Score</th>
                  <th className="py-3 px-4 text-center text-indigo-400 font-bold">R2 Score</th>
                  <th className="py-3 px-4 text-right">Total Weighted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {sortedR2Teams.map((entry, idx) => (
                  <tr
                    key={entry.teamId || idx}
                    className={`transition-colors ${
                      entry.teamName === user?.teamName
                        ? 'bg-indigo-950/40 font-bold text-white border-l-2 border-indigo-400'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="text-white">{entry.teamName}</span>
                        <span className="text-[10px] text-slate-500 font-mono block">{entry.teamCode}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">{getR1(entry)}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-indigo-300">
                      {getR2(entry)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                      {getTotal(entry)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Next Round Waiting Indicator */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>Round 2 complete. Stand by for the Administrator to introduce the next round.</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. ROUND 3 RESULTS (Code Golf)
  // =========================================================================
  if (isRound3Results) {
    const r3ResultsData = stageData?.round3Results || {};
    const myStatsR3 = r3ResultsData?.myStats || null;
    const sortedR3Teams = [...leaderboard].sort((a, b) => getR3(b) - getR3(a));

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Banner */}
        <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-3 relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Code className="w-4 h-4 text-emerald-400" />
            Round 3 Concluded &bull; Code Minimalist Mastery
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Round 3 Final Standings &amp; Results
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-lg mx-auto">
            Algorithm optimization and code reduction evaluation completed. Below is your team performance and rankings.
          </p>

          {currentTeamEntry && (
            <div className="inline-block bg-slate-950 border border-emerald-500/50 rounded-2xl px-6 py-2.5 mt-2">
              <span className="text-xs text-slate-400 block font-medium">Your Round 3 Score</span>
              <span className="text-xl font-extrabold text-white">
                {getR3(currentTeamEntry)} Points &bull; Total Weighted: {getTotal(currentTeamEntry)}
              </span>
            </div>
          )}
        </div>

        {/* My Performance Card */}
        {myStatsR3 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Your Code Minimalist Submission Summary
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-800">
                {myStatsR3.teamName}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Tests Passed</span>
                <span className="text-xl font-mono font-bold text-emerald-400">
                  {myStatsR3.testsPassed} / {myStatsR3.totalTests}
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Char Length</span>
                <span className="text-xl font-mono font-bold text-indigo-300">
                  {myStatsR3.characterCount} chars
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Round 3 Points</span>
                <span className="text-xl font-mono font-bold text-amber-400">
                  {myStatsR3.r3Score} pts
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Language</span>
                <span className="text-xl font-mono font-bold text-slate-200 uppercase">
                  {myStatsR3.bestLanguage || 'Python'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Round 3 Standings Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Round 3 Standings
            </h3>
            <button
              onClick={fetchLeaderboard}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4 text-center">R1</th>
                  <th className="py-3 px-4 text-center">R2</th>
                  <th className="py-3 px-4 text-center text-emerald-400 font-bold">R3 Code Minimalist</th>
                  <th className="py-3 px-4 text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {sortedR3Teams.map((entry, idx) => (
                  <tr
                    key={entry.teamId || idx}
                    className={`transition-colors ${
                      entry.teamName === user?.teamName
                        ? 'bg-emerald-950/40 font-bold text-white border-l-2 border-emerald-400'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="text-white">{entry.teamName}</span>
                        <span className="text-[10px] text-slate-500 font-mono block">{entry.teamCode}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">{getR1(entry)}</td>
                    <td className="py-3 px-4 text-center font-mono">{getR2(entry)}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                      {getR3(entry)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                      {getTotal(entry)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Next Round Waiting Indicator */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>Round 3 complete. Stand by for the Administrator to introduce the next round.</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 4. ROUND 4 RESULTS (Crack the Code)
  // =========================================================================
  if (isRound4Results) {
    const r4ResultsData = stageData?.round4Results || {};
    const myStatsR4 = r4ResultsData?.myStats || null;
    const sortedR4Teams = [...leaderboard].sort((a, b) => getR4(b) - getR4(a));

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Banner */}
        <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-3 relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-700/60 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            Round 4 Concluded &bull; Crack the Code
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Round 4 Final Standings &amp; Results
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-lg mx-auto">
            The security decryption labyrinth has concluded. Below is your puzzle progress and round rankings.
          </p>

          {currentTeamEntry && (
            <div className="inline-block bg-slate-950 border border-amber-500/50 rounded-2xl px-6 py-2.5 mt-2">
              <span className="text-xs text-slate-400 block font-medium">Your Round 4 Score</span>
              <span className="text-xl font-extrabold text-white">
                {getR4(currentTeamEntry)} Points &bull; Total Weighted: {getTotal(currentTeamEntry)}
              </span>
            </div>
          )}
        </div>

        {/* My Performance Card */}
        {myStatsR4 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Your Decryption Summary
              </h3>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950 px-2.5 py-1 rounded-full border border-amber-800">
                {myStatsR4.teamName}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Puzzles Solved</span>
                <span className="text-xl font-mono font-bold text-emerald-400">
                  {myStatsR4.totalSolved} / {myStatsR4.totalChallenges || 5}
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Round 4 Score</span>
                <span className="text-xl font-mono font-bold text-amber-400">
                  {myStatsR4.r4Score} pts
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Solve Duration</span>
                <span className="text-xl font-mono font-bold text-indigo-300">
                  {myStatsR4.totalTimeSeconds || 0}s
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Round 4 Standings Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Round 4 Standings
            </h3>
            <button
              onClick={fetchLeaderboard}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4 text-center">R1</th>
                  <th className="py-3 px-4 text-center">R2</th>
                  <th className="py-3 px-4 text-center">R3</th>
                  <th className="py-3 px-4 text-center text-amber-400 font-bold">R4 Crack</th>
                  <th className="py-3 px-4 text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {sortedR4Teams.map((entry, idx) => (
                  <tr
                    key={entry.teamId || idx}
                    className={`transition-colors ${
                      entry.teamName === user?.teamName
                        ? 'bg-amber-950/40 font-bold text-white border-l-2 border-amber-400'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="text-white">{entry.teamName}</span>
                        <span className="text-[10px] text-slate-500 font-mono block">{entry.teamCode}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">{getR1(entry)}</td>
                    <td className="py-3 px-4 text-center font-mono">{getR2(entry)}</td>
                    <td className="py-3 px-4 text-center font-mono">{getR3(entry)}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">
                      {getR4(entry)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {getTotal(entry)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Final Ceremony Indicator */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>All competition rounds complete. Stand by for the Grand Award Ceremony!</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 5. FINAL OVERALL RESULTS & AWARD CEREMONY
  // =========================================================================
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Hero Banner */}
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-4 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-700/60 text-amber-300 text-xs font-bold uppercase tracking-wider">
          <Trophy className="w-4 h-4 text-amber-400" />
          Official Final Results &amp; Award Ceremony
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          CODEOPS 2026 Champions
        </h1>
        <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto font-medium">
          Congratulations to all participating teams for an extraordinary showcase of speed, logic, and coding mastery!
        </p>

        {/* Current Team Rank Pill if available */}
        {currentTeamEntry && (
          <div className="inline-block bg-slate-950 border border-indigo-500/50 rounded-2xl px-6 py-3 mt-4 text-center">
            <span className="text-xs text-slate-400 block font-medium">Your Official Standing</span>
            <span className="text-lg sm:text-xl font-extrabold text-white">
              Rank #{currentTeamEntry.rank || '-'} &bull; {getTotal(currentTeamEntry)} Weighted Points
            </span>
          </div>
        )}
      </div>

      {/* Podium Cards (1st, 2nd, 3rd) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        {/* 2nd Place */}
        {top2 && (
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-xl text-center space-y-3 order-2 md:order-1">
            <div className="w-14 h-14 rounded-2xl bg-slate-300 text-slate-950 font-black text-xl flex items-center justify-center mx-auto shadow-lg">
              2
            </div>
            <span className="text-xs font-mono font-bold text-slate-400 block uppercase">Runner Up</span>
            <h3 className="text-lg font-extrabold text-white">{top2.teamName}</h3>
            <div className="text-2xl font-black text-slate-200 font-mono">
              {getTotal(top2)} <span className="text-xs text-slate-400 font-sans">pts</span>
            </div>
            <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 font-mono">
              R1: {getR1(top2)} &bull; R2: {getR2(top2)} &bull; R3: {getR3(top2)} &bull; R4: {getR4(top2)}
            </div>
          </div>
        )}

        {/* 1st Place */}
        {top1 && (
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-8 shadow-2xl text-center space-y-4 order-1 md:order-2 ring-4 ring-amber-400/20 md:-translate-y-4">
            <div className="w-20 h-20 rounded-3xl bg-amber-400 text-slate-950 font-black text-3xl flex items-center justify-center mx-auto shadow-xl shadow-amber-400/30">
              👑
            </div>
            <div className="inline-block px-3 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-xs font-bold uppercase">
              Grand Winner
            </div>
            <h3 className="text-2xl font-black text-white">{top1.teamName}</h3>
            <div className="text-4xl font-black text-amber-400 font-mono">
              {getTotal(top1)} <span className="text-sm text-slate-400 font-sans">pts</span>
            </div>
            <div className="pt-3 border-t border-slate-800 text-xs text-slate-300 font-mono font-medium">
              R1: {getR1(top1)} &bull; R2: {getR2(top1)} &bull; R3: {getR3(top1)} &bull; R4: {getR4(top1)}
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {top3 && (
          <div className="bg-slate-900 border border-amber-800/60 rounded-3xl p-6 shadow-xl text-center space-y-3 order-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-700 text-white font-black text-xl flex items-center justify-center mx-auto shadow-lg">
              3
            </div>
            <span className="text-xs font-mono font-bold text-amber-500 block uppercase">2nd Runner Up</span>
            <h3 className="text-lg font-extrabold text-white">{top3.teamName}</h3>
            <div className="text-2xl font-black text-amber-200 font-mono">
              {getTotal(top3)} <span className="text-xs text-slate-400 font-sans">pts</span>
            </div>
            <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 font-mono">
              R1: {getR1(top3)} &bull; R2: {getR2(top3)} &bull; R3: {getR3(top3)} &bull; R4: {getR4(top3)}
            </div>
          </div>
        )}
      </div>

      {/* Full Rankings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Full Event Standings</h3>
            <p className="text-xs text-slate-400">All registered teams ranked by final weighted score.</p>
          </div>
          <button
            onClick={fetchLeaderboard}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Refresh Leaderboard"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400">
              <tr>
                <th className="py-3.5 px-4 w-16">Rank</th>
                <th className="py-3.5 px-4">Team</th>
                <th className="py-3.5 px-4">R1 Typing</th>
                <th className="py-3.5 px-4">R2 Quiz</th>
                <th className="py-3.5 px-4">R3 Minimalist</th>
                <th className="py-3.5 px-4">R4 Crack</th>
                <th className="py-3.5 px-4 text-right">Final Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {leaderboard.map((entry, idx) => (
                <tr
                  key={entry.teamId || idx}
                  className={`hover:bg-slate-800/40 ${
                    idx === 0 ? 'bg-amber-500/5' : ''
                  } ${entry.teamName === user?.teamName ? 'bg-indigo-600/10' : ''}`}
                >
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-xs font-mono">#{idx + 1}</span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-white">
                    {entry.teamName}
                    {entry.teamCode && (
                      <span className="text-[10px] text-slate-500 font-mono ml-2">({entry.teamCode})</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">{getR1(entry)}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">{getR2(entry)}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">{getR3(entry)}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">{getR4(entry)}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-white text-base">
                    {getTotal(entry)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
