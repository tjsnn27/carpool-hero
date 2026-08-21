export type StudentStatus = 'in_class' | 'staged' | 'loaded' | 'absent';
export type QueueStatus = 'waiting' | 'calling' | 'staged' | 'loaded' | 'cancelled';
/** Staff roles (Beeline-aligned). */
export type StaffRole = 'dispatcher' | 'teacher' | 'trafficcontroller';
export type AppRole = StaffRole;

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  dispatcher: 'Dispatcher',
  teacher: 'Teacher',
  trafficcontroller: 'Traffic Controller',
};

export const TEACHER_PERSONA_PREFIX = 'teacher:';

/** Placard tags: 1–5 digits */
export const TAG_NUMBER_MAX_LENGTH = 5;

export function sanitizeTagNumberInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, TAG_NUMBER_MAX_LENGTH);
}

export function teacherPersonaValue(gradeRoom: string): string {
  return `${TEACHER_PERSONA_PREFIX}${gradeRoom}`;
}

export function parseMockPersona(value: string): { role: StaffRole; teacherGrade: string | null } {
  if (value.startsWith(TEACHER_PERSONA_PREFIX)) {
    return {
      role: 'teacher',
      teacherGrade: value.slice(TEACHER_PERSONA_PREFIX.length),
    };
  }
  return { role: value as StaffRole, teacherGrade: null };
}

export function mockPersonaLabel(value: string, gradeRooms: string[]): string {
  const { role, teacherGrade } = parseMockPersona(value);
  if (role === 'teacher' && teacherGrade) return `Teacher ${teacherGrade}`;
  if (role === 'teacher' && gradeRooms.length === 0) return 'Teacher';
  return STAFF_ROLE_LABELS[role] ?? value;
}
export type ArrivalSource = 'geofence' | 'beacon' | 'manual' | 'volunteer';

export interface PickupZone {
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  beacon_uuid?: string;
}

export interface FamilyPickupStatus {
  tag_number: string;
  family_name: string;
  in_queue: boolean;
  queue_status: QueueStatus | null;
  queue_id: string | null;
  students: Array<{ id: string; name: string; grade_room: string; status: StudentStatus }>;
  authorized_pickups: string[];
}

export interface Student {
  id: string;
  family_id: string | null;
  m365_user_id: string | null;
  m365_group_id: string | null;
  m365_photo_url: string | null;
  first_name: string;
  last_name: string;
  grade_room: string;
  status: StudentStatus;
}

export interface QueueItem {
  id: string;
  tag_number: string;
  family_id: string | null;
  lane_number: number;
  status: QueueStatus;
  session_date: string;
  created_at: string;
  dismissed_at: string | null;
  family_name: string;
  primary_phone: string | null;
  authorized_pickups: string[];
  safety_notes: string;
  students: Student[];
}

export interface TagRecord {
  id: string;
  tag_number: string;
  family_name: string;
  primary_phone: string | null;
  authorized_pickups: string[];
  safety_notes: string;
  students: Student[];
}

export type RealtimeMessage =
  | { type: 'CAR_QUEUED'; data: QueueItem }
  | { type: 'QUEUE_UPDATED'; data: QueueItem }
  | { type: 'QUEUE_REMOVED'; data: { id: string } }
  | { type: 'SYNC'; data: QueueItem[] }
  | { type: 'ROSTER_SYNCED'; data: { studentsSynced: number; groupsSynced: number } };

export interface RosterStudent extends Student {
  tag_number: string;
  family_name: string;
}

export interface RosterData {
  families: { id: string; tag_number: string; family_name: string; primary_phone: string | null; safety_notes: string }[];
  students: RosterStudent[];
}

export interface UpsertTagPayload {
  tag_number: string;
  family_name: string;
  primary_phone?: string;
  authorized_pickups?: string[];
  safety_notes?: string;
  student_ids: string[];
}
