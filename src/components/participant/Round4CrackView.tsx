import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CrackChallenge, ContestState } from '../../types/contest';
import {
  Lock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Send,
  Trophy,
  History,
  KeyRound,
  RotateCcw,
  Clock
} from 'lucide-react';

interface Round4CrackViewProps {
  stageData: any;
  contestState: ContestState;
  onRefresh: () => void;
}

export const Round4CrackView: React.FC<Round4CrackViewProps> = ({
  stageData,
  contestState,
  onRefresh
}) => {
  const { token, previewTeamId } = useAuth();
  const challenges: CrackChallenge[] = stageData?.challenges || [];
  const rawCompletedIds: string[] = stageData?.completedChallengeIds || [];
  const [localCompletedIds, setLocalCompletedIds] = useState<string[]>([]);
  const completedIds: string[] = Array.from(new Set([...rawCompletedIds, ...localCompletedIds]));
  const allSolved: boolean = Boolean(stageData?.allSolved) || (challenges.length > 0 && completedIds.length >= challenges.length);

  const [answerInput, setAnswerInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Effective active challenge: first unsolved node in order
  const effectiveActiveChallenge: CrackChallenge | null = React.useMemo(() => {
    return challenges.find((c) => !completedIds.includes(c.id) && !c.isManuallyUnlockedForEveryone) || null;
  }, [challenges, completedIds]);
  const activeChallenge = effectiveActiveChallenge;

  // Selected inspected node (default to effective active challenge or node 1)
  const [inspectedChallengeId, setInspectedChallengeId] = useState<string | null>(null);

  // Sync inspected challenge when effectiveActiveChallenge or list updates
  useEffect(() => {
    if (!inspectedChallengeId) {
      if (effectiveActiveChallenge) {
        setInspectedChallengeId(effectiveActiveChallenge.id);
      } else if (challenges.length > 0) {
        setInspectedChallengeId(challenges[0].id);
      }
    } else {
      const candidate = challenges.find((c) => c.id === inspectedChallengeId);
      if (candidate) {
        const isSolved = completedIds.includes(candidate.id);
        const isActive = effectiveActiveChallenge ? candidate.id === effectiveActiveChallenge.id : false;
        const isManuallyUnlocked = Boolean(candidate.isManuallyUnlockedForEveryone);
        if (!isSolved && !isActive && !isManuallyUnlocked) {
          if (effectiveActiveChallenge) {
            setInspectedChallengeId(effectiveActiveChallenge.id);
          }
        }
      }
    }
  }, [effectiveActiveChallenge?.id, completedIds.length, inspectedChallengeId, challenges]);

  // Find candidate inspected challenge
  const candidateInspected = challenges.find((c) => c.id === inspectedChallengeId);
  
  // Guard: Participants can ONLY access previously solved questions and the current active question.
  // Locked questions are strictly prohibited!
  const isCandidateLocked = candidateInspected
    ? (!completedIds.includes(candidateInspected.id) &&
       candidateInspected.id !== effectiveActiveChallenge?.id &&
       !candidateInspected.isManuallyUnlockedForEveryone)
    : false;

  // Fallback to effectiveActiveChallenge or first solved challenge if locked or invalid
  const currentInspected: CrackChallenge | null = (candidateInspected && !isCandidateLocked)
    ? candidateInspected
    : (effectiveActiveChallenge || challenges.find(c => completedIds.includes(c.id)) || challenges[0] || null);

  const isCurrentSolved = currentInspected ? completedIds.includes(currentInspected.id) : false;
  const isViewingActive = currentInspected ? currentInspected.id === effectiveActiveChallenge?.id : false;

  // Previous challenge for hint tracking
  const currentIdx = challenges.findIndex(c => c.id === currentInspected?.id);
  const prevChallenge = currentIdx > 0 ? challenges[currentIdx - 1] : null;
  const nextChallenge = currentIdx >= 0 && currentIdx < challenges.length - 1 ? challenges[currentIdx + 1] : null;

  // Previously solved challenges for dedicated navigation options
  const solvedChallenges = challenges.filter(c => completedIds.includes(c.id));

  const handleSolveChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentInspected || isSubmitting || isCurrentSolved) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.solveCrackChallenge(token, {
        challengeId: currentInspected.id,
        answer: answerInput.trim(),
        timeTakenSeconds: 30
      }, previewTeamId);

      if (res.success && res.isCorrect) {
        setSuccessMsg(res.message || `Correct! Node ${currentInspected.order} cracked! +${currentInspected.points} pts awarded.`);
        setAnswerInput('');
        
        // Optimistically record solved node immediately
        const newCompleted = Array.from(new Set([...completedIds, currentInspected.id]));
        setLocalCompletedIds(newCompleted);

        // Automatically unlock and advance to the next challenge
        const nextId = res.nextChallengeId || challenges.find(c => !newCompleted.includes(c.id))?.id;
        if (nextId) {
          setInspectedChallengeId(nextId);
        }
        onRefresh();
      } else {
        setErrorMsg(res.message || 'Incorrect passphrase or decryption key. Try again!');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPointsEarned = challenges.reduce(
    (sum, c) => (completedIds.includes(c.id) ? sum + c.points : sum),
    0
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Top Banner & Progression Path */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[11px] font-bold uppercase tracking-wider">
                Round 4 • Linear Security Chain
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">
                {completedIds.length} / {challenges.length} Nodes Cracked
              </span>
              {allSolved && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-bold flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-emerald-400" /> ALL SOLVED
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <KeyRound className="w-6 h-6 text-rose-400" />
              Crack & Compete Arena
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Solve challenges in strict sequence. Each solved problem unlocks the next challenge and reveals crucial decryption intel.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Round 4 Arena Interactive Countdown Timer */}
            <div className="bg-[#040605] px-4 py-2.5 rounded-2xl border border-[#606161]/60 text-center">
              <span className="text-[10px] uppercase font-bold text-[#9F9694] block tracking-wider flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-[#04D87D]" /> Time Left
              </span>
              <span className={`font-mono text-xl font-black ${
                (contestState.timer?.remainingSeconds || 0) <= 60 && (contestState.timer?.remainingSeconds || 0) > 0
                  ? 'text-rose-400 animate-pulse'
                  : 'text-[#04D87D]'
              }`}>
                {Math.floor((contestState.timer?.remainingSeconds || 0) / 60)}:
                {String((contestState.timer?.remainingSeconds || 0) % 60).padStart(2, '0')}
              </span>
            </div>

            <div className="bg-[#040605] px-5 py-2.5 rounded-2xl border border-[#606161]/60 text-center">
              <span className="text-[10px] uppercase font-bold text-[#9F9694] block tracking-wider">Round 4 Points</span>
              <span className="font-mono text-xl font-black text-[#04D87D]">
                {totalPointsEarned} pts
              </span>
            </div>
          </div>
        </div>

        {/* Visual Progression Path */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold text-slate-300">Sequential Chain Progression</span>
            <span className="text-[11px] font-mono text-slate-400">
              Only solved nodes & current active node are accessible
            </span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
            {challenges.map((ch, idx) => {
              const isSolved = completedIds.includes(ch.id);
              const isActive = ch.id === effectiveActiveChallenge?.id;
              const isSelected = ch.id === currentInspected?.id;
              const isLocked = !isSolved && !isActive && !ch.isManuallyUnlockedForEveryone;

              return (
                <React.Fragment key={ch.id}>
                  <button
                    onClick={() => {
                      if (!isLocked) {
                        setInspectedChallengeId(ch.id);
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }
                    }}
                    disabled={isLocked}
                    title={
                      isLocked
                        ? `Node ${ch.order} is locked. Crack Node ${idx > 0 ? challenges[idx - 1].order : 1} first.`
                        : isSolved
                        ? `Node ${ch.order} is solved. Click to review.`
                        : `Node ${ch.order} is currently active.`
                    }
                    className={`flex-1 min-w-[155px] p-3.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 bg-slate-900 border-indigo-500 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                        : isSolved
                        ? 'bg-emerald-950/30 border-emerald-800/70 hover:bg-emerald-900/40 hover:border-emerald-700 cursor-pointer'
                        : isActive
                        ? 'bg-indigo-950/40 border-indigo-800 hover:bg-indigo-900/40 cursor-pointer'
                        : 'bg-slate-950/80 border-slate-800/60 opacity-40 cursor-not-allowed select-none'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        Node {ch.order}
                      </span>
                      {isSolved ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/80">
                          <CheckCircle2 className="w-3 h-3" /> Solved
                        </span>
                      ) : isActive ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-white truncate">{ch.title}</h4>
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="text-slate-400 capitalize">{ch.puzzleType.replace('_', ' ')}</span>
                      <span className="text-amber-400 font-mono font-bold">{ch.points} pts</span>
                    </div>
                  </button>

                  {idx < challenges.length - 1 && (
                    <div className={`shrink-0 ${challenges[idx + 1].id === effectiveActiveChallenge?.id ? 'text-indigo-400' : isSolved ? 'text-emerald-500/60' : 'text-slate-700'}`}>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Dedicated Navigation Options: Only Solved Questions + Current Active Question */}
        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <History className="w-3.5 h-3.5 text-indigo-400" />
              Navigate:
            </span>

            {/* Current Active Question button */}
            {effectiveActiveChallenge && (
              <button
                type="button"
                onClick={() => {
                  setInspectedChallengeId(effectiveActiveChallenge.id);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentInspected?.id === effectiveActiveChallenge.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-300 animate-pulse" />
                Current Active: Node #{effectiveActiveChallenge.order}
              </button>
            )}

            {/* Previously Solved Questions buttons */}
            {solvedChallenges.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 text-[11px]">Solved:</span>
                {solvedChallenges.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => {
                      setInspectedChallengeId(sc.id);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      currentInspected?.id === sc.id
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : 'bg-slate-950 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-950/60'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Node #{sc.order}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            {isViewingActive ? (
              <span className="text-indigo-300">● Currently working on active problem</span>
            ) : isCurrentSolved ? (
              <span className="text-emerald-300">✓ Reviewing solved problem</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* All Solved Celebration Banner */}
      {allSolved && (
        <div className="bg-gradient-to-r from-emerald-950/80 via-indigo-950/70 to-emerald-950/80 border border-emerald-500/40 rounded-3xl p-6 text-center space-y-3 shadow-2xl animate-in zoom-in-95">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
            <Trophy className="w-6 h-6" />
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">
            Grand Breached! All {challenges.length} Security Chain Nodes Cracked!
          </h3>
          <p className="text-xs sm:text-sm text-emerald-200 max-w-xl mx-auto">
            Your team has successfully conquered the entire linear chain and unlocked all flags with a total of{' '}
            <span className="font-mono font-bold text-amber-300">{totalPointsEarned} points</span>.
          </p>
        </div>
      )}

      {/* Active / Inspected Challenge Workspace */}
      {currentInspected ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Review Mode Notice when viewing a solved problem */}
          {isCurrentSolved && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">
                    Reviewing Previously Solved Node #{currentInspected.order}
                  </h4>
                  <p className="text-[11px] text-emerald-300">
                    You have already cracked this problem and claimed {currentInspected.points} pts.
                  </p>
                </div>
              </div>

              {activeChallenge && activeChallenge.id !== currentInspected.id && (
                <button
                  type="button"
                  onClick={() => {
                    setInspectedChallengeId(activeChallenge.id);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer shrink-0"
                >
                  Return to Active Node #{activeChallenge.order}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Node Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-indigo-400 uppercase">
                  Challenge Node #{currentInspected.order}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800 text-[10px] font-mono uppercase">
                  {currentInspected.puzzleType.replace('_', ' ')}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1">{currentInspected.title}</h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-xs font-mono font-bold">
                {currentInspected.points} Points
              </span>
              {isCurrentSolved ? (
                <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> SOLVED
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" /> ACTIVE NOW
                </span>
              )}
            </div>
          </div>

          <div className="space-y-5">
            {/* HINT SYSTEM REQUIREMENT:
                "give the user the hint to next question only after solving the current question"
                - If this is current active node and the PREVIOUS node was solved, show the hint that was earned!
            */}
            {currentInspected.hintFromPrevious && (
              <div className="p-4 bg-indigo-950/40 border border-indigo-700/60 rounded-2xl space-y-1.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Decryption Intel / Hint (Unlocked from Node #{prevChallenge?.order || currentInspected.order - 1})
                  </span>
                  <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-700/50">
                    Earned Clue
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-indigo-100 font-mono leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-indigo-900/80">
                  {currentInspected.hintFromPrevious}
                </p>
              </div>
            )}

            {/* Prompt & Instructions */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Challenge Prompt & Objective
              </span>
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-sm text-slate-200 leading-relaxed font-medium">
                {currentInspected.prompt}
              </div>
            </div>

            {/* Cipher / Data payload */}
            {(currentInspected.cipherText || currentInspected.codeOrData) && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Encrypted Payload / Cipher Data
                </span>
                <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-xs sm:text-sm text-indigo-300 whitespace-pre-wrap overflow-x-auto leading-relaxed shadow-inner">
                  {currentInspected.cipherText || currentInspected.codeOrData}
                </pre>
              </div>
            )}

            {/* HINT AFTER SOLVE:
                When this challenge has been solved, reveal the hint it yielded for the next question!
            */}
            {isCurrentSolved && currentInspected.hintAfterSolve && (
              <div className="p-4 bg-emerald-950/30 border border-emerald-800/80 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Decryption Intel Unlocked for {nextChallenge ? `Node #${nextChallenge.order}` : 'Final Victory'}
                </span>
                <p className="text-xs sm:text-sm text-emerald-200 font-mono bg-slate-950/60 p-3 rounded-xl border border-emerald-900/60">
                  {currentInspected.hintAfterSolve}
                </p>
              </div>
            )}

            {/* Hint Status when NOT yet solved:
                Explains that solving THIS question unlocks the hint for the NEXT question
            */}
            {!isCurrentSolved && nextChallenge && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>
                  Solving this node will unlock <span className="text-slate-300 font-bold">Node #{nextChallenge.order}</span> and reveal its decryption intel hint.
                </span>
              </div>
            )}

            {/* Answer Input Form or Solved Confirmation */}
            {!isCurrentSolved ? (
              <form onSubmit={handleSolveChallenge} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    Enter Decrypted Key or Solution Passphrase
                  </label>
                  <input
                    type="text"
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    disabled={contestState.isEmergencyLocked || isSubmitting}
                    placeholder="Enter solution key or decrypted passphrase..."
                    className="w-full px-4 py-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-white font-mono text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all tracking-wide"
                    required
                  />
                </div>

                {errorMsg && (
                  <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {successMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !answerInput.trim() || contestState.isEmergencyLocked}
                  className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Verifying Key...' : 'SUBMIT KEY & UNLOCK NEXT NODE'}
                </button>
              </form>
            ) : (
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Node #{currentInspected.order} Solved & Verified (+{currentInspected.points} pts awarded).</span>
                </div>

                {activeChallenge && activeChallenge.id !== currentInspected.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setInspectedChallengeId(activeChallenge.id);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
                  >
                    Proceed to Current Node #{activeChallenge.order}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-900 rounded-3xl border border-slate-800 text-slate-400 space-y-2">
          <KeyRound className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-bold text-white">No challenges currently active.</p>
          <p className="text-xs">Waiting for competition administrator to activate Round 4.</p>
        </div>
      )}
    </div>
  );
};
