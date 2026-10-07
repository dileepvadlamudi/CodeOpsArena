import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Users,
  ArrowRight,
  Sparkles,
  Lock,
  Terminal,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Laptop,
  KeyRound,
  UserCheck,
  Building,
  RefreshCw
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginTeam, loginAdmin, verifyCode, joinTeam, error, clearError, setError } = useAuth();
  
  // Tab: 'join' | 'team-login' | 'admin'
  const [activeTab, setActiveTab] = useState<'join' | 'team-login' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/admin')) return 'admin';
      if (path.includes('/join')) return 'join';
    }
    return 'join';
  });

  // Join Flow State
  const [joinStep, setJoinStep] = useState<'ENTER_ID' | 'ENTER_NAME'>('ENTER_ID');
  const [joinTeamId, setJoinTeamId] = useState('');
  const [joinTeamName, setJoinTeamName] = useState('');
  const [verifiedCodeData, setVerifiedCodeData] = useState<string | null>(null);

  // Existing Team Login
  const [loginTeamCode, setLoginTeamCode] = useState('');

  // Admin Login
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [deviceConflict, setDeviceConflict] = useState<{ code: string; message: string } | null>(null);

  // Sync URL history state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const targetPath = activeTab === 'admin' ? '/admin' : activeTab === 'join' ? '/join' : '/';
      if (window.location.pathname !== targetPath) {
        window.history.replaceState(null, '', targetPath);
      }
    }
  }, [activeTab]);

  // Step 1: Verify registered Team ID
  const handleVerifyTeamId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinTeamId.trim()) return;

    clearError();
    setSuccessNotice(null);
    setIsLoading(true);

    try {
      const res = await verifyCode(joinTeamId.trim());
      if (res.success && res.code) {
        setVerifiedCodeData(res.code);
        setJoinStep('ENTER_NAME');
        setSuccessNotice('Team ID verified! Please enter your official Team Name to complete workstation onboarding.');
      }
    } catch (err: any) {
      console.error('Verify ID error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Set Team Name and create session
  const handleCompleteJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedCodeData || !joinTeamName.trim()) return;

    clearError();
    setIsLoading(true);

    try {
      const res = await joinTeam(verifiedCodeData, joinTeamName.trim());
      if (!res.success) {
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Join team error:', err);
      setIsLoading(false);
    }
  };

  // Existing Team Login
  const handleTeamLogin = async (e?: React.FormEvent, force: boolean = false) => {
    if (e) e.preventDefault();
    const targetCode = (force && deviceConflict ? deviceConflict.code : loginTeamCode).trim();
    if (!targetCode) return;

    clearError();
    setIsLoading(true);
    const res = await loginTeam(targetCode, undefined, force);
    setIsLoading(false);

    if (res.code === 'ALREADY_LOGGED_IN') {
      setDeviceConflict({
        code: targetCode,
        message: res.message || 'This team ID is currently logged in on another device. Only 1 device can login using one team ID at a time.'
      });
    } else if (res.success) {
      setDeviceConflict(null);
    }
  };

  // Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword.trim()) return;

    clearError();
    setIsLoading(true);
    await loginAdmin(adminUsername.trim(), adminPassword.trim());
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black p-4 sm:p-6 lg:p-8 relative blackops-grid">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-orange-600/10 rounded-full blur-3xl" />
      </div>

      {/* Top Header */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 flex items-center justify-center shadow-lg shadow-orange-950/60 text-black font-black border border-amber-400/40">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-extrabold text-white tracking-wider flex items-center gap-2 font-tactical">
              <span>CODEOPS</span>
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-500/40">
                BLACKOPS 2026
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">Tactical Contest Engine & Spec-Ops Team Access Terminal</p>
          </div>
        </div>

        {/* Quick Nav Switches */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              clearError();
              setSuccessNotice(null);
              setActiveTab(activeTab === 'admin' ? 'join' : 'admin');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer font-mono"
          >
            {activeTab === 'admin' ? (
              <>
                <Users className="w-3.5 h-3.5 text-amber-400" /> Participant Portal (/join)
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5 text-amber-400" /> Tactical Admin Console (/admin)
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container Card */}
      <main className="max-w-md w-full mx-auto my-auto py-8 relative z-10">
        <div className="bg-[#0b0e14]/95 border border-zinc-800/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 tactical-border">
          {/* Card Header */}
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-black border border-amber-500/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
              {activeTab === 'admin' ? (
                <Shield className="w-6 h-6 text-amber-400" />
              ) : activeTab === 'join' ? (
                <Sparkles className="w-6 h-6 text-amber-400" />
              ) : (
                <Users className="w-6 h-6 text-orange-400" />
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wider font-tactical">
              {activeTab === 'admin'
                ? 'TACTICAL ADMIN AUTHENTICATION'
                : activeTab === 'join'
                ? 'OPERATIVE ENLISTMENT (/join)'
                : 'OPERATIVE WORKSTATION LOGIN'}
            </h2>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto font-mono">
              {activeTab === 'admin'
                ? 'Central mission director, stage coordinator, tactical timers, and team orchestration.'
                : activeTab === 'join'
                ? 'Enter your classified Team ID to initialize your secure workstation terminal.'
                : 'Already registered your operative team? Enter your Team ID to reconnect.'}
            </p>
          </div>

          {/* Navigation Pills */}
          <div className="flex bg-black/80 p-1 rounded-2xl border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                clearError();
                setSuccessNotice(null);
                setActiveTab('join');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'join'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black font-extrabold shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Join (/join)
            </button>

            <button
              type="button"
              onClick={() => {
                clearError();
                setSuccessNotice(null);
                setActiveTab('team-login');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'team-login'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black font-extrabold shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Log In
            </button>

            <button
              type="button"
              onClick={() => {
                clearError();
                setSuccessNotice(null);
                setActiveTab('admin');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black font-extrabold shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Admin
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success / Info Notice */}
          {successNotice && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* TAB 1: JOIN CONTEST (/join) */}
          {activeTab === 'join' && (
            <div className="space-y-4">
              {joinStep === 'ENTER_ID' ? (
                <form onSubmit={handleVerifyTeamId} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center justify-between font-mono">
                      <span>Registered Operative Team ID</span>
                      <span className="text-[10px] font-mono text-amber-400">e.g. CDX26-B2V9N4</span>
                    </label>
                    <input
                      type="text"
                      value={joinTeamId}
                      onChange={(e) => setJoinTeamId(e.target.value.toUpperCase())}
                      placeholder="CDX26-A7K9P2"
                      className="w-full px-4 py-3 bg-black/80 border border-zinc-700/80 rounded-2xl text-white font-mono text-sm uppercase placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all tracking-wider"
                      required
                      autoFocus
                    />
                    <p className="text-[11px] text-zinc-400 mt-1.5 font-mono">
                      Each unique Team ID can only be claimed once to establish an authoritative tactical session.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold text-xs shadow-lg shadow-orange-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 font-mono tracking-wider"
                  >
                    {isLoading ? (
                      'Validating Team ID with Tactical Database...'
                    ) : (
                      <>
                        VERIFY OPERATIVE ID <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Name Entry */
                <form onSubmit={handleCompleteJoin} className="space-y-4 animate-in fade-in">
                  <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-300 block font-mono">
                        Verified Operative ID
                      </span>
                      <span className="font-mono text-sm font-black text-white">
                        {verifiedCodeData}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setJoinStep('ENTER_ID');
                        setVerifiedCodeData(null);
                        setSuccessNotice(null);
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-200 underline cursor-pointer font-mono"
                    >
                      Change ID
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5 font-mono">
                      Enter Official Operative Call-Sign / Team Name
                    </label>
                    <input
                      type="text"
                      value={joinTeamName}
                      onChange={(e) => setJoinTeamName(e.target.value)}
                      placeholder="e.g. Cyber Strike"
                      className="w-full px-4 py-3 bg-black/80 border border-zinc-700/80 rounded-2xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                      required
                      autoFocus
                    />
                    <p className="text-[11px] text-zinc-400 mt-1.5 font-mono">
                      This call-sign will be displayed across the live Blackops leaderboard and command briefings.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-extrabold text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 font-mono tracking-wider"
                  >
                    {isLoading ? (
                      'Creating Tactical Workstation...'
                    ) : (
                      <>
                        ENTER TACTICAL STAGING LOBBY <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: EXISTING TEAM LOGIN */}
          {activeTab === 'team-login' && (
            <div className="space-y-4">
              {/* Active Device Session Conflict Modal / Card */}
              {deviceConflict && (
                <div className="p-4 bg-amber-950/40 border border-amber-500/60 rounded-2xl space-y-3 animate-in fade-in text-left">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
                        Active Device Session Detected
                      </h4>
                      <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed font-mono">
                        Team <span className="text-white font-bold">{deviceConflict.code}</span> is currently logged in on another device.
                        In accordance with CodeOps fair-play regulations, <strong className="text-amber-300">only 1 device is allowed per team at a time</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleTeamLogin(undefined, true)}
                      className="flex-1 py-2.5 px-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-mono shadow-md shadow-orange-950/50 disabled:opacity-50"
                    >
                      <Laptop className="w-3.5 h-3.5" />
                      {isLoading ? 'Taking over session...' : 'TERMINATE OTHER SESSION & LOG IN HERE'}
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        setDeviceConflict(null);
                        clearError();
                      }}
                      className="py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer font-mono text-center"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={(e) => handleTeamLogin(e, false)} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5 font-mono">
                    Your Operative Team Code or ID
                  </label>
                  <input
                    type="text"
                    value={loginTeamCode}
                    onChange={(e) => {
                      setLoginTeamCode(e.target.value.toUpperCase());
                      if (deviceConflict) setDeviceConflict(null);
                    }}
                    placeholder="CDX26-A7K9P2"
                    className="w-full px-4 py-3 bg-black/80 border border-zinc-700/80 rounded-2xl text-white font-mono text-sm uppercase placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all tracking-wider"
                    required
                    autoFocus
                  />
                  <p className="text-[11px] text-zinc-400 mt-1.5 font-mono flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Single-device lock: Exactly 1 active device allowed per team ID.</span>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold text-xs shadow-lg shadow-orange-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 font-mono tracking-wider"
                >
                  {isLoading ? (
                    'Authenticating...'
                  ) : (
                    <>
                      LOG IN TO WORKSTATION <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: ADMIN CONSOLE */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1 font-mono">Tactical Admin ID</label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Enter administrator ID"
                  className="w-full px-4 py-3 bg-black/80 border border-zinc-700/80 rounded-2xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1 font-mono">Clearance Passcode</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter clearance password"
                  className="w-full px-4 py-3 bg-black/80 border border-zinc-700/80 rounded-2xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold text-xs shadow-lg shadow-orange-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 font-mono tracking-wider"
              >
                {isLoading ? (
                  'Authenticating...'
                ) : (
                  <>
                    ENTER TACTICAL ADMIN DECK <Shield className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-3xl w-full mx-auto relative z-10 pt-2 text-center text-xs text-zinc-400 font-mono">
        <p>CODEOPS Central Command Server Engine • Authoritative State Synchronization via WebSockets</p>
      </footer>
    </div>
  );
};
