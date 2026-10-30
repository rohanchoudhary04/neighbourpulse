import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Radio, 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  User, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { DEMO_PERSONAS } from '../../services/mockData';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { signIn, isDemo, switchPersona } = useAuth();
  const navigate = useNavigate();

  // Mode Selection: 'resident' vs 'admin'
  const [activeTab, setActiveTab] = useState<'resident' | 'admin'>('resident');

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [nonAdminUser, setNonAdminUser] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  // Form initialized with completely empty strings (no prefilled credentials)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null);
    setNonAdminUser(false);

    try {
      const userProfile = await signIn(data.email, data.password);

      if (activeTab === 'admin') {
        // Enforce server-side role check against existing community_members
        if (userProfile.role !== 'admin') {
          setNonAdminUser(true);
          setAuthError('This account does not have administrator access.');
          return;
        }
        navigate('/admin');
      } else {
        // Resident login opens the resident application
        navigate('/');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to sign in. Please check your credentials.');
    }
  };

  // Demo helper: only populates on explicit click in demo mode
  const handleQuickLogin = (persona: typeof DEMO_PERSONAS[0]) => {
    setValue('email', persona.email);
    setValue('password', 'password123');
    switchPersona(persona.id);
    if (persona.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setResetSent(true);
    setTimeout(() => {
      setShowForgotModal(false);
      setResetSent(false);
      setForgotEmail('');
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* App Logo & Name */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Radio className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="mt-4 text-center text-3xl font-extrabold tracking-tight text-slate-900">
          Neighbour<span className="text-blue-600">Pulse</span>
        </h1>
        <p className="mt-2 text-center text-sm font-medium text-slate-500">
          Your neighbourhood. Connected and informed.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-card rounded-3xl border border-slate-200/80 sm:px-10">
          
          {/* Two-Tab Navigation: Resident vs Admin */}
          <div className="flex rounded-2xl bg-slate-100 p-1 mb-6 border border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                setActiveTab('resident');
                setAuthError(null);
                setNonAdminUser(false);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'resident'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Resident</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setAuthError(null);
                setNonAdminUser(false);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'admin'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </button>
          </div>

          {/* Subheading depending on active tab */}
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800">
              {activeTab === 'resident' ? 'Resident Account Login' : 'Community Administrator Login'}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {activeTab === 'resident'
                ? 'Sign in to view live incidents and report local issues.'
                : 'Sign in to access tickets, verification, and resolution controls.'}
            </p>
          </div>

          {/* Quick Demo Switcher (Only visible in Demo Mode) */}
          {isDemo && (
            <div className="mb-5 p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Simulated Persona Login (Demo Mode)</span>
              </div>
              <p className="text-[11px] text-amber-800 mb-2">
                Click a test persona below to test resident or administrator roles:
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {DEMO_PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleQuickLogin(p)}
                    className="p-1.5 bg-white hover:bg-amber-100/70 border border-amber-200 rounded-xl text-left text-[11px] font-semibold text-slate-800 flex flex-col transition-colors shadow-2xs"
                  >
                    <span>{p.displayName}</span>
                    <span className="text-[10px] text-amber-700 font-mono font-normal">
                      {p.role === 'admin' ? 'Community Admin' : 'Resident'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message Display */}
          {authError && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{authError}</span>
              </div>
              {nonAdminUser && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    Continue as resident
                  </button>
                </div>
              )}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="Enter your email"
                  {...register('email')}
                  className={`block w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors ${
                    errors.email ? 'border-rose-300 ring-rose-200' : 'border-slate-200'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  {...register('password')}
                  className={`block w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors ${
                    errors.password ? 'border-rose-300 ring-rose-200' : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-md transition-all disabled:opacity-50 ${
                  activeTab === 'admin'
                    ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                {isSubmitting ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>
                      {activeTab === 'admin' ? 'Sign in to Admin Dashboard' : 'Sign in as Resident'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Contextual Footer: Resident Signup Link vs Admin Provisioning Notice */}
          <div className="mt-6 text-center text-xs text-slate-600 border-t border-slate-100 pt-5">
            {activeTab === 'resident' ? (
              <p>
                Don't have an account yet?{' '}
                <Link to="/signup" className="font-bold text-blue-600 hover:text-blue-700">
                  Create an account
                </Link>
              </p>
            ) : (
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Administrator access is provisioned by community management. Public registration is not permitted.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Reset your password</h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter your email and we'll send you instructions to reset your password.
            </p>

            {resetSent ? (
              <div className="my-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Password reset link sent to your email!</span>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
                  >
                    Send reset link
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
