import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ContestState } from '../../types/contest';
import {
  Keyboard,
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Award,
  Lock,
  PauseCircle,
  HelpCircle,
  Timer,
  ChevronRight,
  ArrowRight,
  Play
} from 'lucide-react';

interface Round1TypingViewProps {
  stageData: any;
  contestState: ContestState;
  onRefresh: () => void;
}

export const Round1TypingView: React.FC<Round1TypingViewProps> = ({
  stageData,
  contestState,
  onRefresh
}) => {
  const { token, previewTeamId } = useAuth();

  // All sets available in Round 1
  const allSets: any[] = stageData?.allSets || (stageData?.typingRound ? [stageData.typingRound] : []);
  
  // Track selected set ID (defaults to active set from server)
  const [selectedSetId, setSelectedSetId] = useState<string>(stageData?.typingRound?.id || (allSets[0]?.id || ''));

  // When stageData changes, sync selectedSetId if not set
  useEffect(() => {
    if (stageData?.typingRound?.id && !selectedSetId) {
      setSelectedSetId(stageData.typingRound.id);
    }
  }, [stageData?.typingRound?.id, selectedSetId]);

  // Current set object
  const currentSet = allSets.find(s => s.id === selectedSetId) || allSets[0] || stageData?.typingRound;
  const currentSetIndex = allSets.findIndex(s => s.id === currentSet?.id);

  // Practice vs Main Test toggle
  const [isPractice, setIsPractice] = useState<boolean>(false);

  // Derive passage and constraints for current set & mode
  const passage = (isPractice ? currentSet?.practicePassage : currentSet?.mainPassage) 
    || currentSet?.passage 
    || 'function solveOptimalPath(graph, start, end) { const visited = new Set(); return Dijkstra(graph, start, end); }';
  
  const minAccuracy = currentSet?.minAccuracyPercent || 80;
  const durationSeconds = isPractice ? 60 : (currentSet?.testDurationSeconds || 60);

  // Typing inputs and live stats
  const [userInput, setUserInput] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastRoundKey, setLastRoundKey] = useState<string>('');

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const hasAutoSubmittedRef = useRef(false);

  // When selected set or practice mode changes, synchronize or load existing submission
  useEffect(() => {
    const key = `${currentSet?.id || 'tr'}-${isPractice ? 'practice' : 'test'}`;
    if (lastRoundKey !== key) {
      setLastRoundKey(key);
      setUserInput('');
      setStartTime(null);
      setElapsedSeconds(0);
      setWpm(0);
      setAccuracy(100);
      hasAutoSubmittedRef.current = false;

      // Check if team already completed this set in this mode
      const prevResult = isPractice ? currentSet?.myPracticeResult : currentSet?.myTestResult;
      if (prevResult) {
        setHasSubmitted(true);
        setSubmissionResult(prevResult);
      } else {
        setHasSubmitted(false);
        setSubmissionResult(null);
      }
    }
  }, [currentSet, isPractice, lastRoundKey]);

  // Local timer loop once participant starts typing
  useEffect(() => {
    if (!startTime || hasSubmitted || contestState.isEmergencyLocked) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(elapsed);

      // Auto-submit if local set timer runs out
      if (elapsed >= durationSeconds && !hasAutoSubmittedRef.current) {
        hasAutoSubmittedRef.current = true;
        submitAttempt(userInput, wpm, accuracy);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [startTime, hasSubmitted, contestState.isEmergencyLocked, durationSeconds, userInput, wpm, accuracy]);

  // Focus input automatically when ready to type
  useEffect(() => {
    if (!hasSubmitted && !contestState.isEmergencyLocked && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedSetId, isPractice, hasSubmitted, contestState.isEmergencyLocked]);

  // Handle live keystrokes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (hasSubmitted || contestState.isEmergencyLocked) return;

    const val = e.target.value;
    if (startTime === null && val.length > 0) {
      setStartTime(Date.now());
    }

    setUserInput(val);

    // Calculate accuracy and WPM
    let correct = 0;
    for (let i = 0; i < val.length; i++) {
      if (val[i] === passage[i]) {
        correct++;
      }
    }

    const currentAcc = val.length > 0 ? Math.round((correct / val.length) * 100) : 100;
    setAccuracy(currentAcc);

    const now = Date.now();
    const elapsedMinutes = startTime ? Math.max((now - startTime) / 60000, 0.04) : 0.04;
    const currentWpm = Math.round((correct / 5) / elapsedMinutes);
    setWpm(Math.max(0, currentWpm));

    // Auto submit upon typing entire passage accurately
    if (val.length >= passage.length && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      submitAttempt(val, currentWpm, currentAcc);
    }
  };

  // Submit attempt
  const submitAttempt = useCallback(async (finalInput: string, finalWpm: number, finalAcc: number) => {
    if (!token || isSubmitting) return;
    setIsSubmitting(true);

    let correct = 0;
    let incorrect = 0;
    for (let i = 0; i < finalInput.length; i++) {
      if (finalInput[i] === passage[i]) correct++;
      else incorrect++;
    }

    const now = Date.now();
    const timeTaken = startTime ? Math.round((now - startTime) / 1000) : 30;

    try {
      const res = await api.submitTyping(token, {
        isPractice,
        typingRoundId: currentSet?.id || 'tr-1',
        wpm: finalWpm,
        accuracy: finalAcc,
        charsTyped: finalInput.length,
        correctChars: correct,
        incorrectChars: incorrect,
        timeTakenSeconds: timeTaken
      }, previewTeamId);

      if (res.success) {
        setHasSubmitted(true);
        setSubmissionResult(res.submission);
        onRefresh();
      }
    } catch (err) {
      console.error('Error submitting typing score:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [token, isPractice, currentSet, passage, startTime, previewTeamId, onRefresh, isSubmitting]);

  // Auto-submit when global server timer reaches 0
  useEffect(() => {
    if (
      contestState.timer.remainingSeconds === 0 &&
      contestState.timer.isRunning &&
      !hasSubmitted &&
      !hasAutoSubmittedRef.current &&
      userInput.length > 0
    ) {
      hasAutoSubmittedRef.current = true;
      submitAttempt(userInput, wpm, accuracy);
    }
  }, [contestState.timer.remainingSeconds, contestState.timer.isRunning, hasSubmitted, userInput, wpm, accuracy, submitAttempt]);

  const totalChars = passage.length;
  const typedCount = userInput.length;
  const progressPercent = Math.min(100, Math.round((typedCount / totalChars) * 100));
  const remainingTime = Math.max(0, durationSeconds - elapsedSeconds);

  // Next set navigation
  const nextSetIndex = currentSetIndex + 1;
  const hasNextSet = nextSetIndex < allSets.length;
  const nextSet = hasNextSet ? allSets[nextSetIndex] : null;
  const allSetsFinished = allSets.length > 0 && allSets.every(s => s.hasCompletedTest);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* 1. SET NAVIGATION & PROGRESS STEPPER */}
      {allSets.length > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">
              Round 1 Sets:
            </span>
            <div className="flex items-center gap-2">
              {allSets.map((s, idx) => {
                const isCurrent = s.id === currentSet?.id;
                const isCompleted = s.hasCompletedTest;
                return (
                  <button
                    key={s.id || idx}
                    onClick={() => {
                      setSelectedSetId(s.id);
                      setIsPractice(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : isCompleted
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/60'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                    )}
                    <span>Set {idx + 1}</span>
                    {isCompleted && s.myTestResult?.score && (
                      <span className="text-[10px] text-emerald-400 font-mono">
                        ({Math.round(s.myTestResult.score)}pts)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-right text-xs font-bold text-slate-400 shrink-0">
            {allSets.filter(s => s.hasCompletedTest).length} / {allSets.length} Completed
          </div>
        </div>
      )}

      {/* 2. TOP HUD CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {/* Mode Switch Pills */}
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setIsPractice(false)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !isPractice
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Official Timed Test
              </button>
              <button
                type="button"
                onClick={() => setIsPractice(true)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isPractice
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Practice Warmup (1m)
              </button>
            </div>

            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
              Set {currentSetIndex + 1} of {allSets.length}
            </span>

            <span className="text-xs text-slate-400 font-mono">
              Min Acc: <strong className="text-white">{minAccuracy}%</strong>
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            {currentSet?.title || 'Fastest Fingers First'}
          </h1>
        </div>

        {/* Live HUD Metrics */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 text-center min-w-[84px]">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Time Left</span>
            <span className={`font-mono text-xl sm:text-2xl font-black ${remainingTime <= 10 && remainingTime > 0 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
              {remainingTime}s
            </span>
          </div>

          <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 text-center min-w-[84px]">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Speed</span>
            <span className="font-mono text-xl sm:text-2xl font-black text-emerald-400">
              {wpm} <span className="text-xs text-slate-500 font-sans">WPM</span>
            </span>
          </div>

          <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 text-center min-w-[84px]">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Accuracy</span>
            <span
              className={`font-mono text-xl sm:text-2xl font-black ${
                accuracy >= minAccuracy ? 'text-indigo-300' : 'text-rose-400'
              }`}
            >
              {accuracy}%
            </span>
          </div>

          <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 text-center min-w-[84px]">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Progress</span>
            <span className="font-mono text-base sm:text-lg font-bold text-slate-300">
              {progressPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. MAIN INTERACTIVE TYPING ARENA */}
      {!hasSubmitted ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Target Passage Character Stream */}
          <div
            onClick={() => inputRef.current?.focus()}
            className="p-6 bg-slate-950 rounded-2xl border border-slate-800/80 font-mono text-base sm:text-lg leading-relaxed select-none cursor-text min-h-[160px] max-h-[280px] overflow-y-auto overflow-x-auto whitespace-pre-wrap break-words tracking-wide relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950"
          >
            <div className="whitespace-pre-wrap min-w-max">
            {passage.split('').map((char: string, index: number) => {
              const isTyped = index < userInput.length;
              const isCurrent = index === userInput.length;
              const isCorrect = isTyped && userInput[index] === char;

              let style = 'text-slate-500';
              if (isTyped) {
                style = isCorrect ? 'text-emerald-400 font-bold' : 'text-rose-400 bg-rose-950/80 rounded px-0.5 font-bold underline';
              } else if (isCurrent) {
                style = 'bg-indigo-600 text-white rounded px-0.5 animate-pulse font-bold';
              }

              return (
                <span key={index} className={style}>
                  {char === '\n' ? '\n' : char}
                </span>
              );
            })}
          </div>

          {/* Active Input Listener */}
          <div>
            <textarea
              ref={inputRef}
              value={userInput}
              onChange={handleInputChange}
              disabled={contestState.isEmergencyLocked}
              placeholder="Click here or start typing immediately to capture keystrokes..."
              rows={6}
              wrap="off"
              className="w-full min-h-[150px] max-h-[260px] overflow-y-auto px-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-white font-mono text-sm leading-relaxed placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-y whitespace-pre"
              autoFocus
            />
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
              <span>Multiline input supported. Spaces, punctuation, and line breaks count exactly.</span>
              <span className="text-indigo-400 font-bold">Auto-submits on completion or timer expiry</span>
            </div>
          </div>
        </div>
      ) : (
        /* 4. SUBMISSION RECORDED STATE & NEXT SET PROMPT */
        <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {isPractice
                ? 'Practice Warmup Complete!'
                : `Set ${currentSetIndex + 1} Submission Recorded!`}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto mt-1">
              {isPractice
                ? 'Warmup complete. You can now launch the Official Timed Test for this set.'
                : hasNextSet
                ? `Set ${currentSetIndex + 1} completed! You can proceed immediately to Set ${nextSetIndex + 1}.`
                : 'All uploaded typing sets have been completed! Stand by for administrator results.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto pt-1">
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Final Speed</span>
              <span className="font-mono text-xl font-bold text-emerald-400">{submissionResult?.wpm || wpm} WPM</span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Accuracy</span>
              <span className="font-mono text-xl font-bold text-indigo-300">{submissionResult?.accuracy || accuracy}%</span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Typed Chars</span>
              <span className="font-mono text-xl font-bold text-slate-200">{submissionResult?.charsTyped || userInput.length}</span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Score</span>
              <span className="font-mono text-xl font-black text-amber-400">
                {isPractice ? 'Warmup' : `${submissionResult?.score || 0} pts`}
              </span>
            </div>
          </div>

          {/* Action buttons based on status */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            {isPractice ? (
              <button
                onClick={() => {
                  setIsPractice(false);
                  setHasSubmitted(false);
                }}
                className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" /> Start Official Timed Test for Set {currentSetIndex + 1}
              </button>
            ) : hasNextSet ? (
              <button
                onClick={() => {
                  if (nextSet) {
                    setSelectedSetId(nextSet.id);
                    setIsPractice(false);
                    setHasSubmitted(false);
                  }
                }}
                className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                Proceed to Set {nextSetIndex + 1} of {allSets.length}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                All {allSets.length} Round 1 Typing Sets Finished! Stand by for Results.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
