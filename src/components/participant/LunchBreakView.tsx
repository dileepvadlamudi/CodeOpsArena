import React from 'react';
import { Coffee, Utensils, Clock, Sparkles, Code2, KeyRound } from 'lucide-react';
import { ContestState } from '../../types/contest';

interface LunchBreakViewProps {
  contestState: ContestState;
}

export const LunchBreakView: React.FC<LunchBreakViewProps> = ({ contestState }) => {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-5 relative overflow-hidden">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <Utensils className="w-10 h-10" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-700/60 text-amber-300 text-xs font-bold uppercase tracking-wider">
          <Coffee className="w-4 h-4 text-amber-400" />
          Event Intermission & Networking
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Lunch & Refreshment Break
        </h1>

        <p className="text-slate-300 text-sm sm:text-base max-w-lg mx-auto font-medium leading-relaxed">
          Take a break, recharge, and get ready for the afternoon rounds. The contest server will resume promptly as scheduled by the event coordinator.
        </p>

        {/* Afternoon Preview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-6 max-w-lg mx-auto">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase">
              <Code2 className="w-4 h-4" /> Round 3: Code Minimalist
            </div>
            <p className="text-[11px] text-slate-400">
              Shortest code wins. Review string manipulations and lambda expressions.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase">
              <KeyRound className="w-4 h-4" /> Round 4: Crack & Compete
            </div>
            <p className="text-[11px] text-slate-400">
              Reverse engineering chain. Review binary, hex, and cryptographic logic.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
