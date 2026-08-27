import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Delete, Search } from 'lucide-react';
import { api } from '../lib/api';
import { studentStatusLabel } from '../lib/statusLabels';
import type { RosterStudent } from '../types';
import { TAG_NUMBER_MAX_LENGTH } from '../types';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'enter'] as const;

function studentNameSort(a: RosterStudent, b: RosterStudent): number {
  const byFirst = a.first_name.localeCompare(b.first_name, undefined, { sensitivity: 'base' });
  if (byFirst !== 0) return byFirst;
  return a.last_name.localeCompare(b.last_name, undefined, { sensitivity: 'base' });
}

export default function MorningCheckInPage() {
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const roster = await api.getRoster();
    setStudents(roster.students);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'STUDENT_CHECKED_IN') {
          setStudents((prev) => prev.map((s) => (s.id === msg.data.id ? { ...s, ...msg.data } : s)));
        }
        if (msg.type === 'SESSION_RESET') {
          load();
        }
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  const flash = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 2500);
    if (ok) navigator.vibrate?.(80);
  };

  const checkInStudent = async (student: RosterStudent) => {
    setCheckingId(student.id);
    try {
      const updated = await api.morningCheckInStudent(student.id);
      setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      flash(true, `${updated.first_name} checked in`);
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setCheckingId(null);
    }
  };

  const submitTag = useCallback(
    async (tag: string) => {
      const tagNumber = tag.trim();
      if (!tagNumber || pending) return;
      setPending(true);
      setInput('');
      try {
        const updated = await api.morningCheckIn(tagNumber);
        setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        flash(true, `${updated.first_name} checked in`);
      } catch (err) {
        flash(false, err instanceof Error ? err.message : 'Check-in failed');
      } finally {
        setPending(false);
      }
    },
    [pending]
  );

  const handleKey = (key: string) => {
    if (key === 'clear') setInput('');
    else if (key === 'enter') submitTag(input);
    else setInput((v) => (v.length < TAG_NUMBER_MAX_LENGTH ? v + key : v));
  };

  const grades = useMemo(() => [...new Set(students.map((s) => s.grade_room))].sort(), [students]);

  const notCheckedIn = useMemo(() => {
    const q = search.toLowerCase();
    return students
      .filter((s) => {
        if (s.status !== 'not_checked_in') return false;
        if (gradeFilter && s.grade_room !== gradeFilter) return false;
        if (!q) return true;
        return (
          s.first_name.toLowerCase().includes(q) ||
          s.last_name.toLowerCase().includes(q) ||
          s.tag_number.includes(q) ||
          s.grade_room.toLowerCase().includes(q)
        );
      })
      .sort(studentNameSort);
  }, [students, search, gradeFilter]);

  const checkedInCount = students.filter((s) => s.status === 'in_class').length;

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-stone-900">Morning Check-In</h1>
            <p className="text-sm font-bold text-stone-600 mt-1">
              {checkedInCount} checked in · {students.length - checkedInCount} not checked in
            </p>
          </div>
          <div className="flex gap-2 mt-1">
            <ExportButtons />
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl px-4 py-3 text-center font-black border-4 ${
            feedback.ok ? 'bg-green-100 border-green-700 text-green-900' : 'bg-red-100 border-red-700 text-red-900'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      <div className="bg-white rounded-3xl border-4 border-stone-900 p-5 shadow-[4px_4px_0_#1c1917]">
        <p className="text-center text-sm font-bold text-stone-600 uppercase tracking-widest mb-2">Student ID</p>
        <div className="text-center text-5xl font-black text-brand-700 min-h-[3.5rem] font-mono tracking-wider mb-4">
          {input || '—'}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((key) => (
            <button
              key={key}
              disabled={pending}
              onClick={() => handleKey(key)}
              className={`min-h-[3.5rem] rounded-2xl border-3 border-stone-900 font-black active:scale-95 disabled:opacity-50 ${
                key === 'enter'
                  ? 'bg-green-600 text-white'
                  : key === 'clear'
                    ? 'bg-stone-200'
                    : 'bg-amber-50 text-2xl'
              }`}
            >
              {key === 'clear' ? <Delete className="mx-auto" size={24} /> : key === 'enter' ? <Check className="mx-auto" size={28} /> : key}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border-4 border-stone-900 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[10rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or ID…"
              className="w-full pl-9 pr-3 py-2 border-2 border-stone-900 rounded-xl font-bold"
            />
          </div>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="border-2 border-stone-900 rounded-xl px-3 py-2 font-bold bg-white"
            aria-label="Filter by grade"
          >
            <option value="">All Grades</option>
            {grades.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <h2 className="font-black text-stone-900">Not checked in ({notCheckedIn.length})</h2>
        {notCheckedIn.length === 0 ? (
          <p className="text-stone-500 font-bold text-center py-6">Everyone is checked in</p>
        ) : (
          <ul className="space-y-2 max-h-[24rem] overflow-y-auto">
            {notCheckedIn.map((s) => (
              <li
                key={s.id}
                className="flex justify-between items-center gap-2 bg-stone-50 rounded-xl px-3 py-2 border-2 border-stone-800"
              >
                <div className="min-w-0">
                  <p className="font-black text-stone-900 truncate">
                    {s.first_name} {s.last_name}
                  </p>
                  <p className="text-xs font-bold text-stone-600">
                    ID {s.tag_number} · {s.grade_room}
                  </p>
                  <p className="text-xs font-bold text-orange-700">{studentStatusLabel(s.status)}</p>
                </div>
                <button
                  disabled={checkingId === s.id}
                  onClick={() => checkInStudent(s)}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg font-black text-xs border-2 border-stone-900 disabled:opacity-50 shrink-0"
                >
                  Check In
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ExportButtons() {
  const [busy, setBusy] = useState(false);

  const doDownload = async (format: 'csv' | 'xlsx') => {
    try {
      setBusy(true);
      const { blob, filename } = await api.exportAttendance(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => doDownload('csv')}
        disabled={busy}
        className="px-3 py-1 bg-stone-200 rounded-lg font-bold border-2 border-stone-900"
      >
        Export CSV
      </button>
      <button
        onClick={() => doDownload('xlsx')}
        disabled={busy}
        className="px-3 py-1 bg-stone-200 rounded-lg font-bold border-2 border-stone-900"
      >
        Export Excel
      </button>
    </>
  );
}
