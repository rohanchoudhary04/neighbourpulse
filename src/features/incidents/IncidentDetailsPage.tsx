import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Users, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquareWarning, 
  FileText,
  Share2,
  Calendar,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { incidentService } from '../../services/incidentService';
import { CategoryBadge, StatusBadge, VerificationBadge } from '../../components/ui/CategoryBadge';
import { Incident, IncidentUpdate } from '../../types';

export const IncidentDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [updates, setUpdates] = useState<IncidentUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Still an issue feedback modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      const data = await incidentService.getIncidentById(id);
      if (data) {
        setIncident(data.incident);
        setUpdates(data.updates);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = incidentService.subscribe(() => {
      loadData();
    });
    return unsubscribe;
  }, [id, user?.id]);

  const handleConfirm = async () => {
    if (!user || !incident) return;
    setConfirmError(null);
    setConfirming(true);

    try {
      await incidentService.confirmIncident(incident.id, user.id);
      await loadData();
    } catch (err: any) {
      setConfirmError(err.message || 'Could not corroborate issue.');
    } finally {
      setConfirming(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !incident || !feedbackNote.trim()) return;

    try {
      await incidentService.submitResolutionFeedback(incident.id, user.id, feedbackNote);
      setFeedbackSuccess(true);
      setTimeout(() => {
        setShowFeedbackModal(false);
        setFeedbackSuccess(false);
        setFeedbackNote('');
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit feedback.');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex-1 max-w-2xl mx-auto p-8 text-center">
        <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
        <h2 className="text-base font-bold text-slate-800">Incident not found</h2>
        <p className="text-xs text-slate-500 mt-1">This issue may have been removed or archived.</p>
        <Link to="/" className="mt-4 inline-block text-xs font-bold text-blue-600 hover:underline">
          Return to Live Map
        </Link>
      </div>
    );
  }

  const isReporter = user?.id === incident.reporterId;
  const isResolved = incident.status === 'resolved';

  return (
    <div className="flex-1 bg-slate-50 py-4 sm:py-6 px-4 sm:px-6 max-w-3xl mx-auto w-full">
      {/* Back Button & Actions */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <span className="text-[11px] font-mono text-slate-400">
          ID: {incident.id.slice(0, 12)}
        </span>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
        {/* Photo header if available */}
        {incident.photoUrl && (
          <div className="relative w-full h-64 sm:h-80 bg-slate-100 overflow-hidden">
            <img
              src={incident.photoUrl}
              alt={incident.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-xs">
              <span className="font-semibold bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full">
                Evidence Photo
              </span>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header Badges */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <CategoryBadge category={incident.category} size="md" />
              <StatusBadge status={incident.status} />
            </div>

            <VerificationBadge state={incident.verificationState} count={incident.confirmationCount} />
          </div>

          {/* Title & Metadata */}
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
              {incident.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="font-medium text-slate-700">{incident.locationLabel}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{new Date(incident.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-slate-400" />
                <span>Reported by <strong>{incident.reporterName}</strong></span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {incident.description}
            </p>
          </div>

          {/* CORROBORATION / CONFIRMATION SECTION */}
          <div className="p-4 rounded-2xl border border-blue-200/70 bg-blue-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-950">
                  {incident.confirmationCount} Community {incident.confirmationCount === 1 ? 'Corroboration' : 'Corroborations'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {incident.confirmationCount >= 3 
                  ? 'Corroborated by 3+ residents. Community confirmed status active.'
                  : `${3 - incident.confirmationCount} more corroborations needed for Community Confirmed state.`}
              </p>
            </div>

            {/* Confirmation Action Button */}
            {!isResolved ? (
              isReporter ? (
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                  You reported this issue
                </span>
              ) : incident.userHasConfirmed ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-3.5 py-1.5 rounded-xl border border-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Confirmed by you
                </span>
              ) : (
                <button
                  type="button"
                  disabled={confirming}
                  onClick={handleConfirm}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl shadow-xs transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {confirming ? 'Confirming...' : 'I see this too'}
                </button>
              )
            ) : (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                Issue is Resolved
              </span>
            )}
          </div>

          {confirmError && (
            <p className="text-xs text-rose-600 font-semibold">{confirmError}</p>
          )}

          {/* RESOLUTION EVIDENCE (If Resolved) */}
          {isResolved && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Resolution Information
                </span>
                {incident.resolvedAt && (
                  <span className="text-[11px] text-emerald-700">
                    Resolved {new Date(incident.resolvedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>

              {incident.resolutionNote && (
                <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900 mb-0.5">Admin Resolution Note:</p>
                  <p className="leading-relaxed">{incident.resolutionNote}</p>
                </div>
              )}

              {incident.resolutionPhotoUrl && (
                <div className="rounded-xl overflow-hidden border border-emerald-200 max-w-sm">
                  <img
                    src={incident.resolutionPhotoUrl}
                    alt="Resolution photo"
                    className="w-full h-40 object-cover"
                  />
                  <p className="p-1.5 bg-white text-[11px] text-slate-600 text-center font-medium">
                    Resolution completion evidence
                  </p>
                </div>
              )}

              {/* Still an issue button */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Problem returned or not fully fixed?
                </span>
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition-colors"
                >
                  <MessageSquareWarning className="w-3.5 h-3.5 text-amber-700" />
                  Still an issue
                </button>
              </div>
            </div>
          )}

          {/* STATUS TIMELINE & AUDIT TRAIL */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
              Status Timeline & Updates
            </h3>

            <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
              {updates.map((upd) => (
                <div key={upd.id} className="relative flex items-start gap-3 pl-1">
                  <div className="w-5 h-5 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center flex-shrink-0 z-10">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex-1 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span className="font-bold text-slate-800">{upd.actorName || 'Admin / Community'}</span>
                      <span>{new Date(upd.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {upd.note && <p className="text-slate-600 leading-relaxed">{upd.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* "Still an issue" Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquareWarning className="w-5 h-5 text-amber-600" />
              Report "Still an issue"
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Your feedback is sent directly to the community administrator for review rather than immediately reopening the ticket.
            </p>

            {feedbackSuccess ? (
              <div className="my-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Feedback submitted to administrator for review!</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="mt-4 space-y-3">
                <textarea
                  rows={3}
                  required
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  placeholder="Explain why the issue persists (e.g. water leak restarted after 2 hours)..."
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700"
                  >
                    Submit for Admin Review
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

