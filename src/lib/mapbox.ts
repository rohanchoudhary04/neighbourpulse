import mapboxgl from 'mapbox-gl';

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export const isMapboxConfigured = Boolean(
  MAPBOX_TOKEN && 
  MAPBOX_TOKEN.startsWith('pk.') && 
  MAPBOX_TOKEN.length > 20
);

if (isMapboxConfigured) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

export default mapboxgl;

