import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { useRealtime } from '../hooks/useRealtime';
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
  staged: 'border-blue-600 bg-blue-50',
  loaded: 'border-green-600 bg-green-50',
};

export default function ClassroomBoardPage() {
  const { queue, connected, applyMessage } = useRealtime();
  const { teacherGradeRooms, hasRole } = useAuth();
  const [gradeFilter, setGradeFilter] = useState('');
  const [autoGated, setAutoGated] = useState(false);
  const [tts, setTts] = useState(false);
  const [chime, setChime] = useState(true);
  const prevIds = useRef<Set<string>>(new Set());

  // Auto-gate teachers to their M365 class group
  useEffect(() => {
    if (!autoGated && teacherGradeRooms.length === 1 && hasRole('teacher') && !hasRole('admin')) {
      setGradeFilter(teacherGradeRooms[0]);
      setAutoGated(true);
    }
  }, [teacherGradeRooms, autoGated, hasRole]);

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
          if (names) speak(`${names}. Tag ${item.tag_number}.`);
        }
      }
    }
    prevIds.current = new Set(filtered.map((q) => q.id));
  }, [filtered, chime, tts, gradeFilter]);

  const stageStudent = async (item: QueueItem, studentId: string) => {
    const updated = await api.stageStudent(item.id, studentId);
    applyMessage({ type: 'QUEUE_UPDATED', data: updated });
  };

  const markLoaded = async (item: QueueItem) => {
    await api.updateQueue(item.id, 'loaded');
    applyMessage({ type: 'QUEUE_REMOVED', data: { id: item.id } });
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-stone-900">Dismissal Board</h1>
          <p className={`text-sm font-bold ${connected ? 'text-green-700' : 'text-red-600'}`}>
            {connected ? '● Live updates' : '○ Reconnecting…'}
          </p>
          {teacherGradeRooms.length > 0 && (
            <p className="text-xs font-bold text-brand-700 mt-1">
              Your class{teacherGradeRooms.length > 1 ? 'es' : ''}: {teacherGradeRooms.join(', ')}
            </p>
          )}
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
              <div className="flex justify-between items-start mb-3">
                <span className="text-4xl font-black text-brand-700">#{item.tag_number}</span>
                <span className="text-xs font-black uppercase px-2 py-1 rounded-lg bg-white border-2 border-stone-900">
                  {item.status}
                </span>
              </div>
              <p className="text-xl font-black text-stone-900 mb-2">{item.family_name}</p>

              {item.safety_notes && (
                <div className="flex items-start gap-2 bg-amber-200 border-2 border-amber-600 rounded-xl p-2 mb-3 text-amber-950 font-bold text-sm">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  {item.safety_notes}
                </div>
              )}

              <ul className="space-y-2 mb-4">
                {item.students
                  .filter((s) => !gradeFilter || s.grade_room === gradeFilter)
                  .map((s) => (
                    <li key={s.id} className="flex justify-between items-center bg-white/70 rounded-xl px-3 py-2 border-2 border-stone-800">
                      <div>
                        <p className="font-black text-stone-900">{s.first_name} {s.last_name}</p>
                        <p className="text-sm font-bold text-stone-600">{s.grade_room}</p>
                      </div>
                      {s.status !== 'staged' && s.status !== 'loaded' && (
                        <button
                          onClick={() => stageStudent(item, s.id)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-sm border-2 border-stone-900"
                        >
                          Stage →
                        </button>
                      )}
                    </li>
                  ))}
              </ul>

              <button
                onClick={() => markLoaded(item)}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-black text-lg border-3 border-stone-900 active:scale-[0.98]"
              >
                ✓ Dismiss / Loaded
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
