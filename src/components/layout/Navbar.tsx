import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Radio, 
  Bell, 
  User, 
  MapPin, 
  ShieldCheck, 
  LogOut, 
  Sparkles,
  PlusCircle,
  RotateCcw,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { useDeviceLocation } from '../../context/LocationContext';
import { DEMO_PERSONAS } from '../../services/mockData';
import { incidentService } from '../../services/incidentService';

interface NavbarProps {
  unreadCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ unreadCount = 0 }) => {
  const { user, signOut, switchPersona, isDemo, resetDemoData } = useAuth();
  const { 
    status: locStatus, 
    locationLabel, 
    errorMessage: locError, 
    requestLocation 
  } = useDeviceLocation();

  const navigate = useNavigate();
  const location = useLocation();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const currentCommunity = incidentService.getCurrentCommunity();

  const handleLocationClick = async () => {
    await requestLocation();
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:bg-blue-700 transition-colors">
                <Radio className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  Neighbour<span className="text-blue-600">Pulse</span>
                </span>
                <span className="hidden sm:block text-[10px] text-slate-400 font-medium leading-none">
                  Connected & Informed
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-200">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${location.pathname === '/' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
              >
                Live Map
              </Link>
              <Link
                to="/my-reports"
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${location.pathname === '/my-reports' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
              >
                My Reports
              </Link>
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${location.pathname.startsWith('/admin') ? 'bg-indigo-50 text-indigo-700' : 'text-indigo-600 hover:bg-indigo-50'}`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Dashboard
                </Link>
              )}
            </nav>
          </div>

          {/* Right Section: Community Name, Notifications, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Current Location Geolocation Control Button */}
            <button
              type="button"
              onClick={handleLocationClick}
              disabled={locStatus === 'locating'}
              className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
                locStatus === 'error'
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : locStatus === 'success'
                  ? 'bg-blue-50/80 text-blue-700 border-blue-200/80 hover:bg-blue-100/70 hover:border-blue-300'
                  : locStatus === 'locating'
                  ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-wait'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/60'
              }`}
              title={
                locStatus === 'error'
                  ? locError || 'Location error. Click to retry.'
                  : locStatus === 'success'
                  ? `${locationLabel || 'Location found'} • Click to refresh & recenter map`
                  : locStatus === 'locating'
                  ? 'Detecting device coordinates...'
                  : 'Click to detect your current location'
              }
              aria-label={
                locStatus === 'success'
                  ? `Current location: ${locationLabel || 'Location found'}. Click to recenter.`
                  : locStatus === 'locating'
                  ? 'Finding your location...'
                  : locStatus === 'error'
                  ? 'Location error. Click to retry.'
                  : 'Use my location'
              }
            >
              {locStatus === 'locating' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
                  <span className="truncate max-w-[130px] sm:max-w-[180px]">Finding your location...</span>
                </>
              ) : locStatus === 'success' ? (
                <>
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="max-w-[120px] sm:max-w-[180px] truncate">{locationLabel || 'Location found'}</span>
                  <RefreshCw className="w-3 h-3 text-blue-400 group-hover:text-blue-600 shrink-0 ml-0.5" />
                </>
              ) : locStatus === 'error' ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="truncate max-w-[120px] sm:max-w-[160px]">Retry location</span>
                </>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate max-w-[120px] sm:max-w-[160px]">Use my location</span>
                </>
              )}
            </button>

            {/* Desktop Quick Report Button */}
            <Link
              to="/report"
              className="hidden sm:inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-xl shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Report Issue
            </Link>

            {/* Notifications Button */}
            <Link
              to="/notifications"
              className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="View notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
                aria-haspopup="true"
                aria-expanded={profileMenuOpen}
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-xs text-slate-700">
                  {user?.displayName?.[0] || 'U'}
                </div>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-fadeIn">
                  <div className="px-3.5 py-2.5 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-900 truncate">{user?.displayName}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${user?.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                        {user?.role === 'admin' ? 'Community Admin' : 'Resident'}
                      </span>
                    </div>
                  </div>

                  {isDemo && (
                    <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 mb-1">
                        Demo Persona Switcher
                      </p>
                      <div className="space-y-1">
                        {DEMO_PERSONAS.map((persona) => (
                          <button
                            key={persona.id}
                            onClick={() => {
                              switchPersona(persona.id);
                              setProfileMenuOpen(false);
                            }}
                            className={`w-full text-left px-2 py-1 rounded-lg text-xs flex items-center justify-between ${user?.id === persona.id ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-200/60'}`}
                          >
                            <span className="truncate">{persona.displayName}</span>
                            <span className={`text-[10px] uppercase font-mono ${user?.id === persona.id ? 'text-blue-100' : 'text-slate-400'}`}>
                              {persona.role}
                            </span>
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          resetDemoData();
                          setProfileMenuOpen(false);
                        }}
                        className="mt-2 w-full text-left px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-50 rounded-lg flex items-center gap-1.5 font-medium transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset Mock Database
                      </button>
                    </div>
                  )}

                  <Link
                    to="/profile"
                    onClick={() => setProfileMenuOpen(false)}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    Profile & Settings
                  </Link>

                  {user?.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full text-left px-3.5 py-2 text-xs text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 font-semibold"
                    >
                      <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                      Admin Dashboard
                    </Link>
                  )}

                  <button
                    onClick={() => {
                      signOut();
                      setProfileMenuOpen(false);
                      navigate('/login');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

