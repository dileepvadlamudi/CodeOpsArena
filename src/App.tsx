import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useContestSocket } from './hooks/useContestSocket';
import { Header } from './components/common/Header';
import { LoginView } from './components/common/LoginView';
import { AnnouncementModal } from './components/common/AnnouncementModal';
import { AdminLayout } from './components/admin/AdminLayout';
import { ParticipantLayout } from './components/participant/ParticipantLayout';
import { api } from './services/api';

const ContestAppContent: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { contestState, isConnected, refreshState, setActiveAnnouncement } = useContestSocket({
    onForceLogout: (reason) => {
      logout(reason || 'Session ended: Only 1 device can login using one team ID at a time.');
    }
  });
  const [dismissedMap, setDismissedMap] = useState<Record<string, boolean>>({});

  if (!isAuthenticated || !user) {
    return <LoginView />;
  }

  const currentAnn = contestState.activeAnnouncement;
  const isDismissed = currentAnn ? Boolean(dismissedMap[currentAnn.id]) : false;

  const handleDismissAnnouncement = async () => {
    if (currentAnn) {
      setDismissedMap(prev => ({ ...prev, [currentAnn.id]: true }));
    }
    setActiveAnnouncement(null);

    if (user.role === 'admin' && user.token) {
      try {
        await api.dismissAnnouncement(user.token);
      } catch (err) {
        console.warn('Failed to broadcast dismissal to server:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#040605] text-[#f4f4f5] flex flex-col font-sans selection:bg-[#04D87D] selection:text-[#040605] relative blackops-grid">
      {/* Central Global Header */}
      <Header contestState={contestState} isConnected={isConnected} />

      {/* Live Broadcast Announcement Modal */}
      {currentAnn && !isDismissed && (
        <AnnouncementModal
          announcement={currentAnn}
          onDismiss={handleDismissAnnouncement}
          isAdmin={user.role === 'admin'}
        />
      )}

      {/* Main Role-Based Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {user.role === 'admin' ? (
          <AdminLayout contestState={contestState} onRefresh={refreshState} />
        ) : (
          <ParticipantLayout contestState={contestState} onRefresh={refreshState} />
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ContestAppContent />
    </AuthProvider>
  );
}
