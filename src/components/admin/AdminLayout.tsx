import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ContestState, Team } from '../../types/contest';
import { EventControlTab } from './EventControlTab';
import { TeamsTab } from './TeamsTab';
import { Round1AdminTab } from './Round1AdminTab';
import { Round2AdminTab } from './Round2AdminTab';
import { Round3AdminTab } from './Round3AdminTab';
import { Round4AdminTab } from './Round4AdminTab';
import { LeaderboardScoringTab } from './LeaderboardScoringTab';
import { QualificationTab } from './QualificationTab';
import { AnnouncementsTab } from './AnnouncementsTab';
import { AuditLogsTab } from './AuditLogsTab';
import { ParticipantPreviewModal } from './ParticipantPreviewModal';
import {
  Sliders,
  Users,
  Keyboard,
  BrainCircuit,
  Code2,
  KeyRound,
  Trophy,
  Award,
  Megaphone,
  Shield,
  Eye,
  RefreshCw
} from 'lucide-react';

interface AdminLayoutProps {
  contestState: ContestState;
  onRefresh: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ contestState, onRefresh }) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('EVENT_CONTROL');
  const [teams, setTeams] = useState<Team[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const fetchTeams = async () => {
    if (!token) return;
    try {
      const res = await api.getTeams(token);
      if (res.success) setTeams(res.teams);
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [token]);

  const navItems = [
    { id: 'EVENT_CONTROL', label: 'Event Steering', icon: <Sliders className="w-4 h-4" /> },
    { id: 'TEAMS', label: 'Teams & Workstations', icon: <Users className="w-4 h-4" /> },
    { id: 'ROUND_1', label: 'R1: Typing', icon: <Keyboard className="w-4 h-4" /> },
    { id: 'ROUND_2', label: 'R2: Tech Quiz', icon: <BrainCircuit className="w-4 h-4" /> },
    { id: 'ROUND_3', label: 'R3: Code Minimalist', icon: <Code2 className="w-4 h-4" /> },
    { id: 'ROUND_4', label: 'R4: Crack & Compete', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'LEADERBOARD', label: 'Leaderboard & Scoring', icon: <Trophy className="w-4 h-4" /> },
    { id: 'QUALIFICATION', label: 'Qualification Rules', icon: <Award className="w-4 h-4" /> },
    { id: 'ANNOUNCEMENTS', label: 'Live Broadcasts', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'AUDIT_LOGS', label: 'Audit Trail', icon: <Shield className="w-4 h-4" /> }
  ];

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'EVENT_CONTROL':
        return (
          <EventControlTab
            contestState={contestState}
            teams={teams}
            onOpenPreview={() => setShowPreviewModal(true)}
            onRefreshState={() => {
              fetchTeams();
              onRefresh();
            }}
            onRefresh={onRefresh}
          />
        );
      case 'TEAMS':
        return <TeamsTab teams={teams} onRefresh={() => { fetchTeams(); onRefresh(); }} />;
      case 'ROUND_1':
        return <Round1AdminTab contestState={contestState} onRefresh={onRefresh} />;
      case 'ROUND_2':
        return <Round2AdminTab contestState={contestState} onRefresh={onRefresh} />;
      case 'ROUND_3':
        return <Round3AdminTab contestState={contestState} onRefresh={onRefresh} />;
      case 'ROUND_4':
        return <Round4AdminTab contestState={contestState} teams={teams} onRefresh={onRefresh} />;
      case 'LEADERBOARD':
        return <LeaderboardScoringTab contestState={contestState} onRefresh={onRefresh} />;
      case 'QUALIFICATION':
        return <QualificationTab teams={teams} contestState={contestState} onRefresh={() => { fetchTeams(); onRefresh(); }} />;
      case 'ANNOUNCEMENTS':
        return <AnnouncementsTab />;
      case 'AUDIT_LOGS':
        return <AuditLogsTab />;
      default:
        return <EventControlTab contestState={contestState} onRefresh={onRefresh} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Admin Sub-bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-thin">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-500/20"
          >
            <Eye className="w-4 h-4 text-indigo-400" /> Simulate Participant Screen
          </button>

          <button
            onClick={() => {
              fetchTeams();
              onRefresh();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh All"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Tab View */}
      <div>{renderActiveTabContent()}</div>

      {/* Participant Screen Simulator Modal */}
      {showPreviewModal && (
        <ParticipantPreviewModal
          contestState={contestState}
          teams={teams}
          onClose={() => setShowPreviewModal(false)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
};
