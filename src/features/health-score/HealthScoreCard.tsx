import React, { useState } from 'react';
import { 
  Activity, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  AlertTriangle, 
  Info,
  CheckCircle2
} from 'lucide-react';
import { HealthScoreResult } from '../../types';

interface HealthScoreCardProps {
  scoreData: HealthScoreResult;
  className?: string;
}

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({ scoreData, className = '' }) => {
  const [expanded, setExpanded] = useState(false);

  const getScoreTheme = () => {
    if (scoreData.score === null) {
      return {
        text: 'text-slate-600',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        badgeBg: 'bg-slate-100 text-slate-700',
        progressBg: 'bg-slate-300',
      };
    }
    if (scoreData.score >= 80) {
      return {
        text: 'text-emerald-700',
        bg: 'bg-emerald-50/70',
        border: 'border-emerald-200',
        badgeBg: 'bg-emerald-100 text-emerald-800',
        progressBg: 'bg-emerald-500',
      };
    }
    if (scoreData.score >= 50) {
      return {
        text: 'text-amber-700',
        bg: 'bg-amber-50/70',
        border: 'border-amber-200',
        badgeBg: 'bg-amber-100 text-amber-800',
        progressBg: 'bg-amber-500',
      };
    }
    return {
      text: 'text-rose-700',
      bg: 'bg-rose-50/70',
      border: 'border-rose-200',
      badgeBg: 'bg-rose-100 text-rose-800',
      progressBg: 'bg-rose-500',
    };
  };

  const theme = getScoreTheme();

  return (
    <div className={`bg-white rounded-2xl border ${theme.border} p-4 shadow-sm transition-all duration-200 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${theme.bg}`}>
            <Activity className={`w-5 h-5 ${theme.text}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Community Health Score
              </span>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label="How is this score calculated?"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              {scoreData.score !== null ? (
                <>
                  <span className={`text-3xl font-extrabold tracking-tight ${theme.text}`}>
                    {scoreData.score}
                  </span>
                  <span className="text-sm font-medium text-slate-400">/ 100</span>
                  <span className={`ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full ${theme.badgeBg}`}>
                    {scoreData.label}
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-700">Not enough data</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                    New Community
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 rounded-full ${theme.progressBg}`}
          style={{ width: scoreData.score !== null ? `${scoreData.score}%` : '0%' }}
        />
      </div>

      {/* Key Stats Bar */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>
            <strong>{scoreData.openVerifiedCount}</strong> open verified {scoreData.openVerifiedCount === 1 ? 'incident' : 'incidents'}
          </span>
        </div>

        {scoreData.unverifiedOpenCount > 0 && (
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>{scoreData.unverifiedOpenCount} unverified open</span>
          </div>
        )}
      </div>

      {/* Expandable Explanation */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2 animate-fadeIn">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">Transparent Rule:</p>
              <p className="font-mono text-blue-700 font-medium text-[11px] mt-0.5">
                Score = max(0, 100 - (10 × unresolved verified incidents))
              </p>
              <p className="mt-1 text-slate-600">
                Only corroborations with <strong>3+ community confirmations</strong> or <strong>direct admin verification</strong> in Open or In Progress states count against the score.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] pt-1">
            <div className="bg-emerald-50 text-emerald-800 p-1.5 rounded-lg border border-emerald-200">
              <span className="font-bold">80 - 100</span>
              <p className="text-[10px]">Good</p>
            </div>
            <div className="bg-amber-50 text-amber-800 p-1.5 rounded-lg border border-amber-200">
              <span className="font-bold">50 - 79</span>
              <p className="text-[10px]">Needs attention</p>
            </div>
            <div className="bg-rose-50 text-rose-800 p-1.5 rounded-lg border border-rose-200">
              <span className="font-bold">0 - 49</span>
              <p className="text-[10px]">Critical</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic text-center pt-1">
            “Based on unresolved verified reports, not an official safety rating.”
          </p>
        </div>
      )}
    </div>
  );
};

