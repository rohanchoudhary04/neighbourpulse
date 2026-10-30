import { isDemoMode, supabase } from '../lib/supabase';
import { 
  Community, 
  DuplicateCandidate, 
  HealthScoreResult, 
  Incident, 
  IncidentStatus, 
  IncidentUpdate, 
  NotificationItem, 
  ResolutionFeedback 
} from '../types';
import { DEMO_COMMUNITIES } from './mockData';
import { mockService } from './mockService';

const subscribers: (() => void)[] = [];

function notifySubscribers() {
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Subscriber error:', e);
    }
  });
}

// Optional Supabase Realtime setup
if (!isDemoMode && supabase) {
  try {
    supabase
      .channel('public:incidents_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
        notifySubscribers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confirmations' }, () => {
        notifySubscribers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        notifySubscribers();
      })
      .subscribe();
  } catch (e) {
    console.warn('Realtime subscription error:', e);
  }
}

export const incidentService = {
  // --- Communities ---
  async getCommunities(): Promise<Community[]> {
    if (isDemoMode || !supabase) {
      return mockService.getCommunities();
    }

    try {
      const { data, error } = await supabase.from('communities').select('*');
      if (error || !data || data.length === 0) {
        return DEMO_COMMUNITIES;
      }

      return data.map((row: any) => {
        let lat = 37.7749;
        let lng = -122.4194;

        if (row.center) {
          if (typeof row.center === 'object') {
            if (Array.isArray(row.center.coordinates) && row.center.coordinates.length >= 2) {
              lng = Number(row.center.coordinates[0]);
              lat = Number(row.center.coordinates[1]);
            } else if (typeof row.center.lat === 'number' && typeof row.center.lng === 'number') {
              lat = row.center.lat;
              lng = row.center.lng;
            }
          } else if (typeof row.center === 'string') {
            const pointMatch = row.center.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
            if (pointMatch) {
              lng = parseFloat(pointMatch[1]);
              lat = parseFloat(pointMatch[2]);
            }
          }
        }

        return {
          id: row.id,
          name: row.name,
          locality: row.locality,
          center: { lat, lng },
          boundary: row.boundary,
        };
      });
    } catch {
      return DEMO_COMMUNITIES;
    }
  },

  getCurrentCommunity(): Community {
    try {
      const raw = localStorage.getItem('neighbourpulse_current_community_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.id && !parsed.id.startsWith('comm-')) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return DEMO_COMMUNITIES[0];
  },

  setCurrentCommunity(id: string): Community {
    const community = DEMO_COMMUNITIES.find((c) => c.id === id) || {
      id,
      name: 'Oakridge Heights',
      locality: 'Green Valley Sector 4',
      center: { lat: 37.7749, lng: -122.4194 },
    };
    localStorage.setItem('neighbourpulse_current_community_v1', JSON.stringify(community));
    notifySubscribers();
    return community;
  },

  // --- Incidents ---
  async getIncidents(
    communityId: string,
    filter?: { category?: string; status?: string; verification?: string; search?: string }
  ): Promise<Incident[]> {
    if (isDemoMode || !supabase) {
      return mockService.getIncidents(communityId, filter);
    }

    let query = supabase.from('incidents_view').select('*');
    if (communityId) {
      query = query.eq('community_id', communityId);
    }

    if (filter?.category && filter.category !== 'all') {
      query = query.eq('category', filter.category);
    }
    if (filter?.status && filter.status !== 'all') {
      query = query.eq('status', filter.status);
    }
    if (filter?.verification && filter.verification !== 'all') {
      query = query.eq('verification_state', filter.verification);
    }
    if (filter?.search) {
      query = query.ilike('title', `%${filter.search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase getIncidents error:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      communityId: row.community_id,
      reporterId: row.reporter_id || '',
      reporterName: row.reporter_name || 'Resident',
      hideReporterName: Boolean(row.hide_reporter_name),
      category: row.category,
      title: row.title,
      description: row.description,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      locationLabel: row.location_label,
      photoUrl: row.photo_url,
      status: row.status,
      adminVerified: Boolean(row.admin_verified),
      urgent: Boolean(row.urgent),
      confirmationCount: Number(row.confirmation_count || 0),
      verificationState: row.verification_state,
      userHasConfirmed: Boolean(row.user_has_confirmed),
      userIsFollowing: Boolean(row.user_is_following),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastActivityAt: row.last_activity_at,
      resolvedAt: row.resolved_at,
      resolutionNote: row.resolution_note,
      resolutionPhotoUrl: row.resolution_photo_url,
    }));
  },

  async getMySubmittedIncidents(userId: string): Promise<Incident[]> {
    if (isDemoMode || !supabase) {
      return mockService.getIncidents('').filter((i) => i.reporterId === userId);
    }

    const { data, error } = await supabase
      .from('incidents_view')
      .select('*')
      .eq('reporter_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      communityId: row.community_id,
      reporterId: row.reporter_id || userId,
      reporterName: row.reporter_name || 'Resident',
      hideReporterName: Boolean(row.hide_reporter_name),
      category: row.category,
      title: row.title,
      description: row.description,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      locationLabel: row.location_label,
      photoUrl: row.photo_url,
      status: row.status,
      adminVerified: Boolean(row.admin_verified),
      urgent: Boolean(row.urgent),
      confirmationCount: Number(row.confirmation_count || 0),
      verificationState: row.verification_state,
      userHasConfirmed: Boolean(row.user_has_confirmed),
      userIsFollowing: Boolean(row.user_is_following),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastActivityAt: row.last_activity_at,
      resolvedAt: row.resolved_at,
      resolutionNote: row.resolution_note,
      resolutionPhotoUrl: row.resolution_photo_url,
    }));
  },

  async getMyFollowingIncidents(userId: string): Promise<Incident[]> {
    if (isDemoMode || !supabase) {
      return mockService.getIncidents('').filter((i) => i.userHasConfirmed || i.userIsFollowing);
    }

    const { data, error } = await supabase
      .from('incidents_view')
      .select('*')
      .or('user_has_confirmed.eq.true,user_is_following.eq.true')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      communityId: row.community_id,
      reporterId: row.reporter_id || '',
      reporterName: row.reporter_name || 'Resident',
      hideReporterName: Boolean(row.hide_reporter_name),
      category: row.category,
      title: row.title,
      description: row.description,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      locationLabel: row.location_label,
      photoUrl: row.photo_url,
      status: row.status,
      adminVerified: Boolean(row.admin_verified),
      urgent: Boolean(row.urgent),
      confirmationCount: Number(row.confirmation_count || 0),
      verificationState: row.verification_state,
      userHasConfirmed: Boolean(row.user_has_confirmed),
      userIsFollowing: Boolean(row.user_is_following),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastActivityAt: row.last_activity_at,
      resolvedAt: row.resolved_at,
      resolutionNote: row.resolution_note,
      resolutionPhotoUrl: row.resolution_photo_url,
    }));
  },

  async getIncidentById(id: string): Promise<{ incident: Incident; updates: IncidentUpdate[] } | null> {
    if (isDemoMode || !supabase) {
      return mockService.getIncidentById(id);
    }

    const { data: incidentData, error: incError } = await supabase
      .from('incidents_view')
      .select('*')
      .eq('id', id)
      .single();

    if (incError || !incidentData) throw incError;

    const { data: updatesData } = await supabase
      .from('incident_updates')
      .select('*')
      .eq('incident_id', id)
      .order('created_at', { ascending: true });

    const incident: Incident = {
      id: incidentData.id,
      communityId: incidentData.community_id,
      reporterId: incidentData.reporter_id || '',
      reporterName: incidentData.reporter_name || 'Resident',
      hideReporterName: Boolean(incidentData.hide_reporter_name),
      category: incidentData.category,
      title: incidentData.title,
      description: incidentData.description,
      latitude: Number(incidentData.latitude),
      longitude: Number(incidentData.longitude),
      locationLabel: incidentData.location_label,
      photoUrl: incidentData.photo_url,
      status: incidentData.status,
      adminVerified: Boolean(incidentData.admin_verified),
      urgent: Boolean(incidentData.urgent),
      confirmationCount: Number(incidentData.confirmation_count || 0),
      verificationState: incidentData.verification_state,
      userHasConfirmed: Boolean(incidentData.user_has_confirmed),
      userIsFollowing: Boolean(incidentData.user_is_following),
      createdAt: incidentData.created_at,
      updatedAt: incidentData.updated_at,
      lastActivityAt: incidentData.last_activity_at,
      resolvedAt: incidentData.resolved_at,
      resolutionNote: incidentData.resolution_note,
      resolutionPhotoUrl: incidentData.resolution_photo_url,
    };

    const updates: IncidentUpdate[] = (updatesData || []).map((u: any) => ({
      id: u.id,
      incidentId: u.incident_id,
      actorName: u.actor_name || 'System / Admin',
      updateType: u.update_type,
      note: u.note,
      previousStatus: u.previous_status,
      newStatus: u.new_status,
      createdAt: u.created_at,
    }));

    return { incident, updates };
  },

  // --- Duplicate Detection ---
  async findDuplicateCandidates(
    communityId: string,
    category: string,
    lat: number,
    lng: number,
    radiusMeters: number = 150
  ): Promise<DuplicateCandidate[]> {
    if (isDemoMode || !supabase) {
      return mockService.findDuplicateCandidates(communityId, category, lat, lng, radiusMeters);
    }

    try {
      const { data, error } = await supabase.rpc('find_duplicate_candidates', {
        p_community_id: communityId,
        p_category: category,
        p_lat: lat,
        p_lng: lng,
        p_radius_meters: radiusMeters,
      });

      if (error) {
        console.warn('find_duplicate_candidates RPC notice:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        status: row.status,
        distanceMeters: Number(row.distance_meters),
        confirmationCount: Number(row.confirmation_count),
        createdAt: row.created_at,
      }));
    } catch {
      return [];
    }
  },

  // --- Create Incident ---
  async createIncident(data: {
    communityId: string;
    category: Incident['category'];
    title: string;
    description: string;
    latitude: number;
    longitude: number;
    locationLabel: string;
    photoUrl?: string;
    hideReporterName: boolean;
  }): Promise<Incident> {
    if (isDemoMode || !supabase) {
      const created = mockService.createIncident(data);
      notifySubscribers();
      return created;
    }

    // Live Supabase Mode
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      throw new Error('Not authenticated. Please sign in before reporting an issue.');
    }

    // 1. Ensure user has a profile in public.profiles
    const displayName = user.user_metadata?.display_name || 'Resident';
    await supabase.from('profiles').upsert({
      id: user.id,
      display_name: displayName,
    });

    // 2. Ensure user is registered in community_members so RLS INSERT check passes
    await supabase.from('community_members').upsert({
      community_id: data.communityId,
      user_id: user.id,
      role: 'resident',
    });

    // 3. Insert incident row strictly with user.id as reporter_id
    const { data: created, error } = await supabase
      .from('incidents')
      .insert({
        community_id: data.communityId,
        reporter_id: user.id,
        category: data.category,
        title: data.title.trim(),
        description: data.description.trim(),
        location: `POINT(${data.longitude} ${data.latitude})`,
        location_label: data.locationLabel.trim(),
        hide_reporter_name: data.hideReporterName,
        photo_url: data.photoUrl,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase create incident error:', error);
      throw new Error(`Failed to create incident: ${error.message}`);
    }

    // 4. Record initial audit update
    await supabase.from('incident_updates').insert({
      incident_id: created.id,
      actor_id: user.id,
      update_type: 'created',
      note: 'Incident reported by resident.',
    });

    // 5. Automatically follow own reported incident so reporter receives status notifications
    await supabase.from('incident_followers').insert({
      incident_id: created.id,
      user_id: user.id,
    });

    notifySubscribers();

    return {
      id: created.id,
      communityId: created.community_id,
      reporterId: created.reporter_id,
      reporterName: data.hideReporterName ? 'Resident' : displayName,
      hideReporterName: created.hide_reporter_name,
      category: created.category,
      title: created.title,
      description: created.description,
      latitude: data.latitude,
      longitude: data.longitude,
      locationLabel: created.location_label,
      photoUrl: created.photo_url,
      status: created.status,
      adminVerified: created.admin_verified,
      urgent: created.urgent,
      confirmationCount: 0,
      verificationState: 'unverified',
      userHasConfirmed: false,
      userIsFollowing: true,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
      lastActivityAt: created.last_activity_at,
    };
  },

  // --- Confirm Incident ---
  async confirmIncident(incidentId: string, userId: string): Promise<{ success: boolean; newCount: number; communityConfirmed: boolean }> {
    if (isDemoMode || !supabase) {
      const res = mockService.confirmIncident(incidentId, userId);
      notifySubscribers();
      return res;
    }

    const { data, error } = await supabase.rpc('confirm_incident', {
      p_incident_id: incidentId,
      p_user_id: userId,
    });

    if (error) {
      if (error.message?.includes('cannot confirm their own')) {
        throw new Error('Residents cannot confirm their own incident');
      }
      throw error;
    }

    notifySubscribers();
    return {
      success: data.success,
      newCount: data.confirmation_count,
      communityConfirmed: data.community_confirmed,
    };
  },

  // --- Health Score ---
  async calculateHealthScore(communityId: string): Promise<HealthScoreResult> {
    if (isDemoMode || !supabase) {
      return mockService.calculateHealthScore(communityId);
    }

    try {
      const { data, error } = await supabase.rpc('calculate_health_score', {
        p_community_id: communityId,
      });
      if (error) throw error;

      return {
        score: data.score,
        label: data.label,
        openVerifiedCount: data.open_verified_count,
        totalVerifiedCount: data.total_verified_count,
        unverifiedOpenCount: data.unverified_open_count,
        hasHistory: data.has_history,
        message: data.message,
      };
    } catch {
      return {
        score: null,
        label: 'Not enough data',
        openVerifiedCount: 0,
        totalVerifiedCount: 0,
        unverifiedOpenCount: 0,
        hasHistory: false,
        message: 'Calculating health score...',
      };
    }
  },

  // --- Admin Actions ---
  async adminVerifyIncident(incidentId: string, adminUserId: string): Promise<Incident> {
    if (isDemoMode || !supabase) {
      const res = mockService.adminVerifyIncident(incidentId, adminUserId);
      notifySubscribers();
      return res;
    }

    const { error: updError } = await supabase
      .from('incidents')
      .update({ admin_verified: true, last_activity_at: new Date().toISOString() })
      .eq('id', incidentId);

    if (updError) throw updError;

    await supabase.from('incident_updates').insert({
      incident_id: incidentId,
      actor_id: adminUserId,
      update_type: 'admin_verification',
      note: 'Incident reviewed and officially verified by Administrator.',
    });

    notifySubscribers();
    const details = await this.getIncidentById(incidentId);
    return details!.incident;
  },

  async adminUpdateStatus(
    incidentId: string,
    status: IncidentStatus,
    adminUserId: string,
    note?: string,
    photoUrl?: string
  ): Promise<Incident> {
    if (isDemoMode || !supabase) {
      const res = mockService.adminUpdateStatus(incidentId, status, adminUserId, note, photoUrl);
      notifySubscribers();
      return res;
    }

    if (status === 'resolved' && (!note || note.trim().length === 0)) {
      throw new Error('A resolution note is required to close an incident.');
    }

    const now = new Date().toISOString();
    const updatePayload: any = {
      status,
      updated_at: now,
      last_activity_at: now,
    };
    if (status === 'resolved') {
      updatePayload.resolved_at = now;
      updatePayload.resolution_note = note?.trim();
      updatePayload.resolution_photo_url = photoUrl;
    }

    const { error: updError } = await supabase
      .from('incidents')
      .update(updatePayload)
      .eq('id', incidentId);

    if (updError) throw updError;

    await supabase.from('incident_updates').insert({
      incident_id: incidentId,
      actor_id: adminUserId,
      update_type: status === 'resolved' ? 'resolution_note' : 'status_change',
      note: note || `Status updated to ${status}`,
    });

    notifySubscribers();
    const details = await this.getIncidentById(incidentId);
    return details!.incident;
  },

  async submitResolutionFeedback(incidentId: string, userId: string, note: string): Promise<ResolutionFeedback> {
    if (isDemoMode || !supabase) {
      const res = mockService.submitResolutionFeedback(incidentId, userId, note);
      notifySubscribers();
      return res;
    }

    const { data, error } = await supabase
      .from('resolution_feedback')
      .insert({
        incident_id: incidentId,
        user_id: userId,
        note: note.trim(),
        review_status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    notifySubscribers();

    return {
      id: data.id,
      incidentId: data.incident_id,
      userId: data.user_id,
      note: data.note,
      reviewStatus: data.review_status,
      createdAt: data.created_at,
    };
  },

  async adminReopenFromFeedback(incidentId: string, feedbackId: string, adminUserId: string, note: string): Promise<Incident> {
    if (isDemoMode || !supabase) {
      const res = mockService.adminReopenFromFeedback(incidentId, feedbackId, adminUserId, note);
      notifySubscribers();
      return res;
    }

    await supabase
      .from('resolution_feedback')
      .update({ review_status: 'reopened' })
      .eq('id', feedbackId);

    return this.adminUpdateStatus(incidentId, 'in_progress', adminUserId, note);
  },

  // --- Notifications ---
  async getNotifications(userId: string): Promise<NotificationItem[]> {
    if (isDemoMode || !supabase) {
      return mockService.getNotifications(userId);
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*, incidents(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      incidentId: row.incident_id,
      type: row.type,
      message: row.message,
      readAt: row.read_at,
      createdAt: row.created_at,
      incidentTitle: row.incidents?.title,
    }));
  },

  async markNotificationRead(notifId: string): Promise<void> {
    if (isDemoMode || !supabase) {
      mockService.markNotificationRead(notifId);
      notifySubscribers();
      return;
    }

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notifId);

    notifySubscribers();
  },

  async markAllNotificationsRead(userId: string): Promise<void> {
    if (isDemoMode || !supabase) {
      mockService.markAllNotificationsRead(userId);
      notifySubscribers();
      return;
    }

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);

    notifySubscribers();
  },

  // --- Subscriptions ---
  subscribe(listener: () => void): () => void {
    subscribers.push(listener);
    return () => {
      const index = subscribers.indexOf(listener);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
    };
  },
};
