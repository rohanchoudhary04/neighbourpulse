import { 
  Community, 
  DuplicateCandidate, 
  HealthScoreResult, 
  Incident, 
  IncidentStatus, 
  IncidentUpdate, 
  NotificationItem, 
  ResolutionFeedback, 
  UserProfile 
} from '../types';
import { 
  DEMO_COMMUNITIES, 
  DEMO_PERSONAS, 
  INITIAL_INCIDENTS, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_UPDATES 
} from './mockData';

const STORAGE_KEY_INCIDENTS = 'neighbourpulse_incidents_v1';
const STORAGE_KEY_UPDATES = 'neighbourpulse_updates_v1';
const STORAGE_KEY_NOTIFS = 'neighbourpulse_notifs_v1';
const STORAGE_KEY_FEEDBACK = 'neighbourpulse_feedback_v1';
const STORAGE_KEY_CONFIRMATIONS = 'neighbourpulse_confirmations_v1';
const STORAGE_KEY_CURRENT_USER = 'neighbourpulse_current_user_v1';
const STORAGE_KEY_CURRENT_COMMUNITY = 'neighbourpulse_current_community_v1';

// Haversine formula to compute distance in meters between two coordinates
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

class MockService {
  private listeners: (() => void)[] = [];

  constructor() {
    this.initStorage();
  }

  private initStorage() {
    if (!localStorage.getItem(STORAGE_KEY_INCIDENTS)) {
      localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(INITIAL_INCIDENTS));
    }
    if (!localStorage.getItem(STORAGE_KEY_UPDATES)) {
      localStorage.setItem(STORAGE_KEY_UPDATES, JSON.stringify(INITIAL_UPDATES));
    }
    if (!localStorage.getItem(STORAGE_KEY_NOTIFS)) {
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(INITIAL_NOTIFICATIONS));
    }
    if (!localStorage.getItem(STORAGE_KEY_FEEDBACK)) {
      localStorage.setItem(STORAGE_KEY_FEEDBACK, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_CONFIRMATIONS)) {
      // Seed confirmations for initial incidents
      const initialConfirmations: { incidentId: string; userId: string }[] = [
        { incidentId: 'inc-water-1', userId: 'user-priya' },
        { incidentId: 'inc-water-1', userId: 'user-marcus' },
        { incidentId: 'inc-power-1', userId: 'user-alex' },
        { incidentId: 'inc-road-1', userId: 'user-alex' },
        { incidentId: 'inc-road-1', userId: 'user-priya' },
        { incidentId: 'inc-road-1', userId: 'user-sarah' },
        { incidentId: 'inc-safety-1', userId: 'user-alex' },
        { incidentId: 'inc-animals-1', userId: 'user-priya' },
      ];
      localStorage.setItem(STORAGE_KEY_CONFIRMATIONS, JSON.stringify(initialConfirmations));
    }
    if (!localStorage.getItem(STORAGE_KEY_CURRENT_USER)) {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(DEMO_PERSONAS[0]));
    }
    if (!localStorage.getItem(STORAGE_KEY_CURRENT_COMMUNITY)) {
      localStorage.setItem(STORAGE_KEY_CURRENT_COMMUNITY, JSON.stringify(DEMO_COMMUNITIES[0]));
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public resetDemoData() {
    localStorage.removeItem(STORAGE_KEY_INCIDENTS);
    localStorage.removeItem(STORAGE_KEY_UPDATES);
    localStorage.removeItem(STORAGE_KEY_NOTIFS);
    localStorage.removeItem(STORAGE_KEY_FEEDBACK);
    localStorage.removeItem(STORAGE_KEY_CONFIRMATIONS);
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    localStorage.removeItem(STORAGE_KEY_CURRENT_COMMUNITY);
    this.initStorage();
    this.notify();
  }

  // --- Auth & Profile ---
  public getCurrentUser(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      return data ? JSON.parse(data) : DEMO_PERSONAS[0];
    } catch {
      return DEMO_PERSONAS[0];
    }
  }

  public setCurrentPersona(personaId: string): UserProfile {
    const persona = DEMO_PERSONAS.find((p) => p.id === personaId) || DEMO_PERSONAS[0];
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(persona));
    this.notify();
    return persona;
  }

  public updateUserProfile(updates: Partial<UserProfile>): UserProfile {
    const current = this.getCurrentUser();
    const updated = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(updated));
    this.notify();
    return updated;
  }

  // --- Communities ---
  public getCommunities(): Community[] {
    return DEMO_COMMUNITIES;
  }

  public getCurrentCommunity(): Community {
    try {
      const data = localStorage.getItem(STORAGE_KEY_CURRENT_COMMUNITY);
      if (data) {
        const parsed = JSON.parse(data);
        if (!parsed.id || parsed.id.startsWith('comm-')) {
          localStorage.setItem(STORAGE_KEY_CURRENT_COMMUNITY, JSON.stringify(DEMO_COMMUNITIES[0]));
          return DEMO_COMMUNITIES[0];
        }
        return parsed;
      }
      return DEMO_COMMUNITIES[0];
    } catch {
      return DEMO_COMMUNITIES[0];
    }
  }

  public setCurrentCommunity(communityId: string): Community {
    const community = DEMO_COMMUNITIES.find((c) => c.id === communityId) || DEMO_COMMUNITIES[0];
    localStorage.setItem(STORAGE_KEY_CURRENT_COMMUNITY, JSON.stringify(community));
    // update current user communityId as well
    this.updateUserProfile({ communityId: community.id, communityName: community.name });
    this.notify();
    return community;
  }

  // --- Incidents Storage Helpers ---
  private getStoredIncidents(): Incident[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_INCIDENTS);
      return raw ? JSON.parse(raw) : INITIAL_INCIDENTS;
    } catch {
      return INITIAL_INCIDENTS;
    }
  }

  private setStoredIncidents(incidents: Incident[]) {
    localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(incidents));
    this.notify();
  }

  private getStoredUpdates(): IncidentUpdate[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_UPDATES);
      return raw ? JSON.parse(raw) : INITIAL_UPDATES;
    } catch {
      return INITIAL_UPDATES;
    }
  }

  private setStoredUpdates(updates: IncidentUpdate[]) {
    localStorage.setItem(STORAGE_KEY_UPDATES, JSON.stringify(updates));
  }

  private getStoredConfirmations(): { incidentId: string; userId: string }[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIRMATIONS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private setStoredConfirmations(confirmations: { incidentId: string; userId: string }[]) {
    localStorage.setItem(STORAGE_KEY_CONFIRMATIONS, JSON.stringify(confirmations));
  }

  // --- Incident Retrieval ---
  public getIncidents(
    communityId: string, 
    filter?: { category?: string; status?: string; verification?: string; search?: string }
  ): Incident[] {
    const current = this.getCurrentUser();
    const confirmations = this.getStoredConfirmations();
    let incidents = this.getStoredIncidents().filter((i) => i.communityId === communityId);

    // Populate user-specific dynamic flags and privacy mask
    incidents = incidents.map((i) => {
      const userHasConfirmed = confirmations.some((c) => c.incidentId === i.id && c.userId === current.id);
      const isReporter = i.reporterId === current.id;
      const isAdmin = current.role === 'admin';
      const displayReporter = i.hideReporterName && !isReporter && !isAdmin ? 'Resident' : i.reporterName;

      return {
        ...i,
        reporterName: displayReporter,
        userHasConfirmed,
      };
    });

    if (filter?.category && filter.category !== 'all') {
      incidents = incidents.filter((i) => i.category === filter.category);
    }
    if (filter?.status && filter.status !== 'all') {
      incidents = incidents.filter((i) => i.status === filter.status);
    }
    if (filter?.verification && filter.verification !== 'all') {
      incidents = incidents.filter((i) => i.verificationState === filter.verification);
    }
    if (filter?.search) {
      const query = filter.search.toLowerCase();
      incidents = incidents.filter(
        (i) => i.title.toLowerCase().includes(query) || i.description.toLowerCase().includes(query) || i.locationLabel.toLowerCase().includes(query)
      );
    }

    return incidents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getIncidentById(id: string): { incident: Incident; updates: IncidentUpdate[] } | null {
    const current = this.getCurrentUser();
    const confirmations = this.getStoredConfirmations();
    const incidents = this.getStoredIncidents();
    const inc = incidents.find((i) => i.id === id);
    if (!inc) return null;

    const userHasConfirmed = confirmations.some((c) => c.incidentId === inc.id && c.userId === current.id);
    const isReporter = inc.reporterId === current.id;
    const isAdmin = current.role === 'admin';
    const displayReporter = inc.hideReporterName && !isReporter && !isAdmin ? 'Resident' : inc.reporterName;

    const allUpdates = this.getStoredUpdates();
    const incidentUpdates = allUpdates
      .filter((u) => u.incidentId === id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return {
      incident: {
        ...inc,
        reporterName: displayReporter,
        userHasConfirmed,
      },
      updates: incidentUpdates,
    };
  }

  // --- Duplicate Candidates Lookup (PostGIS Distance Demo Simulation) ---
  public findDuplicateCandidates(
    communityId: string,
    category: string,
    lat: number,
    lng: number,
    radiusMeters: number = 150
  ): DuplicateCandidate[] {
    const incidents = this.getStoredIncidents();
    const fortyEightHoursAgo = Date.now() - 48 * 3600 * 1000;

    const candidates: DuplicateCandidate[] = [];

    for (const inc of incidents) {
      if (inc.communityId !== communityId) continue;
      if (inc.category !== category) continue;
      if (inc.status === 'resolved') continue;
      
      const lastActive = new Date(inc.lastActivityAt || inc.createdAt).getTime();
      if (lastActive < fortyEightHoursAgo) continue;

      const distance = calculateDistanceMeters(lat, lng, inc.latitude, inc.longitude);
      if (distance <= radiusMeters) {
        candidates.push({
          id: inc.id,
          title: inc.title,
          description: inc.description,
          category: inc.category,
          status: inc.status,
          distanceMeters: distance,
          confirmationCount: inc.confirmationCount,
          createdAt: inc.createdAt,
        });
      }
    }

    return candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  // --- Create Incident ---
  public createIncident(data: {
    communityId: string;
    category: Incident['category'];
    title: string;
    description: string;
    latitude: number;
    longitude: number;
    locationLabel: string;
    photoUrl?: string;
    hideReporterName: boolean;
  }): Incident {
    const current = this.getCurrentUser();
    const newId = `inc-${Date.now()}`;
    const now = new Date().toISOString();

    const newIncident: Incident = {
      id: newId,
      communityId: data.communityId,
      reporterId: current.id,
      reporterName: current.displayName,
      hideReporterName: data.hideReporterName,
      category: data.category,
      title: data.title.trim(),
      description: data.description.trim(),
      latitude: data.latitude,
      longitude: data.longitude,
      locationLabel: data.locationLabel.trim(),
      photoUrl: data.photoUrl,
      status: 'open',
      adminVerified: false,
      urgent: false,
      confirmationCount: 0,
      verificationState: 'unverified',
      userHasConfirmed: false,
      userIsFollowing: true,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };

    const incidents = [newIncident, ...this.getStoredIncidents()];
    this.setStoredIncidents(incidents);

    // Initial timeline record
    const updates = this.getStoredUpdates();
    const newUpdate: IncidentUpdate = {
      id: `upd-${Date.now()}`,
      incidentId: newId,
      actorName: current.displayName,
      updateType: 'created',
      note: 'Incident reported by resident.',
      createdAt: now,
    };
    this.setStoredUpdates([newUpdate, ...updates]);

    return newIncident;
  }

  // --- Confirm Incident (Enforces Non-Reporter & 3 Confirms Rule) ---
  public confirmIncident(incidentId: string, userId: string): { success: boolean; newCount: number; communityConfirmed: boolean } {
    const incidents = this.getStoredIncidents();
    const index = incidents.findIndex((i) => i.id === incidentId);
    if (index === -1) throw new Error('Incident not found');

    const incident = incidents[index];

    // Rule: Prevent residents from confirming their own incident!
    if (incident.reporterId === userId) {
      throw new Error('Residents cannot confirm their own incident');
    }

    // Rule: One confirmation per user per incident (Idempotent)
    const confirmations = this.getStoredConfirmations();
    const alreadyConfirmed = confirmations.some((c) => c.incidentId === incidentId && c.userId === userId);
    if (alreadyConfirmed) {
      return { 
        success: true, 
        newCount: incident.confirmationCount, 
        communityConfirmed: incident.verificationState === 'community_confirmed' 
      };
    }

    // Add confirmation
    confirmations.push({ incidentId, userId });
    this.setStoredConfirmations(confirmations);

    const newCount = incident.confirmationCount + 1;
    let newVerificationState = incident.verificationState;
    let justReachedThreshold = false;

    // Rule: 3 distinct confirmations triggers Community Confirmed state
    if (newCount >= 3 && !incident.adminVerified && incident.verificationState === 'unverified') {
      newVerificationState = 'community_confirmed';
      justReachedThreshold = true;
    }

    const updatedIncident: Incident = {
      ...incident,
      confirmationCount: newCount,
      verificationState: newVerificationState,
      lastActivityAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    incidents[index] = updatedIncident;
    this.setStoredIncidents(incidents);

    // If threshold reached, log timeline update and notify
    if (justReachedThreshold) {
      const updates = this.getStoredUpdates();
      updates.push({
        id: `upd-${Date.now()}`,
        incidentId,
        actorName: 'Community Members',
        updateType: 'community_confirmed',
        note: 'Corroborated by 3 distinct community residents.',
        createdAt: new Date().toISOString(),
      });
      this.setStoredUpdates(updates);

      // Create notification for reporter
      this.createNotification(
        incident.reporterId,
        incident.id,
        'community_confirmed',
        `Your report "${incident.title}" has reached 3 confirmations and is now Community Confirmed.`,
        incident.title
      );
    }

    return {
      success: true,
      newCount,
      communityConfirmed: newVerificationState === 'community_confirmed',
    };
  }

  // --- Health Score Calculation ---
  // Rule:
  // Score = max(0, 100 - 10 * unresolved verified incidents)
  // Count only: community-confirmed or admin-verified incidents with status Open or In progress
  // If no verified incident records ever exist in community: "Not enough data"
  // If verified records exist and all are resolved: 100 with "No unresolved verified issues."
  public calculateHealthScore(communityId: string): HealthScoreResult {
    const incidents = this.getStoredIncidents().filter((i) => i.communityId === communityId);

    // A report is verified if adminVerified === true OR confirmationCount >= 3
    const isVerified = (inc: Incident) => inc.adminVerified || inc.confirmationCount >= 3;

    const totalVerifiedEver = incidents.filter(isVerified).length;
    const openVerifiedIncidents = incidents.filter((i) => isVerified(i) && (i.status === 'open' || i.status === 'in_progress'));
    const unverifiedOpenIncidents = incidents.filter((i) => !isVerified(i) && (i.status === 'open' || i.status === 'in_progress'));

    if (totalVerifiedEver === 0) {
      return {
        score: null,
        label: 'Not enough data',
        openVerifiedCount: 0,
        totalVerifiedCount: 0,
        unverifiedOpenCount: unverifiedOpenIncidents.length,
        hasHistory: false,
        message: 'Not enough verified records to calculate a score.',
      };
    }

    const openCount = openVerifiedIncidents.length;
    const score = Math.max(0, 100 - (10 * openCount));

    let label: HealthScoreResult['label'] = 'Good';
    if (score < 50) {
      label = 'Critical';
    } else if (score < 80) {
      label = 'Needs attention';
    }

    return {
      score,
      label,
      openVerifiedCount: openCount,
      totalVerifiedCount: totalVerifiedEver,
      unverifiedOpenCount: unverifiedOpenIncidents.length,
      hasHistory: true,
      message: openCount === 0 
        ? 'No unresolved verified issues.' 
        : 'Based on unresolved verified reports, not an official safety rating.',
    };
  }

  // --- Admin Workflow Actions ---
  public adminVerifyIncident(incidentId: string, adminUserId: string): Incident {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin' || currentUser.id !== adminUserId) {
      throw new Error('Unauthorized: Admin access required');
    }

    const incidents = this.getStoredIncidents();
    const index = incidents.findIndex((i) => i.id === incidentId);
    if (index === -1) throw new Error('Incident not found');

    const inc = incidents[index];
    const updated: Incident = {
      ...inc,
      adminVerified: true,
      verificationState: 'admin_verified',
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    incidents[index] = updated;
    this.setStoredIncidents(incidents);

    // Record timeline update
    const updates = this.getStoredUpdates();
    updates.push({
      id: `upd-${Date.now()}`,
      incidentId,
      actorName: currentUser.displayName,
      updateType: 'admin_verification',
      note: 'Incident reviewed and officially verified by Administrator.',
      createdAt: new Date().toISOString(),
    });
    this.setStoredUpdates(updates);

    // Notify reporter
    this.createNotification(
      inc.reporterId,
      inc.id,
      'admin_verification',
      `Your report "${inc.title}" has been verified by the community administrator.`,
      inc.title
    );

    return updated;
  }

  public adminUpdateStatus(
    incidentId: string,
    newStatus: IncidentStatus,
    adminUserId: string,
    note?: string,
    resolutionPhotoUrl?: string
  ): Incident {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin' || currentUser.id !== adminUserId) {
      throw new Error('Unauthorized: Admin access required');
    }

    // Require resolution note when resolving
    if (newStatus === 'resolved' && (!note || note.trim().length === 0)) {
      throw new Error('A resolution note is required to close an incident.');
    }

    const incidents = this.getStoredIncidents();
    const index = incidents.findIndex((i) => i.id === incidentId);
    if (index === -1) throw new Error('Incident not found');

    const inc = incidents[index];
    const previousStatus = inc.status;
    const now = new Date().toISOString();

    const updated: Incident = {
      ...inc,
      status: newStatus,
      updatedAt: now,
      lastActivityAt: now,
      resolvedAt: newStatus === 'resolved' ? now : inc.resolvedAt,
      resolutionNote: newStatus === 'resolved' ? note?.trim() : inc.resolutionNote,
      resolutionPhotoUrl: newStatus === 'resolved' ? resolutionPhotoUrl : inc.resolutionPhotoUrl,
    };

    incidents[index] = updated;
    this.setStoredIncidents(incidents);

    // Record timeline update
    const updates = this.getStoredUpdates();
    updates.push({
      id: `upd-${Date.now()}`,
      incidentId,
      actorName: currentUser.displayName,
      updateType: newStatus === 'resolved' ? 'resolution_note' : 'status_change',
      previousStatus,
      newStatus,
      note: note || (newStatus === 'in_progress' ? 'Admin moved incident to In Progress' : 'Status updated'),
      createdAt: now,
    });
    this.setStoredUpdates(updates);

    // Notify reporter and followers
    const notifMessage = newStatus === 'resolved'
      ? `Issue "${inc.title}" has been resolved: ${note}`
      : `Issue "${inc.title}" is now In Progress.`;

    this.createNotification(inc.reporterId, inc.id, 'status_change', notifMessage, inc.title);

    // Also notify any followers
    const confirmations = this.getStoredConfirmations();
    confirmations
      .filter((c) => c.incidentId === inc.id && c.userId !== inc.reporterId)
      .forEach((c) => {
        this.createNotification(c.userId, inc.id, 'status_change', notifMessage, inc.title);
      });

    return updated;
  }

  // --- Resolution Feedback ("Still an issue" reports) ---
  public submitResolutionFeedback(incidentId: string, userId: string, note: string): ResolutionFeedback {
    const raw = localStorage.getItem(STORAGE_KEY_FEEDBACK);
    const feedbackList: ResolutionFeedback[] = raw ? JSON.parse(raw) : [];
    const currentUser = this.getCurrentUser();

    const newFeedback: ResolutionFeedback = {
      id: `fb-${Date.now()}`,
      incidentId,
      userId,
      userName: currentUser.displayName,
      note: note.trim(),
      reviewStatus: 'pending',
      createdAt: new Date().toISOString(),
    };

    feedbackList.push(newFeedback);
    localStorage.setItem(STORAGE_KEY_FEEDBACK, JSON.stringify(feedbackList));

    // Notify administrator
    const adminPersona = DEMO_PERSONAS.find((p) => p.role === 'admin') || DEMO_PERSONAS[3];
    const incidents = this.getStoredIncidents();
    const inc = incidents.find((i) => i.id === incidentId);

    this.createNotification(
      adminPersona.id,
      incidentId,
      'resolution_feedback',
      `Resident reported "Still an issue" on resolved item "${inc?.title || 'Incident'}": "${note.slice(0, 80)}"`,
      inc?.title
    );

    this.notify();
    return newFeedback;
  }

  public getResolutionFeedback(incidentId?: string): ResolutionFeedback[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FEEDBACK);
      const list: ResolutionFeedback[] = raw ? JSON.parse(raw) : [];
      if (incidentId) {
        return list.filter((f) => f.incidentId === incidentId);
      }
      return list;
    } catch {
      return [];
    }
  }

  public adminReopenFromFeedback(incidentId: string, feedbackId: string, adminUserId: string, note: string): Incident {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin' || currentUser.id !== adminUserId) {
      throw new Error('Unauthorized');
    }

    // Update feedback reviewStatus
    const raw = localStorage.getItem(STORAGE_KEY_FEEDBACK);
    const list: ResolutionFeedback[] = raw ? JSON.parse(raw) : [];
    const fbIndex = list.findIndex((f) => f.id === feedbackId);
    if (fbIndex !== -1) {
      list[fbIndex].reviewStatus = 'reopened';
      localStorage.setItem(STORAGE_KEY_FEEDBACK, JSON.stringify(list));
    }

    // Reopen incident
    const incidents = this.getStoredIncidents();
    const incIndex = incidents.findIndex((i) => i.id === incidentId);
    if (incIndex === -1) throw new Error('Incident not found');

    const inc = incidents[incIndex];
    const updated: Incident = {
      ...inc,
      status: 'in_progress',
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };
    incidents[incIndex] = updated;
    this.setStoredIncidents(incidents);

    // Record timeline update
    const updates = this.getStoredUpdates();
    updates.push({
      id: `upd-${Date.now()}`,
      incidentId,
      actorName: currentUser.displayName,
      updateType: 'reopened',
      previousStatus: 'resolved',
      newStatus: 'in_progress',
      note: note || 'Reopened after reviewing resident feedback.',
      createdAt: new Date().toISOString(),
    });
    this.setStoredUpdates(updates);

    // Notify
    this.createNotification(
      inc.reporterId,
      inc.id,
      'reopened',
      `Issue "${inc.title}" has been reopened by Admin for further resolution: ${note}`,
      inc.title
    );

    return updated;
  }

  // --- Notifications ---
  public getNotifications(userId: string): NotificationItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_NOTIFS);
      const list: NotificationItem[] = raw ? JSON.parse(raw) : INITIAL_NOTIFICATIONS;
      return list
        .filter((n) => n.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  public createNotification(
    userId: string,
    incidentId: string,
    type: string,
    message: string,
    incidentTitle?: string
  ) {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFS);
    const list: NotificationItem[] = raw ? JSON.parse(raw) : INITIAL_NOTIFICATIONS;

    const notif: NotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      incidentId,
      type,
      message,
      readAt: null,
      createdAt: new Date().toISOString(),
      incidentTitle,
    };

    list.unshift(notif);
    localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(list));
    this.notify();
  }

  public markNotificationRead(notifId: string) {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFS);
    const list: NotificationItem[] = raw ? JSON.parse(raw) : INITIAL_NOTIFICATIONS;
    const index = list.findIndex((n) => n.id === notifId);
    if (index !== -1) {
      list[index].readAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(list));
      this.notify();
    }
  }

  public markAllNotificationsRead(userId: string) {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFS);
    const list: NotificationItem[] = raw ? JSON.parse(raw) : INITIAL_NOTIFICATIONS;
    const now = new Date().toISOString();
    list.forEach((n) => {
      if (n.userId === userId && !n.readAt) {
        n.readAt = now;
      }
    });
    localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(list));
    this.notify();
  }
}

export const mockService = new MockService();

