import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { fetchClassGroups } from './graph';
import type {
  Family,
  FamilyPickupStatus,
  PickupZone,
  QueueItem,
  QueueStatus,
  RealtimeMessage,
  RosterImportRow,
  Student,
  StudentStatus,
  TagRecord,
  UpsertTagPayload,
} from './types';
import { today } from './types';
import { lastNameFromFamily } from './csvParser';
import { assertValidTagNumber } from './tagNumber';

const bus = new EventEmitter();
bus.setMaxListeners(100);

let families: Family[] = [];
let students: Student[] = [];
let queue: QueueItem[] = [];
let pickupZone: PickupZone = {
  name: 'Agasthiyar Academy — Carpool Pickup Zone',
  latitude: 33.1060,
  longitude: -96.7370,
  radius_meters: 100,
};

function makeStudent(
  partial: Pick<Student, 'first_name' | 'last_name' | 'grade_room'> &
    Partial<Omit<Student, 'first_name' | 'last_name' | 'grade_room'>>
): Student {
  return {
    id: partial.id ?? randomUUID(),
    family_id: partial.family_id ?? null,
    m365_user_id: partial.m365_user_id ?? null,
    m365_group_id: partial.m365_group_id ?? null,
    m365_photo_url: partial.m365_photo_url ?? null,
    first_name: partial.first_name,
    last_name: partial.last_name,
    grade_room: partial.grade_room,
    status: partial.status ?? 'in_class',
  };
}

function seedIfEmpty() {
  if (students.length > 0) return;

  const smithId = randomUUID();
  const johnsonId = randomUUID();
  const williamsId = randomUUID();

  families = [
    {
      id: smithId,
      tag_number: '104',
      family_name: 'Smith Family',
      primary_phone: '555-0104',
      authorized_pickups: ['John Smith', 'Jane Smith'],
      safety_notes: '',
    },
    {
      id: johnsonId,
      tag_number: '205',
      family_name: 'Johnson Family',
      primary_phone: '555-0205',
      authorized_pickups: ['Mike Johnson'],
      safety_notes: 'Custody: mother only pickup',
    },
    {
      id: williamsId,
      tag_number: '312',
      family_name: 'Williams Family',
      primary_phone: '555-0312',
      authorized_pickups: ['Chris Williams'],
      safety_notes: 'Allergy: peanuts',
    },
  ];

  students = [
    makeStudent({ family_id: smithId, m365_user_id: 'm365-emma', m365_group_id: 'mock-group-g1', first_name: 'Emma', last_name: 'Smith', grade_room: 'Grade 1' }),
    makeStudent({ family_id: smithId, m365_user_id: 'm365-olivia', m365_group_id: 'mock-group-g1', first_name: 'Olivia', last_name: 'Brown', grade_room: 'Grade 1' }),
    makeStudent({ family_id: johnsonId, m365_user_id: 'm365-liam', m365_group_id: 'mock-group-g2', first_name: 'Liam', last_name: 'Johnson', grade_room: 'Grade 2' }),
    makeStudent({ family_id: williamsId, m365_user_id: 'm365-sophia', m365_group_id: 'mock-group-g1', first_name: 'Sophia', last_name: 'Williams', grade_room: 'Grade 1' }),
  ];
}

export function subscribe(listener: (msg: RealtimeMessage) => void): () => void {
  bus.on('message', listener);
  return () => bus.off('message', listener);
}

export function broadcast(msg: RealtimeMessage) {
  bus.emit('message', msg);
}

function buildQueueItem(family: Family, laneNumber: number): QueueItem {
  const familyStudents = students.filter((s) => s.family_id === family.id);
  return {
    id: randomUUID(),
    tag_number: family.tag_number,
    family_id: family.id,
    lane_number: laneNumber,
    status: 'waiting',
    session_date: today(),
    created_at: new Date().toISOString(),
    dismissed_at: null,
    family_name: family.family_name,
    primary_phone: family.primary_phone,
    authorized_pickups: family.authorized_pickups,
    safety_notes: family.safety_notes,
    students: familyStudents.map((s) => ({ ...s })),
  };
}

export const mockStore = {
  init() {
    seedIfEmpty();
  },

  getQueue(sessionDate = today()): QueueItem[] {
    seedIfEmpty();
    return queue
      .filter((q) => q.session_date === sessionDate && q.status !== 'cancelled' && q.status !== 'loaded')
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  getFamilyByTag(tagNumber: string): Family | null {
    seedIfEmpty();
    return families.find((f) => f.tag_number === tagNumber) ?? null;
  },

  getRoster() {
    seedIfEmpty();
    return {
      families: [...families],
      students: students.map((s) => {
        const f = s.family_id ? families.find((fam) => fam.id === s.family_id) : null;
        return {
          ...s,
          tag_number: f?.tag_number ?? '',
          family_name: f?.family_name ?? '(unassigned)',
        };
      }),
    };
  },

  getTags(): TagRecord[] {
    seedIfEmpty();
    return families.map((f) => ({
      ...f,
      students: students.filter((s) => s.family_id === f.id),
    }));
  },

  getUnassignedStudents(): Student[] {
    seedIfEmpty();
    return students.filter((s) => !s.family_id);
  },

  upsertTag(payload: UpsertTagPayload): TagRecord {
    seedIfEmpty();
    payload = { ...payload, tag_number: assertValidTagNumber(payload.tag_number) };
    let family = families.find((f) => f.tag_number === payload.tag_number);
    if (!family) {
      family = {
        id: randomUUID(),
        tag_number: payload.tag_number,
        family_name: payload.family_name,
        primary_phone: payload.primary_phone ?? null,
        authorized_pickups: payload.authorized_pickups ?? [],
        safety_notes: payload.safety_notes ?? '',
      };
      families.push(family);
    } else {
      family.family_name = payload.family_name;
      family.primary_phone = payload.primary_phone ?? family.primary_phone;
      family.authorized_pickups = payload.authorized_pickups ?? family.authorized_pickups;
      family.safety_notes = payload.safety_notes ?? family.safety_notes;
    }

    // Unassign students previously on this tag
    students.forEach((s) => {
      if (s.family_id === family!.id && !payload.student_ids.includes(s.id)) {
        s.family_id = null;
      }
    });

    // Assign selected students
    for (const sid of payload.student_ids) {
      const student = students.find((s) => s.id === sid);
      if (student) student.family_id = family.id;
    }

    return { ...family, students: students.filter((s) => s.family_id === family!.id) };
  },

  async syncM365Roster() {
    seedIfEmpty();
    const groups = await fetchClassGroups();
    let studentsSynced = 0;
    let groupsSynced = 0;

    for (const group of groups) {
      groupsSynced++;
      for (const member of group.members) {
        let student = students.find((s) => s.m365_user_id === member.id);
        if (student) {
          student.first_name = member.givenName;
          student.last_name = member.surname;
          student.grade_room = group.gradeRoom;
          student.m365_group_id = group.id;
        } else {
          students.push(
            makeStudent({
              m365_user_id: member.id,
              m365_group_id: group.id,
              first_name: member.givenName,
              last_name: member.surname,
              grade_room: group.gradeRoom,
              family_id: null,
            })
          );
          studentsSynced++;
        }
      }
    }

    return { studentsSynced, groupsSynced, groups: groups.map((g) => g.displayName) };
  },

  checkIn(tagNumber: string, laneNumber = 1): QueueItem {
    tagNumber = assertValidTagNumber(tagNumber);
    seedIfEmpty();
    const family = families.find((f) => f.tag_number === tagNumber);
    if (!family) throw new Error(`No family found for Student ID ${tagNumber}`);

    const sessionDate = today();
    const existing = queue.find(
      (q) =>
        q.tag_number === tagNumber &&
        q.session_date === sessionDate &&
        q.status !== 'loaded' &&
        q.status !== 'cancelled'
    );
    if (existing) return existing;

    const item = buildQueueItem(family, laneNumber);
    queue.push(item);
    return item;
  },

  undoLast(sessionDate = today()): QueueItem | null {
    seedIfEmpty();
    const last = queue
      .filter((q) => q.session_date === sessionDate && q.status === 'waiting')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!last) return null;

    last.status = 'cancelled';
    students
      .filter((s) => s.family_id === last.family_id)
      .forEach((s) => {
        if (s.status === 'staged') s.status = 'in_class';
      });
    return last;
  },

  updateQueueStatus(id: string, status: QueueStatus): QueueItem {
    seedIfEmpty();
    const item = queue.find((q) => q.id === id);
    if (!item) throw new Error('Queue entry not found');

    item.status = status;
    if (status === 'loaded') item.dismissed_at = new Date().toISOString();

    if (status === 'staged' || status === 'calling') {
      students
        .filter((s) => s.family_id === item.family_id)
        .forEach((s) => {
          if (s.status !== 'loaded') s.status = 'staged';
        });
    }
    if (status === 'loaded') {
      students
        .filter((s) => s.family_id === item.family_id)
        .forEach((s) => {
          s.status = 'loaded';
        });
    }

    item.students = students.filter((s) => s.family_id === item.family_id).map((s) => ({ ...s }));
    return item;
  },

  stageStudent(studentId: string): QueueItem | null {
    seedIfEmpty();
    const student = students.find((s) => s.id === studentId);
    if (!student) throw new Error('Student not found');
    if (student.status !== 'in_class') {
      throw new Error('Student is not in class');
    }
    student.status = 'staged';

    const item = queue.find(
      (q) => q.family_id === student.family_id && q.status !== 'loaded' && q.status !== 'cancelled'
    );
    if (item) {
      item.status = 'calling';
      item.students = students.filter((s) => s.family_id === item.family_id).map((s) => ({ ...s }));
    }
    return item ?? null;
  },

  loadStudent(studentId: string): QueueItem | null {
    seedIfEmpty();
    const student = students.find((s) => s.id === studentId);
    if (!student) throw new Error('Student not found');
    if (student.status !== 'staged') {
      throw new Error('Student must be released from class before loading');
    }
    student.status = 'loaded';

    const item = queue.find(
      (q) => q.family_id === student.family_id && q.status !== 'loaded' && q.status !== 'cancelled'
    );
    if (!item) return null;

    const familyStudents = students.filter((s) => s.family_id === item.family_id);
    item.students = familyStudents.map((s) => ({ ...s }));

    const activeStudents = familyStudents.filter((s) => s.status !== 'absent');
    if (activeStudents.length > 0 && activeStudents.every((s) => s.status === 'loaded')) {
      item.status = 'loaded';
      item.dismissed_at = new Date().toISOString();
    }
    return item;
  },

  importRoster(rows: RosterImportRow[]) {
    seedIfEmpty();
    let familiesCreated = 0;
    let studentsCreated = 0;
    let studentsUpdated = 0;

    for (const row of rows) {
      let tag: string;
      try {
        tag = assertValidTagNumber(row.tag_number);
      } catch {
        continue;
      }
      if (!row.family_name || !row.student_first_name || !row.grade_room) continue;

      let family = families.find((f) => f.tag_number === tag);
      if (!family) {
        family = {
          id: randomUUID(),
          tag_number: tag,
          family_name: row.family_name.trim(),
          primary_phone: null,
          authorized_pickups: [],
          safety_notes: '',
        };
        families.push(family);
        familiesCreated++;
      } else {
        family.family_name = row.family_name.trim();
      }

      const lastName = lastNameFromFamily(row.family_name);
      const student = students.find(
        (s) =>
          s.family_id === family!.id &&
          s.first_name === row.student_first_name.trim() &&
          s.last_name === lastName
      );

      if (student) {
        student.grade_room = row.grade_room.trim();
        studentsUpdated++;
      } else {
        students.push(
          makeStudent({
            family_id: family.id,
            first_name: row.student_first_name.trim(),
            last_name: lastName,
            grade_room: row.grade_room.trim(),
          })
        );
        studentsCreated++;
      }
    }

    return { familiesCreated, studentsCreated, studentsUpdated, rowsProcessed: rows.length };
  },

  getPickupZone(): PickupZone {
    return { ...pickupZone };
  },

  setPickupZone(zone: PickupZone): PickupZone {
    pickupZone = { ...zone };
    return pickupZone;
  },

  getFamilyPickupStatus(tagNumber: string): FamilyPickupStatus {
    seedIfEmpty();
    const family = families.find((f) => f.tag_number === tagNumber);
    if (!family) throw new Error(`No family found for Student ID ${tagNumber}`);

    const sessionDate = today();
    const active = queue.find(
      (q) =>
        q.tag_number === tagNumber &&
        q.session_date === sessionDate &&
        q.status !== 'cancelled' &&
        q.status !== 'loaded'
    );

    const familyStudents = students.filter((s) => s.family_id === family.id);

    return {
      tag_number: family.tag_number,
      family_name: family.family_name,
      in_queue: !!active,
      queue_status: active?.status ?? null,
      queue_id: active?.id ?? null,
      authorized_pickups: family.authorized_pickups,
      students: familyStudents.map((s) => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        grade_room: s.grade_room,
        status: s.status,
      })),
    };
  },
};
