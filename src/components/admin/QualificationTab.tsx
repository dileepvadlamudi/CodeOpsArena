import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Team, ContestState } from '../../types/contest';
import {
  Award,
  Filter,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Sliders,
  Users,
  ShieldCheck
} from 'lucide-react';

interface QualificationTabProps {
  teams: Team[];
  contestState: ContestState;
  onRefresh: () => void;
}

export const QualificationTab: React.FC<QualificationTabProps> = ({
  teams = [],
  contestState,
  onRefresh
}) => {
  const safeTeams = Array.isArray(teams) ? teams : [];
  const { token } = useAuth();
  const [selectedRound, setSelectedRound] = useState<'r1' | 'r2' | 'r3' | 'r4'>('r1');
  const [ruleType, setRuleType] = useState<'top_n' | 'top_percent' | 'min_score'>('top_n');
  const [ruleValue, setRuleValue] = useState<number>(10);

  const handleApplyRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await api.applyQualificationRule(token, {
        round: selectedRound,
        ruleType,
        value: ruleValue
      });
      onRefresh();
    } catch (err) {
      console.error('Error applying rule:', err);
    }
  };

  const handleToggleManualQualification = async (teamId: string, currentQualified: boolean) => {
    if (!token) return;
    try {
      await api.toggleManualQualification(token, teamId, selectedRound, !currentQualified);
      onRefresh();
    } catch (err) {
      console.error('Error toggling qualification:', err);
    }
  };

  const roundTitles: Record<string, string> = {
    r1: 'Round 1: Fastest Fingers First',
    r2: 'Round 2: Byte-Sized Brains',
    r3: 'Round 3: Code Minimalist',
    r4: 'Round 4: Crack & Compete'
  };

  const getTeamQualified = (t: Team, round: 'r1' | 'r2' | 'r3' | 'r4') => {
    if (t.qualification && t.qualification[round] !== undefined) {
      return Boolean(t.qualification[round]);
    }
    const legacy = (t as any).qualification_status;
    if (legacy && legacy[round] !== undefined) {
      return Boolean(legacy[round]);
    }
    return true;
  };

  const qualifiedCount = safeTeams.filter((t) => t && getTeamQualified(t, selectedRound)).length;

  return (
    <div className="space-y-6">
      {/* Header & Rule Builder */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-400" />
              Automated & Manual Qualification Rules Engine
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select qualification criteria to automatically advance teams into subsequent rounds, or toggle individual team spots manually.
            </p>
          </div>

          {/* Round Selector Pill */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['r1', 'r2', 'r3', 'r4'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRound(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer ${
                  selectedRound === r
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Rule Form */}
        <form
          onSubmit={handleApplyRule}
          className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col md:flex-row items-end gap-4"
        >
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-400 mb-1">Qualification Rule Type</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
            >
              <option value="top_n">Top N Teams by Score</option>
              <option value="top_percent">Top % Percentile of Teams</option>
              <option value="min_score">Minimum Score Cutoff</option>
            </select>
          </div>

          <div className="w-full md:w-48">
            <label className="block text-xs font-bold text-slate-400 mb-1">
              {ruleType === 'top_n'
                ? 'Number of Teams (N)'
                : ruleType === 'top_percent'
                ? 'Percentage (%)'
                : 'Minimum Score Cutoff'}
            </label>
            <input
              type="number"
              value={ruleValue}
              onChange={(e) => setRuleValue(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full md:w-auto px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 cursor-pointer shrink-0"
          >
            Apply Qualification Rule
          </button>
        </form>
      </div>

      {/* Teams Qualification Status Roster */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">{roundTitles[selectedRound]} Roster</h3>
            <p className="text-xs text-slate-400">
              {qualifiedCount} of {teams.length} teams currently qualified for next stage.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400">
              <tr>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">Team Code</th>
                <th className="py-3 px-4">{selectedRound.toUpperCase()} Score</th>
                <th className="py-3 px-4">Total Score</th>
                <th className="py-3 px-4">Qualification Status</th>
                <th className="py-3 px-4 text-right">Manual Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {safeTeams.map((t) => {
                const isQual = getTeamQualified(t, selectedRound);
                return (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-white">{t.name}</td>
                    <td className="py-3 px-4 font-mono text-indigo-400">{t.team_code}</td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {t.scores[selectedRound] || 0}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{t.scores.total}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isQual
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {isQual ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> QUALIFIED
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-500" /> ELIMINATED
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleManualQualification(t.id, isQual)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                          isQual
                            ? 'bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-rose-300'
                            : 'bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-300'
                        }`}
                      >
                        {isQual ? 'Disqualify / Demote' : 'Qualify Team'}
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
  );
};
