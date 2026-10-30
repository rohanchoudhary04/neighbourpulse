import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  ArrowRight, 
  Info 
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { DEMO_COMMUNITIES } from '../../services/mockData';
import { incidentService } from '../../services/incidentService';
import { isDemoMode, supabase } from '../../lib/supabase';
import { Community } from '../../types';

export const OnboardingPage: React.FC = () => {
  const { user, updateCommunity } = useAuth();
  const navigate = useNavigate();

  const [communities, setCommunities] = useState<Community[]>(DEMO_COMMUNITIES);
  const [selectedCommunityId, setSelectedCommunityId] = useState(
    user?.communityId || DEMO_COMMUNITIES[0].id
  );
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    incidentService.getCommunities().then((list) => {
      if (list && list.length > 0) {
        setCommunities(list);
      }
    });
  }, []);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setLocationStatus('Requesting browser location...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLocationStatus(`Location acquired (Lat: ${pos.coords.latitude.toFixed(3)}, Lng: ${pos.coords.longitude.toFixed(3)})`);
        // Find closest community
        setSelectedCommunityId(communities[0]?.id || DEMO_COMMUNITIES[0].id);
      },
      (err) => {
        setLocating(false);
        setLocationStatus(`Location denied or unavailable: ${err.message}. You can still select manually.`);
      },
      { timeout: 8000 }
    );
  };

  const handleComplete = async () => {
    const chosen = communities.find((c) => c.id === selectedCommunityId) || communities[0];
    if (!chosen) return;

    setSaving(true);
    try {
      if (!isDemoMode && supabase && user) {
        // 1. Ensure profile has chosen display name
        const cleanName = displayName.trim() || user.displayName || 'Resident';
        await supabase.from('profiles').upsert({
          id: user.id,
          display_name: cleanName,
        });

        // 2. Persist membership in Supabase community_members
        await supabase.from('community_members').upsert({
          community_id: chosen.id,
          user_id: user.id,
          role: 'resident',
        });
      }

      incidentService.setCurrentCommunity(chosen.id);
      await updateCommunity(chosen.id, chosen.name);
      navigate('/');
    } catch (err) {
      console.error('Error during onboarding completion:', err);
      navigate('/');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Select Your Neighbourhood
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Join your residential society to view live issues and report incidents.
          </p>
        </div>

        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl shadow-card border border-slate-200/80 space-y-6">
          {/* Display Name Option */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Your Public Display Name (Optional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Maya Patel"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              When reporting issues, you can also choose to hide your name from other residents.
            </p>
          </div>

          {/* Communities List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Available Communities
              </label>

              <button
                type="button"
                onClick={handleUseLocation}
                disabled={locating}
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold"
              >
                <Navigation className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
                {locating ? 'Locating...' : 'Use my location'}
              </button>
            </div>

            {locationStatus && (
              <p className="mb-2 text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                {locationStatus}
              </p>
            )}

            <div className="space-y-3">
              {communities.map((community) => {
                const isSelected = selectedCommunityId === community.id;
                return (
                  <div
                    key={community.id}
                    onClick={() => setSelectedCommunityId(community.id)}
                    className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{community.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{community.locality}</p>
                        <span className="inline-block mt-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                          Active Community Hub
                        </span>
                      </div>
                    </div>

                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-4 h-4" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hackathon Note / Production distinction */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">Hackathon Open Access:</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                For evaluation, residents can join seeded communities immediately without invitation codes. In production deployment, residential verification or administrator approval is required.
              </p>
            </div>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={handleComplete}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-colors"
          >
            <span>Continue to Live Map</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

