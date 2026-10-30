import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FileText, 
  Users, 
  Clock, 
  MapPin, 
  PlusCircle, 
  ChevronRight, 
  Info
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { incidentService } from '../../services/incidentService';
import { CategoryBadge, StatusBadge, VerificationBadge } from '../../components/ui/CategoryBadge';
import { Incident } from '../../types';

export const MyReportsPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'submitted' | 'following'>('submitted');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [submittedList, setSubmittedList] = useState<Incident[]>([]);
  const [followingList, setFollowingList] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [submitted, following] = await Promise.all([
        incidentService.getMySubmittedIncidents(user.id),
        incidentService.getMyFollowingIncidents(user.id),
      ]);
      setSubmittedList(submitted);
      setFollowingList(following);
    } catch (err) {
      console.error('Error loading my reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    loadData();
    const unsubscribe = incidentService.subscribe(() => {
      loadData();
    });
    return unsubscribe;
  }, [user?.id, authLoading]);

  const currentList = activeTab === 'submitted' ? submittedList : followingList;
  const filteredList = statusFilter === 'all' 
    ? currentList 
    : currentList.filter((i) => i.status === statusFilter);

  return (
    <div className="flex-1 bg-slate-50 py-4 sm:py-6 px-4 sm:px-6 max-w-4xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            My Reports & Followed Issues
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Logged in as <strong className="text-slate-800">{user?.displayName}</strong> ({user?.email})
          </p>
        </div>

        <Link
          to="/report"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-2 rounded-xl shadow-xs transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Report Issue</span>
        </Link>
      </div>

      {/* Auto-follow note explanation */}
      <div className="mb-4 p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          <strong>Report Ownership & Following:</strong> Incidents reported by you are tracked under <strong>"Submitted by me"</strong>. Since authors automatically follow their own reports to receive real-time resolution updates, your reports will also appear under <strong>"Following / Confirmed"</strong>. Following never replaces your ownership.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-4 pb-2">
        <button
          onClick={() => setActiveTab('submitted')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'submitted'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Submitted by me ({submittedList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('following')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'following'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Following / Confirmed ({followingList.length})</span>
        </button>
      </div>

      {/* Filter by Status */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto no-scrollbar">
        {['all', 'open', 'in_progress', 'resolved'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
              statusFilter === st
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {st === 'all' ? `All (${currentList.length})` : `${st.replace('_', ' ')} (${currentList.filter(i => i.status === st).length})`}
          </button>
        ))}
      </div>

      {/* Cards List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Loading your reports...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {activeTab === 'submitted' ? 'No reports submitted yet' : 'Not following any issues yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeTab === 'submitted'
                ? 'Notice a broken streetlight, water leakage, or road pothole? Report an issue to notify your community administrators.'
                : 'When you corroborate an existing incident with "I see this too", you automatically follow it to receive status notifications.'}
            </p>
            <div className="pt-2">
              <Link
                to={activeTab === 'submitted' ? '/report' : '/'}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
              >
                {activeTab === 'submitted' ? 'Report a new issue' : 'Explore nearby incidents on map'}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          filteredList.map((inc) => (
            <div
              key={inc.id}
              onClick={() => navigate(`/issues/${inc.id}`)}
              className="cursor-pointer bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs hover:shadow-card hover:border-blue-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CategoryBadge category={inc.category} />
                  <StatusBadge status={inc.status} />
                  <VerificationBadge state={inc.verificationState} count={inc.confirmationCount} />
                </div>

                <h3 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-1">
                  {inc.title}
                </h3>

                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1 truncate max-w-[200px]">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{inc.locationLabel}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(inc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    Author: {inc.reporterName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {inc.confirmationCount} corroborations
                </span>

                <button
                  type="button"
                  className="p-1.5 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
