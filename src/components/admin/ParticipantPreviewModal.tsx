import React, { useState } from 'react';
import { ContestState, Team } from '../../types/contest';
import { ParticipantLayout } from '../participant/ParticipantLayout';
import { useAuth } from '../../context/AuthContext';
import { Eye, X, Monitor, Shield, Users } from 'lucide-react';

interface ParticipantPreviewModalProps {
  contestState: ContestState;
  teams: Team[];
  onClose: () => void;
  onRefresh: () => void;
}

export const ParticipantPreviewModal: React.FC<ParticipantPreviewModalProps> = ({
  contestState,
  teams,
  onClose,
  onRefresh
}) => {
  const { setPreviewTeamId, previewTeamId } = useAuth();
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || 'team-warriors');

  React.useEffect(() => {
    const initialId = teams[0]?.id || 'team-warriors';
    setSelectedTeamId(initialId);
    setPreviewTeamId(initialId);
    return () => {
      setPreviewTeamId(null);
    };
  }, []);

  const handleSelectTeam = (id: string) => {
    setSelectedTeamId(id);
    setPreviewTeamId(id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col p-4 sm:p-6 overflow-hidden animate-in fade-in duration-200">
      {/* Simulator Control Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 flex flex-wrap items-center justify-between gap-4 shadow-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Workstation Simulator
              <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] uppercase font-bold">
                Admin Preview Mode
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Live simulation of what participants see on their monitors for Stage: <strong className="text-white">{contestState.currentStage}</strong>
            </p>
          </div>
        </div>

        {/* Team Switcher */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Simulate As:
          </label>
          <select
            value={selectedTeamId}
            onChange={(e) => handleSelectTeam(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.team_code})
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setPreviewTeamId(null);
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close Simulator"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Embedded Participant Screen */}
      <div className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800/80 rounded-3xl p-6 shadow-inner relative">
        <ParticipantLayout contestState={contestState} onRefresh={onRefresh} />
      </div>
    </div>
  );
};
