import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AuditLog } from '../../types/contest';
import { Shield, Search, RefreshCw, Clock } from 'lucide-react';

export const AuditLogsTab: React.FC = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    if (!token) return;
    try {
      const res = await api.getAuditLogs(token);
      if (res.success) setLogs(res.logs);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token]);

  const safeLogs = Array.isArray(logs) ? logs : [];
  const filteredLogs = safeLogs.filter((l) => {
    if (!l) return false;
    const match =
      (l.action || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.adminUser || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.targetEntity || '').toLowerCase().includes(search.toLowerCase());
    return match;
  });

  return (
    <div className="space-y-4">
      {/* Search and Refresh */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail by action or target..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          onClick={fetchLogs}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Logs
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Admin User</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Details / Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans text-xs">
                    No audit records recorded yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 font-medium">
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString()} • {new Date(log.timestamp).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-indigo-400 font-bold">{log.adminUser}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-950 text-white border border-slate-800 text-[10px] font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-amber-300">{log.targetEntity}</td>
                    <td className="py-3 px-4 text-slate-300 truncate max-w-md">
                      {log.details ? (
                        <span>{JSON.stringify(log.details)}</span>
                      ) : log.previousValue || log.newValue ? (
                        <span>
                          {log.previousValue ? `${JSON.stringify(log.previousValue)} ➔ ` : ''}
                          {JSON.stringify(log.newValue)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
