import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Building2, 
  ShieldCheck, 
  LogOut, 
  Sparkles, 
  RotateCcw, 
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { DEMO_PERSONAS } from '../../services/mockData';
import { incidentService } from '../../services/incidentService';

export const ProfilePage: React.FC = () => {
  const { user, signOut, switchPersona, isDemo, resetDemoData, updateCommunity } = useAuth();
  const navigate = useNavigate();

  const currentCommunity = incidentService.getCurrentCommunity();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (user.displayName !== displayName) {
      updateCommunity(user.communityId || currentCommunity.id, currentCommunity.name);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex-1 bg-slate-50 py-6 px-4 sm:px-6 max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Resident Profile & Settings
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your account preferences and community membership.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 sm:p-8 space-y-6">
        {/* User Card */}
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-black shadow-md shadow-blue-500/20">
            {user?.displayName?.[0] || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{user?.displayName}</h2>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                user?.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'
              }`}>
                {user?.role === 'admin' ? 'Community Admin' : 'Resident'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* Current Community Details */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">{currentCommunity.name}</p>
              <p className="text-[11px] text-slate-500">{currentCommunity.locality}</p>
            </div>
          </div>

          <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200/80 px-2.5 py-1 rounded-xl shadow-2xs">
            Assigned Community
          </span>
        </div>

        {/* Demo Personas Switcher (if Demo Mode) */}
        {isDemo && (
          <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Simulated Persona Switcher</span>
              </div>
              <button
                onClick={resetDemoData}
                className="text-[11px] text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Mock Data
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_PERSONAS.map((p) => {
                const isSelected = user?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => switchPersona(p.id)}
                    className={`p-2 rounded-xl text-left text-xs border transition-all ${
                      isSelected
                        ? 'border-amber-600 bg-white shadow-2xs font-bold text-amber-950 ring-2 ring-amber-500/30'
                        : 'border-amber-200 bg-white/70 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <p className="truncate">{p.displayName}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{p.role}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Edit Display Name */}
        <form onSubmit={handleSave} className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {savedSuccess && (
            <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Profile updated!
            </p>
          )}

          <button
            type="submit"
            className="text-xs font-bold px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
          >
            Save changes
          </button>
        </form>

        {/* Sign out */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            NeighbourPulse v1.0 • Hackathon Edition
          </p>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

