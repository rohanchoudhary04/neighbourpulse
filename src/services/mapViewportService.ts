/**
 * Map Viewport Persistence Service
 * 
 * Manages client-side storage for Mapbox viewport preferences (center coordinates and zoom level).
 * 
 * Rules:
 * - Scoped per user ID and community ID.
 * - Stored in browser localStorage only (zero device-tracking history sent to Supabase).
 * - Restoring a viewport does NOT display a live user location dot.
 * - Cleared on user logout.
 */

export interface MapViewport {
  lng: number;
  lat: number;
  zoom: number;
}

export const DEFAULT_MAP_FALLBACK: MapViewport = {
  lng: -122.4194,
  lat: 37.7749,
  zoom: 15,
};

/**
 * Validates coordinate and zoom ranges.
 * - Latitude: [-90, 90]
 * - Longitude: [-180, 180]
 * - Zoom: [0, 22]
 */
export function isValidViewport(vp: unknown): vp is MapViewport {
  if (!vp || typeof vp !== 'object') return false;
  const candidate = vp as Record<string, unknown>;

  const lng = candidate.lng;
  const lat = candidate.lat;
  const zoom = candidate.zoom;

  return (
    typeof lng === 'number' &&
    !isNaN(lng) &&
    isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    typeof lat === 'number' &&
    !isNaN(lat) &&
    isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof zoom === 'number' &&
    !isNaN(zoom) &&
    isFinite(zoom) &&
    zoom >= 0 &&
    zoom <= 22
  );
}

/**
 * Builds a deterministic storage key scoped by user ID and community ID.
 */
export function getViewportStorageKey(userId: string | null | undefined, communityId: string): string {
  const safeUser = userId ? userId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'guest';
  const safeComm = communityId ? communityId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'default';
  return `neighbourpulse_viewport_${safeUser}_${safeComm}`;
}

/**
 * Retrieves and validates the saved viewport for a given user and community.
 */
export function getSavedViewport(userId: string | null | undefined, communityId: string): MapViewport | null {
  try {
    const key = getViewportStorageKey(userId, communityId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (isValidViewport(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse saved map viewport:', err);
  }
  return null;
}

/**
 * Saves a validated viewport for a given user and community.
 */
export function saveViewport(userId: string | null | undefined, communityId: string, viewport: MapViewport): void {
  if (!isValidViewport(viewport)) return;

  try {
    const key = getViewportStorageKey(userId, communityId);
    localStorage.setItem(key, JSON.stringify(viewport));
  } catch (err) {
    console.warn('Failed to save map viewport to localStorage:', err);
  }
}

/**
 * Clears all saved viewports for a specific user upon logout.
 */
export function clearUserViewports(userId: string): void {
  if (!userId) return;

  try {
    const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const prefix = `neighbourpulse_viewport_${safeUser}_`;
    const keysToRemove: string[] = [];

    // Support both direct key enumeration (real browsers/jsdom) and index-based lookup
    const allKeys = Object.keys(localStorage);
    if (allKeys.length > 0) {
      for (const k of allKeys) {
        if (k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
    }

    // Fallback for environments where Object.keys(localStorage) doesn't enumerate storage keys
    if (keysToRemove.length === 0 && typeof localStorage.length === 'number' && localStorage.length > 0) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    console.warn('Failed to clear user map viewports:', err);
  }
}

/**
 * Resolves the viewport according to the strict priority rules:
 * 1. Valid saved viewport for the current user and community.
 * 2. Otherwise, selected community center.
 * 3. Otherwise, configurable fallback.
 */
export function getInitialViewport(
  userId: string | null | undefined,
  community?: { id: string; center?: { lat: number; lng: number } } | null
): MapViewport {
  if (community?.id) {
    // 1. Saved viewport
    const saved = getSavedViewport(userId, community.id);
    if (saved) {
      return saved;
    }

    // 2. Selected community center
    if (
      community.center &&
      typeof community.center.lat === 'number' &&
      !isNaN(community.center.lat) &&
      community.center.lat >= -90 &&
      community.center.lat <= 90 &&
      typeof community.center.lng === 'number' &&
      !isNaN(community.center.lng) &&
      community.center.lng >= -180 &&
      community.center.lng <= 180
    ) {
      return {
        lat: community.center.lat,
        lng: community.center.lng,
        zoom: 15,
      };
    }
  }

  // 3. Configurable fallback
  return DEFAULT_MAP_FALLBACK;
}
