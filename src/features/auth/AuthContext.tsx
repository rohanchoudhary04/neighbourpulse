import React, { createContext, useContext, useEffect, useState } from 'react';
import { isDemoMode, supabase } from '../../lib/supabase';
import { authService } from '../../services/authService';
import { DEMO_PERSONAS } from '../../services/mockData';
import { mockService } from '../../services/mockService';
import { incidentService } from '../../services/incidentService';
import { clearUserViewports } from '../../services/mapViewportService';
import { UserProfile } from '../../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<UserProfile>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ user: UserProfile; confirmationRequired: boolean }>;
  signOut: () => Promise<void>;
  switchPersona: (personaId: string) => void;
  updateCommunity: (communityId: string, communityName: string) => void;
  resetDemoData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    return isDemoMode || !supabase ? mockService.getCurrentUser() : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode || !supabase) {
      setUser(mockService.getCurrentUser());
      setLoading(false);

      const unsubscribe = mockService.subscribe(() => {
        setUser(mockService.getCurrentUser());
      });
      return unsubscribe;
    }

    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }

    const loadSupabaseUser = async (sessionUser: any) => {
      try {
        const { data: profile } = await client
          .from('profiles')
          .select('display_name')
          .eq('id', sessionUser.id)
          .maybeSingle();

        const { data: members } = await client
          .from('community_members')
          .select('community_id, role, communities(name)')
          .eq('user_id', sessionUser.id);

        let activeMember: any = null;
        if (members && members.length > 0) {
          const currentSaved = incidentService.getCurrentCommunity();
          // Retain valid selected community if user is a member of it, otherwise default to first membership
          activeMember = members.find((m: any) => m.community_id === currentSaved?.id) || members[0];
        }

        const displayName = profile?.display_name || sessionUser.user_metadata?.display_name || 'Resident';
        const role = (activeMember?.role as any) || 'resident';
        const communityId = activeMember?.community_id || null;
        const communityName = (activeMember?.communities as any)?.name || undefined;

        // If profile doesn't exist in profiles table yet, ensure it is created
        if (!profile && displayName) {
          await client.from('profiles').upsert({
            id: sessionUser.id,
            display_name: displayName,
          });
        }

        setUser({
          id: sessionUser.id,
          email: sessionUser.email || '',
          displayName,
          role,
          communityId,
          communityName,
        });

        if (communityId) {
          incidentService.setCurrentCommunity(communityId);
        }
      } catch (err) {
        console.error('Error fetching user profile from Supabase:', err);
        setUser({
          id: sessionUser.id,
          email: sessionUser.email || '',
          displayName: sessionUser.user_metadata?.display_name || 'Resident',
          role: 'resident',
          communityId: null,
        });
      } finally {
        setLoading(false);
      }
    };

    // Supabase auth subscription
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadSupabaseUser(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadSupabaseUser(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const u = await authService.signInWithEmail(email, password);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (fullName: string, email: string, password: string) => {
    setLoading(true);
    try {
      const result = await authService.signUpWithEmail(fullName, email, password);
      if (!result.confirmationRequired) {
        setUser(result.user);
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (user?.id) {
      clearUserViewports(user.id);
    }
    await authService.signOut();
    if (!isDemoMode && supabase) {
      setUser(null);
      localStorage.removeItem('neighbourpulse_current_user_v1');
    } else {
      setUser(mockService.getCurrentUser());
    }
  };

  const switchPersona = (personaId: string) => {
    const updated = authService.switchDemoPersona(personaId);
    setUser(updated);
  };

  const updateCommunity = async (communityId: string, communityName: string) => {
    if (!user) return;
    if (!isDemoMode && supabase) {
      try {
        await supabase.from('community_members').upsert({
          community_id: communityId,
          user_id: user.id,
          role: user.role || 'resident',
        });
      } catch (e) {
        console.warn('Error upserting community_members:', e);
      }
      setUser((prev) => (prev ? { ...prev, communityId, communityName } : null));
    } else {
      const updated = mockService.updateUserProfile({ communityId, communityName });
      setUser(updated);
    }
  };

  const resetDemoData = () => {
    mockService.resetDemoData();
    setUser(mockService.getCurrentUser());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemo: isDemoMode || !supabase,
        signIn,
        signUp,
        signOut,
        switchPersona,
        updateCommunity,
        resetDemoData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

