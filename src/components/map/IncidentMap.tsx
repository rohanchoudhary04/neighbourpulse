import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { 
  Navigation, 
  Compass, 
  Layers, 
  MapPin, 
  AlertCircle, 
  ZoomIn, 
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { Community, Incident, IncidentCategory } from '../../types';
import { isMapboxConfigured, MAPBOX_TOKEN } from '../../lib/mapbox';
import { CATEGORY_CONFIG, CategoryIcon } from '../ui/CategoryBadge';
import { useAuth } from '../../features/auth/AuthContext';
import { useDeviceLocation } from '../../context/LocationContext';
import { 
  getInitialViewport, 
  saveViewport, 
  getSavedViewport 
} from '../../services/mapViewportService';

interface IncidentMapProps {
  community: Community;
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident | null) => void;
  className?: string;
  userId?: string | null;
}

export const IncidentMap: React.FC<IncidentMapProps> = ({
  community,
  incidents,
  selectedIncident,
  onSelectIncident,
  className = '',
  userId: propUserId,
}) => {
  const { user } = useAuth();
  const { registerRecenterHandler, requestLocation, status: locStatus } = useDeviceLocation();
  const effectiveUserId = propUserId !== undefined ? propUserId : user?.id || null;

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [id: string]: mapboxgl.Marker }>({});
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Stable references for map event callbacks to avoid stale closures
  const communityRef = useRef<Community>(community);
  communityRef.current = community;

  const userIdRef = useRef<string | null>(effectiveUserId);
  userIdRef.current = effectiveUserId;

  const prevCommunityIdRef = useRef<string>(community.id);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Listen to LocationContext recenter requests (triggered by Navbar or map controls)
  useEffect(() => {
    const unregister = registerRecenterHandler((coords) => {
      if (map.current) {
        map.current.flyTo({
          center: [coords.lng, coords.lat],
          zoom: 16,
          essential: true,
        });

        // Persist viewport
        saveViewport(userIdRef.current, communityRef.current.id, {
          lng: coords.lng,
          lat: coords.lat,
          zoom: 16,
        });

        // Add or move live device marker (active session only)
        if (userMarkerRef.current) {
          userMarkerRef.current.setLngLat([coords.lng, coords.lat]);
        } else {
          const userEl = document.createElement('div');
          userEl.className = 'relative flex items-center justify-center w-5 h-5';
          userEl.innerHTML = `
            <div class="absolute w-5 h-5 rounded-full bg-blue-500 opacity-30 animate-ping"></div>
            <div class="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow"></div>
          `;

          userMarkerRef.current = new mapboxgl.Marker({ element: userEl })
            .setLngLat([coords.lng, coords.lat])
            .addTo(map.current);
        }
      }
    });

    return unregister;
  }, [registerRecenterHandler]);

  // Helper to render or update community boundary layer
  const renderBoundary = useCallback((m: mapboxgl.Map, boundary?: [number, number][]) => {
    if (!boundary || boundary.length === 0) {
      if (m.getLayer('boundary-fill')) m.removeLayer('boundary-fill');
      if (m.getLayer('boundary-line')) m.removeLayer('boundary-line');
      if (m.getSource('community-boundary')) m.removeSource('community-boundary');
      return;
    }

    const geojsonData = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [boundary],
      },
    };

    const existingSource = m.getSource('community-boundary') as mapboxgl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geojsonData);
    } else {
      m.addSource('community-boundary', {
        type: 'geojson',
        data: geojsonData,
      });

      m.addLayer({
        id: 'boundary-fill',
        type: 'fill',
        source: 'community-boundary',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.06,
        },
      });

      m.addLayer({
        id: 'boundary-line',
        type: 'line',
        source: 'community-boundary',
        paint: {
          'line-color': '#2563eb',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });
    }
  }, []);

  // Initialize Mapbox map instance ONCE on container mount
  useEffect(() => {
    if (!isMapboxConfigured || !mapContainer.current) return;

    try {
      // Initialization priority:
      // 1. Saved viewport for current user and community
      // 2. Selected community center
      // 3. Fallback
      const initialViewport = getInitialViewport(effectiveUserId, communityRef.current);

      const m = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11', // clean white aesthetic
        center: [initialViewport.lng, initialViewport.lat],
        zoom: initialViewport.zoom,
        attributionControl: false,
      });

      m.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

      // Persist viewport on moveend (fires when pan or zoom finishes, never on each frame)
      const handleMoveEnd = () => {
        try {
          const center = m.getCenter();
          const zoom = m.getZoom();
          saveViewport(userIdRef.current, communityRef.current.id, {
            lng: center.lng,
            lat: center.lat,
            zoom: zoom,
          });
        } catch (e) {
          console.warn('Could not save map viewport:', e);
        }
      };

      m.on('moveend', handleMoveEnd);

      m.on('load', () => {
        setMapLoaded(true);
        if (communityRef.current.boundary) {
          renderBoundary(m, communityRef.current.boundary);
        }
      });

      m.on('error', () => {
        setMapError(true);
      });

      map.current = m;

      return () => {
        m.off('moveend', handleMoveEnd);
        m.remove();
        map.current = null;
        userMarkerRef.current = null;
      };
    } catch (e) {
      console.warn('Mapbox initialization failed:', e);
      setMapError(true);
    }
  }, []); // Run strictly once on mount to avoid destroying canvas during rerenders

  // Handle Community Switch without re-initializing Mapbox
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (prevCommunityIdRef.current !== community.id) {
      prevCommunityIdRef.current = community.id;

      // Restore new community's saved viewport or fly to its center
      const targetViewport = getInitialViewport(effectiveUserId, community);
      map.current.flyTo({
        center: [targetViewport.lng, targetViewport.lat],
        zoom: targetViewport.zoom,
        essential: true,
      });

      // Update boundary layer
      renderBoundary(map.current, community.boundary);
    }
  }, [community.id, effectiveUserId, mapLoaded, community, renderBoundary]);

  // Update Markers when incidents change (Preserves current map camera position)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    incidents.forEach((incident) => {
      const config = CATEGORY_CONFIG[incident.category] || CATEGORY_CONFIG.water;
      
      const el = document.createElement('div');
      el.className = 'cursor-pointer transform hover:scale-110 transition-transform duration-150';
      
      const isSelected = selectedIncident?.id === incident.id;
      const ringClass = isSelected ? 'ring-4 ring-blue-600 scale-125 z-30' : 'shadow-md';

      el.innerHTML = `
        <div class="flex items-center justify-center w-8 h-8 rounded-full ${config.bg} border-2 ${config.border} ${ringClass}">
          <span class="${config.color} text-xs font-bold">${incident.category[0].toUpperCase()}</span>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectIncident(incident);
        map.current?.flyTo({
          center: [incident.longitude, incident.latitude],
          zoom: 16.5,
          speed: 1.2,
        });
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([incident.longitude, incident.latitude])
        .addTo(map.current!);

      markersRef.current[incident.id] = marker;
    });
  }, [incidents, mapLoaded, selectedIncident, onSelectIncident]);

  // Trigger Browser Geolocation via shared LocationContext
  const handleUseMyLocation = () => {
    requestLocation();
  };

  // Recenter to Community
  const handleRecenter = () => {
    if (map.current) {
      const targetLng = community.center.lng;
      const targetLat = community.center.lat;
      const targetZoom = 15;

      map.current.flyTo({
        center: [targetLng, targetLat],
        zoom: targetZoom,
        essential: true,
      });

      // Update saved viewport to recentered position
      saveViewport(effectiveUserId, community.id, {
        lng: targetLng,
        lat: targetLat,
        zoom: targetZoom,
      });
    }
  };

  // If Mapbox is not configured or throws an error, render the interactive Vector Canvas Fallback
  if (!isMapboxConfigured || mapError) {
    return (
      <div className={`relative bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex flex-col items-center justify-center p-4 ${className}`}>
        {/* Interactive Simulated Neighbourhood Grid */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
        
        {/* SVG Street Simulation */}
        <svg className="absolute inset-0 w-full h-full stroke-slate-300 stroke-2 opacity-50 pointer-events-none">
          <line x1="10%" y1="20%" x2="90%" y2="20%" strokeDasharray="6 4" />
          <line x1="10%" y1="50%" x2="90%" y2="50%" strokeWidth="4" />
          <line x1="10%" y1="80%" x2="90%" y2="80%" strokeDasharray="6 4" />
          <line x1="30%" y1="10%" x2="30%" y2="90%" strokeWidth="3" />
          <line x1="70%" y1="10%" x2="70%" y2="90%" strokeWidth="3" />
          <circle cx="50%" cy="50%" r="60" fill="none" strokeWidth="2" strokeDasharray="4 2" />
        </svg>

        {/* Informative Token Banner */}
        <div className="absolute top-3 left-3 right-3 bg-white/95 backdrop-blur-md rounded-xl p-3 border border-slate-200/80 shadow-sm z-10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <div>
              <p className="font-semibold text-slate-800">{community.name}</p>
              <p className="text-slate-500 text-[11px]">{community.locality} • Interactive Coordinate View</p>
            </div>
          </div>
          <span className="bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">
            {incidents.length} pins
          </span>
        </div>

        {/* Pin Visualizer on canvas */}
        <div className="relative w-full h-full max-h-[460px] flex items-center justify-center">
          {incidents.map((inc, index) => {
            const config = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.water;
            const isSelected = selectedIncident?.id === inc.id;

            // Generate deterministic distributed pin positions inside simulated canvas
            const offsets = [
              { top: '35%', left: '42%' },
              { top: '22%', left: '68%' },
              { top: '65%', left: '30%' },
              { top: '72%', left: '60%' },
              { top: '48%', left: '78%' },
              { top: '55%', left: '48%' },
            ];
            const pos = offsets[index % offsets.length];

            return (
              <button
                key={inc.id}
                onClick={() => onSelectIncident(inc)}
                style={{ top: pos.top, left: pos.left }}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 group transition-all duration-200 focus:outline-none z-20`}
              >
                <div className={`flex items-center justify-center w-9 h-9 rounded-full ${config.bg} border-2 ${config.border} shadow-md group-hover:scale-110 transition-transform ${isSelected ? 'ring-4 ring-blue-600 scale-125' : ''}`}>
                  <CategoryIcon category={inc.category} className="w-4 h-4" />
                </div>
                <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 bg-slate-900/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {inc.title.slice(0, 20)}...
                </div>
              </button>
            );
          })}
        </div>

        {/* Map Legend */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md rounded-xl p-2 border border-slate-200 shadow-sm z-10 flex items-center gap-3 text-[11px] text-slate-600">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Water
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Power
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Road
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Safety
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full rounded-2xl overflow-hidden border border-slate-200 ${className}`}>
      {/* Mapbox Canvas Container */}
      <div ref={mapContainer} className="w-full h-full min-h-[360px]" />

      {/* Floating Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <button
          onClick={handleRecenter}
          className="p-2.5 bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Recenter to Community"
          aria-label="Recenter Map"
        >
          <Compass className="w-5 h-5" />
        </button>

        <button
          onClick={handleUseMyLocation}
          disabled={locStatus === 'locating'}
          className={`p-2.5 bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-colors ${locStatus === 'locating' ? 'animate-pulse text-blue-600' : ''}`}
          title="Use my location (Explicit action only)"
          aria-label="Locate me"
        >
          <Navigation className="w-5 h-5" />
        </button>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md rounded-xl p-2 px-3 border border-slate-200/90 shadow-sm z-10 hidden sm:flex items-center gap-3 text-xs text-slate-600">
        <span className="font-semibold text-slate-700">Categories:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Water
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Power
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Road
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Safety
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Garbage
        </div>
      </div>
    </div>
  );
};
