import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Team } from '../types/contest';

export interface AuthUser {
  id?: string;
  name?: string;
  role: 'admin' | 'team';
  teamCode?: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  role: 'ADMIN' | 'TEAM' | 'admin' | 'team' | null;
  team: Team | null;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  setError: (err: string | null) => void;
  loginAdmin: (passwordOrUsername: string, passwordOptional?: string) => Promise<{ success: boolean; message?: string }>;
  loginTeam: (teamCode: string, accessKey?: string, forceLogin?: boolean) => Promise<{ success: boolean; code?: string; message?: string }>;
  verifyCode: (code: string) => Promise<{ success: boolean; code?: string; message?: string }>;
  joinTeam: (code: string, teamName: string) => Promise<{ success: boolean; message?: string }>;
  logout: (reason?: string) => void;
  updateTeamProfile: (updated: Team) => void;
  previewTeamId: string | null;
  setPreviewTeamId: (teamId: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_TOKEN = 'codex_auth_token';
const STORAGE_KEY_ROLE = 'codex_auth_role';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_TOKEN));
  const [role, setRole] = useState<'ADMIN' | 'TEAM' | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ROLE);
    return saved === 'ADMIN' || saved === 'TEAM' ? saved : null;
  });
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [previewTeamId, setPreviewTeamId] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchCurrentProfile = useCallback(async (activeToken: string) => {
    try {
      setIsLoading(true);
      const res = await api.getMe(activeToken);
      if (res.success) {
        setRole(res.role);
        if (res.role === 'TEAM' && res.team) {
          setTeam(res.team);
        }
      } else {
        // Expired
        setToken(null);
        setRole(null);
        setTeam(null);
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_ROLE);
      }
    } catch (err) {
      console.error('Error fetching auth profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchCurrentProfile(token);
    } else {
      setIsLoading(false);
    }
  }, [token, fetchCurrentProfile]);

  const loginAdmin = async (passwordOrUsername: string, passwordOptional?: string) => {
    clearError();
    try {
      // Support both loginAdmin(password) and loginAdmin(username, password)
      const password = passwordOptional !== undefined ? passwordOptional : passwordOrUsername;
      const username = passwordOptional !== undefined ? passwordOrUsername : 'admin';

      const res = await api.adminLogin(password, username);
      if (res.success && res.token) {
        setToken(res.token);
        setRole('ADMIN');
        setTeam(null);
        localStorage.setItem(STORAGE_KEY_TOKEN, res.token);
        localStorage.setItem(STORAGE_KEY_ROLE, 'ADMIN');
        return { success: true };
      }
      const msg = res.message || 'Invalid administrator credentials.';
      setError(msg);
      return { success: false, message: msg };
    } catch (err: any) {
      const msg = err.message || 'Server connection error';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  const loginTeam = async (teamCode: string, accessKey?: string, forceLogin?: boolean) => {
    clearError();
    try {
      const res = await api.teamLogin(teamCode, accessKey, forceLogin);
      if (res.success && res.token) {
        setToken(res.token);
        setRole('TEAM');
        setTeam(res.team);
        localStorage.setItem(STORAGE_KEY_TOKEN, res.token);
        localStorage.setItem(STORAGE_KEY_ROLE, 'TEAM');
        return { success: true };
      }
      const msg = res.message || 'Could not authenticate team code.';
      if (res.code === 'ALREADY_LOGGED_IN') {
        return { success: false, code: 'ALREADY_LOGGED_IN', message: msg };
      }
      setError(msg);
      return { success: false, message: msg };
    } catch (err: any) {
      const msg = err.message || 'Server connection error';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  const verifyCode = async (code: string) => {
    clearError();
    try {
      const res = await api.verifyTeamCode(code);
      if (!res.success) {
        setError(res.message || 'Verification error');
      }
      return res;
    } catch (err: any) {
      const msg = err.message || 'Verification error';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  const joinTeam = async (code: string, teamName: string) => {
    clearError();
    try {
      const res = await api.joinTeam(code, teamName);
      if (res.success && res.token) {
        setToken(res.token);
        setRole('TEAM');
        setTeam(res.team);
        localStorage.setItem(STORAGE_KEY_TOKEN, res.token);
        localStorage.setItem(STORAGE_KEY_ROLE, 'TEAM');
        return { success: true };
      }
      const msg = res.message || 'Could not claim team code';
      setError(msg);
      return { success: false, message: msg };
    } catch (err: any) {
      const msg = err.message || 'Failed to join contest';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  const logout = (reason?: string) => {
    if (token) {
      api.logout(token).catch((err) => console.warn('Logout API error:', err));
    }
    setToken(null);
    setRole(null);
    setTeam(null);
    setPreviewTeamId(null);
    clearError();
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_ROLE);
    if (reason) {
      setError(reason);
    }
  };

  const updateTeamProfile = (updated: Team) => {
    setTeam(updated);
  };

  // Derive user and isAuthenticated
  const isAuthenticated = !!token && !!role;
  const user: AuthUser | null = isAuthenticated
    ? {
        id: role === 'ADMIN' ? 'admin' : team?.id || 'team',
        name: role === 'ADMIN' ? 'Contest Administrator' : team?.name || 'Contestant Team',
        role: role === 'ADMIN' ? 'admin' : 'team',
        teamCode: team?.team_code
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        token,
        role,
        team,
        isLoading,
        error,
        clearError,
        setError,
        loginAdmin,
        loginTeam,
        verifyCode,
        joinTeam,
        logout,
        updateTeamProfile,
        previewTeamId,
        setPreviewTeamId
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
