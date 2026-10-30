import { MAPBOX_TOKEN, isMapboxConfigured } from '../lib/mapbox';

/**
 * Reverse geocodes [lng, lat] coordinates to a human-readable locality and city
 * using the Mapbox Geocoding API v5.
 *
 * Privacy & Granularity:
 * - Uses types=neighborhood,locality,place,district to restrict granularity to locality/city.
 * - Does NOT request rooftop addresses or POIs.
 * - Does NOT invent a place name on failure; returns null so the caller can fall back to "Location found".
 */
export async function reverseGeocode(lng: number, lat: number): Promise<string | null> {
  if (!isMapboxConfigured || !MAPBOX_TOKEN) {
    return null;
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=neighborhood,locality,place,district&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`Mapbox reverse geocode returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.features) || data.features.length === 0) {
      return null;
    }

    return extractLocalityAndCity(data.features);
  } catch (err) {
    console.warn('Mapbox reverse geocoding network error:', err);
    return null;
  }
}

/**
 * Extracts a clean "Locality, City" or "City" string from Mapbox GeoJSON features.
 */
export function extractLocalityAndCity(features: any[]): string | null {
  if (!Array.isArray(features) || features.length === 0) {
    return null;
  }

  // Find neighborhood / locality
  const neighborhoodFeature = features.find((f: any) =>
    Array.isArray(f.place_type) &&
    (f.place_type.includes('neighborhood') || f.place_type.includes('locality'))
  );

  // Find city / place / district
  const placeFeature = features.find((f: any) =>
    Array.isArray(f.place_type) &&
    (f.place_type.includes('place') || f.place_type.includes('district'))
  );

  const localityName = neighborhoodFeature?.text?.trim();
  let cityName = placeFeature?.text?.trim();

  // If neighborhood exists but city wasn't found as a top-level feature, inspect context
  if (neighborhoodFeature && !cityName && Array.isArray(neighborhoodFeature.context)) {
    const placeContext = neighborhoodFeature.context.find((c: any) =>
      typeof c.id === 'string' && (c.id.startsWith('place.') || c.id.startsWith('district.'))
    );
    if (placeContext?.text) {
      cityName = placeContext.text.trim();
    }
  }

  if (localityName && cityName) {
    // If locality and city happen to be identical, display only once
    if (localityName.toLowerCase() === cityName.toLowerCase()) {
      return cityName;
    }
    return `${localityName}, ${cityName}`;
  }

  if (localityName) {
    return localityName;
  }

  if (cityName) {
    return cityName;
  }

  // Fallback to top feature text if available
  const topText = features[0]?.text?.trim();
  return topText || null;
}

