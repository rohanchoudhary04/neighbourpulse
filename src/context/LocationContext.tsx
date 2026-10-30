import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { reverseGeocode } from '../services/geocodingService';

export type LocationStatus = 'idle' | 'locating' | 'success' | 'error';

export interface LocationCoords {
  lat: number;
  lng: number;
}

export interface LocationContextType {
  status: LocationStatus;
  coords: LocationCoords | null;
  locationLabel: string | null;
  errorMessage: string | null;
  requestLocation: () => Promise<void>;
  registerRecenterHandler: (handler: (coords: LocationCoords) => void) => () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [coords, setCoords] = useState<LocationCoords | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set of registered map recenter handlers
  const handlersRef = useRef<Set<(coords: LocationCoords) => void>>(new Set());

  const registerRecenterHandler = useCallback((handler: (coords: LocationCoords) => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const notifyRecenter = useCallback((newCoords: LocationCoords) => {
    handlersRef.current.forEach((handler) => {
      try {
        handler(newCoords);
      } catch (err) {
        console.warn('Error in map recenter handler:', err);
      }
    });
  }, []);

  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setStatus('locating');
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newCoords: LocationCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCoords(newCoords);

        // Notify active map listeners immediately to recenter camera
        notifyRecenter(newCoords);

        // Perform reverse geocoding to obtain human-readable locality and city
        try {
          const resolvedName = await reverseGeocode(newCoords.lng, newCoords.lat);
          setLocationLabel(resolvedName || 'Location found');
        } catch {
          setLocationLabel('Location found');
        }

        setStatus('success');
      },
      (err) => {
        setStatus('error');
        let message = 'Location request failed.';
        if (err.code === 1) { // PERMISSION_DENIED
          message = 'Location permission denied. Please allow location in your browser.';
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          message = 'Location unavailable. Could not detect device position.';
        } else if (err.code === 3) { // TIMEOUT
          message = 'Location request timed out. Please try again.';
        }
        setErrorMessage(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [notifyRecenter]);

  return (
    <LocationContext.Provider
      value={{
        status,
        coords,
        locationLabel,
        errorMessage,
        requestLocation,
        registerRecenterHandler,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useDeviceLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useDeviceLocation must be used within a LocationProvider');
  }
  return context;
};

