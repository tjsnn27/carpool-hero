import { useEffect, useState } from 'react';
import { MapPin, Save } from 'lucide-react';
import { api } from '../lib/api';
import type { PickupZone } from '../types';

export default function AdminPickupZonePage() {
  const [zone, setZone] = useState<PickupZone>({
    name: 'Agasthiyar Academy — Carpool Pickup Zone',
    latitude: 33.106,
    longitude: -96.737,
    radius_meters: 100,
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getPickupZone().then(setZone).catch(console.error);
  }, []);

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setZone((z) => ({
          ...z,
          latitude: Math.round(pos.coords.latitude * 1e6) / 1e6,
          longitude: Math.round(pos.coords.longitude * 1e6) / 1e6,
        }));
        setMessage('Coordinates set from your current location.');
      },
      () => setMessage('Could not get location. Enter coordinates manually.'),
      { enableHighAccuracy: true }
    );
  };

  const save = async () => {
    setLoading(true);
    setMessage('');
    try {
      await api.setPickupZone(zone);
      setMessage('Pickup zone saved. Driver auto-arrival will use this geofence.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <MapPin className="text-brand-700" size={32} />
        <div>
          <h1 className="text-2xl font-black text-stone-900">Pickup Zone</h1>
          <p className="text-sm font-bold text-stone-600">Geofence for hands-free driver arrival</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border-4 border-stone-900 p-5 space-y-4 shadow-[3px_3px_0_#1c1917]">
        <label className="block">
          <span className="text-sm font-bold text-stone-600">Zone Name</span>
          <input
            value={zone.name}
            onChange={(e) => setZone((z) => ({ ...z, name: e.target.value }))}
            className="mt-1 w-full border-2 border-stone-900 rounded-xl px-3 py-2 font-bold"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-bold text-stone-600">Latitude</span>
            <input
              type="number"
              step="any"
              value={zone.latitude}
              onChange={(e) => setZone((z) => ({ ...z, latitude: Number(e.target.value) }))}
              className="mt-1 w-full border-2 border-stone-900 rounded-xl px-3 py-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-stone-600">Longitude</span>
            <input
              type="number"
              step="any"
              value={zone.longitude}
              onChange={(e) => setZone((z) => ({ ...z, longitude: Number(e.target.value) }))}
              className="mt-1 w-full border-2 border-stone-900 rounded-xl px-3 py-2 font-mono"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-bold text-stone-600">Radius (meters)</span>
          <input
            type="number"
            value={zone.radius_meters}
            onChange={(e) => setZone((z) => ({ ...z, radius_meters: Number(e.target.value) }))}
            className="mt-1 w-full border-2 border-stone-900 rounded-xl px-3 py-2 font-mono"
          />
          <p className="text-xs text-stone-500 mt-1">Typical carpool lane: 50–150 meters</p>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={useMyLocation}
            className="px-4 py-2 bg-blue-100 border-2 border-blue-700 rounded-xl font-bold text-sm text-blue-900"
          >
            Use My Current Location
          </button>
          <button
            onClick={save}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white rounded-xl font-black border-2 border-stone-900 disabled:opacity-50"
          >
            <Save size={16} /> Save Zone
          </button>
        </div>

        {message && <p className="text-sm font-bold text-stone-700">{message}</p>}
      </div>

      <div className="text-sm text-stone-600 space-y-2 bg-stone-100 rounded-xl p-4">
        <p className="font-black text-stone-800">Privacy note for drivers</p>
        <p>
          The geofence boundary is downloaded to each driver&apos;s phone. Location is evaluated locally —
          only the family tag number is sent when a driver enters the zone. Exact coordinates are never stored on our servers.
        </p>
      </div>
    </div>
  );
}
