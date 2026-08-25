import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Delete, Undo2, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useRealtime } from '../hooks/useRealtime';
import { studentStatusLabel } from '../lib/statusLabels';
import { PICKUP_LOCATIONS, pickupLocationLabel } from '../lib/pickupLocations';
import type { QueueItem } from '../types';
import { TAG_NUMBER_MAX_LENGTH } from '../types';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'enter'] as const;

export default function LaneScannerPage() {
  const { queue, connected, applyMessage } = useRealtime();
  const [input, setInput] = useState('');
  const [lane, setLane] = useState(1);
  const [scannerMode, setScannerMode] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingStudentId, setLoadingStudentId] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = 'lane-qr';

  const recent = queue.slice(-3).reverse();
  const activeQueue = queue.filter((q) => q.status !== 'loaded' && q.status !== 'cancelled');

  const flash = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 2000);
    if (ok) navigator.vibrate?.(80);
  };

  const submit = useCallback(
    async (tag: string) => {
      const tagNumber = tag.trim();
      if (!tagNumber || pending) return;
      setPending(true);

      setInput('');
      try {
        const item = await api.checkIn(tagNumber, lane);
        applyMessage({ type: 'CAR_QUEUED', data: item });
        flash(true, `ID ${tagNumber} — ${item.family_name}`);
      } catch (err) {
        flash(false, err instanceof Error ? err.message : 'Check-in failed');
      } finally {
        setPending(false);
      }
    },
    [lane, pending, applyMessage]
  );

  const handleKey = (key: string) => {
    if (key === 'clear') setInput('');
    else if (key === 'enter') submit(input);
    else setInput((v) => (v.length < TAG_NUMBER_MAX_LENGTH ? v + key : v));
  };

  const handleUndo = async () => {
    try {
      const { undone } = await api.undoLast();
      if (undone) {
        applyMessage({ type: 'QUEUE_REMOVED', data: { id: undone.id } });
        flash(true, `Undid ID ${undone.tag_number}`);
      }
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Undo failed');
    }
  };

  const markLoaded = async (item: QueueItem, studentId: string) => {
    setLoadingStudentId(studentId);
    try {
      const updated = await api.loadStudent(item.id, studentId);
      if (updated.status === 'loaded') {
        applyMessage({ type: 'QUEUE_REMOVED', data: { id: updated.id } });
        flash(true, `${updated.family_name} — all loaded`);
      } else {
        applyMessage({ type: 'QUEUE_UPDATED', data: updated });
        flash(true, 'Student loaded into pickup vehicle');
      }
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoadingStudentId(null);
    }
  };

  useEffect(() => {
    if (!scannerMode) {
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
      return;
    }
    const scanner = new Html5Qrcode(scannerDivId);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decoded) => submit(decoded.replace(/^TAG:/i, '').trim()),
        () => {}
      )
      .catch(() => {
        flash(false, 'Camera unavailable');
        setScannerMode(false);
      });
    return () => {
      scanner.stop().catch(() => {});
    };
  }, [scannerMode, submit]);

  return (
    <div className="max-w-md mx-auto space-y-4 pb-8">
      <div className="bg-stone-100 border-2 border-stone-400 rounded-xl px-4 py-3 text-sm font-bold text-stone-700">
        Enter the Student ID from the car placard. Mark each released student with Load into Pickup vehicle once they are in the car.
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">Traffic Control</h1>
          <p className={`text-sm font-semibold ${connected ? 'text-green-700' : 'text-red-600'}`}>
            {connected ? '● Live' : '○ Offline'}
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={lane}
            onChange={(e) => setLane(Number(e.target.value))}
            className="bg-white border-2 border-stone-900 rounded-xl px-3 py-2 font-bold text-stone-900 max-w-[10rem]"
            aria-label="Pickup location"
          >
            {PICKUP_LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.label}</option>
            ))}
          </select>
          <button
            onClick={() => setScannerMode((m) => !m)}
            className={`p-3 rounded-xl border-2 border-stone-900 ${scannerMode ? 'bg-brand-600 text-white' : 'bg-white text-stone-900'}`}
            aria-label="Toggle QR scanner"
          >
            <Camera size={24} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl px-4 py-4 text-center text-xl font-black border-4 ${
            feedback.ok
              ? 'bg-green-100 border-green-700 text-green-900'
              : 'bg-red-100 border-red-700 text-red-900'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {scannerMode && (
        <div className="rounded-2xl overflow-hidden border-4 border-stone-900">
          <div id={scannerDivId} />
        </div>
      )}

      <div className="bg-white rounded-3xl border-4 border-stone-900 p-5 shadow-[4px_4px_0_#1c1917]">
        <p className="text-center text-sm font-bold text-stone-600 uppercase tracking-widest mb-2">Student ID</p>
        <div className="text-center text-6xl font-black text-brand-700 min-h-[4rem] font-mono tracking-wider mb-4">
          {input || '—'}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((key) => (
            <button
              key={key}
              disabled={pending}
              onClick={() => handleKey(key)}
              className={`min-h-[4.5rem] rounded-2xl border-3 border-stone-900 font-black active:scale-95 transition-transform disabled:opacity-50 ${
                key === 'enter'
                  ? 'bg-green-600 text-white text-2xl'
                  : key === 'clear'
                    ? 'bg-stone-200 text-stone-900'
                    : 'bg-amber-50 text-stone-900 text-3xl'
              }`}
            >
              {key === 'clear' ? <Delete className="mx-auto" size={28} /> : key === 'enter' ? <Check className="mx-auto" size={32} /> : key}
            </button>
          ))}
        </div>
      </div>

      {activeQueue.length > 0 && (
        <div className="bg-white rounded-2xl border-4 border-stone-900 p-4 space-y-3">
          <h2 className="font-black text-stone-900">Active pickups</h2>
          {activeQueue.map((item) => (
            <div key={item.id} className="border-2 border-stone-800 rounded-xl p-3">
              <div className="flex justify-between items-baseline mb-2 gap-2">
                <span className="text-2xl font-black text-brand-700">ID {item.tag_number}</span>
                <div className="text-right">
                  <span className="font-bold text-stone-800 block">{item.family_name}</span>
                  <span className="text-xs font-bold text-stone-600">{pickupLocationLabel(item.lane_number)}</span>
                </div>
              </div>
              <ul className="space-y-2">
                {item.students.map((s) => (
                  <li key={s.id} className="flex justify-between items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="font-bold text-stone-900">{s.first_name} {s.last_name}</p>
                      <p className="text-xs font-bold text-stone-600 whitespace-nowrap">{studentStatusLabel(s.status)}</p>
                    </div>
                    {s.status === 'staged' && (
                      <button
                        disabled={loadingStudentId === s.id}
                        onClick={() => markLoaded(item, s.id)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg font-black text-xs border-2 border-stone-900 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        Load into Pickup vehicle
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="bg-white rounded-2xl border-4 border-stone-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-stone-900">Last 3</h2>
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 px-3 py-2 bg-red-100 border-2 border-red-700 rounded-xl text-red-900 font-bold text-sm"
            >
              <Undo2 size={16} /> Undo
            </button>
          </div>
          <ul className="space-y-2">
            {recent.map((q: QueueItem) => (
              <li key={q.id} className="flex justify-between font-bold text-stone-800">
                <span className="text-brand-700 text-xl">ID {q.tag_number}</span>
                <span>{q.family_name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
