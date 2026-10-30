import React from 'react';
import { 
  Droplets, 
  Zap, 
  Construction, 
  ShieldAlert, 
  Trash2, 
  HeartHandshake,
  CheckCircle2,
  Clock,
  AlertCircle,
  LucideIcon
} from 'lucide-react';
import { IncidentCategory, IncidentStatus, VerificationState } from '../../types';

export const CATEGORY_CONFIG: Record<
  IncidentCategory, 
  { label: string; icon: LucideIcon; color: string; bg: string; border: string; ring: string }
> = {
  water: {
    label: 'Water',
    icon: Droplets,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    ring: 'ring-blue-500',
  },
  power: {
    label: 'Power',
    icon: Zap,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    ring: 'ring-amber-500',
  },
  road: {
    label: 'Road',
    icon: Construction,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    ring: 'ring-orange-500',
  },
  safety: {
    label: 'Safety',
    icon: ShieldAlert,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    ring: 'ring-rose-500',
  },
  garbage: {
    label: 'Garbage',
    icon: Trash2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    ring: 'ring-emerald-500',
  },
  animals: {
    label: 'Animals',
    icon: HeartHandshake,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    ring: 'ring-purple-500',
  },
};

export const CategoryIcon: React.FC<{ category: IncidentCategory; className?: string }> = ({ category, className = 'w-4 h-4' }) => {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.water;
  const Icon = config.icon;
  return <Icon className={`${config.color} ${className}`} />;
};

export const CategoryBadge: React.FC<{ category: IncidentCategory; size?: 'sm' | 'md' }> = ({ category, size = 'sm' }) => {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.water;
  const Icon = config.icon;

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.color} ${config.border}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold border ${config.bg} ${config.color} ${config.border}`}>
      <Icon className="w-4 h-4" />
      {config.label}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: IncidentStatus }> = ({ status }) => {
  switch (status) {
    case 'open':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3.5 h-3.5" />
          Open
        </span>
      );
    case 'in_progress':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3.5 h-3.5 animate-spin-slow" />
          In Progress
        </span>
      );
    case 'resolved':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Resolved
        </span>
      );
  }
};

export const VerificationBadge: React.FC<{ state: VerificationState; count?: number }> = ({ state, count = 0 }) => {
  switch (state) {
    case 'admin_verified':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
          Admin Verified
        </span>
      );
    case 'community_confirmed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200" title="Corroborated by 3+ residents">
          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
          Community Confirmed ({count})
        </span>
      );
    case 'unverified':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          Unverified ({count}/3)
        </span>
      );
  }
};

