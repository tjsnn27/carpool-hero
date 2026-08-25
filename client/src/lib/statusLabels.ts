import type { QueueStatus, StudentStatus } from '../types';

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  not_checked_in: 'Not Checked In',
  in_class: 'In Class',
  staged: 'Released from Class',
  loaded: 'Loaded',
  absent: 'Absent',
};

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  waiting: 'Waiting',
  calling: 'Released En Route',
  staged: 'At Curb',
  loaded: 'Loaded',
  cancelled: 'Cancelled',
};

export function studentStatusLabel(status: StudentStatus): string {
  return STUDENT_STATUS_LABELS[status] ?? status;
}
