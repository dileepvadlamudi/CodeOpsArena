import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CrackChallenge, CrackProgress, ContestState, Team } from '../../types/contest';
import {
  KeyRound,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Shield,
  HelpCircle,
  RotateCcw
} from 'lucide-react';

interface Round4AdminTabProps {
  contestState: ContestState;
  teams?: Team[];
  onRefresh: () => void;
}

export const Round4AdminTab: React.FC<Round4AdminTabProps> = ({
  contestState,
  teams = [],
  onRefresh
}) => {
  const safeTeams = Array.isArray(teams) ? teams : [];
  const { token } = useAuth();
  const [subTab, setSubTab] = useState<'BUILDER' | 'PROGRESS'>('BUILDER');
  const [challenges, setChallenges] = useState<CrackChallenge[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, CrackProgress>>({});
  const [editingChallenge, setEditingChallenge] = useState<Partial<CrackChallenge> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchCrackData = async () => {
    if (!token) return;
    try {
      const [cRes, pRes] = await Promise.all([
        api.getCrackChallenges(token),
        api.getCrackProgress(token)
      ]);
      if (cRes.success && Array.isArray(cRes.challenges)) {
        setChallenges(cRes.challenges.sort((a: any, b: any) => a.order - b.order));
      }
      if (pRes.success) {
        if (Array.isArray(pRes.progress)) {
          const map: Record<string, CrackProgress> = {};
          pRes.progress.forEach((p: any) => {
            if (p.teamId) map[p.teamId] = p;
          });
          setProgressMap(map);
        } else if (pRes.progress && typeof pRes.progress === 'object') {
          setProgressMap(pRes.progress);
        }
      }
    } catch (err) {
      console.error('Error fetching crack data:', err);
    }
  };

  useEffect(() => {
    fetchCrackData();
    // Realtime live polling for Round 4 progression matrix
    const interval = setInterval(fetchCrackData, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const handleSaveChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingChallenge) return;
    try {
      await api.saveCrackChallenge(token, editingChallenge, isEditing);
      setEditingChallenge(null);
      fetchCrackData();
      onRefresh();
    } catch (err) {
      console.error('Error saving crack challenge:', err);
    }
  };

  const handleManualUnlock = async (challengeId: string, teamId?: string) => {
    if (!token) return;
    try {
      await api.manualUnlockChallenge(token, challengeId, teamId);
      fetchCrackData();
      onRefresh();
    } catch (err) {
      console.error('Error unlocking challenge:', err);
    }
  };

  const handleRestartRound4 = async () => {
    if (!token) return;
    if (!window.confirm('Reset Round 4 state? This will ensure all teams start from Question 1, clearing Round 4 progress, attempts, and scores.')) {
      return;
    }
    try {
      await api.restartRound4(token, 1800);
      await fetchCrackData();
      onRefresh();
    } catch (err) {
      console.error('Error restarting Round 4:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setSubTab('BUILDER')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'BUILDER'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" /> Visual Challenge Chain Builder ({challenges.length})
          </button>
          <button
            onClick={() => setSubTab('PROGRESS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'PROGRESS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" /> Live Progression Matrix
          </button>
        </div>

        {subTab === 'BUILDER' && (
          <button
            onClick={() => {
              setEditingChallenge({
                id: `crk-${Date.now()}`,
                order: challenges.length + 1,
                title: `Node ${challenges.length + 1}: Custom Security Puzzle`,
                puzzleType: 'cipher',
                prompt: 'Decrypt the hidden key using standard Caesar shift (+3).',
                cipherText: 'FRGHVHYHQ',
                correctAnswer: 'CODESEVEN',
                acceptedVariations: ['codeseven', 'CODE SEVEN'],
                hintAfterSolve: 'Hint for next node: Check byte offset 0x4F.',
                points: 25,
                isManuallyUnlockedForEveryone: false
              });
              setIsEditing(false);
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Puzzle Node
          </button>
        )}
      </div>

      {subTab === 'BUILDER' ? (
        <div className="space-y-6">
          {/* Visual Interactive Linear Flow */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Contest Challenge Chain (Linear Path)
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Teams must solve each challenge in strict sequence. Solving a node automatically grants points, unlocks the clue/hint, and reveals the next challenge.
            </p>

            <div className="flex flex-col md:flex-row items-stretch gap-3 overflow-x-auto pb-2">
              {challenges.map((ch, idx) => (
                <React.Fragment key={ch.id}>
                  <div className="flex-1 min-w-[220px] bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                        {ch.order}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-amber-400 font-mono">
                        {ch.points} pts
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white mb-1 truncate">{ch.title}</h4>
                      <p className="text-[10px] text-slate-400 capitalize">{ch.puzzleType} puzzle</p>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-emerald-400 font-mono truncate">
                      Ans: {ch.correctAnswer}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handleManualUnlock(ch.id)}
                        className={`text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                          ch.isManuallyUnlockedForEveryone ? 'text-amber-400' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {ch.isManuallyUnlockedForEveryone ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {ch.isManuallyUnlockedForEveryone ? 'Unlocked for All' : 'Unlock All'}
                      </button>

                      <button
                        onClick={() => {
                          setEditingChallenge({ ...ch });
                          setIsEditing(true);
                        }}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Edit Node"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {idx < challenges.length - 1 && (
                    <div className="hidden md:flex items-center justify-center text-slate-600">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Challenge list details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challenges.map((ch) => (
              <div
                key={ch.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] font-bold">
                      Challenge {ch.order} • {ch.puzzleType.toUpperCase()}
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">{ch.points} pts</span>
                  </div>

                  <h4 className="text-sm font-bold text-white mb-2">{ch.title}</h4>
                  <p className="text-xs text-slate-300 mb-3">{ch.prompt}</p>

                  {ch.cipherText && (
                    <pre className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-indigo-300 mb-2 whitespace-pre-wrap">
                      {ch.cipherText}
                    </pre>
                  )}

                  {ch.hintAfterSolve && (
                    <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/60 rounded-xl text-xs text-emerald-300">
                      <span className="text-[10px] font-bold uppercase text-emerald-400 block mb-0.5">Unlocked Hint:</span>
                      {ch.hintAfterSolve}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400 font-bold">
                    Key: <span className="text-white">{ch.correctAnswer}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleManualUnlock(ch.id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                    >
                      {ch.isManuallyUnlockedForEveryone ? 'Locked for None' : 'Unlock for All'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingChallenge({ ...ch });
                        setIsEditing(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* LIVE PROGRESSION MATRIX */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Team Progression Matrix</h3>
              <p className="text-xs text-slate-400">Live solve status across all challenge nodes in Round 4.</p>
            </div>
            <button
              onClick={handleRestartRound4}
              className="px-3.5 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Reset all Round 4 progress so every team starts cleanly from Node 1"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              Reset All Teams to Node 1
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400">
                <tr>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">Solved</th>
                  {challenges.map((ch) => (
                    <th key={ch.id} className="py-3 px-4 text-center">
                      Node {ch.order} ({ch.points}p)
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right">R4 Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {safeTeams.map((t) => {
                  const prog = progressMap[t.id];
                  const completedIds = prog?.completedChallengeIds || [];

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-white">{t.name}</td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                        {completedIds.length}/{challenges.length}
                      </td>
                      {challenges.map((ch) => {
                        const isDone = completedIds.includes(ch.id) || ch.isManuallyUnlockedForEveryone;
                        return (
                          <td key={ch.id} className="py-3 px-4 text-center">
                            {isDone ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold">
                                ✓
                              </span>
                            ) : (
                              <button
                                onClick={() => handleManualUnlock(ch.id, t.id)}
                                className="inline-flex items-center justify-center px-2 py-1 rounded bg-slate-800 hover:bg-amber-600 text-slate-400 hover:text-white text-[10px] font-bold"
                                title="Manually unlock this node for this team"
                              >
                                Unlock
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-right font-mono font-black text-white text-sm">
                        {t.scores.r4}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT CHALLENGE MODAL */}
      {editingChallenge && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">
              {isEditing ? 'Edit Crack Node' : 'Create Crack Challenge Node'}
            </h3>

            <form onSubmit={handleSaveChallenge} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Order #</label>
                  <input
                    type="number"
                    value={editingChallenge.order || 1}
                    onChange={(e) => setEditingChallenge({ ...editingChallenge, order: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Puzzle Type</label>
                  <select
                    value={editingChallenge.puzzleType || 'cipher'}
                    onChange={(e) => setEditingChallenge({ ...editingChallenge, puzzleType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  >
                    <option value="cipher">Cipher / Decryption</option>
                    <option value="hex_binary">Hex / Binary Data</option>
                    <option value="regex_code">Regex / Reverse Engineering</option>
                    <option value="logic_riddle">Logic Riddle / Security Puzzle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Points</label>
                  <input
                    type="number"
                    value={editingChallenge.points || 25}
                    onChange={(e) => setEditingChallenge({ ...editingChallenge, points: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Node Title</label>
                <input
                  type="text"
                  value={editingChallenge.title || ''}
                  onChange={(e) => setEditingChallenge({ ...editingChallenge, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Prompt / Instructions</label>
                <textarea
                  value={editingChallenge.prompt || ''}
                  onChange={(e) => setEditingChallenge({ ...editingChallenge, prompt: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Cipher / Raw Data Payload</label>
                <textarea
                  value={editingChallenge.cipherText || ''}
                  onChange={(e) => setEditingChallenge({ ...editingChallenge, cipherText: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Correct Answer / Key</label>
                <input
                  type="text"
                  value={editingChallenge.correctAnswer || ''}
                  onChange={(e) => setEditingChallenge({ ...editingChallenge, correctAnswer: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Hint Unlocked After Solving</label>
                <textarea
                  value={editingChallenge.hintAfterSolve || ''}
                  onChange={(e) => setEditingChallenge({ ...editingChallenge, hintAfterSolve: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingChallenge(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500"
                >
                  Save Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
