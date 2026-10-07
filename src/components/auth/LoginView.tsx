import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Users,
  KeyRound,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Code2,
  Terminal,
  Cpu,
  Zap
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { verifyCode, joinTeam, loginAdmin } = useAuth();

  // Mode: 'TEAM' or 'ADMIN'
  const [activeTab, setActiveTab] = useState<'TEAM' | 'ADMIN'>('TEAM');

  // Team Registration & Join state
  const [teamCodeInput, setTeamCodeInput] = useState('');
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Admin login state
  const [adminPassword, setAdminPassword] = useState('');

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamCodeInput.trim()) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await verifyCode(teamCodeInput.trim());
      if (res.success && res.code) {
        setVerifiedCode(res.code);
        setSuccessMsg('Team ID verified! Please enter your Team Name to join.');
      } else {
        setErrorMsg(res.message || 'Invalid Team ID. This team is not registered.');
        setVerifiedCode(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedCode || !teamNameInput.trim()) return;

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await joinTeam(verifiedCode, teamNameInput.trim());
      if (!res.success) {
        setErrorMsg(res.message || 'Could not join contest.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to claim team ID.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword) return;

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await loginAdmin(adminPassword);
      if (!res.success) {
        setErrorMsg(res.message || 'Invalid administrator password.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login error');
    } finally {
      setIsLoading(false);
    }
  };

  const quickFillCode = (code: string) => {
    setTeamCodeInput(code);
    setVerifiedCode(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#07090e] flex flex-col justify-center items-center px-4 sm:px-6 py-12 relative overflow-hidden blackops-grid">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="max-w-md w-full relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 shadow-xl shadow-orange-950/40 mb-4 border border-amber-400/30 text-black">
            <Code2 className="w-8 h-8" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-wider flex items-center justify-center gap-2 font-tactical">
            CODEOPS <span className="text-amber-400 font-mono text-xl font-black bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded">BLACKOPS</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-1.5 font-mono">
            Tactical Multi-Round Cyber Operations Competition
          </p>
        </div>

        {/* Tab switch */}
        <div className="bg-black/80 p-1 rounded-xl border border-zinc-800 flex gap-1 mb-6 shadow-inner font-mono">
          <button
            type="button"
            onClick={() => {
              setActiveTab('TEAM');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'TEAM'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black font-extrabold shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Operative Team Login
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('ADMIN');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'ADMIN'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black font-extrabold shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Tactical Admin Access
          </button>
        </div>

        {/* Card Body */}
        <div className="bg-[#0b0e14]/95 border border-zinc-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm tactical-border">
          {/* Error Message */}
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{successMsg}</span>
            </div>
          )}

          {activeTab === 'TEAM' ? (
            /* TEAM LOGIN FLOW */
            <div>
              {!verifiedCode ? (
                /* Step 1: Enter Team ID */
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 font-mono">
                      Enter Operative Team ID
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={teamCodeInput}
                        onChange={(e) => setTeamCodeInput(e.target.value.toUpperCase())}
                        placeholder="e.g. CDX26-B2V9N4"
                        className="w-full px-4 py-3 bg-black/80 border border-zinc-700 rounded-xl text-white font-mono text-base tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all uppercase"
                        autoFocus
                      />
                      <KeyRound className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-2 font-mono">
                      Use the unique Operative Team ID provided by tactical command.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !teamCodeInput.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-black font-extrabold text-sm transition-all shadow-lg shadow-orange-950/40 flex items-center justify-center gap-2 cursor-pointer font-mono tracking-wider"
                  >
                    {isLoading ? 'Verifying...' : 'VERIFY OPERATIVE ID'}
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Pre-seeded demo codes helper */}
                  <div className="mt-6 pt-5 border-t border-zinc-800">
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Classified Test Credentials:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {['CDX26-B2V9N4', 'CDX26-K4R1W8', 'CDX26-M9P3Z6'].map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => quickFillCode(code)}
                          className="px-2.5 py-1 rounded-lg bg-black/80 border border-zinc-800 text-[11px] font-mono text-amber-300 hover:border-amber-500 hover:text-white transition-colors"
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              ) : (
                /* Step 2: Choose Team Name & Join */
                <form onSubmit={handleJoinContest} className="space-y-4 animate-in fade-in">
                  <div className="p-3 bg-black/80 rounded-xl border border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono">Verified Operative ID</span>
                      <p className="text-sm font-mono font-bold text-amber-400">{verifiedCode}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifiedCode(null);
                        setErrorMsg(null);
                      }}
                      className="text-xs text-zinc-400 hover:text-rose-400 transition-colors underline font-mono"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 font-mono">
                      Operative Call-Sign / Team Name
                    </label>
                    <input
                      type="text"
                      value={teamNameInput}
                      onChange={(e) => setTeamNameInput(e.target.value)}
                      placeholder="e.g. Shadow Squad, Apex Operatives"
                      maxLength={40}
                      className="w-full px-4 py-3 bg-black/80 border border-zinc-700 rounded-xl text-white font-medium text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                      autoFocus
                    />
                    <p className="text-[11px] text-zinc-400 mt-2 font-mono">
                      This call-sign will be visible on the live tactical leaderboard.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !teamNameInput.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-black font-extrabold text-sm transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer font-mono tracking-wider"
                  >
                    {isLoading ? 'Joining Mission...' : 'INITIALIZE WORKSTATION'}
                    <Sparkles className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* ADMIN ACCESS */
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 font-mono">
                  Tactical Clearance Passcode
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter clearance passcode"
                    className="w-full px-4 py-3 bg-black/80 border border-zinc-700 rounded-xl text-white font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                    autoFocus
                  />
                  <Shield className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[11px] text-zinc-400 mt-2 font-mono">
                  Administrator control center for tactical stage steering and scoring operations.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !adminPassword}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-black font-extrabold text-sm transition-all shadow-lg shadow-orange-950/40 flex items-center justify-center gap-2 cursor-pointer font-mono tracking-wider"
              >
                {isLoading ? 'Authenticating...' : 'ENTER TACTICAL COMMAND'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setAdminPassword('codex2026admin')}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors underline font-mono"
                >
                  Fill Default Admin Key (codex2026admin)
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-slate-500 flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Real-time Sync
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" /> Multi-Round Engine
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Sandbox Isolation
          </span>
        </div>
      </div>
    </div>
  );
};
