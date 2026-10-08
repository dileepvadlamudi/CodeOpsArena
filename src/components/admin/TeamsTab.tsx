import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Team, TeamCode } from '../../types/contest';
import {
  Users,
  Key,
  Plus,
  FileSpreadsheet,
  Trash2,
  Ban,
  Lock,
  Unlock,
  Edit2,
  LogOut,
  Sliders,
  Search,
  CheckCircle,
  Copy,
  Download,
  ShieldAlert,
  Radio,
  RefreshCw
} from 'lucide-react';

interface TeamsTabProps {
  teams?: Team[];
  onRefresh: () => void;
}

export const TeamsTab: React.FC<TeamsTabProps> = ({ teams = [], onRefresh }) => {
  const safeTeams = Array.isArray(teams) ? teams : [];
  const { token } = useAuth();
  const [subTab, setSubTab] = useState<'TEAMS' | 'CODES'>('TEAMS');

  // Codes state
  const [codes, setCodes] = useState<TeamCode[]>([]);
  const safeCodes = Array.isArray(codes) ? codes : [];
  const [generateCount, setGenerateCount] = useState<number>(5);
  const [csvText, setCsvText] = useState('');
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [codeFilter, setCodeFilter] = useState<'all' | 'unused' | 'claimed' | 'revoked'>('all');
  const [codeSearch, setCodeSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Teams state
  const [teamSearch, setTeamSearch] = useState('');
  const [teamStatusFilter, setTeamStatusFilter] = useState<string>('all');
  
  // Modals
  const [disqualifyTeam, setDisqualifyTeam] = useState<Team | null>(null);
  const [disqualifyReason, setDisqualifyReason] = useState('');
  
  const [renameTeam, setRenameTeam] = useState<Team | null>(null);
  const [newName, setNewName] = useState('');

  const [scoreOverrideTeam, setScoreOverrideTeam] = useState<Team | null>(null);
  const [overrideRound, setOverrideRound] = useState<'r1' | 'r2' | 'r3' | 'r4'>('r1');
  const [overrideScoreVal, setOverrideScoreVal] = useState<number>(0);

  const fetchCodes = async () => {
    if (!token) return;
    try {
      const res = await api.getTeamCodes(token);
      if (res.success) setCodes(res.codes);
    } catch (err) {
      console.error('Error fetching team codes:', err);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, [token]);

  const handleGenerateCodes = async () => {
    if (!token) return;
    try {
      await api.generateTeamCodes(token, generateCount);
      fetchCodes();
      onRefresh();
    } catch (err) {
      console.error('Error generating codes:', err);
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !csvText.trim()) return;
    try {
      await api.importTeamCodesCSV(token, csvText);
      setCsvText('');
      setShowCsvModal(false);
      fetchCodes();
      onRefresh();
    } catch (err) {
      console.error('Error importing CSV:', err);
    }
  };

  const handleRevokeCode = async (code: string) => {
    if (!token) return;
    try {
      await api.revokeTeamCode(token, code);
      fetchCodes();
    } catch (err) {
      console.error('Error revoking code:', err);
    }
  };

  const handleDeleteCode = async (code: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to permanently delete code ${code}?`)) return;
    try {
      await api.deleteTeamCode(token, code);
      fetchCodes();
    } catch (err) {
      console.error('Error deleting code:', err);
    }
  };

  const handleToggleLock = async (teamId: string) => {
    if (!token) return;
    try {
      await api.toggleTeamLock(token, teamId);
      onRefresh();
    } catch (err) {
      console.error('Error locking team:', err);
    }
  };

  const handleForceLogout = async (teamId: string) => {
    if (!token) return;
    if (!confirm('Force logout this team device session?')) return;
    try {
      await api.forceLogoutTeam(token, teamId);
      onRefresh();
    } catch (err) {
      console.error('Error logging out team:', err);
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    if (!token) return;
    const confirmed = confirm(
      `Permanently delete ${team.name} (${team.team_code})? This removes the player, all round scores, submissions, progress, and the leaderboard record. This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await api.deleteTeam(token, team.id);
      if (res.success) {
        onRefresh();
      } else {
        alert(res.message || 'Unable to delete the team.');
      }
    } catch (err) {
      console.error('Error deleting team:', err);
      alert('Unable to delete the team.');
    }
  };

  const handleConfirmDisqualify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !disqualifyTeam) return;
    try {
      await api.disqualifyTeam(token, disqualifyTeam.id, disqualifyReason, false);
      setDisqualifyTeam(null);
      setDisqualifyReason('');
      onRefresh();
    } catch (err) {
      console.error('Error disqualifying team:', err);
    }
  };

  const handleRestoreTeam = async (teamId: string) => {
    if (!token) return;
    try {
      await api.disqualifyTeam(token, teamId, '', true);
      onRefresh();
    } catch (err) {
      console.error('Error restoring team:', err);
    }
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !renameTeam || !newName.trim()) return;
    try {
      await api.renameTeam(token, renameTeam.id, newName.trim());
      setRenameTeam(null);
      setNewName('');
      onRefresh();
    } catch (err) {
      console.error('Error renaming team:', err);
    }
  };

  const handleConfirmScoreOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !scoreOverrideTeam) return;
    try {
      await api.overrideTeamScore(token, scoreOverrideTeam.id, overrideRound, overrideScoreVal);
      setScoreOverrideTeam(null);
      onRefresh();
    } catch (err) {
      console.error('Error overriding score:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const exportTeamsCsv = () => {
    const headers = ['Team ID', 'Team Code', 'Team Name', 'Status', 'Online', 'R1 Score', 'R2 Score', 'R3 Score', 'R4 Score', 'Total Score'];
    const rows = teams.map(t => [
      t.id,
      t.team_code,
      `"${t.name.replace(/"/g, '""')}"`,
      t.status,
      t.is_online ? 'Yes' : 'No',
      t.scores.r1,
      t.scores.r2,
      t.scores.r3,
      t.scores.r4,
      t.scores.total
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `codeops_teams_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered lists
  const filteredCodes = safeCodes.filter(c => {
    const matchStatus = codeFilter === 'all' || c.status === codeFilter;
    const matchSearch = c.code.toLowerCase().includes(codeSearch.toLowerCase()) ||
      (c.claimed_by_team_name && c.claimed_by_team_name.toLowerCase().includes(codeSearch.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const filteredTeams = safeTeams.filter(t => {
    const matchStatus = teamStatusFilter === 'all' || t.status === teamStatusFilter;
    const matchSearch = t.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
      t.team_code.toLowerCase().includes(teamSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  const unusedCount = safeCodes.filter(c => c.status === 'unused').length;
  const claimedCount = safeCodes.filter(c => c.status === 'claimed').length;
  const revokedCount = safeCodes.filter(c => c.status === 'revoked').length;

  return (
    <div className="space-y-6">
      {/* Sub-tabs header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setSubTab('TEAMS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'TEAMS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> All Active Teams ({safeTeams.length})
          </button>
          <button
            onClick={() => setSubTab('CODES')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'CODES'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" /> Team ID Credentials ({codes.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'TEAMS' && (
            <button
              onClick={exportTeamsCsv}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export Teams CSV
            </button>
          )}
          <button
            onClick={() => {
              onRefresh();
              fetchCodes();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {subTab === 'TEAMS' ? (
        /* ALL TEAMS MANAGEMENT */
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Search teams by name or code..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={teamStatusFilter}
                onChange={(e) => setTeamStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 w-full sm:w-auto"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="locked">Locked</option>
                <option value="disqualified">Disqualified</option>
              </select>
            </div>
          </div>

          {/* Teams Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4">Team</th>
                    <th className="py-3.5 px-4">Team Code</th>
                    <th className="py-3.5 px-4">Online</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">R1 (Type)</th>
                    <th className="py-3.5 px-4">R2 (Quiz)</th>
                    <th className="py-3.5 px-4">R3 (Minimalist)</th>
                    <th className="py-3.5 px-4">R4 (Crack)</th>
                    <th className="py-3.5 px-4">Total Score</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredTeams.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        No registered teams found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTeams.map((team) => (
                      <tr key={team.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-sm">{team.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{team.id}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-indigo-400 font-bold">
                          {team.team_code}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              team.is_online
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                                : 'bg-slate-950 text-slate-500 border border-slate-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                team.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                              }`}
                            />
                            {team.is_online ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              team.status === 'active'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                : team.status === 'locked'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            {team.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-200">{team.scores.r1}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-200">{team.scores.r2}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-200">{team.scores.r3}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-200">{team.scores.r4}</td>
                        <td className="py-3.5 px-4 font-mono font-black text-indigo-400 text-sm">{team.scores.total}</td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Rename */}
                            <button
                              onClick={() => {
                                setRenameTeam(team);
                                setNewName(team.name);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Rename Team"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Override Score */}
                            <button
                              onClick={() => {
                                setScoreOverrideTeam(team);
                                setOverrideScoreVal(team.scores.r1);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white transition-colors"
                              title="Override Score"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>

                            {/* Lock/Unlock */}
                            <button
                              onClick={() => handleToggleLock(team.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                team.status === 'locked'
                                  ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              }`}
                              title={team.status === 'locked' ? 'Unlock Team' : 'Lock Team'}
                            >
                              {team.status === 'locked' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>

                            {/* Disqualify / Restore */}
                            {team.status === 'disqualified' ? (
                              <button
                                onClick={() => handleRestoreTeam(team.id)}
                                className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 transition-colors"
                                title="Restore Team"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setDisqualifyTeam(team);
                                  setDisqualifyReason('');
                                }}
                                className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 transition-colors"
                                title="Disqualify Team"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Permanent Delete */}
                            <button
                              onClick={() => handleDeleteTeam(team)}
                              className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white transition-colors"
                              title="Permanently Delete Team & All Data"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Force Logout */}
                            <button
                              onClick={() => handleForceLogout(team.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
                              title="Force Logout Session"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* TEAM ID CREDENTIALS MANAGEMENT */
        <div className="space-y-6">
          {/* Stats & Generator Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stats card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-around text-center">
              <div>
                <p className="text-2xl font-black text-indigo-400">{codes.length}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Total Codes</p>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <p className="text-2xl font-black text-emerald-400">{unusedCount}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Unused</p>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <p className="text-2xl font-black text-amber-400">{claimedCount}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Claimed</p>
              </div>
            </div>

            {/* Quick Generator */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Generate Unique Team IDs</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Enforces CDX26-XXXXXX uniqueness.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={generateCount}
                  onChange={(e) => setGenerateCount(Math.max(1, Number(e.target.value)))}
                  className="w-16 px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white text-center font-bold"
                />
                <button
                  onClick={handleGenerateCodes}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Generate
                </button>
              </div>
            </div>

            {/* CSV Import */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Bulk CSV Import</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Paste list of custom Team IDs.</p>
              </div>
              <button
                onClick={() => setShowCsvModal(true)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Import CSV
              </button>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={codeSearch}
                onChange={(e) => setCodeSearch(e.target.value)}
                placeholder="Search team codes..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 uppercase"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['all', 'unused', 'claimed', 'revoked'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setCodeFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                    codeFilter === filter
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Codes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredCodes.map((tc) => (
              <div
                key={tc.code}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-base font-black text-white tracking-wider block">
                      {tc.code}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(tc.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      tc.status === 'unused'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : tc.status === 'claimed'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {tc.status}
                  </span>
                </div>

                {tc.claimed_by_team_name && (
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Claimed By Team</span>
                    <p className="text-xs font-bold text-indigo-300 truncate">{tc.claimed_by_team_name}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => copyToClipboard(tc.code)}
                    className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedCode === tc.code ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Code
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    {tc.status !== 'revoked' && (
                      <button
                        onClick={() => handleRevokeCode(tc.code)}
                        className="p-1 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                        title="Revoke Code"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCode(tc.code)}
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Delete Code"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              Import Team IDs from CSV
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Paste a list of Team IDs (one per line, or comma-separated).
            </p>

            <form onSubmit={handleImportCsv} className="space-y-4">
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"CDX26-A1B2C3\nCDX26-D4E5F6\nCDX26-G7H8J9"}
                rows={6}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                required
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500"
                >
                  Import Codes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISQUALIFY MODAL */}
      {disqualifyTeam && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-rose-300 flex items-center gap-2 mb-1">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Disqualify Team: {disqualifyTeam.name}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Disqualifying this team will immediately terminate their active session and lock submissions.
            </p>

            <form onSubmit={handleConfirmDisqualify} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Reason for Disqualification
                </label>
                <input
                  type="text"
                  value={disqualifyReason}
                  onChange={(e) => setDisqualifyReason(e.target.value)}
                  placeholder="e.g. Code plagiarism / unauthorized assistance"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDisqualifyTeam(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500"
                >
                  Confirm Disqualify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameTeam && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-white mb-4">Rename Team</h3>
            <form onSubmit={handleConfirmRename} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">New Team Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenameTeam(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500"
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERRIDE SCORE MODAL */}
      {scoreOverrideTeam && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-white mb-1">
              Override Score for {scoreOverrideTeam.name}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Directly override a round score for this team in disputes or manual reviews.
            </p>

            <form onSubmit={handleConfirmScoreOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Select Round</label>
                <select
                  value={overrideRound}
                  onChange={(e) => {
                    const r = e.target.value as 'r1' | 'r2' | 'r3' | 'r4';
                    setOverrideRound(r);
                    setOverrideScoreVal(scoreOverrideTeam.scores[r] || 0);
                  }}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="r1">Round 1: Fastest Fingers First (Current: {scoreOverrideTeam.scores.r1})</option>
                  <option value="r2">Round 2: Byte-Sized Brains (Current: {scoreOverrideTeam.scores.r2})</option>
                  <option value="r3">Round 3: Code Minimalist (Current: {scoreOverrideTeam.scores.r3})</option>
                  <option value="r4">Round 4: Crack & Compete (Current: {scoreOverrideTeam.scores.r4})</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">New Score</label>
                <input
                  type="number"
                  step="0.1"
                  value={overrideScoreVal}
                  onChange={(e) => setOverrideScoreVal(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setScoreOverrideTeam(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500"
                >
                  Save Score
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
