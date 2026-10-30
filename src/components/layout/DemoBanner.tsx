import React from 'react';
import { AlertCircle, UserCheck, ShieldAlert, Sparkles, RotateCcw } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { DEMO_PERSONAS } from '../../services/mockData';

export const DemoBanner: React.FC = () => {
  const { isDemo, user, switchPersona, resetDemoData } = useAuth();

  if (!isDemo) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-200/80 px-4 py-2 text-xs text-amber-900">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-bold bg-amber-600 text-white text-[10px] uppercase px-2 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3" />
            Demo Mode
          </span>
          <span className="text-[11px] text-amber-900/90 font-medium">
            Local simulated environment with PostGIS & RLS logic. Switch personas below to test multi-resident confirmations & admin flows.
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-amber-800 hidden lg:inline">Active Persona:</span>
          {DEMO_PERSONAS.map((p) => {
            const isCurrent = user?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => switchPersona(p.id)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                  isCurrent
                    ? 'bg-amber-600 text-white font-bold shadow-sm'
                    : 'bg-white/80 hover:bg-white text-amber-900 border border-amber-300'
                }`}
                title={`Switch to ${p.displayName} (${p.role})`}
              >
                {p.displayName.split(' ')[0]} ({p.role === 'admin' ? 'Admin' : 'Res'})
              </button>
            );
          })}

          <button
            onClick={resetDemoData}
            title="Reset mock data to initial seeded state"
            className="p-1 text-amber-800 hover:text-amber-950 hover:bg-amber-100 rounded transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

