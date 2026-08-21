import type { RosterImportRow } from './types';

/** Required CSV columns (case/spacing insensitive): TagNumber, StudentFirstName, FamilyName, GradeRoom */
const REQUIRED_COLUMNS: (keyof RosterImportRow)[] = [
  'tag_number',
  'student_first_name',
  'family_name',
  'grade_room',
];

const COLUMN_ALIASES: Record<string, keyof RosterImportRow> = {
  tag_number: 'tag_number',
  tagnumber: 'tag_number',
  student_first_name: 'student_first_name',
  studentfirstname: 'student_first_name',
  student_first: 'student_first_name',
  first_name: 'student_first_name',
  firstname: 'student_first_name',
  family_name: 'family_name',
  familyname: 'family_name',
  grade_room: 'grade_room',
  graderoom: 'grade_room',
  grade: 'grade_room',
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function detectDelimiter(headerLine: string): ',' | '\t' {
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

function parseLine(line: string, delimiter: ',' | '\t'): string[] {
  if (delimiter === '\t') {
    return line.split('\t').map((v) => v.trim().replace(/^"|"$/g, ''));
  }

  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function mapHeaders(rawHeaders: string[]): Map<keyof RosterImportRow, number> {
  const columnIndex = new Map<keyof RosterImportRow, number>();

  rawHeaders.forEach((raw, idx) => {
    const normalized = normalizeHeader(raw);
    const field = COLUMN_ALIASES[normalized];
    if (field && !columnIndex.has(field)) {
      columnIndex.set(field, idx);
    }
  });

  return columnIndex;
}

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

export function parseCsv(text: string): RosterImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter);
  const columnIndex = mapHeaders(headers);

  const missing = REQUIRED_COLUMNS.filter((col) => !columnIndex.has(col));
  if (missing.length > 0) {
    const labels: Record<keyof RosterImportRow, string> = {
      tag_number: 'TagNumber',
      student_first_name: 'StudentFirstName',
      family_name: 'FamilyName',
      grade_room: 'GradeRoom',
    };
    throw new CsvParseError(
      `CSV must include columns: TagNumber, StudentFirstName, FamilyName, GradeRoom. Missing: ${missing.map((m) => labels[m]).join(', ')}`
    );
  }

  const rows: RosterImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter);
    const get = (field: keyof RosterImportRow) => {
      const idx = columnIndex.get(field);
      return idx === undefined ? '' : (values[idx]?.trim() ?? '');
    };

    const row: RosterImportRow = {
      tag_number: get('tag_number'),
      student_first_name: get('student_first_name'),
      family_name: get('family_name'),
      grade_room: get('grade_room'),
    };

    if (row.tag_number && row.student_first_name && row.family_name && row.grade_room) {
      rows.push(row);
    }
  }

  return rows;
}

/** Derive student last name from family name (e.g. "Smith Family" → "Smith"). */
export function lastNameFromFamily(familyName: string): string {
  const trimmed = familyName.trim();
  const withoutSuffix = trimmed.replace(/\s+family\s*$/i, '').trim();
  return withoutSuffix.split(/\s+/)[0] || trimmed;
}
