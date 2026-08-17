import { useCallback, useEffect, useRef, useState } from 'react';
import { isInsideZone } from '../lib/geofence';
import type { PickupZone } from '../types';

interface GeofenceState {
  inZone: boolean;
  watching: boolean;
  error: string | null;
  permission: PermissionState | 'unsupported' | 'unknown';
}

export function useGeofence(zone: PickupZone | null, enabled: boolean) {
  const [state, setState] = useState<GeofenceState>({
    inZone: false,
    watching: false,
    error: null,
    permission: 'unknown',
  });
  const watchId = useRef<number | null>(null);
  const wasInZone = useRef(false);

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setState((s) => ({ ...s, watching: false }));
  }, []);

  useEffect(() => {
    if (!enabled || !zone) {
      stop();
      return;
    }

    if (!('geolocation' in navigator)) {
      setState({ inZone: false, watching: false, error: 'Geolocation not supported', permission: 'unsupported' });
      return;
    }

    setState((s) => ({ ...s, watching: true, error: null }));

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const inZone = isInsideZone(pos.coords.latitude, pos.coords.longitude, zone);
        setState((s) => ({ ...s, inZone, error: null, permission: 'granted' }));
        wasInZone.current = inZone;
      },
      (err) => {
        setState((s) => ({
          ...s,
          error: err.message,
          permission: err.code === 1 ? 'denied' : 'unknown',
          watching: false,
        }));
      },
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 }
    );

    return stop;
  }, [enabled, zone, stop]);

  return { ...state, wasInZone: wasInZone.current, stop };
}
