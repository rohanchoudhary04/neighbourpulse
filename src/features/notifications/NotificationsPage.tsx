import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Clock, 
  ArrowRight, 
  AlertCircle, 
  Sparkles,
  Users,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { incidentService } from '../../services/incidentService';
import { NotificationItem } from '../../types';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const list = await incidentService.getNotifications(user.id);
      setNotifications(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const unsubscribe = incidentService.subscribe(() => {
      loadNotifications();
    });
    return unsubscribe;
  }, [user?.id]);

  const handleMarkOne = async (id: string, incidentId: string) => {
    await incidentService.markNotificationRead(id);
    navigate(`/issues/${incidentId}`);
  };

  const handleMarkAll = async () => {
    if (!user) return;
    await incidentService.markAllNotificationsRead(user.id);
    await loadNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="flex-1 bg-slate-50 py-4 sm:py-6 px-4 sm:px-6 max-w-3xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            Notifications
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Realtime updates for incidents you reported, confirmed, or manage.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-2.5">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
            <Bell className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No notifications yet</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              When neighbours corroborate your issues or admins update progress, notifications will arrive here.
            </p>
          </div>
        ) : (
          notifications.map((notif) => {
            const isUnread = !notif.readAt;

            return (
              <div
                key={notif.id}
                onClick={() => handleMarkOne(notif.id, notif.incidentId)}
                className={`cursor-pointer rounded-2xl border p-4 transition-all flex items-start gap-3 ${
                  isUnread
                    ? 'bg-blue-50/70 border-blue-200 shadow-2xs hover:bg-blue-50'
                    : 'bg-white border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-xl flex-shrink-0 ${
                  isUnread ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {notif.type === 'community_confirmed' ? (
                    <Users className="w-4 h-4" />
                  ) : notif.type === 'resolved' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <p className={`text-xs leading-relaxed ${isUnread ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(notif.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {isUnread && (
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0 mt-1"></span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

