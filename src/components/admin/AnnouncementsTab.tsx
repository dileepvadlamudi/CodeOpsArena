import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Announcement } from '../../types/contest';
import { Megaphone, Trash2, CheckCircle2, AlertTriangle, Info, BellOff } from 'lucide-react';

export const AnnouncementsTab: React.FC = () => {
  const { token } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'urgent'>('info');

  const fetchAnnouncements = async () => {
    if (!token) return;
    try {
      const res = await api.getAnnouncements(token);
      if (res.success) setAnnouncements(res.announcements);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [token]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !title.trim() || !message.trim()) return;

    try {
      await api.createAnnouncement(token, {
        title: title.trim(),
        message: message.trim(),
        type,
        target: 'all'
      });
      setTitle('');
      setMessage('');
      fetchAnnouncements();
    } catch (err) {
      console.error('Error creating announcement:', err);
    }
  };

  const handleDismissActive = async () => {
    if (!token) return;
    try {
      await api.dismissAnnouncement(token);
      fetchAnnouncements();
    } catch (err) {
      console.error('Error dismissing announcement:', err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Creator Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-fit">
        <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-indigo-400" />
          Broadcast Live Announcement
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Broadcast high-priority modal notifications across all connected participant screens simultaneously.
        </p>

        <form onSubmit={handleCreateAnnouncement} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Priority Type</label>
            <div className="flex gap-2">
              {(['info', 'warning', 'urgent'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize border cursor-pointer ${
                    type === t
                      ? t === 'urgent'
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : t === 'warning'
                        ? 'bg-amber-600 border-amber-500 text-white'
                        : 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Announcement Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Schedule Update"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Detailed Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Round 3 Code Minimalist starts in 5 minutes. No external IDEs allowed."
              rows={4}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Megaphone className="w-4 h-4" /> Send Live Broadcast
          </button>
        </form>
      </div>

      {/* Announcements Log & Active Dismissal */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div>
            <h4 className="text-sm font-bold text-white">Broadcast History</h4>
            <p className="text-xs text-slate-400">All announcements sent during the event.</p>
          </div>
          <button
            onClick={handleDismissActive}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:border-rose-800 border border-transparent text-slate-300 hover:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BellOff className="w-3.5 h-3.5" /> Dismiss Active Announcement
          </button>
        </div>

        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-500 text-xs">
              No announcements broadcasted yet.
            </div>
          ) : (
            announcements.map((a) => (
              <div
                key={a.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between gap-2 ${
                  a.isActive
                    ? 'bg-slate-900 border-indigo-500/80 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-950 border-slate-850 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        a.type === 'urgent'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : a.type === 'warning'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                      }`}
                    >
                      {a.type}
                    </span>
                    <span className="text-xs font-bold text-white">{a.title}</span>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(a.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-medium">
                  {a.message}
                </p>

                {a.isActive && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-emerald-400 font-bold">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active on Team Screens
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
