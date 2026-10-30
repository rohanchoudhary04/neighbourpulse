import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { LocationProvider } from '../context/LocationContext';
import { AppLayout } from '../components/layout/AppLayout';

import { LoginPage } from '../features/auth/LoginPage';
import { SignupPage } from '../features/auth/SignupPage';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { HomePage } from '../features/incidents/HomePage';
import { ReportIssuePage } from '../features/incidents/ReportIssuePage';
import { IncidentDetailsPage } from '../features/incidents/IncidentDetailsPage';
import { MyReportsPage } from '../features/incidents/MyReportsPage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { ProfilePage } from '../features/auth/ProfilePage';
import { AdminDashboardPage } from '../features/admin/AdminDashboardPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Admin Protected Route Wrapper with Authorization Loading State
const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-xs font-semibold text-slate-500">Verifying administrator authorization...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Administrator Access Required</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            This account does not have administrator access. Only authorized community managers may access the management dashboard.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-2xs"
            >
              Continue as resident
            </Link>
            <Link
              to="/login"
              className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Sign in with an administrator account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocationProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              {/* Protected Routes inside AppLayout */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />

              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<HomePage />} />
                <Route path="/report" element={<ReportIssuePage />} />
                <Route path="/issues/:id" element={<IncidentDetailsPage />} />
                <Route path="/my-reports" element={<MyReportsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route
                  path="/admin"
                  element={
                    <AdminProtectedRoute>
                      <AdminDashboardPage />
                    </AdminProtectedRoute>
                  }
                />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </LocationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;

