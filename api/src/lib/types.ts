export type StudentStatus =
  | 'not_checked_in'
  | 'in_class'
  | 'pickup_arrived'
  | 'released_from_class'
  | 'loaded'
  | 'absent';
export type QueueStatus = 'waiting' | 'calling' | 'staged' | 'loaded' | 'cancelled';

export interface Family {
  id: string;
  tag_number: string;
  family_name: string;
  primary_phone: string | null;
  authorized_pickups: string[];
  safety_notes: string;
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

export interface QueueEntry {
  id: string;
  tag_number: string;
  family_id: string | null;
  lane_number: number;
  status: QueueStatus;
  session_date: string;
  created_at: string;
  dismissed_at: string | null;
}

export interface QueueItem extends QueueEntry {
  family_name: string;
  primary_phone: string | null;
  authorized_pickups: string[];
  safety_notes: string;
  students: Student[];
}

export interface TagRecord extends Family {
  students: Student[];
}

export interface M365GroupMember {
  id: string;
  displayName: string;
  givenName: string;
  surname: string;
  mail: string | null;
  photoUrl?: string;
}

export interface M365ClassGroup {
  id: string;
  displayName: string;
  gradeRoom: string;
  members: M365GroupMember[];
}

export type RealtimeMessage =
  | { type: 'CAR_QUEUED'; data: QueueItem }
  | { type: 'QUEUE_UPDATED'; data: QueueItem }
  | { type: 'QUEUE_REMOVED'; data: { id: string } }
  | { type: 'SYNC'; data: QueueItem[] }
  | { type: 'ROSTER_SYNCED'; data: { studentsSynced: number; groupsSynced: number } }
  | { type: 'STUDENT_CHECKED_IN'; data: { id: string; tag_number: string; first_name: string; last_name: string; grade_room: string; status: StudentStatus } }
  | { type: 'SESSION_RESET'; data: { session_date: string } };

export interface RosterImportRow {
  tag_number: string;
  family_name: string;
  student_first_name: string;
  grade_room: string;
}

export interface UpsertTagPayload {
  tag_number: string;
  family_name: string;
  primary_phone?: string;
  authorized_pickups?: string[];
  safety_notes?: string;
  student_ids: string[];
}

export interface PickupZone {
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  beacon_uuid?: string;
}

export type ArrivalSource = 'geofence' | 'beacon' | 'manual' | 'volunteer';

export interface FamilyPickupStatus {
  tag_number: string;
  family_name: string;
  in_queue: boolean;
  queue_status: QueueStatus | null;
  queue_id: string | null;
  students: Array<{
    id: string;
    name: string;
    grade_room: string;
    status: StudentStatus;
  }>;
  authorized_pickups: string[];
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isMockMode(): boolean {
  return (
    process.env.MOCK_MODE === 'true' ||
    !process.env.DATABASE_URL ||
    process.env.DATABASE_URL === ''
  );
}

export function isGraphMockMode(): boolean {
  return isMockMode() || !process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID;
}

export function groupDisplayToGradeRoom(displayName: string): string {
  return displayName
    .replace(/^(Class-|Grade-|SundaySchool-)/i, '')
    .replace(/-/g, ' ')
    .trim();
}

export function isClassGroup(displayName: string): boolean {
  return /^(Class-|Grade-|SundaySchool-)/i.test(displayName);
}
