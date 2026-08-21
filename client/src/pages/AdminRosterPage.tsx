import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudDownload, Search, Upload, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import type { RosterData, RosterStudent } from '../types';
import { studentStatusLabel } from '../lib/statusLabels';

export default function AdminRosterPage() {
  const { refreshRosterGrades } = useAuth();
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [search, setSearch] = useState('');
  const [csvText, setCsvText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setRoster(await api.getRoster());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered: RosterStudent[] = (roster?.students ?? []).filter((s) => {
    const q = search.toLowerCase();
    return (
      !q ||
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      s.family_name.toLowerCase().includes(q) ||
      s.tag_number.includes(q) ||
      s.grade_room.toLowerCase().includes(q)
    );
  });

  const syncM365 = async () => {
    setLoading(true);
    setResult('');
    try {
      const r = await api.syncM365Roster();
      setResult(`M365 sync: ${r.studentsSynced} new students from ${r.groupsSynced} groups (${r.groups.join(', ')}).`);
      await load();
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'M365 sync failed');
    } finally {
      setLoading(false);
    }
  };

  const importCsv = async (csv: string) => {
    setLoading(true);
    setResult('');
    try {
      const r = await api.importCsv(csv);
      setResult(`Imported ${r.rowsProcessed} rows — ${r.familiesCreated} families, ${r.studentsCreated} new students, ${r.studentsUpdated} updated.`);
      await load();
      await refreshRosterGrades();
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const sample = `StudentID,StudentFirstName,FamilyName,GradeRoom
104,Emma,Smith Family,Grade 1
205,Liam,Johnson Family,Grade 2
312,Sophia,Williams Family,Grade 1`;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Users className="text-brand-700" size={32} />
        <div>
          <h1 className="text-2xl font-black text-stone-900">Roster & Tags</h1>
          <p className="text-sm font-bold text-stone-600">{roster?.students.length ?? 0} students · {roster?.families.length ?? 0} families</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={syncM365}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black border-2 border-stone-900 disabled:opacity-50"
        >
          <CloudDownload size={18} /> Sync from Microsoft 365
        </button>
      </div>

      <div className="bg-white rounded-2xl border-4 border-stone-900 p-5 shadow-[3px_3px_0_#1c1917]">
        <h2 className="font-black text-lg mb-3 flex items-center gap-2"><Upload size={20} /> CSV Import</h2>
        <p className="text-sm text-stone-600 mb-3 font-medium">
          Required columns only: StudentID, StudentFirstName, FamilyName, GradeRoom (comma or tab separated)
        </p>
        <div
          className="border-3 border-dashed border-stone-400 rounded-xl p-8 text-center cursor-pointer hover:border-brand-600 mb-3"
          onClick={() => fileRef.current?.click()}
        >
          <p className="font-bold text-stone-700">Drop CSV or click to upload</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) importCsv(await f.text());
          }} />
        </div>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={sample}
          rows={5}
          className="w-full border-2 border-stone-900 rounded-xl p-3 font-mono text-sm mb-2"
        />
        <button
          disabled={!csvText.trim() || loading}
          onClick={() => importCsv(csvText)}
          className="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-black border-2 border-stone-900 disabled:opacity-50"
        >
          Import CSV
        </button>
        {result && <p className="mt-3 text-sm font-bold text-stone-700">{result}</p>}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={20} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, family, Student ID, grade…"
          className="w-full pl-10 pr-4 py-3 border-3 border-stone-900 rounded-xl font-bold bg-white"
        />
      </div>

      <div className="overflow-x-auto bg-white rounded-2xl border-4 border-stone-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-100 border-b-2 border-stone-900 text-left">
              <th className="p-3 font-black">Student ID</th>
              <th className="p-3 font-black">Student</th>
              <th className="p-3 font-black">Family</th>
              <th className="p-3 font-black">Grade</th>
              <th className="p-3 font-black">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-stone-200">
                <td className="p-3 font-mono font-black text-brand-700">{s.tag_number}</td>
                <td className="p-3 font-bold">{s.first_name} {s.last_name}</td>
                <td className="p-3">{s.family_name}</td>
                <td className="p-3 font-bold">{s.grade_room}</td>
                <td className="p-3">
                  <span className="text-xs font-black px-2 py-0.5 rounded bg-stone-100">{studentStatusLabel(s.status)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
