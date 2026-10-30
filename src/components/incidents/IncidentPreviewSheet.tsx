import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  MapPin, 
  Clock, 
  Users, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { Incident } from '../../types';
import { CategoryBadge, StatusBadge, VerificationBadge } from '../ui/CategoryBadge';

interface IncidentPreviewSheetProps {
  incident: Incident | null;
  onClose: () => void;
}

export const IncidentPreviewSheet: React.FC<IncidentPreviewSheetProps> = ({ incident, onClose }) => {
  const navigate = useNavigate();

  if (!incident) return null;

  const formatTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="fixed inset-x-0 bottom-16 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 z-40 p-4 pointer-events-none">
      <div className="pointer-events-auto bg-white rounded-2xl shadow-sheet sm:shadow-card border border-slate-200/90 p-4 animate-slide-up backdrop-blur-md">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge category={incident.category} />
            <StatusBadge status={incident.status} />
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <h3 className="mt-2 text-base font-bold text-slate-900 leading-snug line-clamp-2">
          {incident.title}
        </h3>

        {/* Location & Time metadata */}
        <div className="mt-2 space-y-1 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{incident.locationLabel}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{formatTimeAgo(incident.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1 text-blue-600 font-medium">
              <Users className="w-3.5 h-3.5" />
              <span>{incident.confirmationCount} corroborations</span>
            </div>
          </div>
        </div>

        {/* Verification badge */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <VerificationBadge state={incident.verificationState} count={incident.confirmationCount} />

          <button
            onClick={() => navigate(`/issues/${incident.id}`)}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-sm transition-colors"
          >
            View details
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

