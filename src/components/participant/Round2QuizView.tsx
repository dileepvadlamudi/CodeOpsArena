import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ContestState } from '../../types/contest';
import {
  BrainCircuit,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Send,
  ChevronRight,
  ChevronLeft,
  Check,
  Flag,
  ListChecks,
  RotateCcw,
  Trophy,
  ArrowRight,
  Eye,
  AlertTriangle,
  HelpCircle,
  Layers,
  X
} from 'lucide-react';

interface Round2QuizViewProps {
  stageData: any;
  contestState: ContestState;
  onRefresh: () => void;
}

export const Round2QuizView: React.FC<Round2QuizViewProps> = ({
  stageData,
  contestState,
  onRefresh
}) => {
  const { token, previewTeamId, user } = useAuth();
  const [directQuestions, setDirectQuestions] = useState<any[]>([]);

  const isPaused = Boolean(
    stageData?.isPaused || contestState.timer.isPaused || contestState.eventStatus === 'PAUSED'
  );

  // Fallback direct questions fetch if stageData questions aren't provided yet
  useEffect(() => {
    const hasStageDataQuestions =
      (Array.isArray(stageData?.allQuestions) && stageData.allQuestions.length > 0) ||
      (Array.isArray(stageData?.questions) && stageData.questions.length > 0);

    if (!hasStageDataQuestions && token) {
      api.getParticipantQuizQuestions(token, previewTeamId)
        .then((res) => {
          if (res && res.success && Array.isArray(res.questions) && res.questions.length > 0) {
            setDirectQuestions(res.questions);
          }
        })
        .catch((err) => {
          console.error('Error fetching fallback quiz questions:', err);
        });
    }
  }, [token, previewTeamId, stageData?.allQuestions, stageData?.questions]);

  // Collect all questions sorted stage-wise (Stage 1 -> Stage 2 -> Stage 3)
  const allQuestions: any[] = useMemo(() => {
    let rawQuestions: any[] = [];
    if (Array.isArray(stageData?.allQuestions) && stageData.allQuestions.length > 0) {
      rawQuestions = stageData.allQuestions;
    } else if (Array.isArray(stageData?.questions) && stageData.questions.length > 0) {
      rawQuestions = stageData.questions;
    } else if (Array.isArray(stageData?.stages) && stageData.stages.length > 0) {
      rawQuestions = stageData.stages.flatMap((stg: any) => stg.questions || []);
    } else if (Array.isArray(directQuestions) && directQuestions.length > 0) {
      rawQuestions = directQuestions;
    }

    return [...rawQuestions].sort((a, b) => {
      const stageA = Number(a.stageNumber || 1);
      const stageB = Number(b.stageNumber || 1);
      if (stageA !== stageB) return stageA - stageB;
      const orderA = Number(a.order ?? a.index ?? 0);
      const orderB = Number(b.order ?? b.index ?? 0);
      return orderA - orderB;
    });
  }, [stageData?.allQuestions, stageData?.questions, stageData?.stages, directQuestions]);

  // Storage key for caching answers and flags per session/team
  const storagePrefix = `codex_quiz_${previewTeamId || 'me'}`;

  // Local answers cache: questionId -> answer
  const [answersMap, setAnswersMap] = useState<Record<string, any>>(() => {
    try {
      const cached = localStorage.getItem(`${storagePrefix}_answers`);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Seen questions tracker: Set of questionIds that participant has viewed
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      const cached = localStorage.getItem(`${storagePrefix}_seen`);
      return cached ? new Set(JSON.parse(cached)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Flagged questions tracker: questionId -> boolean
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>(() => {
    try {
      const cached = localStorage.getItem(`${storagePrefix}_flagged`);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Current question pointer index (0-indexed)
  const [currentIdx, setCurrentIdx] = useState<number>(0);

  // Review & Submit modal state
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [isFinalSubmitting, setIsFinalSubmitting] = useState<boolean>(false);
  const [showConfirmSubmitDialog, setShowConfirmSubmitDialog] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(Boolean(stageData?.isCompleted));
  const [completionResult, setCompletionResult] = useState<any>(null);

  // Active inputs for current question
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const [fillBlankInput, setFillBlankInput] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Per-question countdown timer state (20 seconds per question)
  const QUESTION_TIME_LIMIT = 20;
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState<number>(QUESTION_TIME_LIMIT);
  const [timeUpBanner, setTimeUpBanner] = useState<string | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());
  const questionEndTimeRef = useRef<number>(Date.now() + QUESTION_TIME_LIMIT * 1000);
  const timerIntervalRef = useRef<any>(null);

  // References to keep timeout handler fresh without resetting timers
  const fillBlankInputRef = useRef(fillBlankInput);
  fillBlankInputRef.current = fillBlankInput;
  const selectedOptionRef = useRef(selectedOption);
  selectedOptionRef.current = selectedOption;
  const selectedMultiOptionsRef = useRef(selectedMultiOptions);
  selectedMultiOptionsRef.current = selectedMultiOptions;
  const activeIdxRef = useRef(currentIdx);
  activeIdxRef.current = currentIdx;
  const allQuestionsRef = useRef<any[]>(allQuestions);
  allQuestionsRef.current = allQuestions;
  const isTransitioningRef = useRef<boolean>(false);

  // Live leaderboard for R2 completion screen
  const [r2Leaderboard, setR2Leaderboard] = useState<any[]>([]);
  const [isR2LeaderboardLoading, setIsR2LeaderboardLoading] = useState(false);

  const fetchR2Leaderboard = async () => {
    if (!token) return;
    setIsR2LeaderboardLoading(true);
    try {
      const res = await api.getParticipantLeaderboard(token);
      if (res && res.success && Array.isArray(res.leaderboard)) {
        setR2Leaderboard(res.leaderboard);
      }
    } catch (err) {
      console.error('Error fetching leaderboard for R2 results:', err);
    } finally {
      setIsR2LeaderboardLoading(false);
    }
  };

  useEffect(() => {
    if (isCompleted) {
      fetchR2Leaderboard();
      const interval = setInterval(fetchR2Leaderboard, 4000);
      return () => clearInterval(interval);
    }
  }, [isCompleted, token, previewTeamId]);

  const currentQ = allQuestions[currentIdx] || allQuestions[0];

  // Sync server submissions into answersMap and seenIds on first load
  useEffect(() => {
    if (allQuestions.length > 0) {
      const serverSubmissionsCount = allQuestions.filter((q: any) => q.mySubmission && q.mySubmission.answer !== undefined).length;
      if (serverSubmissionsCount === 0 && Object.keys(answersMap).length > 0) {
        try {
          localStorage.removeItem(`${storagePrefix}_answers`);
          localStorage.removeItem(`${storagePrefix}_seen`);
          localStorage.removeItem(`${storagePrefix}_flagged`);
        } catch {}
        setAnswersMap({});
        setSeenIds(new Set(allQuestions[0] ? [allQuestions[0].id] : []));
        setFlaggedIds({});
        return;
      }

      setAnswersMap((prev) => {
        const next = { ...prev };
        let hasChanges = false;
        allQuestions.forEach((q: any) => {
          const sAns = q.mySubmission?.answer;
          if (sAns !== undefined && sAns !== null && sAns !== '__TIMEOUT__' && next[q.id] === undefined) {
            next[q.id] = sAns;
            hasChanges = true;
          }
        });
        if (hasChanges) {
          try {
            localStorage.setItem(`${storagePrefix}_answers`, JSON.stringify(next));
          } catch {}
          return next;
        }
        return prev;
      });

      setSeenIds((prev) => {
        const next = new Set(prev);
        allQuestions.forEach((q: any) => {
          if (q.hasSubmitted || q.status === 'answered' || q.mySubmission) {
            next.add(q.id);
          }
        });
        if (currentQ) next.add(currentQ.id);
        try {
          localStorage.setItem(`${storagePrefix}_seen`, JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
    }
  }, [allQuestions]);

  // Mark current question as seen whenever currentIdx changes
  useEffect(() => {
    if (currentQ?.id) {
      setSeenIds((prev) => {
        if (prev.has(currentQ.id)) return prev;
        const next = new Set(prev);
        next.add(currentQ.id);
        try {
          localStorage.setItem(`${storagePrefix}_seen`, JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
    }
  }, [currentQ?.id]);

  // Populate inputs and reset 20-second countdown when active question index changes
  useEffect(() => {
    if (!currentQ) return;
    questionStartTimeRef.current = Date.now();
    questionEndTimeRef.current = Date.now() + QUESTION_TIME_LIMIT * 1000;
    setQuestionSecondsLeft(QUESTION_TIME_LIMIT);
    setSaveStatus('idle');
    isTransitioningRef.current = false;

    const recordedAns = answersMap[currentQ.id] ?? currentQ.mySubmission?.answer;
    if (recordedAns !== undefined && recordedAns !== null && recordedAns !== '__TIMEOUT__') {
      if (currentQ.type === 'multi_select') {
        setSelectedMultiOptions(Array.isArray(recordedAns) ? recordedAns : [String(recordedAns)]);
      } else if (
        currentQ.type === 'fill_blank' ||
        (currentQ.type === 'code_output' && (!currentQ.options || currentQ.options.length === 0))
      ) {
        setFillBlankInput(String(recordedAns));
      } else {
        setSelectedOption(String(recordedAns));
      }
    } else {
      setSelectedOption('');
      setSelectedMultiOptions([]);
      setFillBlankInput('');
    }
  }, [currentIdx, currentQ?.id]);

  // Advance strictly to the immediate next question in designated order
  const advanceToImmediateNextQuestion = (isTimeout = false) => {
    if (isTransitioningRef.current || isCompleted || isFinalSubmitting) return;
    isTransitioningRef.current = true;

    const currIdx = activeIdxRef.current;
    const questionsList = allQuestionsRef.current;
    const q = questionsList[currIdx];

    // Auto-save current answer if any
    if (q) {
      if (
        (q.type === 'fill_blank' ||
          (q.type === 'code_output' && (!q.options || q.options.length === 0))) &&
        fillBlankInputRef.current.trim()
      ) {
        saveAnswerToServer(q.id, fillBlankInputRef.current.trim());
      } else if (q.type === 'multi_select' && selectedMultiOptionsRef.current.length > 0) {
        saveAnswerToServer(q.id, selectedMultiOptionsRef.current);
      } else if (selectedOptionRef.current) {
        saveAnswerToServer(q.id, selectedOptionRef.current);
      }
    }

    const currentNumber = currIdx + 1;
    if (isTimeout) {
      setTimeUpBanner(`Time's up (20s) for Question ${currentNumber}! Moving to Question ${currentNumber + 1}...`);
      setTimeout(() => {
        setTimeUpBanner(null);
      }, 2500);
    }

    // Auto-advance strictly to immediate next index (currIdx + 1)
    if (currIdx < questionsList.length - 1) {
      setCurrentIdx(currIdx + 1);
    } else {
      // Reached the final question
      setShowConfirmSubmitDialog(true);
    }
  };

  // Tick 20-second countdown for the current question using real wall-clock time
  useEffect(() => {
    if (isPaused || contestState.isEmergencyLocked || isCompleted || isFinalSubmitting || !currentQ) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const remainingMs = questionEndTimeRef.current - now;
      const secs = Math.max(0, Math.ceil(remainingMs / 1000));
      setQuestionSecondsLeft(secs);

      if (remainingMs <= 0) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        advanceToImmediateNextQuestion(true);
      }
    }, 250);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [currentIdx, currentQ?.id, isPaused, contestState.isEmergencyLocked, isCompleted, isFinalSubmitting]);

  // Helper to persist answer to server and local cache
  const saveAnswerToServer = async (qId: string, answerPayload: any) => {
    if (!token || !qId) return;
    setSaveStatus('saving');

    // Update local answers map immediately
    setAnswersMap((prev) => {
      const updated = { ...prev, [qId]: answerPayload };
      try {
        localStorage.setItem(`${storagePrefix}_answers`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    const elapsedSeconds = Math.max(1, Math.round((Date.now() - questionStartTimeRef.current) / 1000));

    try {
      const res = await api.submitQuiz(
        token,
        {
          questionId: qId,
          answer: answerPayload,
          timeTakenSeconds: elapsedSeconds
        },
        previewTeamId
      );

      if (res && res.success) {
        setSaveStatus('saved');
        onRefresh();
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Failed to save quiz answer to server:', err);
      setSaveStatus('saved'); // Still saved locally
    }
  };

  // Toggle flag for a question
  const toggleFlag = (qId: string) => {
    setFlaggedIds((prev) => {
      const updated = { ...prev, [qId]: !prev[qId] };
      try {
        localStorage.setItem(`${storagePrefix}_flagged`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Handle single option selection (MCQ, true_false, code_output with options)
  const handleSelectOption = (option: string) => {
    if (isPaused || contestState.isEmergencyLocked || isFinalSubmitting) return;
    setSelectedOption(option);
    saveAnswerToServer(currentQ.id, option);
  };

  // Handle multi-select toggle
  const handleToggleMulti = (option: string) => {
    if (isPaused || contestState.isEmergencyLocked || isFinalSubmitting) return;
    const nextArr = selectedMultiOptions.includes(option)
      ? selectedMultiOptions.filter((o) => o !== option)
      : [...selectedMultiOptions, option];
    setSelectedMultiOptions(nextArr);
    if (nextArr.length > 0) {
      saveAnswerToServer(currentQ.id, nextArr);
    }
  };

  // Handle fill in the blank submit or blur
  const handleSaveFillBlank = () => {
    if (isPaused || contestState.isEmergencyLocked || isFinalSubmitting) return;
    if (fillBlankInput.trim()) {
      saveAnswerToServer(currentQ.id, fillBlankInput.trim());
    }
  };

  // Navigation handlers: Strictly sequential designated order only
  const handleNextClick = () => {
    if (isPaused || contestState.isEmergencyLocked || isTransitioningRef.current) return;
    advanceToImmediateNextQuestion(false);
  };

  // Final Submit handler
  const handleFinalSubmit = async () => {
    if (!token || isFinalSubmitting) return;
    setIsFinalSubmitting(true);
    setShowConfirmSubmitDialog(false);

    try {
      const res = await api.completeQuiz(token, previewTeamId);
      if (res && res.success) {
        setIsCompleted(true);
        setCompletionResult(res);
        onRefresh();
      } else {
        alert(res?.message || 'Error submitting quiz.');
      }
    } catch (err: any) {
      console.error('Final submit error:', err);
      alert(err.message || 'Failed to complete quiz submission.');
    } finally {
      setIsFinalSubmitting(false);
    }
  };

  // Compute status for any question:
  // - 'attempted' (Green): Answer has been entered/saved
  // - 'seen_unattempted' (Red): Question has been seen, but no answer entered
  // - 'unseen' (Colorless): Question has not been viewed yet
  const getQuestionStatus = (q: any): 'attempted' | 'seen_unattempted' | 'unseen' => {
    const ans = answersMap[q.id] ?? q.mySubmission?.answer;
    const hasAnswer =
      ans !== undefined &&
      ans !== null &&
      ans !== '__TIMEOUT__' &&
      (Array.isArray(ans) ? ans.length > 0 : String(ans).trim() !== '');

    if (hasAnswer) return 'attempted';
    if (seenIds.has(q.id)) return 'seen_unattempted';
    return 'unseen';
  };

  // Summary counts
  const attemptedCount = allQuestions.filter((q) => getQuestionStatus(q) === 'attempted').length;
  const seenUnattemptedCount = allQuestions.filter((q) => getQuestionStatus(q) === 'seen_unattempted').length;
  const unseenCount = allQuestions.filter((q) => getQuestionStatus(q) === 'unseen').length;
  const flaggedCount = allQuestions.filter((q) => flaggedIds[q.id]).length;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Group questions by stages: Stage 1, Stage 2, Stage 3
  const stagesGrouped = useMemo(() => {
    const map: Record<number, { title: string; desc: string; questions: any[] }> = {
      1: { title: 'Stage 1: Syntax Sprint', desc: 'Rapid syntax & language puzzles', questions: [] },
      2: { title: 'Stage 2: Core Architecture', desc: 'System design, concurrency, REST', questions: [] },
      3: { title: 'Stage 3: Deep Systems', desc: 'OS internals, consensus, kernel ops', questions: [] }
    };

    allQuestions.forEach((q, idx) => {
      const stgNum = Number(q.stageNumber || 1);
      if (!map[stgNum]) {
        map[stgNum] = { title: `Stage ${stgNum}`, desc: 'Stage Questions', questions: [] };
      }
      map[stgNum].questions.push({ ...q, globalIdx: idx });
    });

    return map;
  }, [allQuestions]);

  if (allQuestions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-12 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
          <BrainCircuit className="w-8 h-8 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-white">Loading Question Bank...</h2>
        <p className="text-sm text-slate-400">
          Syncing stage-wise questions from the contest server.
        </p>
      </div>
    );
  }

  // Completion celebratory view
  if (isCompleted) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in zoom-in-95 duration-300">
        <div className="p-8 sm:p-10 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/10">
            <Trophy className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-bold uppercase tracking-wider">
              Submission Confirmed
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Round 2 Quiz Arena Completed!
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto">
              Your team's answers have been submitted, verified, and weighted. The live leaderboard standings are displayed below.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto pt-2">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-center">
              <span className="text-[11px] text-slate-400 block font-medium">Round 2 Score</span>
              <span className="text-2xl font-black text-amber-400 font-mono">
                {completionResult?.teamScore ?? stageData?.totalScore ?? 0} pts
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-center">
              <span className="text-[11px] text-slate-400 block font-medium">Attempted</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {attemptedCount} / {allQuestions.length}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-center">
              <span className="text-[11px] text-slate-400 block font-medium">Correct</span>
              <span className="text-2xl font-black text-indigo-400 font-mono">
                {completionResult?.correctCount ?? '-'}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-center">
              <span className="text-[11px] text-slate-400 block font-medium">Total Contest Pts</span>
              <span className="text-2xl font-black text-white font-mono">
                {completionResult?.totalScore ?? '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Standings / Leaderboard */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Live Contest Leaderboard
                </h3>
                <p className="text-xs text-slate-400">Real-time standings updated across all workstations</p>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchR2Leaderboard}
              disabled={isR2LeaderboardLoading}
              className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isR2LeaderboardLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4 text-center">R1</th>
                  <th className="py-3 px-4 text-center text-indigo-400 font-bold">R2</th>
                  <th className="py-3 px-4 text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {r2Leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Loading official leaderboard standings...
                    </td>
                  </tr>
                ) : (
                  r2Leaderboard.map((entry: any, idx: number) => {
                    const isMyTeam = entry.teamName === user?.teamName || entry.teamId === (user as any)?.teamId;
                    return (
                      <tr
                        key={entry.teamId || idx}
                        className={`transition-colors ${
                          isMyTeam
                            ? 'bg-indigo-950/50 font-bold text-white border-l-2 border-indigo-400'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <span className="text-white">{entry.teamName}</span>
                            {entry.teamCode && (
                              <span className="text-[10px] text-slate-500 font-mono block">{entry.teamCode}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-400">
                          {entry.roundScores?.r1 ?? entry.scores?.r1 ?? 0}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-indigo-300">
                          {entry.roundScores?.r2 ?? entry.scores?.r2 ?? 0}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                          {entry.totalScore ?? entry.scores?.total ?? 0} pts
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const currentQStatus = getQuestionStatus(currentQ);
  const isCurrentFlagged = Boolean(flaggedIds[currentQ?.id]);
  const hasOptions = Array.isArray(currentQ?.options) && currentQ.options.length > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Banner: Arena Header & Real-Time Sync */}
      <div className="bg-[#040605] border border-[#606161]/60 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#04D87D]/10 border border-[#04D87D]/30 flex items-center justify-center text-[#04D87D] shrink-0">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-white">
                Round 2: Quiz Arena
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#045D33]/40 text-[#04D87D] border border-[#045D33] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#04D87D] animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="text-xs text-[#9F9694]">
              Designated Order Only • 20s Per Question • Auto-Advances to Immediate Next
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Question Sequence Progress */}
          <div className="px-3.5 py-2 rounded-2xl bg-[#040605] border border-[#606161]/60 text-xs font-mono text-[#9F9694] flex items-center gap-2">
            <span className="text-[#04D87D] font-bold">Question {currentIdx + 1}</span>
            <span>of</span>
            <span className="text-white font-bold">{allQuestions.length}</span>
          </div>

          {/* Points indicator */}
          <div className="px-4 py-2 rounded-2xl bg-[#040605] border border-[#606161]/60 text-xs font-mono text-[#9F9694] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Score: <strong className="text-amber-400 font-bold">{stageData?.totalScore || 0} pts</strong></span>
          </div>

          {/* Active Question Countdown Timer (20s per question) */}
          <div
            className={`px-4 py-2 rounded-2xl border text-xs font-mono font-bold flex items-center gap-2 shadow-inner ${
              isPaused
                ? 'bg-[#045D33]/40 border-[#045D33] text-amber-300'
                : questionSecondsLeft <= 5
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
                : questionSecondsLeft <= 10
                ? 'bg-[#04768D]/20 border-[#04768D]/70 text-[#04D87D]'
                : 'bg-[#040605] border-[#04D87D]/50 text-[#04D87D]'
            }`}
          >
            <Clock className={`w-4 h-4 ${questionSecondsLeft <= 5 ? 'text-rose-400 animate-spin' : 'text-[#04D87D]'}`} />
            <span>{isPaused ? 'PAUSED' : `Q${currentIdx + 1} Timer: ${questionSecondsLeft}s / 20s`}</span>
          </div>
        </div>
      </div>

      {/* Main Single-Column Focused Question Workspace (Designated Order - No Arbitrary Palette) */}
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-[#040605] border border-[#606161]/60 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header Metadata & Status Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#606161]/40 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs font-bold uppercase tracking-wider">
                  Stage {currentQ?.stageNumber || 1}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-950 text-slate-300 border border-slate-800 text-xs font-mono font-medium">
                  {currentQ?.category || 'General'}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-xs font-mono font-bold">
                  {currentQ?.points || 2} Points
                </span>

                {/* Status chip */}
                {currentQStatus === 'attempted' && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Attempted
                  </span>
                )}
                {currentQStatus === 'seen_unattempted' && (
                  <span className="px-2.5 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Unattempted
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Flag for Review Toggle Button */}
                <button
                  type="button"
                  onClick={() => toggleFlag(currentQ.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isCurrentFlagged
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-sm shadow-amber-500/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-amber-400 hover:border-slate-700'
                  }`}
                  title="Flag this question to review before final submission"
                >
                  <Flag className={`w-3.5 h-3.5 ${isCurrentFlagged ? 'fill-amber-400' : ''}`} />
                  <span>{isCurrentFlagged ? 'Flagged' : 'Flag for Review'}</span>
                </button>

                {/* Auto-save status feedback */}
                {saveStatus === 'saving' && (
                  <span className="text-[11px] text-indigo-400 font-mono animate-pulse flex items-center gap-1">
                    Saving...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
              </div>
            </div>

            {/* Void or Full Points Notice */}
            {currentQ?.isVoided && (
              <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>Notice: This question has been voided by contest officials.</span>
              </div>
            )}
            {currentQ?.isFullPointsAwarded && (
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800 text-indigo-300 text-xs flex items-center gap-2 font-bold">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Notice: Full points ({currentQ.points} pts) awarded to all teams!</span>
              </div>
            )}

            {/* Per-Question 20-Second Countdown HUD & Smooth Progress Bar */}
            <div className="bg-[#040605] border border-[#606161]/60 rounded-2xl p-4 space-y-2.5 shadow-inner">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${questionSecondsLeft <= 5 ? 'text-rose-400 animate-bounce' : 'text-[#04D87D]'}`} />
                  <span className="font-bold text-white uppercase tracking-wider font-mono text-[11px]">
                    Question Time Limit: 20 Seconds
                  </span>
                  {questionSecondsLeft <= 5 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/60 text-rose-300 text-[10px] font-bold animate-pulse">
                      HURRY! Auto-advancing soon
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#9F9694] font-mono">Time Left:</span>
                  <span className={`font-mono text-base font-black px-2.5 py-0.5 rounded-lg border ${
                    questionSecondsLeft <= 5
                      ? 'bg-rose-950/90 border-rose-500 text-rose-300 animate-pulse'
                      : questionSecondsLeft <= 10
                      ? 'bg-[#04768D]/20 border-[#04768D]/70 text-[#04D87D]'
                      : 'bg-[#045D33]/30 border-[#04D87D]/50 text-[#04D87D]'
                  }`}>
                    {questionSecondsLeft}s
                  </span>
                </div>
              </div>

              {/* Smooth 20s Progress Bar */}
              <div className="w-full bg-[#606161]/30 rounded-full h-2 overflow-hidden border border-[#606161]/40">
                <div
                  className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                    questionSecondsLeft <= 5
                      ? 'bg-rose-500'
                      : questionSecondsLeft <= 10
                      ? 'bg-[#04768D]'
                      : 'bg-[#04D87D]'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (questionSecondsLeft / 20) * 100))}%` }}
                />
              </div>
            </div>

            {/* Time Up Notification Banner */}
            {timeUpBanner && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500 text-rose-200 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{timeUpBanner}</span>
              </div>
            )}

            {/* Question Text */}
            <div className="space-y-2">
              <span className="text-xs font-mono text-[#04768D] font-bold">
                Question {currentIdx + 1} of {allQuestions.length} • Designated Order
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-white leading-relaxed">
                {currentQ?.questionText}
              </h2>
            </div>

            {/* Code Snippet */}
            {currentQ?.codeSnippet && (
              <div className="bg-[#040605] rounded-2xl border border-[#606161]/50 p-4 font-mono text-xs sm:text-sm text-[#04D87D] whitespace-pre-wrap overflow-x-auto leading-relaxed shadow-inner">
                {currentQ.codeSnippet}
              </div>
            )}

            {/* ============================================================ */}
            {/* Answer Input Workspace: Instantly marked on click            */}
            {/* ============================================================ */}
            <div className="space-y-3 pt-2">
              {/* Option 1: MCQ or Code Output WITH Options */}
              {hasOptions && currentQ?.type !== 'multi_select' && (
                <div className="space-y-2.5">
                  {currentQ.options.map((option: string, index: number) => {
                    const isSelected = selectedOption === option;
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={isPaused || contestState.isEmergencyLocked || isFinalSubmitting}
                        onClick={() => handleSelectOption(option)}
                        className={`w-full p-4 rounded-2xl border text-left font-medium text-sm transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#045D33]/60 border-[#04D87D] text-white shadow-lg shadow-[#04D87D]/20 ring-1 ring-[#04D87D]'
                            : 'bg-[#040605] border-[#606161]/60 text-slate-200 hover:border-[#04D87D]/60 hover:bg-[#045D33]/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-7 h-7 rounded-lg border text-xs font-bold flex items-center justify-center font-mono ${
                              isSelected
                                ? 'bg-[#04D87D] border-[#04D87D] text-[#040605]'
                                : 'bg-[#040605] border-[#606161]/60 text-[#9F9694]'
                            }`}
                          >
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="break-all">{option}</span>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-[#04D87D] bg-[#04D87D]' : 'border-[#606161]'
                          }`}
                        >
                          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#040605]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Option 2: Multi-Select */}
              {currentQ?.type === 'multi_select' && hasOptions && (
                <div className="space-y-2.5">
                  <span className="text-xs text-[#04768D] font-mono block">
                    (Select all that apply)
                  </span>
                  {currentQ.options.map((option: string, index: number) => {
                    const isSelected = selectedMultiOptions.includes(option);
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={isPaused || contestState.isEmergencyLocked || isFinalSubmitting}
                        onClick={() => handleToggleMulti(option)}
                        className={`w-full p-4 rounded-2xl border text-left font-medium text-sm transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#045D33]/60 border-[#04D87D] text-white shadow-lg shadow-[#04D87D]/20 ring-1 ring-[#04D87D]'
                            : 'bg-[#040605] border-[#606161]/60 text-slate-200 hover:border-[#04D87D]/60 hover:bg-[#045D33]/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-7 h-7 rounded-lg border text-xs font-bold flex items-center justify-center font-mono ${
                              isSelected
                                ? 'bg-[#04D87D] border-[#04D87D] text-[#040605]'
                                : 'bg-[#040605] border-[#606161]/60 text-[#9F9694]'
                            }`}
                          >
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="break-all">{option}</span>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs shrink-0 ${
                            isSelected
                              ? 'border-[#04D87D] bg-[#04D87D] text-[#040605] font-bold'
                              : 'border-[#606161]'
                          }`}
                        >
                          {isSelected && '✓'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Option 3: True / False */}
              {currentQ?.type === 'true_false' && (
                <div className="grid grid-cols-2 gap-3">
                  {['True', 'False'].map((tf) => {
                    const isSelected = selectedOption.toLowerCase() === tf.toLowerCase();
                    return (
                      <button
                        key={tf}
                        type="button"
                        disabled={isPaused || contestState.isEmergencyLocked || isFinalSubmitting}
                        onClick={() => handleSelectOption(tf)}
                        className={`py-4 rounded-2xl border text-center font-bold text-sm transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#045D33]/60 border-[#04D87D] text-white shadow-lg shadow-[#04D87D]/20 ring-1 ring-[#04D87D]'
                            : 'bg-[#040605] border-[#606161]/60 text-slate-200 hover:border-[#04D87D]/60 hover:bg-[#045D33]/20'
                        }`}
                      >
                        {tf}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Option 4: Fill In The Blank OR Code Output without options */}
              {(currentQ?.type === 'fill_blank' || (currentQ?.type === 'code_output' && !hasOptions)) && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled={isPaused || contestState.isEmergencyLocked || isFinalSubmitting}
                      value={fillBlankInput}
                      onChange={(e) => setFillBlankInput(e.target.value)}
                      onBlur={handleSaveFillBlank}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveFillBlank();
                          handleNextClick();
                        }
                      }}
                      placeholder={
                        currentQ.type === 'code_output'
                          ? 'Enter exact console output...'
                          : 'Type your answer here...'
                      }
                      className="flex-1 px-4 py-3.5 bg-[#040605] border border-[#606161]/60 rounded-2xl text-white font-mono text-sm placeholder:text-[#606161] focus:outline-none focus:border-[#04D87D] transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleSaveFillBlank}
                      className="px-5 py-3.5 rounded-2xl bg-[#04D87D] hover:bg-[#04D87D]/90 text-[#040605] font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Check className="w-4 h-4" /> Save
                    </button>
                  </div>
                  <span className="text-[11px] text-[#9F9694]">
                    Press Enter or click Save to record your answer.
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Action Controls: Designated Order Forward Navigation */}
            <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#606161]/40">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#9F9694] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#04D87D] animate-pulse" />
                  <span>Question {currentIdx + 1} of {allQuestions.length}</span>
                  <span className="text-[#606161]">•</span>
                  <span className="text-white font-bold">Designated Order</span>
                </span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {currentIdx < allQuestions.length - 1 ? (
                  <button
                    type="button"
                    disabled={isPaused || contestState.isEmergencyLocked || isFinalSubmitting}
                    onClick={handleNextClick}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#04D87D] hover:bg-[#04D87D]/90 active:scale-95 text-[#040605] font-extrabold text-xs shadow-lg shadow-[#04D87D]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Save &amp; Next Question</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isPaused || contestState.isEmergencyLocked || isFinalSubmitting}
                    onClick={() => setShowConfirmSubmitDialog(true)}
                    className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-[#04D87D] hover:bg-[#04D87D]/90 active:scale-95 text-[#040605] font-extrabold text-xs shadow-lg shadow-[#04D87D]/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Finish &amp; Final Submit Quiz</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* ============================================================ */}
      {/* REVIEW & FINAL SUBMIT MODAL                                 */}
      {/* ============================================================ */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <ListChecks className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Round 2 Quiz Review &amp; Submit
                  </h3>
                  <p className="text-xs text-slate-400">
                    Verify all answers before final submission. Click any question to edit.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Counters Bar */}
            <div className="px-6 py-4 bg-slate-950/70 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Attempted:
                </span>
                <span className="font-mono font-bold text-emerald-400 text-sm">{attemptedCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Unattempted:
                </span>
                <span className="font-mono font-bold text-rose-400 text-sm">{seenUnattemptedCount + unseenCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Flag className="w-3 h-3 text-amber-400" /> Flagged:
                </span>
                <span className="font-mono font-bold text-amber-400 text-sm">{flaggedCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-[#04D87D]" /> Time Limit:
                </span>
                <span className="font-mono font-bold text-[#04D87D] text-sm">20s / Question</span>
              </div>
            </div>

            {/* Questions Review Table Grouped by Stages */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {[1, 2, 3].map((stgNum) => {
                const stageInfo = stagesGrouped[stgNum];
                if (!stageInfo || stageInfo.questions.length === 0) return null;

                return (
                  <div key={stgNum} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center justify-center text-xs font-mono">
                          {stgNum}
                        </span>
                        {stageInfo.title}
                      </h4>
                      <span className="text-xs text-slate-400 font-mono">
                        {stageInfo.questions.filter((q) => getQuestionStatus(q) === 'attempted').length} / {stageInfo.questions.length} completed
                      </span>
                    </div>

                    <div className="space-y-2">
                      {stageInfo.questions.map((q: any) => {
                        const status = getQuestionStatus(q);
                        const isFlagged = Boolean(flaggedIds[q.id]);
                        const recordedAns = answersMap[q.id] ?? q.mySubmission?.answer;
                        const hasAns = status === 'attempted';

                        let ansDisplay = 'No answer chosen';
                        if (hasAns) {
                          if (Array.isArray(recordedAns)) {
                            ansDisplay = recordedAns.join(', ');
                          } else {
                            ansDisplay = String(recordedAns);
                          }
                        }

                        return (
                          <div
                            key={q.id}
                            className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-8 h-8 rounded-xl border text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                                  status === 'attempted'
                                    ? 'bg-emerald-600 border-emerald-400 text-white'
                                    : status === 'seen_unattempted'
                                    ? 'bg-rose-600 border-rose-400 text-white'
                                    : 'bg-slate-900 border-slate-800 text-slate-400'
                                }`}
                              >
                                {q.globalIdx + 1}
                              </span>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">
                                    Q{q.globalIdx + 1}: {q.category}
                                  </span>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-amber-300">
                                    {q.points} pts
                                  </span>
                                  {isFlagged && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                                      <Flag className="w-2.5 h-2.5 fill-amber-400" /> Flagged
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 line-clamp-1 pt-0.5">
                                  {q.questionText}
                                </p>
                                <p className="text-[11px] font-mono pt-1">
                                  {hasAns ? (
                                    <span className="text-emerald-400 font-medium">
                                      Your Answer: {ansDisplay}
                                    </span>
                                  ) : (
                                    <span className="text-rose-400 font-medium">
                                      Not answered
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>

                            <span className="px-3 py-1 rounded-xl bg-[#040605] border border-[#606161]/50 text-xs font-mono text-[#9F9694]">
                              {hasAns ? 'Recorded' : 'Unanswered'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-5 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-all cursor-pointer"
              >
                Back to Quiz
              </button>

              <button
                type="button"
                disabled={isFinalSubmitting}
                onClick={() => {
                  const unattempted = allQuestions.length - attemptedCount;
                  if (unattempted > 0) {
                    setShowConfirmSubmitDialog(true);
                  } else {
                    handleFinalSubmit();
                  }
                }}
                className="px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                {isFinalSubmitting ? (
                  'Finalizing...'
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Final Submit Round 2
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog if submitting with unattempted questions */}
      {showConfirmSubmitDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Unattempted Questions Remaining
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              You have <strong className="text-rose-400">{allQuestions.length - attemptedCount}</strong> unattempted questions and <strong className="text-amber-400">{flaggedCount}</strong> flagged questions. Are you sure you want to finalize your Round 2 submission?
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmSubmitDialog(false)}
                className="flex-1 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-all cursor-pointer"
              >
                Keep Answering
              </button>
              <button
                type="button"
                disabled={isFinalSubmitting}
                onClick={handleFinalSubmit}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                {isFinalSubmitting ? 'Submitting...' : 'Yes, Final Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
