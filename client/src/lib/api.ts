import type { QueueItem, RealtimeMessage, RosterData, TagRecord, UpsertTagPayload } from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as T;
}

export const api = {
  getQueue: () => request<QueueItem[]>('/queue'),

  checkIn: (tag_number: string, lane_number = 1) =>
    request<QueueItem>('/queue', {
      method: 'POST',
      body: JSON.stringify({ tag_number, lane_number }),
    }),

  updateQueue: (id: string, status: string) =>
    request<QueueItem>(`/queue/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  stageStudent: (id: string, student_id: string) =>
    request<QueueItem>(`/queue/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ student_id, action: 'release' }),
    }),

  loadStudent: (id: string, student_id: string) =>
    request<QueueItem>(`/queue/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ student_id, action: 'load' }),
    }),

  undoLast: () => request<{ undone: QueueItem | null }>('/queue/undo', { method: 'POST' }),

  morningCheckIn: (tag_number: string) =>
    request<import('../types').RosterStudent>('/students/morning-check-in', {
      method: 'POST',
      body: JSON.stringify({ tag_number }),
    }),

  morningCheckInStudent: (student_id: string) =>
    request<import('../types').RosterStudent>('/students/morning-check-in', {
      method: 'POST',
      body: JSON.stringify({ student_id }),
    }),

  restartSession: (password: string) =>
    request<{ session_date: string; studentsReset: number }>('/admin/restart-session', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  negotiate: () => request<{ url: string } | { mock: true }>('/negotiate'),

  getRoster: () => request<RosterData>('/roster'),

  exportAttendance: async (format: 'csv' | 'xlsx' = 'csv') => {
    const res = await fetch(`${BASE}/roster/export?format=${format}`, { method: 'GET' });
    if (!res.ok) {
      let err = 'Export failed';
      try {
        const body = await res.json();
        err = body.error ?? err;
      } catch {
        /* ignore */
      }
      throw new Error(err);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || res.headers.get('content-disposition') || '';
    let filename = `attendance.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
    const m = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
    if (m) filename = m[1];
    return { blob, filename };
  },

  importCsv: (csv: string) =>
    request<{ familiesCreated: number; studentsCreated: number; studentsUpdated: number; rowsProcessed: number }>(
      '/roster/import',
      { method: 'POST', body: JSON.stringify({ csv }) }
    ),

  syncM365Roster: () =>
    request<{ studentsSynced: number; groupsSynced: number; groups: string[] }>('/m365/sync-roster'),

  getMyClasses: (accessToken?: string) =>
    request<{ gradeRooms: string[] }>('/m365/my-classes', {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    }),

  getTags: () => request<TagRecord[]>('/tags'),

  getUnassignedStudents: () => request<import('../types').Student[]>('/tags/unassigned'),

  upsertTag: (payload: UpsertTagPayload) =>
    request<TagRecord>('/tags', { method: 'POST', body: JSON.stringify(payload) }),

  updateTag: (tagNumber: string, payload: Omit<UpsertTagPayload, 'tag_number'>) =>
    request<TagRecord>(`/tags/${tagNumber}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  getPickupZone: () => request<import('../types').PickupZone>('/settings/pickup-zone'),

  setPickupZone: (zone: import('../types').PickupZone) =>
    request<import('../types').PickupZone>('/settings/pickup-zone', {
      method: 'PUT',
      body: JSON.stringify(zone),
    }),
};

export type { RealtimeMessage };
