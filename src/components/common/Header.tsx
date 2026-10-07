import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ContestState } from '../../types/contest';
import {
  Clock,
  Shield,
  Users,
  AlertTriangle,
  LogOut,
  Radio,
  Eye,
  Sliders,
  CheckCircle,
  Pause,
  Play,
  Lock
} from 'lucide-react';

interface HeaderProps {
  contestState: ContestState | null;
  isConnected: boolean;
  onOpenPreview?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ contestState, isConnected, onOpenPreview }) => {
  const { role, team, logout, previewTeamId, setPreviewTeamId } = useAuth();

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const timer = contestState?.timer;
  const isTimerRunning = timer?.isRunning && !timer?.isPaused;
  const remainingSecs = timer?.remainingSeconds || 0;
  const isUrgentTimer = remainingSecs > 0 && remainingSecs <= 30 && isTimerRunning;

  return (
    <header className="sticky top-0 z-40 bg-[#090b10]/95 backdrop-blur border-b border-zinc-800/90 shadow-xl shadow-black/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Stage info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 flex items-center justify-center font-black text-black text-sm tracking-wider shadow-lg shadow-orange-950/50 border border-amber-400/40">
              OPS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-sm sm:text-base tracking-wider font-tactical">CODEOPS</span>
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-400 border border-amber-500/40 shadow-sm">
                  BLACKOPS 2026
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="truncate font-medium text-zinc-300">
                  {contestState?.stageTitle || 'Live Competition'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Live Timer Display */}
        {timer && (
          <div className="flex items-center">
            <div
              className={`flex items-center gap-2.5 px-4 py-1.5 rounded-xl border transition-all ${
                contestState?.isEmergencyLocked
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                  : isUrgentTimer
                  ? 'bg-rose-950/70 border-rose-500/90 text-rose-300 animate-pulse'
                  : isTimerRunning
                  ? 'bg-black/90 border-amber-500/40 text-amber-300 shadow-inner'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-400'
              }`}
            >
              <Clock className={`w-4 h-4 ${isUrgentTimer ? 'text-rose-400' : 'text-amber-400'}`} />
              <div className="flex flex-col items-center">
                <span className="font-mono text-base sm:text-lg font-bold tracking-wider leading-none">
                  {formatTimer(remainingSecs)}
                </span>
                <span className="text-[9px] uppercase font-semibold tracking-wider text-zinc-400 leading-none mt-0.5 font-mono">
                  {contestState?.isEmergencyLocked ? 'Locked' : isTimerRunning ? 'Time Left' : timer.isPaused ? 'Paused' : 'Timer Idle'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Right: Role, Live Status, Actions */}
        <div className="flex items-center gap-3">
          {/* Connection badge */}
          <div
            className="hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-zinc-800 bg-black/60 text-zinc-400"
            title={isConnected ? 'Connected to live contest server' : 'Reconnecting to server...'}
          >
            <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
            <span className="font-medium font-mono">{isConnected ? 'Live Sync' : 'Connecting...'}</span>
          </div>

          {/* Admin Preview Mode Indicator */}
          {role === 'ADMIN' && previewTeamId && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs px-2.5 py-1 rounded-lg">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-medium truncate max-w-[120px] font-mono">POV Preview</span>
              <button
                onClick={() => setPreviewTeamId(null)}
                className="ml-1 text-amber-400 hover:text-white text-xs font-bold cursor-pointer"
                title="Exit Preview"
              >
                ✕
              </button>
            </div>
          )}

          {/* User Badge */}
          {role === 'ADMIN' ? (
            <div className="flex items-center gap-2 bg-amber-950/60 border border-amber-500/50 px-3 py-1 rounded-xl shadow-sm">
              <Shield className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-200 hidden sm:inline font-mono">TACTICAL ADMIN</span>
            </div>
          ) : team ? (
            <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700/80 px-3 py-1 rounded-xl">
              <Users className="w-4 h-4 text-amber-400" />
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-white leading-tight truncate max-w-[140px] font-tactical">{team.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-400 font-mono">{team.team_code}</span>
                  <span
                    className="inline-flex items-center gap-0.5 text-[9px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-1 py-0.2 rounded"
                    title="Workstation bound to 1 active device"
                  >
                    <Lock className="w-2.5 h-2.5" /> 1-Dev
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Logout button */}
          <button
            onClick={() => logout()}
            className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            title="Log Out / Exit"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
