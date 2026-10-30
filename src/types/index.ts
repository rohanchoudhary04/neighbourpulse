export type IncidentCategory = 'water' | 'power' | 'road' | 'safety' | 'garbage' | 'animals';

export type IncidentStatus = 'open' | 'in_progress' | 'resolved';

export type VerificationState = 'unverified' | 'community_confirmed' | 'admin_verified';

export type UserRole = 'resident' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  communityId: string | null;
  communityName?: string;
}

export interface Community {
  id: string;
  name: string;
  locality: string;
  center: {
    lat: number;
    lng: number;
  };
  boundary?: [number, number][]; // coordinates for polygon
}

export interface Incident {
  id: string;
  communityId: string;
  reporterId: string;
  reporterName: string;
  hideReporterName: boolean;
  category: IncidentCategory;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  photoUrl?: string;
  status: IncidentStatus;
  adminVerified: boolean;
  urgent: boolean;
  confirmationCount: number;
  verificationState: VerificationState;
  userHasConfirmed: boolean;
  userIsFollowing: boolean;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
  resolutionPhotoUrl?: string;
}

export interface IncidentUpdate {
  id: string;
  incidentId: string;
  actorId?: string;
  actorName?: string;
  updateType: 'created' | 'status_change' | 'admin_verification' | 'resolution_note' | 'community_confirmed' | 'reopened';
  note?: string;
  previousStatus?: IncidentStatus;
  newStatus?: IncidentStatus;
  createdAt: string;
}

export interface Confirmation {
  incidentId: string;
  userId: string;
  createdAt: string;
}

export interface ResolutionFeedback {
  id: string;
  incidentId: string;
  userId: string;
  userName?: string;
  note: string;
  reviewStatus: 'pending' | 'reviewed' | 'reopened';
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  incidentId: string;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  incidentTitle?: string;
}

export interface HealthScoreResult {
  score: number | null; // null represents "Not enough data"
  label: 'Good' | 'Needs attention' | 'Critical' | 'Not enough data';
  openVerifiedCount: number;
  totalVerifiedCount: number;
  unverifiedOpenCount: number;
  hasHistory: boolean;
  message: string;
}

export interface DuplicateCandidate {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  distanceMeters: number;
  confirmationCount: number;
  createdAt: string;
}

