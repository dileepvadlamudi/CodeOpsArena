import React from 'react';
import { ShieldAlert, PauseCircle, Lock } from 'lucide-react';

interface EmergencyPauseOverlayProps {
  isLocked: boolean;
  isAdmin?: boolean;
}

export const EmergencyPauseOverlay: React.FC<EmergencyPauseOverlayProps> = ({ isLocked, isAdmin }) => {
  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-amber-500/50 rounded-2xl p-6 sm:p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
          <PauseCircle className="w-9 h-9 animate-pulse" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
          <Lock className="w-3.5 h-3.5" />
          Competition Paused
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-2">
          Contest is Temporarily on Hold
        </h2>

        <p className="text-sm text-slate-300 mt-2 leading-relaxed">
          The event administrator has paused the active stage. All timers and input submissions are safely frozen on the server.
        </p>

        <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Please stand by. State will auto-resume immediately upon Admin signal.</span>
        </div>
      </div>
    </div>
  );
};
