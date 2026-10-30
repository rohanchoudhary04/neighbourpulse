import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';
import { DemoBanner } from './DemoBanner';
import { useAuth } from '../../features/auth/AuthContext';
import { incidentService } from '../../services/incidentService';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = async () => {
    if (!user) return;
    const notifs = await incidentService.getNotifications(user.id);
    const unread = notifs.filter((n) => !n.readAt).length;
    setUnreadCount(unread);
  };

  useEffect(() => {
    fetchUnread();
    const unsubscribe = incidentService.subscribe(() => {
      fetchUnread();
    });
    return unsubscribe;
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <DemoBanner />
      <Navbar unreadCount={unreadCount} />

      <main className="flex-1 pb-20 md:pb-8 flex flex-col">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
};

