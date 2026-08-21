import { useCallback, useEffect, useState } from 'react';
import { Hash, Plus, Save, Tag, Users } from 'lucide-react';
import { api } from '../lib/api';
import type { Student, TagRecord, UpsertTagPayload } from '../types';
import { sanitizeTagNumberInput } from '../types';

const emptyForm: UpsertTagPayload = {
  tag_number: '',
  family_name: '',
  primary_phone: '',
  authorized_pickups: [],
  safety_notes: '',
  student_ids: [],
};

export default function AdminTagsPage() {
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [unassigned, setUnassigned] = useState<Student[]>([]);
  const [form, setForm] = useState<UpsertTagPayload>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [pickupsText, setPickupsText] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const [t, u] = await Promise.all([api.getTags(), api.getUnassignedStudents()]);
    setTags(t);
    setUnassigned(u);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (tag: TagRecord) => {
    setEditing(tag.tag_number);
    setForm({
      tag_number: tag.tag_number,
      family_name: tag.family_name,
      primary_phone: tag.primary_phone ?? '',
      authorized_pickups: tag.authorized_pickups,
      safety_notes: tag.safety_notes,
      student_ids: tag.students.map((s) => s.id),
    });
    setPickupsText(tag.authorized_pickups.join('; '));
  };

  const startNew = () => {
    setEditing('new');
    setForm(emptyForm);
    setPickupsText('');
  };

  const toggleStudent = (id: string) => {
    setForm((f) => ({
      ...f,
      student_ids: f.student_ids.includes(id)
        ? f.student_ids.filter((sid) => sid !== id)
        : [...f.student_ids, id],
    }));
  };

  const save = async () => {
    if (!form.tag_number.trim() || !form.family_name.trim()) {
      setMessage('Student ID and family name are required.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const payload: UpsertTagPayload = {
        ...form,
        authorized_pickups: pickupsText.split(';').map((s) => s.trim()).filter(Boolean),
      };
      if (editing && editing !== 'new') {
        await api.updateTag(form.tag_number, payload);
      } else {
        await api.upsertTag(payload);
      }
      setMessage(`Saved Student ID ${form.tag_number}`);
      setEditing(null);
      setForm(emptyForm);
      setPickupsText('');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const allStudents = [...unassigned, ...tags.flatMap((t) => t.students)];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Tag className="text-brand-700" size={32} />
          <div>
            <h1 className="text-2xl font-black text-stone-900">Placard IDs & Families</h1>
            <p className="text-sm font-bold text-stone-600">
              Map 1–5 digit Student IDs to families · {unassigned.length} unassigned
            </p>
          </div>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl font-black border-2 border-stone-900"
        >
          <Plus size={18} /> New Student ID
        </button>
      </div>

      {(editing === 'new' || editing) && (
        <div className="bg-white rounded-2xl border-4 border-stone-900 p-5 shadow-[3px_3px_0_#1c1917] space-y-4">
          <h2 className="font-black text-lg flex items-center gap-2">
            <Hash size={20} /> {editing === 'new' ? 'New Student ID' : `Edit ID ${form.tag_number}`}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-stone-600">Student ID *</span>
              <input
                value={form.tag_number}
                onChange={(e) => setForm((f) => ({ ...f, tag_number: sanitizeTagNumberInput(e.target.value) }))}
                disabled={editing !== 'new'}
                className="mt-1 w-full border-2 border-stone-900 rounded-xl px-3 py-2 font-mono text-2xl font-black"
                placeholder="10401"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-stone-600">Family Name *</span>
              <input
                value={form.family_name}
                onChange={(e) => setForm((f) => ({ ...f, family_name: e.target.value }))}
                className="mt-1 w-full border-2 border-stone-900 rounded-xl px-3 py-2 font-bold"
                placeholder="Smith Family"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-stone-600">Phone</span>
              <input
                value={form.primary_phone ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, primary_phone: e.target.value }))}
                className="mt-1 w-full border-2 border-stone-900 rounded-xl px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-stone-600">Authorized Pickups (semicolon-separated)</span>
              <input
                value={pickupsText}
                onChange={(e) => setPickupsText(e.target.value)}
                className="mt-1 w-full border-2 border-stone-900 rounded-xl px-3 py-2"
                placeholder="John Smith; Jane Smith"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-bold text-stone-600">Safety / Allergy Notes</span>
            <textarea
              value={form.safety_notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, safety_notes: e.target.value }))}
              rows={2}
              className="mt-1 w-full border-2 border-stone-900 rounded-xl px-3 py-2"
              placeholder="Allergy: peanuts, Custody notes…"
            />
          </label>

          <div>
            <p className="text-sm font-bold text-stone-600 mb-2 flex items-center gap-1">
              <Users size={16} /> Link Students (siblings share a tag)
            </p>
            <div className="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto border-2 border-stone-200 rounded-xl p-2">
              {allStudents.map((s) => (
                <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-amber-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.student_ids.includes(s.id)}
                    onChange={() => toggleStudent(s.id)}
                    className="w-5 h-5"
                  />
                  <span className="font-bold text-sm">
                    {s.first_name} {s.last_name}{' '}
                    <span className="text-stone-500">({s.grade_room})</span>
                    {!s.family_id && <span className="text-brand-600 ml-1">M365</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-black border-2 border-stone-900 disabled:opacity-50"
            >
              <Save size={18} /> Save Tag
            </button>
            <button
              onClick={() => { setEditing(null); setForm(emptyForm); }}
              className="px-5 py-2.5 bg-stone-200 rounded-xl font-bold border-2 border-stone-900"
            >
              Cancel
            </button>
          </div>
          {message && <p className="text-sm font-bold text-stone-700">{message}</p>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tags.map((tag) => (
          <div key={tag.id} className="bg-white rounded-2xl border-4 border-stone-900 p-4 shadow-[2px_2px_0_#1c1917]">
            <div className="flex justify-between items-start mb-2">
              <span className="text-3xl font-black text-brand-700">ID {tag.tag_number}</span>
              <button onClick={() => startEdit(tag)} className="text-sm font-bold text-brand-700 underline">
                Edit
              </button>
            </div>
            <p className="font-black text-stone-900">{tag.family_name}</p>
            {tag.safety_notes && (
              <p className="text-xs font-bold text-amber-800 bg-amber-100 rounded-lg px-2 py-1 mt-2">{tag.safety_notes}</p>
            )}
            <ul className="mt-2 space-y-1">
              {tag.students.map((s) => (
                <li key={s.id} className="text-sm font-bold text-stone-700">
                  {s.first_name} {s.last_name} · {s.grade_room}
                </li>
              ))}
            </ul>
            {tag.authorized_pickups.length > 0 && (
              <p className="text-xs text-stone-500 mt-2">
                Pickup: {tag.authorized_pickups.join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
