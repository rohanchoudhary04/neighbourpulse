import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Camera, 
  MapPin, 
  Navigation, 
  AlertTriangle, 
  ShieldCheck, 
  EyeOff, 
  X, 
  CheckCircle2, 
  ArrowRight,
  Info,
  Users,
  Compass,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { incidentService } from '../../services/incidentService';
import { CATEGORY_CONFIG, CategoryBadge } from '../../components/ui/CategoryBadge';
import { DuplicateCandidate, IncidentCategory } from '../../types';

const reportSchema = z.object({
  category: z.enum(['water', 'power', 'road', 'safety', 'garbage', 'animals'] as const),
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title too long'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500, 'Description too long'),
  locationLabel: z.string().min(3, 'Please specify a landmark or street label'),
  hideReporterName: z.boolean().default(false),
});

type ReportFormData = z.infer<typeof reportSchema>;

export const ReportIssuePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentCommunity = incidentService.getCurrentCommunity();

  // Selected Pin Coordinates (defaults to community center)
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: currentCommunity.center.lat,
    lng: currentCommunity.center.lng,
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false);
  const [confirmedDuplicateSuccess, setConfirmedDuplicateSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      category: 'water',
      title: '',
      description: '',
      locationLabel: '',
      hideReporterName: false,
    },
  });

  const selectedCategory = watch('category');

  // Trigger duplicate candidate lookup whenever category or coords change
  useEffect(() => {
    let active = true;
    const checkDuplicates = async () => {
      if (!currentCommunity.id || !selectedCategory) return;
      try {
        const matches = await incidentService.findDuplicateCandidates(
          currentCommunity.id,
          selectedCategory,
          coords.lat,
          coords.lng,
          150 // 150m radius threshold
        );
        if (active) {
          setDuplicateCandidates(matches);
          // If new matches found, reset dismiss
          if (matches.length > 0) {
            setDismissedDuplicates(false);
          }
        }
      } catch (e) {
        console.warn('Duplicate check error:', e);
      }
    };

    const timer = setTimeout(checkDuplicates, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedCategory, coords, currentCommunity.id]);

  // Photo upload and compression handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size (5MB limit)
    if (!file.type.startsWith('image/')) {
      setPhotoError('Only image files (JPEG, PNG, WebP) are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be under 5MB.');
      return;
    }

    // Client-side image compression using HTMLCanvas
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoPreview(compressed);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Browser Geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Browser geolocation is not available.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(newCoords);
        if (!watch('locationLabel')) {
          setValue('locationLabel', 'Near My Current Location');
        }
      },
      (err) => {
        setLocating(false);
        alert(`Location permission denied or unavailable: ${err.message}`);
      },
      { timeout: 8000 }
    );
  };

  // User chooses "I see this too" on a duplicate candidate
  const handleConfirmExisting = async (existingId: string) => {
    if (!user) return;
    try {
      setSubmitting(true);
      await incidentService.confirmIncident(existingId, user.id);
      setConfirmedDuplicateSuccess('You have confirmed the existing issue. You are now subscribed to status updates.');
      setTimeout(() => {
        navigate(`/issues/${existingId}`);
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Could not confirm incident.');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (data: ReportFormData) => {
    if (!user) {
      navigate('/login');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      const created = await incidentService.createIncident({
        communityId: currentCommunity.id,
        category: data.category,
        title: data.title,
        description: data.description,
        latitude: coords.lat,
        longitude: coords.lng,
        locationLabel: data.locationLabel,
        photoUrl: photoPreview || undefined,
        hideReporterName: data.hideReporterName,
      });

      navigate(`/issues/${created.id}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit report. Please check your network and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 py-4 sm:py-8 px-4 sm:px-6 max-w-3xl mx-auto w-full">
      {/* Top Breadcrumb & Title */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Report a Neighbourhood Issue
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Submitting to <strong className="text-slate-800">{currentCommunity.name}</strong> ({currentCommunity.locality})
        </p>
      </div>

      {/* Safety Notice */}
      <div className="mb-6 p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Community Reporting Notice:</strong> This app is for community maintenance and safety reporting, not urgent emergency response. For immediate danger or fire, contact local emergency services immediately.
        </p>
      </div>

      {submitError && (
        <div className="mb-6 p-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* DUPLICATE SUGGESTION CARD (Key Differentiator) */}
      {duplicateCandidates.length > 0 && !dismissedDuplicates && (
        <div className="mb-6 bg-blue-50/80 border-2 border-blue-500 rounded-3xl p-4 sm:p-5 shadow-md animate-slide-up">
          <div className="flex items-center justify-between pb-3 border-b border-blue-200">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600 text-white">
                <Users className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-blue-900">
                  Similar Issue Nearby Detected
                </h3>
                <p className="text-[11px] text-blue-700">
                  A neighbour already reported this within 150m. Confirming saves duplicate tickets and accelerates admin action!
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedDuplicates(true)}
              className="text-blue-500 hover:text-blue-700 p-1"
              aria-label="Dismiss duplicate suggestions"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            {duplicateCandidates.slice(0, 2).map((cand) => (
              <div
                key={cand.id}
                className="bg-white p-3.5 rounded-2xl border border-blue-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <CategoryBadge category={cand.category} />
                    <span className="text-[11px] text-slate-500 font-medium">
                      ~{cand.distanceMeters}m away
                    </span>
                    <span className="text-[11px] text-blue-600 font-semibold">
                      {cand.confirmationCount} corroborations
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-1">{cand.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{cand.description}</p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => navigate(`/issues/${cand.id}`)}
                    className="flex-1 sm:flex-initial px-3 py-1.5 text-xs text-slate-600 font-semibold hover:text-slate-900 bg-slate-100 rounded-xl"
                  >
                    View issue
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleConfirmExisting(cand.id)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    I see this too
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-right">
            <button
              type="button"
              onClick={() => setDismissedDuplicates(true)}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
            >
              This is a different issue →
            </button>
          </div>
        </div>
      )}

      {confirmedDuplicateSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{confirmedDuplicateSuccess}</span>
        </div>
      )}

      {/* Main Report Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card space-y-6">
        {/* Category Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Select Category *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {(['water', 'power', 'road', 'safety', 'garbage', 'animals'] as IncidentCategory[]).map((cat) => {
              const isSelected = selectedCategory === cat;
              const config = CATEGORY_CONFIG[cat];
              const Icon = config.icon;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setValue('category', cat)}
                  className={`p-3 rounded-2xl border-2 text-left flex items-center gap-2.5 transition-all ${
                    isSelected
                      ? `border-blue-600 bg-blue-50/70 shadow-xs font-bold`
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${config.bg} ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{config.label}</span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {cat === 'animals' ? 'Welfare' : cat}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {errors.category && (
            <p className="mt-1 text-xs text-rose-600">{errors.category.message}</p>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Short Title *
          </label>
          <input
            type="text"
            {...register('title')}
            placeholder="e.g. Broken sprinkler flooding sidewalk"
            className={`w-full px-4 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 ${
              errors.title ? 'border-rose-300' : 'border-slate-200'
            }`}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-rose-600">{errors.title.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Description *
          </label>
          <textarea
            rows={3}
            {...register('description')}
            placeholder="Provide concise details: what happened, exact location cues, or hazard level..."
            className={`w-full px-4 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 ${
              errors.description ? 'border-rose-300' : 'border-slate-200'
            }`}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-rose-600">{errors.description.message}</p>
          )}
        </div>

        {/* Location Selection & Map Coordinates */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Location & Landmark *
            </label>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold"
            >
              <Navigation className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
              {locating ? 'Acquiring...' : 'Use current GPS'}
            </button>
          </div>

          <div className="relative rounded-xl shadow-2xs">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <MapPin className="w-4 h-4" />
            </div>
            <input
              type="text"
              {...register('locationLabel')}
              placeholder="e.g. Near Block B entrance, outside clubhouse"
              className={`w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                errors.locationLabel ? 'border-rose-300' : 'border-slate-200'
              }`}
            />
          </div>
          {errors.locationLabel && (
            <p className="mt-1 text-xs text-rose-600">{errors.locationLabel.message}</p>
          )}

          {/* Coordinate Adjustment Simulation Preview */}
          <div className="mt-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-600" />
              <span>
                Coordinates: <strong>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</strong>
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Within {currentCommunity.name} boundary
            </span>
          </div>
        </div>

        {/* Optional Photo Attachment */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Photo Evidence (Optional)
          </label>

          {photoPreview ? (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 max-w-sm">
              <img src={photoPreview} alt="Incident preview" className="w-full h-48 object-cover" />
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                className="absolute top-2 right-2 p-1.5 bg-slate-900/70 text-white rounded-full hover:bg-slate-900"
                aria-label="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="cursor-pointer border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-colors bg-slate-50 hover:bg-blue-50/30">
              <Camera className="w-6 h-6 text-slate-400 mb-1" />
              <span className="text-xs font-semibold text-slate-700">
                Click to attach photo
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                JPEG, PNG, WebP up to 5MB (compressed automatically)
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          )}

          {photoError && (
            <p className="mt-1 text-xs text-rose-600">{photoError}</p>
          )}
        </div>

        {/* Privacy: Hide my name toggle */}
        <div className="pt-2 border-t border-slate-100">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('hideReporterName')}
              className="mt-1 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <div>
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                Hide my name from other residents
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Your report will show as "Resident" on public neighbourhood feeds. Authorized administrators can still verify your identity for safety audits.
              </p>
            </div>
          </label>
        </div>

        {/* Submit Action */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all disabled:opacity-50"
          >
            {submitting ? (
              <span>Submitting...</span>
            ) : (
              <>
                <span>Publish Issue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

