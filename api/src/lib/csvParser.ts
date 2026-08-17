import type { RosterImportRow } from './types';

export function parseCsv(text: string): RosterImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) =>
    h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  );

  const aliasMap: Record<string, keyof RosterImportRow> = {
    tag_number: 'tag_number',
    tag: 'tag_number',
    tag__: 'tag_number',
    family_name: 'family_name',
    family: 'family_name',
    student_first_name: 'student_first_name',
    first_name: 'student_first_name',
    child_name: 'student_first_name',
    student_last_name: 'student_last_name',
    last_name: 'student_last_name',
    grade_room: 'grade_room',
    grade: 'grade_room',
    room: 'grade_room',
    grade_class: 'grade_room',
    phone: 'phone',
    primary_phone: 'phone',
    notes: 'notes',
    safety_notes: 'notes',
    authorized_pickup: 'authorized_pickups',
    authorized_pickups: 'authorized_pickups',
  };

  const rows: RosterImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = values[idx]?.trim().replace(/^"|"$/g, '') ?? '';
    });

    const childName = raw.child_name || raw.student_name || raw.name || '';
    let firstName = raw.student_first_name || raw.first_name || '';
    let lastName = raw.student_last_name || raw.last_name || '';
    if (childName && !firstName) {
      const parts = childName.split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }

    const row: RosterImportRow = {
      tag_number: raw.tag_number || raw.tag || raw.tag__ || '',
      family_name: raw.family_name || raw.family || '',
      student_first_name: firstName,
      student_last_name: lastName,
      grade_room: raw.grade_room || raw.grade || raw.room || raw.grade_class || '',
      phone: raw.phone || raw.primary_phone,
      notes: raw.notes || raw.safety_notes,
      authorized_pickups: raw.authorized_pickups || raw.authorized_pickup,
    };

    if (row.tag_number && row.family_name && row.student_first_name && row.grade_room) {
      rows.push(row);
    }
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
