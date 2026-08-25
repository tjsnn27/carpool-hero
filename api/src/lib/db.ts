import { Pool } from 'pg';
import type { QueueItem, QueueStatus, RosterImportRow, Student, TagRecord, UpsertTagPayload, PickupZone, FamilyPickupStatus } from './types';
import { isMockMode, today } from './types';
import { mockStore } from './mockStore';
import { fetchClassGroups } from './graph';
import { lastNameFromFamily } from './csvParser';
import { normalizePickupLocation } from './pickupLocations';
import { assertValidTagNumber } from './tagNumber';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

function mapQueueRow(row: Record<string, unknown>, students: Student[]): QueueItem {
  return {
    id: row.id as string,
    tag_number: row.tag_number as string,
    family_id: row.family_id as string,
    lane_number: row.lane_number as number,
    status: row.status as QueueItem['status'],
    session_date: (row.session_date as Date).toISOString().slice(0, 10),
    created_at: (row.created_at as Date).toISOString(),
    dismissed_at: row.dismissed_at ? (row.dismissed_at as Date).toISOString() : null,
    family_name: row.family_name as string,
    primary_phone: row.primary_phone as string | null,
    authorized_pickups: (row.authorized_pickups as string[]) ?? [],
    safety_notes: (row.safety_notes as string) ?? '',
    students,
  };
}

export const db = {
  async getQueue(sessionDate = today()): Promise<QueueItem[]> {
    if (isMockMode()) return mockStore.getQueue(sessionDate);

    const result = await getPool().query(
      `
        SELECT q.*, f.family_name, f.primary_phone, f.authorized_pickups, f.safety_notes
        FROM carpool_queue q
        JOIN families f ON f.id = q.family_id
        WHERE q.session_date = $1
          AND q.status NOT IN ('loaded', 'cancelled')
        ORDER BY q.created_at ASC
      `,
      [sessionDate]
    );

    const items: QueueItem[] = [];
    for (const row of result.rows) {
      const studentsResult = await getPool().query(
        'SELECT * FROM students WHERE family_id = $1 ORDER BY last_name, first_name',
        [row.family_id]
      );
      items.push(mapQueueRow(row, studentsResult.rows));
    }
    return items;
  },

  async checkIn(tagNumber: string, laneNumber = 1): Promise<QueueItem> {
    tagNumber = assertValidTagNumber(tagNumber);
    laneNumber = normalizePickupLocation(laneNumber);
    if (isMockMode()) return mockStore.checkIn(tagNumber, laneNumber);

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const familyResult = await client.query('SELECT * FROM families WHERE tag_number = $1', [tagNumber]);
      if (familyResult.rows.length === 0) throw new Error(`No family found for Student ID ${tagNumber}`);
      const family = familyResult.rows[0];
      const sessionDate = today();

      const existing = await client.query(
        `SELECT * FROM carpool_queue
         WHERE tag_number = $1 AND session_date = $2 AND status NOT IN ('loaded', 'cancelled')`,
        [tagNumber, sessionDate]
      );
      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        const studentsResult = await getPool().query('SELECT * FROM students WHERE family_id = $1', [family.id]);
        return mapQueueRow({ ...existing.rows[0], ...family }, studentsResult.rows);
      }

      const insertResult = await client.query(
        `INSERT INTO carpool_queue (tag_number, family_id, lane_number, status, session_date)
         VALUES ($1, $2, $3, 'waiting', $4) RETURNING *`,
        [tagNumber, family.id, laneNumber, sessionDate]
      );

      await client.query('COMMIT');

      const studentsResult = await getPool().query('SELECT * FROM students WHERE family_id = $1', [family.id]);
      return mapQueueRow({ ...insertResult.rows[0], ...family }, studentsResult.rows);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateQueueStatus(id: string, status: QueueStatus): Promise<QueueItem> {
    if (isMockMode()) return mockStore.updateQueueStatus(id, status);

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const qResult = await client.query(
        `UPDATE carpool_queue SET status = $1, dismissed_at = CASE WHEN $1 = 'loaded' THEN NOW() ELSE dismissed_at END
         WHERE id = $2 RETURNING *`,
        [status, id]
      );
      if (qResult.rows.length === 0) throw new Error('Queue entry not found');
      const entry = qResult.rows[0];

      if (status === 'staged') {
        await client.query(
          `UPDATE students SET status = 'staged' WHERE family_id = $1 AND status != 'loaded'`,
          [entry.family_id]
        );
      }
      if (status === 'loaded') {
        await client.query(`UPDATE students SET status = 'loaded' WHERE family_id = $1`, [entry.family_id]);
      }
      await client.query('COMMIT');

      const familyResult = await getPool().query('SELECT * FROM families WHERE id = $1', [entry.family_id]);
      const studentsResult = await getPool().query('SELECT * FROM students WHERE family_id = $1', [entry.family_id]);
      return mapQueueRow({ ...entry, ...familyResult.rows[0] }, studentsResult.rows);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async stageStudent(studentId: string): Promise<QueueItem | null> {
    if (isMockMode()) return mockStore.stageStudent(studentId);

    const studentResult = await getPool().query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (studentResult.rows.length === 0) throw new Error('Student not found');
    const student = studentResult.rows[0];
    if (student.status !== 'in_class') {
      throw new Error(
        student.status === 'not_checked_in'
          ? 'Student must be checked in before release from class'
          : 'Student is not in class'
      );
    }

    await getPool().query(`UPDATE students SET status = 'staged' WHERE id = $1`, [studentId]);

    await getPool().query(
      `UPDATE carpool_queue SET status = 'calling'
       WHERE family_id = $1 AND status = 'waiting' AND session_date = CURRENT_DATE`,
      [student.family_id]
    );

    const queueResult = await getPool().query(
      `SELECT q.*, f.family_name, f.primary_phone, f.authorized_pickups, f.safety_notes
       FROM carpool_queue q JOIN families f ON f.id = q.family_id
       WHERE q.family_id = $1 AND q.session_date = CURRENT_DATE AND q.status != 'cancelled'
       ORDER BY q.created_at DESC LIMIT 1`,
      [student.family_id]
    );
    if (queueResult.rows.length === 0) return null;
    const studentsResult = await getPool().query('SELECT * FROM students WHERE family_id = $1', [student.family_id]);
    return mapQueueRow(queueResult.rows[0], studentsResult.rows);
  },

  async loadStudent(studentId: string): Promise<QueueItem | null> {
    if (isMockMode()) return mockStore.loadStudent(studentId);

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const studentResult = await client.query('SELECT * FROM students WHERE id = $1 FOR UPDATE', [studentId]);
      if (studentResult.rows.length === 0) throw new Error('Student not found');
      const student = studentResult.rows[0];
      if (student.status !== 'staged') {
        throw new Error('Student must be released from class before loading');
      }

      await client.query(`UPDATE students SET status = 'loaded' WHERE id = $1`, [studentId]);

      const queueResult = await client.query(
        `SELECT q.*, f.family_name, f.primary_phone, f.authorized_pickups, f.safety_notes
         FROM carpool_queue q JOIN families f ON f.id = q.family_id
         WHERE q.family_id = $1 AND q.session_date = CURRENT_DATE
           AND q.status NOT IN ('cancelled', 'loaded')
         ORDER BY q.created_at DESC LIMIT 1`,
        [student.family_id]
      );
      if (queueResult.rows.length === 0) {
        await client.query('COMMIT');
        return null;
      }

      const entry = queueResult.rows[0];
      const studentsResult = await client.query('SELECT * FROM students WHERE family_id = $1', [student.family_id]);
      const activeStudents = studentsResult.rows.filter((s) => s.status !== 'absent');
      const allLoaded = activeStudents.length > 0 && activeStudents.every((s) => s.status === 'loaded');

      if (allLoaded) {
        await client.query(
          `UPDATE carpool_queue SET status = 'loaded', dismissed_at = NOW() WHERE id = $1`,
          [entry.id]
        );
        entry.status = 'loaded';
      }

      await client.query('COMMIT');
      return mapQueueRow(entry, studentsResult.rows);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async undoLast(): Promise<QueueItem | null> {
    if (isMockMode()) return mockStore.undoLast();
    // Production undo: cancel most recent waiting entry for today
    const result = await getPool().query(
      `UPDATE carpool_queue SET status = 'cancelled'
       WHERE id = (
         SELECT id FROM carpool_queue
         WHERE session_date = CURRENT_DATE AND status = 'waiting'
         ORDER BY created_at DESC LIMIT 1
       ) RETURNING *`
    );
    return result.rows[0] ?? null;
  },

  async morningCheckIn(tagNumber: string) {
    if (isMockMode()) return mockStore.morningCheckIn(tagNumber);

    tagNumber = assertValidTagNumber(tagNumber);
    const updated = await getPool().query(
      `UPDATE students s SET status = 'in_class'
       FROM families f
       WHERE s.family_id = f.id AND f.tag_number = $1 AND s.status = 'not_checked_in'
       RETURNING s.*, f.tag_number, f.family_name`,
      [tagNumber]
    );
    if (updated.rows.length > 0) return updated.rows[0];

    const existing = await getPool().query(
      `SELECT s.status, s.first_name FROM students s
       JOIN families f ON f.id = s.family_id
       WHERE f.tag_number = $1`,
      [tagNumber]
    );
    if (existing.rows.length === 0) throw new Error(`No student found for Student ID ${tagNumber}`);
    const row = existing.rows[0];
    if (row.status === 'in_class') throw new Error(`${row.first_name} is already checked in`);
    throw new Error(`${row.first_name} cannot be checked in right now`);
  },

  async morningCheckInStudent(studentId: string) {
    if (isMockMode()) return mockStore.morningCheckInStudent(studentId);

    const updated = await getPool().query(
      `UPDATE students SET status = 'in_class'
       WHERE id = $1 AND status = 'not_checked_in'
       RETURNING *`,
      [studentId]
    );
    if (updated.rows.length > 0) {
      const student = updated.rows[0];
      const family = await getPool().query('SELECT tag_number, family_name FROM families WHERE id = $1', [student.family_id]);
      return { ...student, tag_number: family.rows[0]?.tag_number ?? '', family_name: family.rows[0]?.family_name ?? '' };
    }

    const existing = await getPool().query('SELECT first_name, status FROM students WHERE id = $1', [studentId]);
    if (existing.rows.length === 0) throw new Error('Student not found');
    const row = existing.rows[0];
    if (row.status === 'in_class') throw new Error(`${row.first_name} is already checked in`);
    throw new Error(`${row.first_name} cannot be checked in right now`);
  },

  async getRoster() {
    if (isMockMode()) return mockStore.getRoster();

    const families = await getPool().query('SELECT * FROM families ORDER BY tag_number');
    const students = await getPool().query(
      `SELECT s.*, COALESCE(f.tag_number, '') AS tag_number, COALESCE(f.family_name, '(unassigned)') AS family_name
       FROM students s LEFT JOIN families f ON f.id = s.family_id
       ORDER BY f.tag_number NULLS LAST, s.last_name, s.first_name`
    );
    return { families: families.rows, students: students.rows };
  },

  async getTags(): Promise<TagRecord[]> {
    if (isMockMode()) return mockStore.getTags();

    const families = await getPool().query('SELECT * FROM families ORDER BY tag_number');
    const result: TagRecord[] = [];
    for (const f of families.rows) {
      const studentsResult = await getPool().query(
        'SELECT * FROM students WHERE family_id = $1 ORDER BY last_name, first_name',
        [f.id]
      );
      result.push({ ...f, students: studentsResult.rows });
    }
    return result;
  },

  async getUnassignedStudents(): Promise<Student[]> {
    if (isMockMode()) return mockStore.getUnassignedStudents();
    const result = await getPool().query(
      'SELECT * FROM students WHERE family_id IS NULL ORDER BY grade_room, last_name, first_name'
    );
    return result.rows;
  },

  async upsertTag(payload: UpsertTagPayload): Promise<TagRecord> {
    payload = { ...payload, tag_number: assertValidTagNumber(payload.tag_number) };
    if (isMockMode()) return mockStore.upsertTag(payload);

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const familyResult = await client.query(
        `INSERT INTO families (tag_number, family_name, primary_phone, authorized_pickups, safety_notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tag_number) DO UPDATE SET
           family_name = EXCLUDED.family_name,
           primary_phone = COALESCE(EXCLUDED.primary_phone, families.primary_phone),
           authorized_pickups = EXCLUDED.authorized_pickups,
           safety_notes = EXCLUDED.safety_notes
         RETURNING *`,
        [
          payload.tag_number,
          payload.family_name,
          payload.primary_phone ?? null,
          payload.authorized_pickups ?? [],
          payload.safety_notes ?? '',
        ]
      );
      const family = familyResult.rows[0];

      await client.query('UPDATE students SET family_id = NULL WHERE family_id = $1 AND NOT (id = ANY($2::uuid[]))', [
        family.id,
        payload.student_ids,
      ]);

      if (payload.student_ids.length > 0) {
        await client.query('UPDATE students SET family_id = $1 WHERE id = ANY($2::uuid[])', [
          family.id,
          payload.student_ids,
        ]);
      }

      await client.query('COMMIT');
      const studentsResult = await getPool().query(
        'SELECT * FROM students WHERE family_id = $1 ORDER BY last_name, first_name',
        [family.id]
      );
      return { ...family, students: studentsResult.rows };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async syncM365Roster() {
    if (isMockMode()) return mockStore.syncM365Roster();

    const groups = await fetchClassGroups();
    let studentsSynced = 0;
    let groupsSynced = 0;
    const client = await getPool().connect();

    try {
      await client.query('BEGIN');
      for (const group of groups) {
        groupsSynced++;
        for (const member of group.members) {
          const result = await client.query(
            `INSERT INTO students (m365_user_id, first_name, last_name, grade_room, m365_group_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (m365_user_id) DO UPDATE SET
               first_name = EXCLUDED.first_name,
               last_name = EXCLUDED.last_name,
               grade_room = EXCLUDED.grade_room,
               m365_group_id = EXCLUDED.m365_group_id
             RETURNING (xmax = 0) AS inserted`,
            [member.id, member.givenName, member.surname, group.gradeRoom, group.id]
          );
          if (result.rows[0]?.inserted) studentsSynced++;
        }
      }
      await client.query('COMMIT');
      return { studentsSynced, groupsSynced, groups: groups.map((g) => g.displayName) };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async importRoster(rows: RosterImportRow[]) {
    if (isMockMode()) return mockStore.importRoster(rows);

    const client = await getPool().connect();
    let familiesCreated = 0;
    let studentsCreated = 0;
    let studentsUpdated = 0;

    try {
      await client.query('BEGIN');
      for (const row of rows) {
        const tag = assertValidTagNumber(row.tag_number);
        if (!row.family_name || !row.student_first_name || !row.grade_room) continue;

        const familyResult = await client.query(
          `INSERT INTO families (tag_number, family_name, primary_phone, safety_notes, authorized_pickups)
           VALUES ($1, $2, NULL, '', '{}')
           ON CONFLICT (tag_number) DO UPDATE SET
             family_name = EXCLUDED.family_name
           RETURNING id, (xmax = 0) AS inserted`,
          [tag, row.family_name.trim()]
        );
        if (familyResult.rows[0].inserted) familiesCreated++;
        const familyId = familyResult.rows[0].id;
        const lastName = lastNameFromFamily(row.family_name);

        const studentResult = await client.query(
          `INSERT INTO students (family_id, first_name, last_name, grade_room)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [familyId, row.student_first_name.trim(), lastName, row.grade_room.trim()]
        );

        if (studentResult.rows.length > 0) {
          studentsCreated++;
        } else {
          await client.query(
            `UPDATE students SET grade_room = $1
             WHERE family_id = $2 AND first_name = $3 AND last_name = $4`,
            [row.grade_room.trim(), familyId, row.student_first_name.trim(), lastName]
          );
          studentsUpdated++;
        }
      }
      await client.query('COMMIT');
      return { familiesCreated, studentsCreated, studentsUpdated, rowsProcessed: rows.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getPickupZone(): Promise<PickupZone> {
    if (isMockMode()) return mockStore.getPickupZone();
    const result = await getPool().query(
      `SELECT value FROM app_settings WHERE key = 'pickup_zone'`
    ).catch(() => ({ rows: [] }));
    if (result.rows[0]?.value) return result.rows[0].value as PickupZone;
    return mockStore.getPickupZone();
  },

  async setPickupZone(zone: PickupZone): Promise<PickupZone> {
    if (isMockMode()) return mockStore.setPickupZone(zone);
    await getPool().query(
      `INSERT INTO app_settings (key, value) VALUES ('pickup_zone', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(zone)]
    ).catch(() => mockStore.setPickupZone(zone));
    return zone;
  },

  async getFamilyPickupStatus(tagNumber: string): Promise<FamilyPickupStatus> {
    if (isMockMode()) return mockStore.getFamilyPickupStatus(tagNumber);
    const familyResult = await getPool().query('SELECT * FROM families WHERE tag_number = $1', [tagNumber]);
    if (familyResult.rows.length === 0) throw new Error(`No family found for tag #${tagNumber}`);
    const family = familyResult.rows[0];
    const queueResult = await getPool().query(
      `SELECT * FROM carpool_queue WHERE tag_number = $1 AND session_date = CURRENT_DATE
       AND status NOT IN ('cancelled', 'loaded') ORDER BY created_at DESC LIMIT 1`,
      [tagNumber]
    );
    const studentsResult = await getPool().query(
      'SELECT * FROM students WHERE family_id = $1 ORDER BY last_name, first_name',
      [family.id]
    );
    const active = queueResult.rows[0];
    return {
      tag_number: family.tag_number,
      family_name: family.family_name,
      in_queue: !!active,
      queue_status: active?.status ?? null,
      queue_id: active?.id ?? null,
      authorized_pickups: family.authorized_pickups ?? [],
      students: studentsResult.rows.map((s: Student) => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        grade_room: s.grade_room,
        status: s.status,
      })),
    };
  },
};
