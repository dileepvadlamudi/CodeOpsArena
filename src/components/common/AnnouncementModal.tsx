import React, { useEffect, useState } from 'react';
import { Announcement } from '../../types/contest';
import { Megaphone, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

interface AnnouncementModalProps {
  announcement: Announcement | null;
  onDismiss?: () => void;
  isAdmin?: boolean;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  announcement,
  onDismiss,
  isAdmin
}) => {
  const [progress, setProgress] = useState(100);
  const DURATION_MS = 12000;

  useEffect(() => {
    if (!announcement) return;
    setProgress(100);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / DURATION_MS) * 100);
      setProgress(remainingPct);

      if (remainingPct <= 0) {
        clearInterval(interval);
        if (onDismiss) {
          onDismiss();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [announcement?.id, onDismiss]);

  if (!announcement || !announcement.isActive) return null;

  const getTypeStyles = (type: Announcement['type']) => {
    switch (type) {
      case 'urgent':
        return {
          bg: 'bg-rose-950/95 border-rose-600 shadow-rose-950/60',
          badge: 'bg-rose-500 text-white',
          icon: <AlertCircle className="w-6 h-6 text-rose-400" />,
          titleColor: 'text-rose-200',
          barColor: 'bg-rose-500'
        };
      case 'warning':
        return {
          bg: 'bg-amber-950/95 border-amber-600 shadow-amber-950/60',
          badge: 'bg-amber-500 text-slate-950',
          icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
          titleColor: 'text-amber-200',
          barColor: 'bg-amber-500'
        };
      default:
        return {
          bg: 'bg-indigo-950/95 border-indigo-600 shadow-indigo-950/60',
          badge: 'bg-indigo-500 text-white',
          icon: <Info className="w-6 h-6 text-indigo-400" />,
          titleColor: 'text-indigo-200',
          barColor: 'bg-indigo-500'
        };
    }
  };

  const style = getTypeStyles(announcement.type);

  return (
    <div className="fixed inset-x-0 top-16 z-50 p-4 pointer-events-none flex justify-center animate-in slide-in-from-top-4 duration-300">
      <div
        className={`pointer-events-auto max-w-2xl w-full p-4 sm:p-5 rounded-2xl border shadow-2xl backdrop-blur-md ${style.bg} relative overflow-hidden flex items-start gap-4`}
      >
        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/50 shrink-0 shadow-inner">
          {style.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full ${style.badge}`}>
              {announcement.type} announcement
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {new Date(announcement.createdAt).toLocaleTimeString()}
            </span>
            <span className="text-[10px] text-slate-400 ml-auto hidden sm:inline">
              Auto-dismissing in {Math.ceil((progress / 100) * (DURATION_MS / 1000))}s
            </span>
          </div>

          <h3 className={`text-base sm:text-lg font-bold ${style.titleColor}`}>
            {announcement.title}
          </h3>

          <p className="text-sm text-slate-200 mt-1 leading-relaxed whitespace-pre-line font-medium">
            {announcement.message}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 border border-slate-700/50 transition-all cursor-pointer"
              title="Dismiss Announcement"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Dismiss</span>
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
          <div
            className={`h-full ${style.barColor} transition-all duration-100 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
