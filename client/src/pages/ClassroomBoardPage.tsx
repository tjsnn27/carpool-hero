import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import { api } from '../lib/api';
import { useRealtime } from '../hooks/useRealtime';
import { pickupLocationLabel } from '../lib/pickupLocations';
import { studentStatusLabel } from '../lib/statusLabels';
import type { QueueItem } from '../types';

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    /* ignore */
  }
}

const statusStyle: Record<string, string> = {
  waiting: 'border-orange-500 bg-orange-50',
  calling: 'border-blue-500 bg-blue-50',
  pickup_arrived: 'border-indigo-500 bg-indigo-50',
  released_from_class: 'border-blue-600 bg-blue-50',
  loaded: 'border-green-600 bg-green-50',
};

const studentStatusStyle: Record<string, string> = {
  not_checked_in: 'bg-orange-200 text-orange-900',
  in_class: 'bg-stone-200 text-stone-800',
  pickup_arrived: 'bg-indigo-200 text-indigo-900',
  released_from_class: 'bg-blue-200 text-blue-900',
  loaded: 'bg-green-200 text-green-900',
  absent: 'bg-stone-100 text-stone-500',
};

export default function ClassroomBoardPage() {
  const { queue, connected, applyMessage } = useRealtime();
  const [gradeFilter, setGradeFilter] = useState('');
  const [tts, setTts] = useState(false);
  const [chime, setChime] = useState(true);
  const prevIds = useRef<Set<string>>(new Set());

  const grades = useMemo(() => {
    const set = new Set<string>();
    queue.forEach((q) => q.students.forEach((s) => set.add(s.grade_room)));
    return [...set].sort();
  }, [queue]);

  const filtered = useMemo(() => {
    if (!gradeFilter) return queue;
    return queue.filter((q) => q.students.some((s) => s.grade_room === gradeFilter));
  }, [queue, gradeFilter]);

  useEffect(() => {
    for (const item of filtered) {
      if (!prevIds.current.has(item.id) && item.status === 'waiting') {
        if (chime) playChime();
        if (tts) {
          const names = item.students
            .filter((s) => !gradeFilter || s.grade_room === gradeFilter)
            .map((s) => `${s.first_name} ${s.last_name}`)
            .join(', ');
          if (names) speak(`${names}. Student ID ${item.tag_number}. ${pickupLocationLabel(item.lane_number)}.`);
        }
      }
    }
    prevIds.current = new Set(filtered.map((q) => q.id));
  }, [filtered, chime, tts, gradeFilter]);

  const releaseStudent = async (item: QueueItem, studentId: string) => {
    const updated = await api.stageStudent(item.id, studentId);
    applyMessage({ type: 'QUEUE_UPDATED', data: updated });
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-stone-900">Dismissal Board</h1>
          <p className={`text-sm font-bold ${connected ? 'text-green-700' : 'text-red-600'}`}>
            {connected ? '● Live updates' : '○ Reconnecting…'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="border-2 border-stone-900 rounded-xl px-4 py-2 font-bold bg-white"
            aria-label="Filter by grade"
          >
            <option value="">All Grades</option>
            {grades.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <button
            onClick={() => setChime((c) => !c)}
            className={`p-2 rounded-xl border-2 border-stone-900 ${chime ? 'bg-brand-100' : 'bg-white'}`}
            aria-label="Toggle chime"
          >
            {chime ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </button>
          <button
            onClick={() => setTts((t) => !t)}
            className={`px-3 py-2 rounded-xl border-2 border-stone-900 font-bold text-sm ${tts ? 'bg-brand-600 text-white' : 'bg-white'}`}
          >
            TTS {tts ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-24 text-stone-500 font-bold text-xl">No cars in queue</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border-4 p-4 shadow-[3px_3px_0_#1c1917] ${statusStyle[item.status] ?? statusStyle.waiting}`}
            >
              <div className="flex justify-between items-start mb-3 gap-2">
                <div>
                  <p className="text-xs font-bold uppercase text-stone-600">Student ID</p>
                  <span className="text-4xl font-black text-brand-700">#{item.tag_number}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase text-stone-600">Pickup</p>
                  <span className="text-sm font-black text-stone-900 whitespace-nowrap">
                    {pickupLocationLabel(item.lane_number)}
                  </span>
                </div>
              </div>
              <p className="text-xl font-black text-stone-900 mb-2">{item.family_name}</p>

              {item.safety_notes && (
                <div className="flex items-start gap-2 bg-amber-200 border-2 border-amber-600 rounded-xl p-2 mb-3 text-amber-950 font-bold text-sm">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  {item.safety_notes}
                </div>
              )}

              <ul className="space-y-2">
                {item.students
                  .filter((s) => !gradeFilter || s.grade_room === gradeFilter)
                  .map((s) => (
                    <li key={s.id} className="flex justify-between items-center gap-2 bg-white/70 rounded-xl px-3 py-2 border-2 border-stone-800">
                      <div className="min-w-0">
                        <p className="font-black text-stone-900">{s.first_name} {s.last_name}</p>
                        <p className="text-sm font-bold text-stone-600">{s.grade_room}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-xs font-black px-2 py-1 rounded-lg whitespace-nowrap ${studentStatusStyle[s.status] ?? studentStatusStyle.in_class}`}>
                          {studentStatusLabel(s.status)}
                        </span>
                        {s.status === 'pickup_arrived' && (
                          <button
                            onClick={() => releaseStudent(item, s.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs border-2 border-stone-900 whitespace-nowrap"
                          >
                            Release from Class
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
