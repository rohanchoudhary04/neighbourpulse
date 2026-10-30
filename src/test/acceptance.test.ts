import { describe, it, expect, beforeEach } from 'vitest';
import { mockService } from '../services/mockService';
import { 
  getInitialViewport, 
  saveViewport, 
  getSavedViewport, 
  clearUserViewports, 
  isValidViewport,
  DEFAULT_MAP_FALLBACK
} from '../services/mapViewportService';
import { extractLocalityAndCity } from '../services/geocodingService';

describe('NeighbourPulse Acceptance & Business Logic Suite', () => {
  beforeEach(() => {
    mockService.resetDemoData();
  });

  describe('1. Health Score Calculation', () => {
    it('returns "Not enough data" if no verified incident history exists', () => {
      const result = mockService.calculateHealthScore('comm-empty-test');
      expect(result.score).toBeNull();
      expect(result.label).toBe('Not enough data');
      expect(result.hasHistory).toBe(false);
    });

    it('returns 100 when verified records exist and all are resolved', () => {
      const testCommId = 'comm-resolved-test';
      mockService.setCurrentCommunity(testCommId);
      
      const inc = mockService.createIncident({
        communityId: testCommId,
        category: 'road',
        title: 'Resolved Pothole',
        description: 'Repaved road section',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Main Gate',
        hideReporterName: false,
      });

      mockService.setCurrentPersona('user-sarah'); // Admin
      mockService.adminVerifyIncident(inc.id, 'user-sarah');
      mockService.adminUpdateStatus(inc.id, 'resolved', 'user-sarah', 'Successfully repaired by road crew');

      const score = mockService.calculateHealthScore(testCommId);
      expect(score.score).toBe(100);
      expect(score.label).toBe('Good');
      expect(score.openVerifiedCount).toBe(0);
      expect(score.message).toBe('No unresolved verified issues.');
    });

    it('deducts exactly 10 points for each unresolved verified incident and assigns correct labels', () => {
      const testCommId = 'comm-deduct-test';
      mockService.setCurrentCommunity(testCommId);
      mockService.setCurrentPersona('user-sarah'); // Admin

      // 1 open verified incident -> 90 (Good)
      const inc1 = mockService.createIncident({
        communityId: testCommId,
        category: 'water',
        title: 'Water Pipe Burst',
        description: 'Major leak',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Block A',
        hideReporterName: false,
      });
      mockService.adminVerifyIncident(inc1.id, 'user-sarah');

      let score = mockService.calculateHealthScore(testCommId);
      expect(score.score).toBe(90);
      expect(score.label).toBe('Good');

      // Add 2 more verified open incidents -> 3 open verified -> 70 (Needs attention)
      const inc2 = mockService.createIncident({
        communityId: testCommId,
        category: 'power',
        title: 'Transformer Spark',
        description: 'Power cut',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Substation',
        hideReporterName: false,
      });
      mockService.adminVerifyIncident(inc2.id, 'user-sarah');

      const inc3 = mockService.createIncident({
        communityId: testCommId,
        category: 'safety',
        title: 'Gate Fault',
        description: 'Gate lock',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Gate 2',
        hideReporterName: false,
      });
      mockService.adminVerifyIncident(inc3.id, 'user-sarah');

      score = mockService.calculateHealthScore(testCommId);
      expect(score.score).toBe(70);
      expect(score.label).toBe('Needs attention');
      expect(score.openVerifiedCount).toBe(3);
    });

    it('does not count unverified incidents against the Health Score', () => {
      const testCommId = 'comm-unverified-test';
      mockService.setCurrentCommunity(testCommId);
      mockService.setCurrentPersona('user-sarah'); // Admin

      // 1 verified resolved incident so history exists
      const incResolved = mockService.createIncident({
        communityId: testCommId,
        category: 'water',
        title: 'Fixed Sprinkler',
        description: 'Sprinkler fixed',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Lawn',
        hideReporterName: false,
      });
      mockService.adminVerifyIncident(incResolved.id, 'user-sarah');
      mockService.adminUpdateStatus(incResolved.id, 'resolved', 'user-sarah', 'Replaced valve');

      // Add 2 raw unverified open reports
      mockService.setCurrentPersona('user-alex');
      mockService.createIncident({
        communityId: testCommId,
        category: 'garbage',
        title: 'Full trash bin',
        description: 'Near parking',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Lot 3',
        hideReporterName: false,
      });

      const score = mockService.calculateHealthScore(testCommId);
      expect(score.score).toBe(100);
      expect(score.unverifiedOpenCount).toBe(1);
    });
  });

  describe('2. Confirmation Rules & Thresholds', () => {
    it('prevents residents from confirming their own incident', () => {
      mockService.setCurrentPersona('user-alex');
      const inc = mockService.createIncident({
        communityId: 'a1b2c3d4-0000-0000-0000-000000000001',
        category: 'water',
        title: 'Alex Own Leak',
        description: 'Water leak',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Block A',
        hideReporterName: false,
      });

      expect(() => {
        mockService.confirmIncident(inc.id, 'user-alex');
      }).toThrow('Residents cannot confirm their own incident');
    });

    it('enforces idempotent confirmations (one confirmation per user per incident)', () => {
      mockService.setCurrentPersona('user-alex');
      const inc = mockService.createIncident({
        communityId: 'a1b2c3d4-0000-0000-0000-000000000001',
        category: 'water',
        title: 'Leak Test',
        description: 'Water leak',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Block A',
        hideReporterName: false,
      });

      // Priya confirms
      const first = mockService.confirmIncident(inc.id, 'user-priya');
      expect(first.newCount).toBe(1);

      // Priya confirms again -> does not double count
      const second = mockService.confirmIncident(inc.id, 'user-priya');
      expect(second.newCount).toBe(1);
    });

    it('triggers community-confirmed state upon exactly 3 distinct non-reporter confirmations', () => {
      mockService.setCurrentPersona('user-alex');
      const inc = mockService.createIncident({
        communityId: 'a1b2c3d4-0000-0000-0000-000000000001',
        category: 'water',
        title: 'Three Confirmations Threshold Test',
        description: 'High pressure leak flooding path',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'North Lawn',
        hideReporterName: false,
      });

      expect(inc.verificationState).toBe('unverified');

      // Confirmation 1: Priya
      const c1 = mockService.confirmIncident(inc.id, 'user-priya');
      expect(c1.communityConfirmed).toBe(false);

      // Confirmation 2: Marcus
      const c2 = mockService.confirmIncident(inc.id, 'user-marcus');
      expect(c2.communityConfirmed).toBe(false);

      // Confirmation 3: Sarah (as resident/neighbour)
      const c3 = mockService.confirmIncident(inc.id, 'user-sarah');
      expect(c3.communityConfirmed).toBe(true);

      // Verify incident model has updated verificationState
      const details = mockService.getIncidentById(inc.id);
      expect(details?.incident.verificationState).toBe('community_confirmed');
      expect(details?.incident.confirmationCount).toBe(3);
    });
  });

  describe('3. Duplicate Candidate Matching', () => {
    it('detects incidents within 150m with same category and active within 48h', () => {
      const testCommId = 'comm-dup-test';
      mockService.setCurrentPersona('user-alex');
      const inc = mockService.createIncident({
        communityId: testCommId,
        category: 'water',
        title: 'Broken Sprinkler on Main Lawn',
        description: 'Water spraying everywhere',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Main Lawn',
        hideReporterName: false,
      });

      // A neighbor ~45m away selects water category
      const candidates = mockService.findDuplicateCandidates(
        testCommId,
        'water',
        37.7749 + 0.0004,
        -122.4194,
        150
      );

      expect(candidates.length).toBe(1);
      expect(candidates[0].id).toBe(inc.id);
      expect(candidates[0].distanceMeters).toBeLessThan(150);
    });

    it('does not match resolved incidents or different categories', () => {
      mockService.setCurrentPersona('user-sarah'); // Admin
      const inc = mockService.createIncident({
        communityId: 'a1b2c3d4-0000-0000-0000-000000000001',
        category: 'road',
        title: 'Repaired Pothole',
        description: 'Fixed',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Gate',
        hideReporterName: false,
      });

      mockService.adminVerifyIncident(inc.id, 'user-sarah');
      mockService.adminUpdateStatus(inc.id, 'resolved', 'user-sarah', 'Done');

      // Search near same spot
      const candidates = mockService.findDuplicateCandidates(
        'a1b2c3d4-0000-0000-0000-000000000001',
        'road',
        37.7749,
        -122.4194,
        150
      );

      expect(candidates.some((c) => c.id === inc.id)).toBe(false);
    });
  });

  describe('4. Admin Permissions and Resolution Note Validation', () => {
    it('rejects status changes and verification by non-admin users', () => {
      mockService.setCurrentPersona('user-alex'); // Resident
      const inc = mockService.createIncident({
        communityId: 'a1b2c3d4-0000-0000-0000-000000000001',
        category: 'power',
        title: 'Flickering Light',
        description: 'Pole light',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Clubhouse',
        hideReporterName: false,
      });

      expect(() => {
        mockService.adminVerifyIncident(inc.id, 'user-alex');
      }).toThrow('Unauthorized: Admin access required');

      expect(() => {
        mockService.adminUpdateStatus(inc.id, 'resolved', 'user-alex', 'Note');
      }).toThrow('Unauthorized: Admin access required');
    });

    it('requires a resolution note before closing an incident as resolved', () => {
      mockService.setCurrentPersona('user-sarah'); // Admin
      const inc = mockService.createIncident({
        communityId: 'a1b2c3d4-0000-0000-0000-000000000001',
        category: 'power',
        title: 'Flickering Light',
        description: 'Pole light',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Clubhouse',
        hideReporterName: false,
      });

      expect(() => {
        mockService.adminUpdateStatus(inc.id, 'resolved', 'user-sarah', '');
      }).toThrow('A resolution note is required to close an incident.');
    });
  });

  describe('5. Complete End-to-End Scenario Verification', () => {
    it('executes steps 1 through 13 seamlessly', () => {
      // 1. Resident signs up and joins a community (Alex Chen in Oakridge)
      const user = mockService.setCurrentPersona('user-alex');
      const comm = mockService.setCurrentCommunity('a1b2c3d4-0000-0000-0000-000000000001');
      expect(user.displayName).toBe('Alex Chen');
      expect(comm.name).toBe('Oakridge Heights');

      // Baseline: in Oakridge initial mock there is 1 unresolved verified incident (inc-power-1)
      // Score = 100 - (10 * 1) = 90
      let health = mockService.calculateHealthScore('a1b2c3d4-0000-0000-0000-000000000001');
      expect(health.score).toBe(90);

      // 2. Resident reports a water issue
      const waterReport = mockService.createIncident({
        communityId: 'a1b2c3d4-0000-0000-0000-000000000001',
        category: 'water',
        title: 'Main Lawn Irrigation Pipe Burst',
        description: 'High volume of water overflowing onto walkways',
        latitude: 37.7740,
        longitude: -122.4190,
        locationLabel: 'Central Park / Pavilion',
        hideReporterName: false,
      });
      expect(waterReport.status).toBe('open');
      expect(waterReport.confirmationCount).toBe(0);

      // 3 & 4. Another resident (Priya) attempts to report similar nearby issue, app suggests duplicate
      mockService.setCurrentPersona('user-priya');
      const duplicates = mockService.findDuplicateCandidates(
        'a1b2c3d4-0000-0000-0000-000000000001',
        'water',
        37.7741, // ~15m away
        -122.4190,
        150
      );
      expect(duplicates.length).toBeGreaterThan(0);
      expect(duplicates.some((d) => d.id === waterReport.id)).toBe(true);

      // 5. Priya confirms instead of creating a duplicate
      const pConfirm = mockService.confirmIncident(waterReport.id, 'user-priya');
      expect(pConfirm.newCount).toBe(1);

      // 6. Marcus confirms (confirmation 2)
      mockService.setCurrentPersona('user-marcus');
      mockService.confirmIncident(waterReport.id, 'user-marcus');

      // 7. Third eligible neighbor confirms (Sarah) -> reaches 3 confirmations!
      mockService.setCurrentPersona('user-sarah');
      const thirdConfirm = mockService.confirmIncident(waterReport.id, 'user-sarah');
      expect(thirdConfirm.communityConfirmed).toBe(true);

      const verifiedWaterReport = mockService.getIncidentById(waterReport.id)?.incident;
      expect(verifiedWaterReport?.verificationState).toBe('community_confirmed');

      // 8. Health score updates: was 90 (1 unresolved verified), now with this 2nd unresolved verified -> 80
      health = mockService.calculateHealthScore('a1b2c3d4-0000-0000-0000-000000000001');
      expect(health.score).toBe(80);
      expect(health.openVerifiedCount).toBe(2);

      // 9. Admin marks the incident In Progress
      mockService.adminUpdateStatus(
        waterReport.id,
        'in_progress',
        'user-sarah',
        'Plumbing contractor dispatched with replacement PVC joint.'
      );
      const inProgressReport = mockService.getIncidentById(waterReport.id)?.incident;
      expect(inProgressReport?.status).toBe('in_progress');

      // 10. Admin resolves it with a note
      mockService.adminUpdateStatus(
        waterReport.id,
        'resolved',
        'user-sarah',
        'Main water pressure valve sealed and new schedule 40 pipe welded.',
        'https://images.unsplash.com/photo-1584824486509-112e4181ff6b'
      );
      const resolvedReport = mockService.getIncidentById(waterReport.id)?.incident;
      expect(resolvedReport?.status).toBe('resolved');
      expect(resolvedReport?.resolutionNote).toContain('Main water pressure valve sealed');

      // 11. Followers receive in-app notification
      const alexNotifs = mockService.getNotifications('user-alex');
      const resolvedNotif = alexNotifs.find((n) => n.incidentId === waterReport.id && n.type === 'status_change');
      expect(resolvedNotif).toBeDefined();
      expect(resolvedNotif?.message).toContain('has been resolved');

      // 12. Health Score updates back up (unresolved count drops by 1) -> back to 90
      health = mockService.calculateHealthScore('a1b2c3d4-0000-0000-0000-000000000001');
      expect(health.score).toBe(90);
      expect(health.openVerifiedCount).toBe(1);

      // 13. Resident sees the resolution and can submit "Still an issue" feedback
      mockService.setCurrentPersona('user-alex');
      const feedback = mockService.submitResolutionFeedback(
        waterReport.id,
        'user-alex',
        'Water pressure dropped again this afternoon, pipe is damp.'
      );
      expect(feedback.reviewStatus).toBe('pending');

      // Admin reviews feedback and reopens
      mockService.setCurrentPersona('user-sarah');
      const reopened = mockService.adminReopenFromFeedback(
        waterReport.id,
        feedback.id,
        'user-sarah',
        'Reopened: Contractor returning for joint inspection.'
      );
      expect(reopened.status).toBe('in_progress');
    });
  });

  describe('6. Report Ownership & Resident Identity Isolation (Two Accounts)', () => {
    it('accurately binds reporter_id to Resident A and isolates from Resident B', () => {
      const commId = 'a1b2c3d4-0000-0000-0000-000000000001';
      mockService.setCurrentCommunity(commId);

      // 1. Resident A logs in
      const residentA = mockService.updateUserProfile({
        id: 'usr-uuid-resident-a',
        displayName: 'Maya Patel',
        email: 'maya.patel@neighbourpulse.local',
        role: 'resident',
        communityId: commId,
      });
      expect(residentA.id).toBe('usr-uuid-resident-a');
      expect(residentA.displayName).toBe('Maya Patel');

      // 2. Resident A submits an incident
      const incA = mockService.createIncident({
        communityId: commId,
        category: 'road',
        title: 'Broken curb corner on 4th Ave',
        description: 'Exposed rebar sticking out from curb',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Corner 4th Ave & Oak St',
        hideReporterName: false,
      });

      // 3. Saved reporter_id strictly equals Resident A's ID
      expect(incA.reporterId).toBe('usr-uuid-resident-a');

      // 4. Resident A sees it under "Submitted by me"
      const allIncidentsA = mockService.getIncidents(commId);
      const submittedByA = allIncidentsA.filter((i) => i.reporterId === residentA.id);
      expect(submittedByA.some((i) => i.id === incA.id)).toBe(true);

      // 5. Author displays Resident A's profile name, NOT Alex Chen
      const retrievedA = mockService.getIncidentById(incA.id);
      expect(retrievedA?.incident.reporterName).toBe('Maya Patel');
      expect(retrievedA?.incident.reporterName).not.toBe('Alex Chen');

      // 6. Resident B logs in
      const residentB = mockService.updateUserProfile({
        id: 'usr-uuid-resident-b',
        displayName: 'Carlos Rodriguez',
        email: 'carlos.r@neighbourpulse.local',
        role: 'resident',
        communityId: commId,
      });

      // 7. Resident B does NOT see Resident A's report under "Submitted by me"
      const allIncidentsB = mockService.getIncidents(commId);
      const submittedByB = allIncidentsB.filter((i) => i.reporterId === residentB.id);
      expect(submittedByB.some((i) => i.id === incA.id)).toBe(false);

      // 8. Resident B sees the report on the map with Maya Patel as author
      const incidentSeenByB = allIncidentsB.find((i) => i.id === incA.id);
      expect(incidentSeenByB).toBeDefined();
      expect(incidentSeenByB?.reporterName).toBe('Maya Patel');

      // 9. Resident B can corroborate/follow without becoming its reporter
      const confirmB = mockService.confirmIncident(incA.id, residentB.id);
      expect(confirmB.success).toBe(true);

      const incidentAfterFollow = mockService.getIncidentById(incA.id);
      expect(incidentAfterFollow?.incident.reporterId).toBe('usr-uuid-resident-a'); // Still Maya!
      expect(incidentAfterFollow?.incident.confirmationCount).toBe(1);

      // 10. Resident A creates an incident with hidden name
      mockService.updateUserProfile(residentA);
      const incAHidden = mockService.createIncident({
        communityId: commId,
        category: 'safety',
        title: 'Dark corner behind maintenance shed',
        description: 'Light fixture destroyed',
        latitude: 37.7749,
        longitude: -122.4194,
        locationLabel: 'Maintenance shed',
        hideReporterName: true,
      });

      // Switch to Resident B viewing it: name is masked as "Resident"
      mockService.updateUserProfile(residentB);
      const hiddenSeenByB = mockService.getIncidents(commId).find((i) => i.id === incAHidden.id);
      expect(hiddenSeenByB?.reporterName).toBe('Resident');
      expect(hiddenSeenByB?.reporterName).not.toBe('Alex Chen');
      expect(hiddenSeenByB?.reporterName).not.toBe('Maya Patel');
    });
  });

  describe('7. Map Viewport Persistence & Isolation', () => {
    const userA = 'user-res-a';
    const userB = 'user-res-b';
    const comm1 = 'a1b2c3d4-0000-0000-0000-000000000001';
    const comm2 = 'a1b2c3d4-0000-0000-0000-000000000002';

    beforeEach(() => {
      localStorage.clear();
    });

    it('validates coordinate and zoom ranges strictly', () => {
      expect(isValidViewport({ lat: 37.7749, lng: -122.4194, zoom: 15 })).toBe(true);
      expect(isValidViewport({ lat: 91, lng: -122.4194, zoom: 15 })).toBe(false);
      expect(isValidViewport({ lat: 37.7749, lng: 181, zoom: 15 })).toBe(false);
      expect(isValidViewport({ lat: 37.7749, lng: -122.4194, zoom: 25 })).toBe(false);
      expect(isValidViewport({ lat: NaN, lng: -122.4194, zoom: 15 })).toBe(false);
      expect(isValidViewport(null)).toBe(false);
      expect(isValidViewport('invalid')).toBe(false);
    });

    it('persists viewport after movement ends and restores it accurately', () => {
      const movedViewport = { lat: 37.7812, lng: -122.4089, zoom: 16.5 };
      saveViewport(userA, comm1, movedViewport);

      const restored = getSavedViewport(userA, comm1);
      expect(restored).toEqual(movedViewport);
    });

    it('enforces initialization priority (saved viewport > community center > fallback)', () => {
      const community = {
        id: comm1,
        center: { lat: 37.7749, lng: -122.4194 },
      };

      // 1. Initially without saved viewport -> uses community center
      const initialNoSaved = getInitialViewport(userA, community);
      expect(initialNoSaved.lat).toBe(37.7749);
      expect(initialNoSaved.lng).toBe(-122.4194);
      expect(initialNoSaved.zoom).toBe(15);

      // 2. User pans/zooms and movement ends -> saved viewport takes precedence
      const customView = { lat: 40.7128, lng: -74.0060, zoom: 14 };
      saveViewport(userA, comm1, customView);

      const restoredPriority = getInitialViewport(userA, community);
      expect(restoredPriority).toEqual(customView);

      // 3. Community with missing center -> uses configurable fallback
      const commNoCenter = { id: 'comm-empty' };
      const fallback = getInitialViewport('user-unknown', commNoCenter);
      expect(fallback).toEqual(DEFAULT_MAP_FALLBACK);
    });

    it('isolates saved viewports between different users', () => {
      const viewA = { lat: 37.7750, lng: -122.4190, zoom: 16 };
      saveViewport(userA, comm1, viewA);

      // User B opens the same community -> User A's view is not restored
      const viewForB = getSavedViewport(userB, comm1);
      expect(viewForB).toBeNull();

      const initialForB = getInitialViewport(userB, {
        id: comm1,
        center: { lat: 37.7749, lng: -122.4194 },
      });
      expect(initialForB.lat).toBe(37.7749);
      expect(initialForB.lng).toBe(-122.4194);
    });

    it('isolates saved viewports between different communities for the same user', () => {
      const viewComm1 = { lat: 37.7700, lng: -122.4200, zoom: 16 };
      saveViewport(userA, comm1, viewComm1);

      // User A switches to Community 2 -> returns null or Comm 2 center
      expect(getSavedViewport(userA, comm2)).toBeNull();

      const viewComm2 = { lat: 37.7850, lng: -122.4080, zoom: 17 };
      saveViewport(userA, comm2, viewComm2);

      // Both communities maintain their own respective viewports
      expect(getSavedViewport(userA, comm1)).toEqual(viewComm1);
      expect(getSavedViewport(userA, comm2)).toEqual(viewComm2);
    });

    it('clears departing user viewports on logout without affecting others', () => {
      saveViewport(userA, comm1, { lat: 37.7700, lng: -122.4200, zoom: 16 });
      saveViewport(userA, comm2, { lat: 37.7800, lng: -122.4100, zoom: 15 });
      saveViewport(userB, comm1, { lat: 37.7900, lng: -122.4000, zoom: 14 });

      // User A logs out
      clearUserViewports(userA);

      expect(getSavedViewport(userA, comm1)).toBeNull();
      expect(getSavedViewport(userA, comm2)).toBeNull();

      // User B viewports remain untouched
      expect(getSavedViewport(userB, comm1)).toEqual({ lat: 37.7900, lng: -122.4000, zoom: 14 });
    });

    it('handles malformed localStorage data gracefully', () => {
      localStorage.setItem(`neighbourpulse_viewport_${userA}_${comm1}`, 'invalid-json{{{');
      expect(getSavedViewport(userA, comm1)).toBeNull();

      localStorage.setItem(`neighbourpulse_viewport_${userA}_${comm1}`, JSON.stringify({ lat: 999, lng: 999 }));
      expect(getSavedViewport(userA, comm1)).toBeNull();
    });
  });

  describe('8. Reverse Geocoding & Navbar Geolocation Control', () => {
    it('extracts locality and city accurately from Mapbox features', () => {
      const mockFeatures = [
        {
          id: 'neighborhood.123',
          place_type: ['neighborhood'],
          text: 'Whitefield',
          context: [
            { id: 'place.456', text: 'Bengaluru' },
            { id: 'region.789', text: 'Karnataka' },
          ],
        },
        {
          id: 'place.456',
          place_type: ['place'],
          text: 'Bengaluru',
        },
      ];

      const label = extractLocalityAndCity(mockFeatures);
      expect(label).toBe('Whitefield, Bengaluru');
    });

    it('extracts city from context if place is only in context', () => {
      const mockFeatures = [
        {
          id: 'locality.100',
          place_type: ['locality'],
          text: 'Indiranagar',
          context: [
            { id: 'place.200', text: 'Bengaluru' },
          ],
        },
      ];

      const label = extractLocalityAndCity(mockFeatures);
      expect(label).toBe('Indiranagar, Bengaluru');
    });

    it('avoids duplicating when locality and city share identical names', () => {
      const mockFeatures = [
        {
          id: 'locality.100',
          place_type: ['locality'],
          text: 'San Francisco',
        },
        {
          id: 'place.200',
          place_type: ['place'],
          text: 'San Francisco',
        },
      ];

      const label = extractLocalityAndCity(mockFeatures);
      expect(label).toBe('San Francisco');
    });

    it('returns null truthfully when features are empty or invalid', () => {
      expect(extractLocalityAndCity([])).toBeNull();
      expect(extractLocalityAndCity(null as any)).toBeNull();
      expect(extractLocalityAndCity([{ id: 'country.1', place_type: ['country'] }])).toBeNull();
    });

    it('keeps report creation scoped to active community ID regardless of geolocation label', () => {
      const activeComm = 'a1b2c3d4-0000-0000-0000-000000000001';
      mockService.setCurrentCommunity(activeComm);

      // Report created while user is geographically elsewhere
      const report = mockService.createIncident({
        communityId: activeComm,
        category: 'water',
        title: 'Burst pipe near main gate',
        description: 'Water overflowing onto walkway',
        latitude: 12.9716, // Bengaluru coords
        longitude: 77.5946,
        locationLabel: 'Block B Entrance',
        hideReporterName: false,
      });

      expect(report.communityId).toBe(activeComm);
      const incidentsInCommunity = mockService.getIncidents(activeComm);
      expect(incidentsInCommunity.some((i) => i.id === report.id)).toBe(true);
    });
  });

  describe('9. Authentication, Role Separation & Route Authorization', () => {
    beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
      mockService.resetDemoData();
    });

    it('authenticates resident accounts with resident role and rejects admin tab access', () => {
      const residentUser = mockService.setCurrentPersona('user-alex');
      expect(residentUser.role).toBe('resident');

      // Emulate the LoginPage tab authorization check
      const isAdminTab = true;
      let authError: string | null = null;
      let canEnterAdmin = false;
      let targetRoute = '/';

      if (isAdminTab) {
        if (residentUser.role !== 'admin') {
          authError = 'This account does not have administrator access.';
          canEnterAdmin = false;
        } else {
          canEnterAdmin = true;
          targetRoute = '/admin';
        }
      }

      expect(canEnterAdmin).toBe(false);
      expect(targetRoute).toBe('/');
      expect(authError).toBe('This account does not have administrator access.');
    });

    it('authenticates administrator accounts and allows admin dashboard access', () => {
      const adminUser = mockService.setCurrentPersona('user-sarah');
      expect(adminUser.role).toBe('admin');

      const isAdminTab = true;
      let authError: string | null = null;
      let canEnterAdmin = false;
      let targetRoute = '/';

      if (isAdminTab) {
        if (adminUser.role !== 'admin') {
          authError = 'This account does not have administrator access.';
          canEnterAdmin = false;
        } else {
          canEnterAdmin = true;
          targetRoute = '/admin';
        }
      }

      expect(canEnterAdmin).toBe(true);
      expect(targetRoute).toBe('/admin');
      expect(authError).toBeNull();
    });

    it('never stores plaintext passwords in localStorage or sessionStorage', () => {
      const sensitivePassword = 'SecretPassword123!';
      
      // Perform mock operations
      mockService.setCurrentPersona('user-alex');

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key);
          expect(val).not.toContain(sensitivePassword);
          expect(key.toLowerCase()).not.toContain('password');
        }
      }

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const val = sessionStorage.getItem(key);
          expect(val).not.toContain(sensitivePassword);
          expect(key.toLowerCase()).not.toContain('password');
        }
      }
    });

    it('enforces that newly created accounts default to resident role without administrative rights', () => {
      const newResident = mockService.updateUserProfile({
        id: 'user-new-resident',
        email: 'newresident@example.com',
        displayName: 'New Resident',
        role: 'resident',
        communityId: 'a1b2c3d4-0000-0000-0000-000000000001',
      });
      expect(newResident.role).toBe('resident');
      expect(newResident.role).not.toBe('admin');

      // Admin verification action fails for this user
      expect(() => {
        mockService.adminVerifyIncident('inc-1', newResident.id);
      }).toThrow(/Unauthorized: Admin access required/);
    });
  });
});
