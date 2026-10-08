import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ContestState } from '../../types/contest';
import {
  Shield,
  Users,
  LogOut,
  Radio,
  Eye,
  Lock
} from 'lucide-react';

interface HeaderProps {
  contestState: ContestState | null;
  isConnected: boolean;
  onOpenPreview?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ contestState, isConnected, onOpenPreview }) => {
  const { role, team, logout, previewTeamId, setPreviewTeamId } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-[#040605]/95 backdrop-blur border-b border-[#606161]/40 shadow-xl shadow-black/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Stage info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#04D87D] via-[#04768D] to-[#045D33] flex items-center justify-center font-black text-[#040605] text-sm tracking-wider shadow-lg shadow-[#045D33]/40 border border-[#04D87D]/50">
              OPS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-sm sm:text-base tracking-wider font-tactical">CODEOPS</span>
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-1.5 py-0.5 rounded bg-[#045D33]/40 text-[#04D87D] border border-[#04D87D]/40 shadow-sm">
                  BLACKOPS 2026
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#9F9694] truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-[#04D87D] animate-pulse" />
                <span className="truncate font-medium text-zinc-300">
                  {contestState?.stageTitle || 'Live Competition'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Role, Live Status, Actions */}
        <div className="flex items-center gap-3">
          {/* Connection badge */}
          <div
            className="hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-[#606161]/50 bg-[#040605]/80 text-[#9F9694]"
            title={isConnected ? 'Connected to live contest server' : 'Reconnecting to server...'}
          >
            <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-[#04D87D] animate-pulse' : 'text-rose-400'}`} />
            <span className="font-medium font-mono">{isConnected ? 'Live Sync' : 'Connecting...'}</span>
          </div>

          {/* Admin Preview Mode Indicator */}
          {role === 'ADMIN' && previewTeamId && (
            <div className="flex items-center gap-1.5 bg-[#04768D]/20 border border-[#04768D]/50 text-[#04D87D] text-xs px-2.5 py-1 rounded-lg">
              <Eye className="w-3.5 h-3.5 text-[#04D87D]" />
              <span className="font-medium truncate max-w-[120px] font-mono">POV Preview</span>
              <button
                onClick={() => setPreviewTeamId(null)}
                className="ml-1 text-[#04D87D] hover:text-white text-xs font-bold cursor-pointer"
                title="Exit Preview"
              >
                ✕
              </button>
            </div>
          )}

          {/* User Badge */}
          {role === 'ADMIN' ? (
            <div className="flex items-center gap-2 bg-[#045D33]/40 border border-[#04D87D]/50 px-3 py-1 rounded-xl shadow-sm">
              <Shield className="w-4 h-4 text-[#04D87D]" />
              <span className="text-xs font-bold text-[#04D87D] hidden sm:inline font-mono">TACTICAL ADMIN</span>
            </div>
          ) : team ? (
            <div className="flex items-center gap-2 bg-[#040605] border border-[#606161]/60 px-3 py-1 rounded-xl">
              <Users className="w-4 h-4 text-[#04D87D]" />
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-white leading-tight truncate max-w-[140px] font-tactical">{team.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#9F9694] font-mono">{team.team_code}</span>
                  <span
                    className="inline-flex items-center gap-0.5 text-[9px] font-mono text-[#04D87D] bg-[#045D33]/40 border border-[#045D33] px-1 py-0.2 rounded"
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
            className="p-2 text-[#9F9694] hover:text-rose-400 hover:bg-[#606161]/20 rounded-lg transition-colors cursor-pointer"
            title="Log Out / Exit"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
