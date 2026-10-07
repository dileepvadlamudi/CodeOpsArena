import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ContestState, ContestStage, Team } from '../../types/contest';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Lock,
  Unlock,
  Radio,
  Clock,
  Sparkles,
  Eye,
  Megaphone,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Flame,
  Coffee,
  Trophy,
  Sliders,
  X
} from 'lucide-react';

interface EventControlTabProps {
  contestState: ContestState;
  teams?: Team[];
  onOpenPreview?: (teamId: string) => void;
  onRefreshState?: () => void;
  onRefresh?: () => void;
}

export const EventControlTab: React.FC<EventControlTabProps> = ({
  contestState,
  teams = [],
  onOpenPreview,
  onRefreshState,
  onRefresh
}) => {
  const refreshCallback = onRefreshState || onRefresh || (() => {});
  const safeTeams = Array.isArray(teams) ? teams : [];
  const { token } = useAuth();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [customTimerSecs, setCustomTimerSecs] = useState<number>(60);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementType, setAnnouncementType] = useState<'info' | 'warning' | 'urgent'>('info');
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);

  const stageList: { stage: ContestStage; label: string; round: string; icon: string; category: string }[] = [
    { stage: 'LOBBY', label: 'Waiting Lobby', round: 'LOBBY', icon: '🏛️', category: 'General' },
    
    // Round 1
    { stage: 'R1_INSTRUCTIONS', label: 'R1 Instructions', round: 'ROUND_1', icon: '📋', category: 'Round 1' },
    { stage: 'R1_TEST', label: 'R1 Typing Arena (All Sets)', round: 'ROUND_1', icon: '⚡', category: 'Round 1' },
    { stage: 'R1_RESULTS', label: 'R1 Results', round: 'ROUND_1', icon: '📊', category: 'Round 1' },

    // Round 2
    { stage: 'R2_INSTRUCTIONS', label: 'R2 Instructions', round: 'ROUND_2', icon: '📋', category: 'Round 2' },
    { stage: 'R2_QUIZ', label: 'R2 Quiz Arena', round: 'ROUND_2', icon: '🧠', category: 'Round 2' },
    { stage: 'R2_RESULTS', label: 'R2 Results', round: 'ROUND_2', icon: '📊', category: 'Round 2' },

    // Break
    { stage: 'LUNCH_BREAK', label: 'Lunch Break', round: 'LUNCH', icon: '🥪', category: 'General' },

    // Round 3
    { stage: 'R3_INSTRUCTIONS', label: 'R3 Instructions', round: 'ROUND_3', icon: '📋', category: 'Round 3' },
    { stage: 'R3_CODE', label: 'R3 Code Minimalist', round: 'ROUND_3', icon: '💻', category: 'Round 3' },
    { stage: 'R3_RESULTS', label: 'R3 Results', round: 'ROUND_3', icon: '📊', category: 'Round 3' },

    // Round 4
    { stage: 'R4_INSTRUCTIONS', label: 'R4 Instructions', round: 'ROUND_4', icon: '📋', category: 'Round 4' },
    { stage: 'R4_CRACK', label: 'R4 Security Chain', round: 'ROUND_4', icon: '🔓', category: 'Round 4' },
    { stage: 'R4_RESULTS', label: 'R4 Results', round: 'ROUND_4', icon: '📊', category: 'Round 4' },

    // Finales & Overrides
    { stage: 'FINAL_RESULTS', label: 'Final Awards', round: 'FINAL', icon: '🏆', category: 'Finale' },
    { stage: 'PAUSED', label: 'Pause Contest', round: 'PAUSED', icon: '⏸️', category: 'Status' },
    { stage: 'ENDED', label: 'End Contest', round: 'FINAL', icon: '🏁', category: 'Status' }
  ];

  const handleSetStage = async (stage: ContestStage) => {
    if (!token) return;
    setIsActionLoading(true);
    try {
      await api.setStage(token, stage);
      refreshCallback();
    } catch (err) {
      console.error('Error changing stage:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleTimerAction = async (action: 'start' | 'pause' | 'resume' | 'end') => {
    if (!token) return;
    try {
      await api.controlTimer(token, action);
      refreshCallback();
    } catch (err) {
      console.error('Timer action error:', err);
    }
  };

  const handleEndStage = async () => {
    if (!token) return;
    try {
      await api.endStage(token);
      refreshCallback();
    } catch (err) {
      console.error('End stage error:', err);
    }
  };

  const handleAddTime = async (secs: number) => {
    if (!token) return;
    try {
      await api.addTimerTime(token, secs);
      refreshCallback();
    } catch (err) {
      console.error('Add time error:', err);
    }
  };

  const handleSetTimer = async (secs: number, autoStart: boolean = true) => {
    if (!token) return;
    try {
      await api.setTimerDuration(token, secs, autoStart);
      refreshCallback();
    } catch (err) {
      console.error('Set timer error:', err);
    }
  };

  const handleRestartActiveRound = async () => {
    if (!token) return;
    if (!confirm(`Are you sure you want to restart the current round (${contestState.currentStage})? This will reset the timer and synchronize all connected workstations.`)) return;
    try {
      await api.restartRound(token);
      refreshCallback();
    } catch (err) {
      console.error('Restart round error:', err);
    }
  };

  const handleToggleEmergencyLock = async () => {
    if (!token) return;
    try {
      await api.toggleEmergencyLock(token);
      refreshCallback();
    } catch (err) {
      console.error('Lock error:', err);
    }
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !announcementText.trim()) return;

    try {
      await api.createAnnouncement(token, {
        title: 'Event Administrator Broadcast',
        message: announcementText.trim(),
        type: announcementType,
        target: 'all'
      });
      setAnnouncementText('');
      setShowAnnounceModal(false);
      refreshCallback();
    } catch (err) {
      console.error('Error sending announcement:', err);
    }
  };

  const handleDismissActiveAnnouncement = async () => {
    if (!token) return;
    try {
      await api.dismissAnnouncement(token);
      refreshCallback();
    } catch (err) {
      console.error('Error dismissing announcement:', err);
    }
  };

  const timer = contestState.timer;
  const isTimerRunning = timer.isRunning && !timer.isPaused;

  const onlineTeamsCount = safeTeams.filter(t => t && t.is_online).length;

  return (
    <div className="space-y-6">
      {/* 1. TOP STATUS & EMERGENCY CONTROLS BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left: Active Stage Details */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                CONTEST LIVE
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {onlineTeamsCount}/{safeTeams.length} Teams Connected
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {contestState.stageTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-mono">
              STAGE KEY: <span className="text-indigo-400 font-bold">{contestState.currentStage}</span>
            </p>
          </div>

          {/* Right: Master Timer & Actions */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Timer Counter */}
            <div
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all ${
                contestState.isEmergencyLocked
                  ? 'bg-amber-950/50 border-amber-500/60 text-amber-300'
                  : isTimerRunning
                  ? 'bg-slate-950 border-indigo-500/50 text-indigo-300 shadow-lg shadow-indigo-500/10'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <Clock className="w-6 h-6 text-indigo-400 shrink-0" />
              <div>
                <span className="font-mono text-3xl font-black tracking-wider block leading-none">
                  {Math.floor(timer.remainingSeconds / 60)
                    .toString()
                    .padStart(2, '0')}
                  :
                  {(timer.remainingSeconds % 60)
                    .toString()
                    .padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mt-1">
                  {contestState.isEmergencyLocked
                    ? 'Emergency Paused'
                    : isTimerRunning
                    ? 'Running Server Timer'
                    : timer.isPaused
                    ? 'Timer Paused'
                    : 'Timer Stopped'}
                </span>
              </div>
            </div>

            {/* Timer Quick Controls */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              {isTimerRunning ? (
                <button
                  onClick={() => handleTimerAction('pause')}
                  className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Pause active timer"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              ) : (
                <button
                  onClick={() => (timer.isPaused ? handleTimerAction('resume') : handleTimerAction('start'))}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/30"
                  title="Start or Resume timer"
                >
                  <Play className="w-4 h-4" /> {timer.isPaused ? 'Resume' : 'Start'}
                </button>
              )}

              <button
                onClick={handleRestartActiveRound}
                className="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Restart this active round"
              >
                <RotateCcw className="w-4 h-4 text-rose-400" /> Restart Round
              </button>

              <button
                onClick={handleEndStage}
                className="px-3 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/80 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="End current stage timer"
              >
                End Stage
              </button>

              <button
                onClick={() => handleAddTime(30)}
                className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                title="Add 30 seconds"
              >
                +30s
              </button>

              <button
                onClick={() => handleAddTime(60)}
                className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                title="Add 1 minute"
              >
                +1m
              </button>

              <button
                onClick={() => handleSetTimer(60, true)}
                className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                title="Reset to 1 minute"
              >
                1m
              </button>
            </div>

            {/* Emergency Lock Toggle */}
            <button
              onClick={handleToggleEmergencyLock}
              className={`px-4 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                contestState.isEmergencyLocked
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/30'
                  : 'bg-rose-950/60 hover:bg-rose-900/60 border border-rose-700 text-rose-300'
              }`}
              title="Pause all interactions across all team dashboards"
            >
              {contestState.isEmergencyLocked ? (
                <>
                  <Unlock className="w-4 h-4" /> RESUME CONTEST
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> PAUSE CONTEST
                </>
              )}
            </button>

            {/* Broadcast Announcement Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAnnounceModal(true)}
                className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                <Megaphone className="w-4 h-4" /> Broadcast
              </button>

              {contestState.activeAnnouncement && (
                <button
                  onClick={handleDismissActiveAnnouncement}
                  className="px-3.5 py-3 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Dismiss active broadcast from all participant screens"
                >
                  <X className="w-4 h-4" /> Clear Broadcast
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. MASTER STAGE CONTROLLER (16 QUICK ACTIONS) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Contest Stage Director
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Clicking any stage instantly pushes the view to all connected teams via WebSockets without browser refresh.
            </p>
          </div>
        </div>

        {/* Stages Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2.5">
          {stageList.map((item) => {
            const isActive = contestState.currentStage === item.stage;
            return (
              <button
                key={item.stage}
                disabled={isActionLoading}
                onClick={() => handleSetStage(item.stage)}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between h-24 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 scale-[1.02] ring-2 ring-indigo-400'
                    : 'bg-slate-950 border-slate-800/80 hover:border-slate-700 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base">{item.icon}</span>
                  <span
                    className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-indigo-800 text-white' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {item.round}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-bold truncate leading-tight">{item.label}</p>
                  <p className={`text-[10px] truncate ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                    {isActive ? 'CURRENT LIVE' : 'Switch'}
                  </p>
                </div>

                {isActive && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-950 animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. PARTICIPANT POV PREVIEW SELECTOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-400" />
              Preview Participant POV (View as Team)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate exactly what any active team is viewing right now in read-only mode without affecting their score.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              onChange={(e) => {
                if (e.target.value) onOpenPreview(e.target.value);
              }}
              className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer w-full sm:w-64"
              defaultValue=""
            >
              <option value="" disabled>
                Select team to preview...
              </option>
              {safeTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.team_code}) — {t.is_online ? '🟢 Online' : '⚪ Offline'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. BROADCAST ANNOUNCEMENT MODAL */}
      {showAnnounceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-indigo-400" />
                Send Live Announcement
              </h3>
              <button
                onClick={() => setShowAnnounceModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Announcement Type
                </label>
                <div className="flex gap-2">
                  {(['info', 'warning', 'urgent'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAnnouncementType(t)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize border cursor-pointer ${
                        announcementType === t
                          ? t === 'urgent'
                            ? 'bg-rose-600 border-rose-500 text-white'
                            : t === 'warning'
                            ? 'bg-amber-600 border-amber-500 text-white'
                            : 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Message to Broadcast
                </label>
                <textarea
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="e.g. Round 2 Byte-Sized Brains will begin in exactly 3 minutes. Please prepare your workspaces."
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnounceModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <Megaphone className="w-4 h-4" /> Broadcast to All Teams
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
