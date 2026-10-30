import { isDemoMode, supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { DEMO_PERSONAS } from './mockData';
import { mockService } from './mockService';
import { incidentService } from './incidentService';

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
}

export const authService = {
  getCurrentUser(): UserProfile | null {
    if (isDemoMode || !supabase) {
      return mockService.getCurrentUser();
    }
    return null;
  },

  async signInWithEmail(email: string, password: string): Promise<UserProfile> {
    if (isDemoMode || !supabase) {
      // Find matching demo persona or generate one
      const persona = DEMO_PERSONAS.find((p) => p.email.toLowerCase() === email.toLowerCase());
      if (persona) {
        return mockService.setCurrentPersona(persona.id);
      }
      // Create ad-hoc user for testing
      const newUser: UserProfile = {
        id: `user-${Date.now()}`,
        email,
        displayName: email.split('@')[0],
        role: 'resident',
        communityId: 'comm-oakridge',
        communityName: 'Oakridge Heights',
      };
      return mockService.updateUserProfile(newUser);
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('User not found');

    // Fetch profile and community
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
    const { data: members } = await supabase.from('community_members').select('*, communities(name)').eq('user_id', data.user.id);

    let activeMember: any = null;
    if (members && members.length > 0) {
      const currentSaved = incidentService.getCurrentCommunity();
      activeMember = members.find((m: any) => m.community_id === currentSaved?.id) || members[0];
    }

    return {
      id: data.user.id,
      email: data.user.email || email,
      displayName: profile?.display_name || email.split('@')[0],
      role: activeMember?.role || 'resident',
      communityId: activeMember?.community_id || null,
      communityName: activeMember?.communities?.name,
    };
  },

  async signUpWithEmail(fullName: string, email: string, password: string): Promise<{ user: UserProfile; confirmationRequired: boolean }> {
    if (isDemoMode || !supabase) {
      const newUser: UserProfile = {
        id: `user-${Date.now()}`,
        email,
        displayName: fullName,
        role: 'resident',
        communityId: null, // Needs onboarding!
      };
      mockService.updateUserProfile(newUser);
      return { user: newUser, confirmationRequired: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: fullName,
        },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('Failed to create account');

    const newUser: UserProfile = {
      id: data.user.id,
      email,
      displayName: fullName,
      role: 'resident',
      communityId: null,
    };

    return {
      user: newUser,
      confirmationRequired: !data.session,
    };
  },

  async signOut(): Promise<void> {
    if (isDemoMode || !supabase) {
      // In demo mode, stay on Alex or reset to Alex
      mockService.setCurrentPersona(DEMO_PERSONAS[0].id);
      return;
    }
    await supabase.auth.signOut();
  },

  async sendPasswordResetEmail(email: string): Promise<void> {
    if (isDemoMode || !supabase) {
      // Simulated instant success
      return new Promise((resolve) => setTimeout(resolve, 600));
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  switchDemoPersona(personaId: string): UserProfile {
    return mockService.setCurrentPersona(personaId);
  },
};

