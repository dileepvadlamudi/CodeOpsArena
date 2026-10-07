import React from 'react';
import { Team, ContestState } from '../../types/contest';
import {
  Clock,
  Shield,
  Zap,
  Award,
  Sparkles,
  Keyboard,
  BrainCircuit,
  Code2,
  KeyRound,
  CheckCircle2,
  Users
} from 'lucide-react';

interface LobbyViewProps {
  team: Team;
  contestState: ContestState;
}

export const LobbyView: React.FC<LobbyViewProps> = ({ team, contestState }) => {
  const schedule = [
    {
      round: 'Round 1',
      name: 'Fastest Fingers First',
      icon: <Keyboard className="w-5 h-5 text-indigo-400" />,
      desc: 'Speed & Accuracy Typing Challenge (1-min Practice + Main Test)',
      duration: '10 Mins'
    },
    {
      round: 'Round 2',
      name: 'Byte-Sized Brains',
      icon: <BrainCircuit className="w-5 h-5 text-violet-400" />,
      desc: 'Progressive Tech & Code Snippet Quiz (Easy ➔ Medium ➔ Hard)',
      duration: '20 Mins'
    },
    {
      round: 'Break',
      name: 'Networking & Lunch Intermission',
      icon: <Clock className="w-5 h-5 text-amber-400" />,
      desc: 'Refreshments & Mid-event score check',
      duration: '30 Mins'
    },
    {
      round: 'Round 3',
      name: 'Code Minimalist',
      icon: <Code2 className="w-5 h-5 text-emerald-400" />,
      desc: 'Algorithmic Code Reduction Challenge',
      duration: '30 Mins'
    },
    {
      round: 'Round 4',
      name: 'Crack & Compete',
      icon: <KeyRound className="w-5 h-5 text-rose-400" />,
      desc: 'Linear Security, Cipher, & Reverse-Engineering Chain',
      duration: '40 Mins'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Contest Lobby • Waiting for Admin Signal
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Welcome, <span className="text-indigo-400">{team.name}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1.5 font-medium max-w-xl">
              Your workstation is connected and synchronized with the central event server. The competition will begin automatically once the administrator initiates Round 1.
            </p>
          </div>

          {/* Team Credentials Pill */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 min-w-[200px] text-center shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
              Registered Team ID
            </span>
            <span className="font-mono text-lg font-black text-indigo-300 block mt-0.5">
              {team.team_code}
            </span>
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Kickoff
            </div>
          </div>
        </div>
      </div>

      {/* Contest Schedule */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          Event Structure & Round Schedule
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Each stage is controlled directly by the administrator. Keep this window open.
        </p>

        <div className="space-y-3">
          {schedule.map((item, idx) => (
            <div
              key={item.round}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-850 hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                  {item.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-indigo-400 border border-slate-800 uppercase">
                      {item.round}
                    </span>
                    <h3 className="text-sm font-bold text-white">{item.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              </div>

              <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0">
                {item.duration}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Rules Notice */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex items-start gap-3 text-xs text-slate-400">
        <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-200">Fair Play Policy:</strong> Client-side tampering, external script injections, or unauthorized multi-device logins will result in immediate disqualification. Timers and scoring are server-authoritative.
        </div>
      </div>
    </div>
  );
};
