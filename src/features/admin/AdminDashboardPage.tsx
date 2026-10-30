import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Filter, 
  RotateCcw, 
  FileText, 
  Search, 
  ArrowRight,
  Eye,
  Camera,
  MessageSquareWarning,
  Flame,
  Activity
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { incidentService } from '../../services/incidentService';
import { CategoryBadge, StatusBadge, VerificationBadge } from '../../components/ui/CategoryBadge';
import { HealthScoreResult, Incident, IncidentStatus, ResolutionFeedback } from '../../types';

export const AdminDashboardPage: React.FC = () => {
  const { user, isDemo, switchPersona } = useAuth();
  const navigate = useNavigate();
  const currentCommunity = incidentService.getCurrentCommunity();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [feedbackList, setFeedbackList] = useState<ResolutionFeedback[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScoreResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Action Modals
  const [resolvingIncident, setResolvingIncident] = useState<Incident | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionPhoto, setResolutionPhoto] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Reopen Feedback Modal
  const [reviewingFeedback, setReviewingFeedback] = useState<ResolutionFeedback | null>(null);
  const [reopenNote, setReopenNote] = useState('');

  const loadAdminData = async () => {
    try {
      const [list, score] = await Promise.all([
        incidentService.getIncidents(currentCommunity.id),
        incidentService.calculateHealthScore(currentCommunity.id),
      ]);
      setIncidents(list);
      setHealthScore(score);
      const fbs = window.localStorage.getItem('neighbourpulse_feedback_v1');
      setFeedbackList(fbs ? JSON.parse(fbs) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    const unsubscribe = incidentService.subscribe(() => {
      loadAdminData();
    });
    return unsubscribe;
  }, [currentCommunity.id]);

  // Authorization Check
  if (user?.role !== 'admin') {
    return (
      <div className="flex-1 max-w-lg mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Admin Authorization Required</h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          The admin dashboard is restricted to authorized community management. Public residents cannot modify operational tickets.
        </p>

        {isDemo && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 text-left">
            <p className="font-bold mb-1">Demo Evaluation:</p>
            <p className="text-[11px] mb-3 text-amber-800">
              Switch to Sarah Jenkins (Admin) to review, verify, resolve, and manage reports.
            </p>
            <button
              onClick={() => switchPersona('user-sarah')}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors"
            >
              Switch to Sarah Jenkins (Admin Persona)
            </button>
          </div>
        )}

        <div className="mt-6">
          <Link to="/" className="text-xs font-bold text-blue-600 hover:underline">
            Return to Live Map
          </Link>
        </div>
      </div>
    );
  }

  // Calculate Metrics
  const openCount = incidents.filter((i) => i.status === 'open').length;
  const inProgressCount = incidents.filter((i) => i.status === 'in_progress').length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length;
  const verifiedCount = incidents.filter((i) => i.adminVerified || i.confirmationCount >= 3).length;

  // Filter Table Incidents
  const filteredIncidents = incidents.filter((inc) => {
    if (categoryFilter !== 'all' && inc.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
    if (verificationFilter !== 'all' && inc.verificationState !== verificationFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!inc.title.toLowerCase().includes(q) && !inc.locationLabel.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Admin Actions
  const handleVerify = async (incidentId: string) => {
    if (!user) return;
    try {
      await incidentService.adminVerifyIncident(incidentId, user.id);
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    }
  };

  const handleSetInProgress = async (incidentId: string) => {
    if (!user) return;
    try {
      await incidentService.adminUpdateStatus(
        incidentId,
        'in_progress',
        user.id,
        'Admin designated ticket to operational maintenance queue.'
      );
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    }
  };

  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !resolvingIncident) return;
    setActionError(null);

    if (!resolutionNote.trim()) {
      setActionError('A resolution note is required before closing a ticket.');
      return;
    }

    try {
      await incidentService.adminUpdateStatus(
        resolvingIncident.id,
        'resolved',
        user.id,
        resolutionNote.trim(),
        resolutionPhoto.trim() || undefined
      );
      setResolvingIncident(null);
      setResolutionNote('');
      setResolutionPhoto('');
      await loadAdminData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to resolve incident');
    }
  };

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reviewingFeedback) return;

    try {
      await incidentService.adminReopenFromFeedback(
        reviewingFeedback.incidentId,
        reviewingFeedback.id,
        user.id,
        reopenNote.trim() || 'Reopened by administrator after reviewing resident feedback.'
      );
      setReviewingFeedback(null);
      setReopenNote('');
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to reopen incident');
    }
  };

  return (
    <div className="flex-1 bg-slate-50 py-4 sm:py-6 px-4 sm:px-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-600 text-white">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Community Administration Console
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Managing tickets and operational status for <strong className="text-slate-800">{currentCommunity.name}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
            Active Admin: {user?.displayName}
          </span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Open Incidents
          </span>
          <span className="text-2xl font-black text-rose-600">{openCount}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Verified / Confirmed
          </span>
          <span className="text-2xl font-black text-blue-600">{verifiedCount}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            In Progress
          </span>
          <span className="text-2xl font-black text-amber-600">{inProgressCount}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Resolved Tickets
          </span>
          <span className="text-2xl font-black text-emerald-600">{resolvedCount}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Health Score
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">
              {healthScore?.score !== null ? healthScore?.score : '--'}
            </span>
            <span className="text-xs text-slate-400 font-bold">/ 100</span>
            <span className="ml-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              {healthScore?.label}
            </span>
          </div>
        </div>
      </div>

      {/* "Still an issue" Review Queue (if any feedback pending) */}
      {feedbackList.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-3xl p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="w-5 h-5 text-amber-700" />
            <h3 className="text-sm font-bold text-amber-950">
              Resident "Still an issue" Feedback Review Queue ({feedbackList.filter((f) => f.reviewStatus === 'pending').length} Pending)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {feedbackList.map((fb) => {
              const relatedInc = incidents.find((i) => i.id === fb.incidentId);
              return (
                <div key={fb.id} className="bg-white p-3.5 rounded-2xl border border-amber-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 line-clamp-1">{relatedInc?.title || 'Resolved Issue'}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      fb.reviewStatus === 'reopened' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {fb.reviewStatus.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-600 italic bg-slate-50 p-2 rounded-xl">"{fb.note}"</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">By {fb.userName || 'Resident'}</span>
                    {fb.reviewStatus === 'pending' && (
                      <button
                        onClick={() => {
                          setReviewingFeedback(fb);
                          setReopenNote(`Reopened: ${fb.note}`);
                        }}
                        className="text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-lg"
                      >
                        Review & Reopen
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incident List / Table with Filters */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or landmark..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="water">Water</option>
              <option value="power">Power</option>
              <option value="road">Road</option>
              <option value="safety">Safety</option>
              <option value="garbage">Garbage</option>
              <option value="animals">Animals</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            {/* Verification Filter */}
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="all">All Verification</option>
              <option value="unverified">Unverified</option>
              <option value="community_confirmed">Community Confirmed</option>
              <option value="admin_verified">Admin Verified</option>
            </select>
          </div>
        </div>

        {/* Desktop Table Layout */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px] border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Priority / Age</th>
                <th className="py-3 px-4">Category & Title</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No matching incidents found in management console.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc) => {
                  const hoursOld = (Date.now() - new Date(inc.createdAt).getTime()) / 3600000;
                  const isPending48h = hoursOld > 48 && inc.status !== 'resolved';

                  return (
                    <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Priority Badges */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {inc.urgent && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              <Flame className="w-3 h-3 text-rose-600" />
                              Urgent
                            </span>
                          )}
                          {isPending48h && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              &gt;48h Pending
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            {Math.round(hoursOld)}h ago
                          </span>
                        </div>
                      </td>

                      {/* Category & Title */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="space-y-1">
                          <CategoryBadge category={inc.category} />
                          <Link
                            to={`/issues/${inc.id}`}
                            className="font-bold text-slate-900 hover:text-blue-600 line-clamp-1 block text-sm"
                          >
                            {inc.title}
                          </Link>
                          <span className="text-[11px] text-slate-400 block line-clamp-1">
                            By {inc.reporterName}
                          </span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-[180px] truncate">
                        {inc.locationLabel}
                      </td>

                      {/* Verification State */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <VerificationBadge state={inc.verificationState} count={inc.confirmationCount} />
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={inc.status} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Admin Verify Button */}
                          {!inc.adminVerified && inc.status !== 'resolved' && (
                            <button
                              onClick={() => handleVerify(inc.id)}
                              className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                              title="Officially verify this incident"
                            >
                              Verify
                            </button>
                          )}

                          {/* Move to In Progress */}
                          {inc.status === 'open' && (
                            <button
                              onClick={() => handleSetInProgress(inc.id)}
                              className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
                            >
                              Start Progress
                            </button>
                          )}

                          {/* Resolve Button */}
                          {inc.status !== 'resolved' && (
                            <button
                              onClick={() => {
                                setResolvingIncident(inc);
                                setResolutionNote('');
                                setResolutionPhoto('');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                            >
                              Resolve
                            </button>
                          )}

                          <Link
                            to={`/issues/${inc.id}`}
                            className="p-1 text-slate-400 hover:text-slate-600"
                            title="View Incident Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RESOLUTION MODAL (Mandatory resolution note) */}
      {resolvingIncident && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Close & Resolve Incident
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Closing ticket: <strong>"{resolvingIncident.title}"</strong>
              </p>
            </div>

            {actionError && (
              <p className="text-xs text-rose-600 font-semibold">{actionError}</p>
            )}

            <form onSubmit={handleConfirmResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Resolution Note * (Required)
                </label>
                <textarea
                  rows={3}
                  required
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Explain the maintenance work performed (e.g. Broken valve replaced by contractor; asphalt repaved and cured)..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Resolution Photo Evidence URL (Optional)
                </label>
                <input
                  type="url"
                  value={resolutionPhoto}
                  onChange={(e) => setResolutionPhoto(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolvingIncident(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  Confirm & Resolve Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REOPEN MODAL */}
      {reviewingFeedback && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Review & Reopen Ticket
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Resident note: <em>"{reviewingFeedback.note}"</em>
              </p>
            </div>

            <form onSubmit={handleReopen} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reopen Reason / Note
                </label>
                <textarea
                  rows={3}
                  required
                  value={reopenNote}
                  onChange={(e) => setReopenNote(e.target.value)}
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewingFeedback(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700"
                >
                  Reopen Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
