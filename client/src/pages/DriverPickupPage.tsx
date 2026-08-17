import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Radio, Shield, Smartphone } from 'lucide-react';
import { api } from '../lib/api';
import { useGeofence } from '../hooks/useGeofence';
import { useRealtime } from '../hooks/useRealtime';
import type { FamilyPickupStatus, PickupZone } from '../types';

const TAG_KEY = 'carpool_hero_family_tag';

const statusLabel: Record<string, string> = {
  in_class: 'In Class',
  staged: 'Walking to Car',
  loaded: 'Picked Up ✓',
  absent: 'Absent',
};

const statusColor: Record<string, string> = {
  in_class: 'bg-stone-200 text-stone-800',
  staged: 'bg-blue-200 text-blue-900',
  loaded: 'bg-green-200 text-green-900',
  absent: 'bg-stone-100 text-stone-500',
};

export default function DriverPickupPage() {
  const [tag, setTag] = useState(() => localStorage.getItem(TAG_KEY) ?? '');
  const [savedTag, setSavedTag] = useState(() => localStorage.getItem(TAG_KEY) ?? '');
  const [zone, setZone] = useState<PickupZone | null>(null);
  const [autoArrival, setAutoArrival] = useState(true);
  const [status, setStatus] = useState<FamilyPickupStatus | null>(null);
  const [message, setMessage] = useState('');
  const arrivedRef = useRef(false);
  const { queue, applyMessage } = useRealtime();

  const { inZone, watching, error: geoError, permission } = useGeofence(zone, autoArrival && !!savedTag);

  useEffect(() => {
    api.getPickupZone().then(setZone).catch(console.error);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!savedTag) return;
    try {
      setStatus(await api.getFamilyStatus(savedTag));
    } catch {
      setStatus(null);
    }
  }, [savedTag]);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshStatus, queue]);

  // Update status from realtime queue
  useEffect(() => {
    if (!savedTag) return;
    const entry = queue.find((q) => q.tag_number === savedTag);
    if (entry) {
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              in_queue: true,
              queue_status: entry.status,
              queue_id: entry.id,
              students: entry.students.map((s) => ({
                id: s.id,
                name: `${s.first_name} ${s.last_name}`,
                grade_room: s.grade_room,
                status: s.status,
              })),
            }
          : prev
      );
    }
  }, [queue, savedTag]);

  const saveTag = () => {
    const t = tag.trim();
    if (!t) return;
    localStorage.setItem(TAG_KEY, t);
    setSavedTag(t);
    setMessage(`Family tag #${t} saved. Share this tag with anyone authorized to pick up your children.`);
    refreshStatus();
  };

  const arrive = async (source: 'geofence' | 'manual') => {
    if (!savedTag || arrivedRef.current) return;
    try {
      const item = await api.arrive(savedTag, source);
      applyMessage({ type: 'CAR_QUEUED', data: item });
      arrivedRef.current = true;
      setMessage(source === 'geofence' ? 'Auto-arrival detected! Classroom notified.' : 'Arrival sent! Classroom notified.');
      await refreshStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Arrival failed');
    }
  };

  // Auto-arrival when entering geofence (privacy: coords never leave device)
  useEffect(() => {
    if (inZone && autoArrival && savedTag && !arrivedRef.current && status && !status.in_queue) {
      arrive('geofence');
    }
    if (!inZone) arrivedRef.current = false;
  }, [inZone, autoArrival, savedTag, status]);

  return (
    <div className="max-w-md mx-auto space-y-5 pb-10">
      <div>
        <h1 className="text-2xl font-black text-stone-900">Driver Pickup</h1>
        <p className="text-sm font-bold text-stone-600 mt-1">
          Hands-free arrival — no phone use while driving
        </p>
      </div>

      {!savedTag ? (
        <div className="bg-white rounded-2xl border-4 border-stone-900 p-5 shadow-[3px_3px_0_#1c1917] space-y-3">
          <h2 className="font-black flex items-center gap-2"><Smartphone size={20} /> Link Family Tag</h2>
          <p className="text-sm text-stone-600">
            Enter your placard number. Share this tag with anyone authorized to pick up your children — it works like a family account.
          </p>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="e.g. 104"
            className="w-full text-center text-4xl font-black font-mono border-3 border-stone-900 rounded-xl py-3"
          />
          <button
            onClick={saveTag}
            className="w-full py-4 bg-brand-600 text-white rounded-xl font-black text-lg border-3 border-stone-900"
          >
            Save Family Tag
          </button>
        </div>
      ) : (
        <>
          <div className="bg-brand-100 rounded-2xl border-3 border-brand-700 p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-brand-800 uppercase">Family Tag</p>
              <p className="text-4xl font-black text-brand-900">#{savedTag}</p>
              {status && <p className="text-sm font-bold text-brand-800">{status.family_name}</p>}
            </div>
            <button
              onClick={() => { localStorage.removeItem(TAG_KEY); setSavedTag(''); setTag(''); setStatus(null); arrivedRef.current = false; }}
              className="text-xs font-bold underline text-brand-800"
            >
              Change tag
            </button>
          </div>

          <div className="bg-white rounded-2xl border-4 border-stone-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black flex items-center gap-2"><Radio size={18} /> Auto-Arrival</h2>
              <button
                onClick={() => setAutoArrival((a) => !a)}
                className={`px-3 py-1 rounded-full font-black text-sm border-2 border-stone-900 ${autoArrival ? 'bg-green-500 text-white' : 'bg-stone-200'}`}
              >
                {autoArrival ? 'ON' : 'OFF'}
              </button>
            </div>
            <p className="text-xs text-stone-600">
              When enabled, entering the pickup zone automatically notifies the classroom. Your GPS coordinates are never sent to the server.
            </p>
            <div className="flex items-center gap-2 text-sm font-bold">
              <MapPin size={16} className={inZone ? 'text-green-600' : 'text-stone-400'} />
              {watching
                ? inZone
                  ? '✓ Inside pickup zone'
                  : 'Outside pickup zone — driving toward school'
                : permission === 'denied'
                  ? 'Location permission needed for auto-arrival'
                  : 'Waiting for location…'}
            </div>
            {geoError && <p className="text-xs text-red-600 font-bold">{geoError}</p>}
          </div>

          <button
            onClick={() => arrive('manual')}
            disabled={status?.in_queue}
            className="w-full py-5 bg-green-600 text-white rounded-2xl font-black text-xl border-4 border-stone-900 shadow-[4px_4px_0_#1c1917] disabled:opacity-50 active:scale-[0.98]"
          >
            {status?.in_queue ? '✓ Already in Line' : 'I\'ve Arrived (One Tap)'}
          </button>

          {status && (
            <div className="bg-white rounded-2xl border-4 border-stone-900 p-4">
              <h2 className="font-black mb-3">Children Status</h2>
              <ul className="space-y-2">
                {status.students.map((s) => (
                  <li key={s.id} className="flex justify-between items-center p-3 rounded-xl border-2 border-stone-800">
                    <div>
                      <p className="font-black">{s.name}</p>
                      <p className="text-xs font-bold text-stone-500">{s.grade_room}</p>
                    </div>
                    <span className={`text-xs font-black px-2 py-1 rounded-lg ${statusColor[s.status] ?? statusColor.in_class}`}>
                      {statusLabel[s.status] ?? s.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-start gap-2 bg-stone-100 rounded-xl p-3 text-xs text-stone-600">
            <Shield size={16} className="shrink-0 mt-0.5 text-brand-700" />
            <p>
              <strong>Privacy:</strong> Location is checked on your device only. We send your tag number — never your coordinates.{' '}
              <a href="/faq" className="underline font-bold text-brand-700">Learn more</a>
            </p>
          </div>
        </>
      )}

      {message && (
        <div className="rounded-xl bg-amber-100 border-2 border-amber-600 px-4 py-3 text-sm font-bold text-amber-950">
          {message}
        </div>
      )}
    </div>
  );
}
