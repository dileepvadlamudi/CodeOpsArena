import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ContestState, Team } from '../../types/contest';
import { LobbyView } from './LobbyView';
import { InstructionsView } from './InstructionsView';
import { Round1TypingView } from './Round1TypingView';
import { Round2QuizView } from './Round2QuizView';
import { LunchBreakView } from './LunchBreakView';
import { Round3CodeView } from './Round3CodeView';
import { Round4CrackView } from './Round4CrackView';
import { ResultsView } from './ResultsView';
import { EmergencyPauseOverlay } from '../common/EmergencyPauseOverlay';
import { ShieldAlert, AlertTriangle, Maximize, LockKeyhole } from 'lucide-react';

interface ParticipantLayoutProps {
  contestState: ContestState;
  onRefresh: () => void;
}

export const ParticipantLayout: React.FC<ParticipantLayoutProps> = ({
  contestState,
  onRefresh
}) => {
  const { token, user, previewTeamId } = useAuth();
  const [stageData, setStageData] = useState<any>(null);
  const [teamInfo, setTeamInfo] = useState<Team | null>(null);
  const [clipboardWarning, setClipboardWarning] = useState<string | null>(null);
  const [fullscreenLocked, setFullscreenLocked] = useState(false);
  const [fullscreenWarningCount, setFullscreenWarningCount] = useState(0);
  const [fullscreenSubmitting, setFullscreenSubmitting] = useState(false);
  const [fullscreenSecondsLeft, setFullscreenSecondsLeft] = useState<number | null>(null);
  const fullscreenGraceTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [fullscreenNotice, setFullscreenNotice] = useState<string | null>(null);
  const fullscreenActiveRef = React.useRef(false);
  const fullscreenSubmittingRef = React.useRef(false);
  const lastFullscreenViolationAtRef = React.useRef(0);
  const browserFullscreenRef = React.useRef(false);

  const getMainRoundKey = (): 'r1' | 'r2' | 'r3' | 'r4' | null => {
    switch (contestState.currentStage) {
      case 'R1_TEST':
      case 'ROUND_1_TEST':
        return 'r1';
      case 'R2_PHASE_1':
      case 'ROUND_2_PHASE_1':
      case 'R2_PHASE_2':
      case 'ROUND_2_PHASE_2':
      case 'R2_PHASE_3':
      case 'ROUND_2_PHASE_3':
      case 'R2_QUIZ':
      case 'ROUND_2_QUIZ':
      case 'ROUND_2_ACTIVE':
        return 'r2';
      case 'R3_CODE':
      case 'ROUND_3_CODE':
      case 'ROUND_3_ACTIVE':
        return 'r3';
      case 'R4_CRACK':
      case 'ROUND_4_CRACK':
      case 'ROUND_4_ACTIVE':
        return 'r4';
      default:
        return null;
    }
  };

  const isParticipantSession = user?.role === 'team' && !previewTeamId;
  const isMainRound = Boolean(getMainRoundKey()) && isParticipantSession;

  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenEnabled) {
        setFullscreenNotice('Fullscreen is unavailable in this browser. Please use a supported desktop browser.');
        return;
      }

      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      }

      const active = Boolean(document.fullscreenElement);
      fullscreenActiveRef.current = active;
      setFullscreenLocked(!active);

      if (active) {
        setFullscreenNotice(null);
      }
    } catch (error) {
      console.warn('Unable to enter fullscreen:', error);
      setFullscreenLocked(true);
      setFullscreenNotice('Fullscreen permission was denied. Click the button again and allow fullscreen.');
    }
  };

  // Keep the displayed warning count synchronized with the server-provided team profile.
  // This is intentionally separate from the fullscreen event listener so normal profile
  // refreshes cannot recreate the listener or reset its state.
  useEffect(() => {
    if (!isMainRound) {
      setFullscreenWarningCount(0);
      return;
    }

    const roundKey = getMainRoundKey();
    if (roundKey) {
      setFullscreenWarningCount(Number(teamInfo?.fullscreenWarnings?.[roundKey] || 0));
    }
  }, [isMainRound, contestState.currentStage, teamInfo?.fullscreenWarnings]);

  // Fullscreen enforcement is participant-only and active only during the four main rounds.
  useEffect(() => {
    if (!isMainRound) {
      setFullscreenLocked(false);
      setFullscreenNotice(null);
      setFullscreenSecondsLeft(null);
      if (fullscreenGraceTimerRef.current) clearInterval(fullscreenGraceTimerRef.current);
      fullscreenGraceTimerRef.current = null;
      fullscreenActiveRef.current = false;
      fullscreenSubmittingRef.current = false;
      return;
    }

    const isBrowserFullscreen = () => {
      const heightMatches = window.innerHeight >= Math.max(0, window.screen.availHeight - 16);
      const widthMatches = window.innerWidth >= Math.max(0, window.screen.availWidth - 16);
      return heightMatches && widthMatches;
    };

    const initiallyFullscreen = Boolean(document.fullscreenElement) || isBrowserFullscreen();
    browserFullscreenRef.current = isBrowserFullscreen();
    setFullscreenLocked(!initiallyFullscreen);
    fullscreenActiveRef.current = initiallyFullscreen;

    const recordViolation = async (reason: 'fullscreen_exit' | 'tab_switch' | 'window_blur' | 'browser_fullscreen_exit') => {
      if (!token || !fullscreenActiveRef.current) return;

      // A single user action can fire multiple browser events (for example,
      // leaving fullscreen can also change visibility). Count it only once.
      const now = Date.now();
      if (now - lastFullscreenViolationAtRef.current < 1000) return;
      lastFullscreenViolationAtRef.current = now;

      setFullscreenLocked(true);

      try {
        const result = await api.recordFullscreenViolation(token, previewTeamId);

        if (!result?.success || result?.ignored) {
          setFullscreenNotice(result?.message || 'Fullscreen violation could not be recorded.');
          return;
        }

        const count = Number(result.warningCount || 0);
        setFullscreenWarningCount(count);

        setTeamInfo(prev => prev ? {
          ...prev,
          status: result.disqualified ? 'disqualified' : prev.status,
          disqualified_reason: result.disqualified
            ? (result.message || 'Fullscreen policy violation.')
            : prev.disqualified_reason,
          fullscreenWarnings: result.warnings || prev.fullscreenWarnings
        } : prev);

        if (result.disqualified || count >= 3) {
          setFullscreenSecondsLeft(null);
          setFullscreenNotice('WARNING 3/3 — Team disqualified for fullscreen policy violation.');
          return;
        }

        const reasonText =
          reason === 'tab_switch'
            ? 'You switched away from the contest tab.'
            : reason === 'window_blur'
              ? 'You left the contest window.'
              : reason === 'browser_fullscreen_exit'
                ? 'You exited browser fullscreen (F11).'
                : 'You exited fullscreen.';

        setFullscreenNotice(`WARNING ${count}/3 — ${reasonText} Return to fullscreen within 7 seconds.`);

        if (fullscreenGraceTimerRef.current) clearInterval(fullscreenGraceTimerRef.current);
        const deadline = Date.now() + 7000;
        setFullscreenSecondsLeft(7);

        fullscreenGraceTimerRef.current = setInterval(async () => {
          if (document.fullscreenElement && !document.hidden && document.hasFocus()) {
            if (fullscreenGraceTimerRef.current) clearInterval(fullscreenGraceTimerRef.current);
            fullscreenGraceTimerRef.current = null;
            setFullscreenSecondsLeft(null);
            setFullscreenLocked(false);
            return;
          }

          const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
          setFullscreenSecondsLeft(remaining);

          if (remaining <= 0) {
            if (fullscreenGraceTimerRef.current) clearInterval(fullscreenGraceTimerRef.current);
            fullscreenGraceTimerRef.current = null;
            setFullscreenSecondsLeft(null);

            try {
              const timeoutResult = await api.fullscreenTimeout(token, previewTeamId);
              if (timeoutResult?.disqualified) {
                setTeamInfo(prev => prev ? {
                  ...prev,
                  status: 'disqualified',
                  disqualified_reason: 'Fullscreen policy violation: failed to return within 7 seconds.'
                } : prev);
              }
            } catch (error) {
              console.error('Failed to process fullscreen timeout:', error);
            }
          }
        }, 250);
      } catch (error) {
        console.error('Failed to record fullscreen violation:', error);
        setFullscreenNotice('Security violation detected, but the warning could not be recorded. Stay on the contest screen and contact the coordinator.');
      }
    };

    const handleFullscreenChange = async () => {
      const active = Boolean(document.fullscreenElement);
      const wasActive = fullscreenActiveRef.current;
      fullscreenActiveRef.current = active;

      if (active) {
        setFullscreenLocked(false);
        setFullscreenNotice(null);
        setFullscreenSecondsLeft(null);
        if (fullscreenGraceTimerRef.current) clearInterval(fullscreenGraceTimerRef.current);
        fullscreenGraceTimerRef.current = null;
        return;
      }

      // The initial security gate is not a violation. Only a real transition
      // from fullscreen -> non-fullscreen records a warning.
      if (!wasActive) {
        setFullscreenLocked(true);
        return;
      }

      await recordViolation('fullscreen_exit');
    };

    const handleVisibilityChange = () => {
      if (document.hidden && fullscreenActiveRef.current) {
        void recordViolation('tab_switch');
      }
    };

    const handleWindowBlur = () => {
      if (!document.hidden && fullscreenActiveRef.current) {
        void recordViolation('window_blur');
      }
    };

    const handleBrowserFullscreenResize = () => {
      const browserFullscreen = isBrowserFullscreen();

      if (browserFullscreen) {
        browserFullscreenRef.current = true;

        // F11 can provide browser fullscreen without document.fullscreenElement.
        // Treat it as valid fullscreen for participants.
        if (!fullscreenActiveRef.current) {
          fullscreenActiveRef.current = true;
          setFullscreenLocked(false);
          setFullscreenNotice(null);
        }
        return;
      }

      // A transition from F11 fullscreen back to the normal browser viewport
      // is a fullscreen exit even though fullscreenchange does not fire.
      if (browserFullscreenRef.current && fullscreenActiveRef.current && !document.fullscreenElement) {
        browserFullscreenRef.current = false;
        void recordViolation('browser_fullscreen_exit');
      } else {
        browserFullscreenRef.current = false;
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('resize', handleBrowserFullscreenResize);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('resize', handleBrowserFullscreenResize);
      if (fullscreenGraceTimerRef.current) clearInterval(fullscreenGraceTimerRef.current);
      fullscreenGraceTimerRef.current = null;
    };
  }, [isMainRound, contestState.currentStage, token, previewTeamId]);
  // Disable copy, paste, cut, and right-click context menu for participants
  useEffect(() => {
    let warningTimeout: any = null;
    const showWarning = (msg: string) => {
      setClipboardWarning(msg);
      clearTimeout(warningTimeout);
      warningTimeout = setTimeout(() => setClipboardWarning(null), 3000);
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      showWarning('Copying content is disabled for participants during the contest.');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      showWarning('Pasting content is disabled for participants during the contest.');
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      showWarning('Cutting content is disabled for participants during the contest.');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showWarning('Right-click context menu is restricted for contest integrity.');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl) {
        const key = e.key.toLowerCase();
        if (key === 'c' || key === 'v' || key === 'x' || key === 'insert') {
          // Allow Ctrl+' and Ctrl+Enter for code execution/submission
          e.preventDefault();
          showWarning(`Clipboard shortcut (Ctrl+${key.toUpperCase()}) is disabled for participants.`);
        }
      }
    };

    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('cut', handleCut);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(warningTimeout);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('cut', handleCut);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const fetchParticipantData = async () => {
    if (!token) return;
    try {
      const [stageRes, profRes] = await Promise.all([
        api.getStageData(token, previewTeamId),
        api.getTeamProfile(token, previewTeamId)
      ]);
      if (stageRes.success) setStageData(stageRes.stageData || stageRes.data);
      if (profRes.success) setTeamInfo(profRes.team);
    } catch (err) {
      console.error('Error fetching participant data:', err);
    }
  };

  const handleRefreshAll = () => {
    fetchParticipantData();
    onRefresh();
  };

  // Re-fetch whenever stage changes or on trigger, plus keep multi-device sync fresh
  useEffect(() => {
    fetchParticipantData();
    const syncTimer = setInterval(() => {
      fetchParticipantData();
    }, 4000);
    return () => clearInterval(syncTimer);
  }, [token, contestState.currentStage, contestState.currentQuestionId, contestState.currentCodingProblemId, contestState.timer.isPaused, previewTeamId]);

  // Check Disqualification Status
  if (teamInfo && teamInfo.status === 'disqualified') {
    return (
      <div className="max-w-2xl mx-auto p-12 bg-slate-900 border-2 border-rose-600 rounded-3xl text-center space-y-4 shadow-2xl animate-in zoom-in-95">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white">Workstation Disqualified</h2>
        <p className="text-sm text-slate-300 max-w-md mx-auto">
          Your team has been disqualified from active competition by the administrator. Contact event coordinators if you believe this is an error.
        </p>
      </div>
    );
  }

  // Render appropriate view according to central server stage
  const renderActiveStageView = () => {
    switch (contestState.currentStage) {
      case 'LOBBY':
        return teamInfo ? (
          <LobbyView team={teamInfo} contestState={contestState} />
        ) : null;

      case 'R1_INSTRUCTIONS':
      case 'ROUND_1_INSTRUCTIONS':
        return <InstructionsView stage="ROUND_1_INSTRUCTIONS" />;
      
      case 'R2_INSTRUCTIONS':
      case 'ROUND_2_INSTRUCTIONS':
        return <InstructionsView stage="ROUND_2_INSTRUCTIONS" />;

      case 'R3_INSTRUCTIONS':
      case 'ROUND_3_INSTRUCTIONS':
        return <InstructionsView stage="ROUND_3_INSTRUCTIONS" />;

      case 'R4_INSTRUCTIONS':
      case 'ROUND_4_INSTRUCTIONS':
        return <InstructionsView stage="ROUND_4_INSTRUCTIONS" />;

      case 'R1_PRACTICE':
      case 'ROUND_1_PRACTICE':
      case 'R1_TEST':
      case 'ROUND_1_TEST':
        return (
          <Round1TypingView
            stageData={stageData}
            contestState={contestState}
            onRefresh={onRefresh}
          />
        );

      case 'R1_RESULTS':
      case 'ROUND_1_RESULTS':
      case 'R2_RESULTS':
      case 'ROUND_2_RESULTS':
      case 'R3_RESULTS':
      case 'ROUND_3_RESULTS':
      case 'R4_RESULTS':
      case 'ROUND_4_RESULTS':
      case 'FINAL_RESULTS':
      case 'ENDED':
      case 'CONTEST_ENDED':
        return <ResultsView contestState={contestState} stageData={stageData} />;

      case 'R2_QUIZ':
      case 'ROUND_2_QUIZ':
      case 'ROUND_2_ACTIVE':
      case 'R2_PHASE_1':
      case 'ROUND_2_PHASE_1':
      case 'R2_PHASE_2':
      case 'ROUND_2_PHASE_2':
      case 'R2_PHASE_3':
      case 'ROUND_2_PHASE_3':
        return (
          <Round2QuizView
            stageData={stageData}
            contestState={contestState}
            onRefresh={onRefresh}
          />
        );

      case 'LUNCH_BREAK':
        return <LunchBreakView contestState={contestState} />;

      case 'R3_CODE':
      case 'ROUND_3_CODE':
      case 'ROUND_3_ACTIVE':
        return (
          <Round3CodeView
            stageData={stageData}
            contestState={contestState}
            onRefresh={handleRefreshAll}
          />
        );

      case 'R4_CRACK':
      case 'ROUND_4_CRACK':
      case 'ROUND_4_ACTIVE':
        return (
          <Round4CrackView
            stageData={stageData}
            contestState={contestState}
            onRefresh={handleRefreshAll}
          />
        );

      case 'PAUSED':
        return (
          <div className="max-w-xl mx-auto p-8 bg-slate-900 border border-amber-500/40 rounded-3xl text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white">Contest Paused</h2>
            <p className="text-sm text-slate-300">
              The administrator has temporarily paused the event timer and interaction. Please stand by.
            </p>
          </div>
        );

      default:
        return teamInfo ? (
          <LobbyView team={teamInfo} contestState={contestState} />
        ) : null;
    }
  };

  return (
    <div className="relative select-none">
      {/* Emergency Pause Overlay */}
      {contestState.isEmergencyLocked && <EmergencyPauseOverlay />}

      {/* Clipboard Warning Toast */}
      {clipboardWarning && (
        <div className="fixed bottom-6 right-6 z-50 bg-rose-950/95 border border-rose-500/60 text-rose-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 backdrop-blur-md">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-white tracking-wide">ACTION RESTRICTED</p>
            <p className="text-rose-300 font-medium">{clipboardWarning}</p>
          </div>
        </div>
      )}

      {/* Fullscreen enforcement: active only during main contest rounds. */}
      {isMainRound && fullscreenLocked && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-3xl border-2 border-amber-500/50 bg-slate-950 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <LockKeyhole className="h-8 w-8" />
            </div>

            <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-400">
              {fullscreenWarningCount > 0 ? 'Fullscreen Violation' : 'Main Round Security'}
            </p>

            <h2 className="mt-3 text-3xl font-black text-white">
              {fullscreenWarningCount > 0 ? `Warning ${fullscreenWarningCount}/3` : 'Fullscreen Required'}
            </h2>

            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-300">
              {fullscreenWarningCount > 0
                ? 'You exited fullscreen during the main round. Your workstation is locked until you return to fullscreen.'
                : 'This main round requires fullscreen. Enter fullscreen before you can continue.'}
            </p>
            {fullscreenSecondsLeft !== null && (
              <div className="mt-5 rounded-2xl border border-rose-500/50 bg-rose-500/10 px-5 py-4">
                <div className="text-xs font-black uppercase tracking-widest text-rose-400">Return to fullscreen</div>
                <div className="mt-1 text-4xl font-black text-white">{fullscreenSecondsLeft}s</div>
                <div className="mt-1 text-xs text-slate-400">Failure to return before the timer reaches 0 will disqualify the team.</div>
              </div>
            )}

            {fullscreenNotice && (
              <div className="mt-5 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-5 py-4 text-sm font-bold text-rose-200">
                {fullscreenNotice}
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Warnings for this round
              </div>
              <div className="mt-1 text-3xl font-black text-white">
                {fullscreenWarningCount} <span className="text-slate-600">/ 3</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Each main round has its own separate 3-warning limit.
              </div>
            </div>

            <button
              type="button"
              onClick={enterFullscreen}
              disabled={fullscreenSubmitting}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-7 py-3.5 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Maximize className="h-4 w-4" />
              {fullscreenSubmitting ? 'Recording warning…' : 'Enter Fullscreen & Continue'}
            </button>
          </div>
        </div>
      )}

      {isMainRound && fullscreenNotice && !fullscreenLocked && (
        <div className="fixed top-6 left-1/2 z-[110] -translate-x-1/2 rounded-2xl border border-amber-500/60 bg-amber-950/95 px-6 py-4 text-center shadow-2xl backdrop-blur-md">
          <p className="text-xs font-black uppercase tracking-widest text-amber-400">Fullscreen Warning</p>
          <p className="mt-1 text-sm font-bold text-white">{fullscreenNotice}</p>
        </div>
      )}

      {/* Main View */}
      {renderActiveStageView()}
    </div>
  );
};
