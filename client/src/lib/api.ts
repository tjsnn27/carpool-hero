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
      body: JSON.stringify({ student_id }),
    }),

  undoLast: () => request<{ undone: QueueItem | null }>('/queue/undo', { method: 'POST' }),

  negotiate: () => request<{ url: string } | { mock: true }>('/negotiate'),

  getRoster: () => request<RosterData>('/roster'),

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
