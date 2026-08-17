const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'carpool.db');
let db = null;
let SQL = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_name TEXT NOT NULL,
    tag_number TEXT NOT NULL UNIQUE,
    primary_phone TEXT,
    authorized_pickup_names TEXT DEFAULT '[]',
    notes TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    grade_class TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'IN_CLASS'
  );

  CREATE TABLE IF NOT EXISTS carpool_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_date TEXT NOT NULL,
    tag_number TEXT NOT NULL,
    lane_number INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'WAITING',
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

async function initDb() {
  SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run(SCHEMA);
  saveDb();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseFamily(row) {
  if (!row || !row.id) return null;
  return {
    ...row,
    authorized_pickup_names: JSON.parse(row.authorized_pickup_names || '[]'),
  };
}

function getFamilies() {
  return all('SELECT * FROM families ORDER BY tag_number').map(parseFamily);
}

function getFamilyByTag(tagNumber) {
  return parseFamily(get('SELECT * FROM families WHERE tag_number = ?', [tagNumber]));
}

function searchFamiliesByTagPrefix(prefix) {
  return all("SELECT * FROM families WHERE tag_number LIKE ? || '%' ORDER BY tag_number LIMIT 10", [
    prefix,
  ]).map(parseFamily);
}

function getStudents(filters = {}) {
  let sql = `
    SELECT s.*, f.family_name, f.tag_number, f.authorized_pickup_names, f.notes, f.primary_phone
    FROM students s
    JOIN families f ON f.id = s.family_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.grade_class) {
    sql += ' AND s.grade_class = ?';
    params.push(filters.grade_class);
  }
  if (filters.status) {
    sql += ' AND s.status = ?';
    params.push(filters.status);
  }
  if (filters.family_id) {
    sql += ' AND s.family_id = ?';
    params.push(filters.family_id);
  }

  sql += ' ORDER BY s.last_name, s.first_name';

  return all(sql, params).map((row) => ({
    ...row,
    authorized_pickup_names: JSON.parse(row.authorized_pickup_names || '[]'),
  }));
}

function getQueueWithStudents(sessionDate = today()) {
  const queue = all(
    `
      SELECT q.*,
        f.id AS family_id,
        f.family_name,
        f.authorized_pickup_names,
        f.notes,
        f.primary_phone
      FROM carpool_queue q
      LEFT JOIN families f ON f.tag_number = q.tag_number
      WHERE q.session_date = ? AND q.status != 'DISMISSED'
      ORDER BY q.timestamp ASC
    `,
    [sessionDate]
  );

  return queue.map((row) => {
    const students = row.family_id
      ? all('SELECT * FROM students WHERE family_id = ? ORDER BY last_name, first_name', [
          row.family_id,
        ])
      : [];
    return {
      ...row,
      authorized_pickup_names: JSON.parse(row.authorized_pickup_names || '[]'),
      students,
    };
  });
}

function getBoardData(sessionDate = today(), gradeClass = null) {
  const queue = getQueueWithStudents(sessionDate);
  const items = [];

  for (const entry of queue) {
    for (const student of entry.students) {
      if (gradeClass && student.grade_class !== gradeClass) continue;

      let displayStatus = 'queued';
      if (student.status === 'STAGED' || entry.status === 'CALLING') {
        displayStatus = 'staged';
      } else if (student.status === 'LOADED' || entry.status === 'DISMISSED') {
        displayStatus = 'loaded';
      } else if (student.status === 'QUEUED' || entry.status === 'WAITING') {
        displayStatus = 'queued';
      }

      items.push({
        queue_id: entry.id,
        tag_number: entry.tag_number,
        family_name: entry.family_name,
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        grade_class: student.grade_class,
        student_status: student.status,
        queue_status: entry.status,
        display_status: displayStatus,
        timestamp: entry.timestamp,
        lane_number: entry.lane_number,
      });
    }
  }

  return items.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function checkIn(tagNumber, laneNumber = 1) {
  const family = getFamilyByTag(tagNumber);
  if (!family) {
    throw new Error(`No family found for tag #${tagNumber}`);
  }

  const sessionDate = today();
  const existing = get(
    `
      SELECT * FROM carpool_queue
      WHERE session_date = ? AND tag_number = ? AND status != 'DISMISSED'
    `,
    [sessionDate, tagNumber]
  );

  if (existing) {
    return { queueEntry: existing, family, alreadyInQueue: true };
  }

  run(
    `
      INSERT INTO carpool_queue (session_date, tag_number, lane_number, status)
      VALUES (?, ?, ?, 'WAITING')
    `,
    [sessionDate, tagNumber, laneNumber]
  );

  run("UPDATE students SET status = 'QUEUED' WHERE family_id = ? AND status = 'IN_CLASS'", [
    family.id,
  ]);

  const queueEntry = get('SELECT * FROM carpool_queue WHERE id = last_insert_rowid()');
  return { queueEntry, family, alreadyInQueue: false };
}

function stageStudent(studentId) {
  const student = get('SELECT * FROM students WHERE id = ?', [studentId]);
  if (!student) throw new Error('Student not found');

  const family = get('SELECT * FROM families WHERE id = ?', [student.family_id]);
  run("UPDATE students SET status = 'STAGED' WHERE id = ?", [studentId]);
  run(
    `
      UPDATE carpool_queue SET status = 'CALLING'
      WHERE session_date = ? AND tag_number = ? AND status = 'WAITING'
    `,
    [today(), family.tag_number]
  );

  return getStudents({ family_id: student.family_id });
}

function markLoaded(queueId) {
  const entry = get('SELECT * FROM carpool_queue WHERE id = ?', [queueId]);
  if (!entry) throw new Error('Queue entry not found');

  run("UPDATE carpool_queue SET status = 'DISMISSED' WHERE id = ?", [queueId]);

  const family = getFamilyByTag(entry.tag_number);
  if (family) {
    run("UPDATE students SET status = 'LOADED' WHERE family_id = ?", [family.id]);
  }

  return get('SELECT * FROM carpool_queue WHERE id = ?', [queueId]);
}

function resetSession(sessionDate = today()) {
  run("UPDATE carpool_queue SET status = 'DISMISSED' WHERE session_date = ? AND status != 'DISMISSED'", [
    sessionDate,
  ]);
  run("UPDATE students SET status = 'IN_CLASS' WHERE status != 'IN_CLASS'");
}

function importCsv(rows) {
  let familiesCreated = 0;
  let studentsCreated = 0;
  let studentsUpdated = 0;

  for (const row of rows) {
    const tagNumber = String(row.tag_number || row.tag || '').trim();
    const familyName = String(row.family_name || row.family || '').trim();
    const childName = String(row.child_name || row.student_name || row.name || '').trim();
    const gradeClass = String(row.grade_class || row.grade || row.room || '').trim();

    if (!tagNumber || !familyName || !childName || !gradeClass) continue;

    const nameParts = childName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || familyName.split(/\s+/).pop();

    const pickupNames = row.authorized_pickup
      ? JSON.stringify(
          String(row.authorized_pickup)
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)
        )
      : '[]';

    const existingBefore = get('SELECT id FROM families WHERE tag_number = ?', [tagNumber]);
    if (existingBefore) {
      run(
        'UPDATE families SET family_name = ?, primary_phone = COALESCE(?, primary_phone), authorized_pickup_names = ?, notes = COALESCE(?, notes) WHERE tag_number = ?',
        [
          familyName,
          row.primary_phone || row.phone || null,
          pickupNames,
          row.notes || '',
          tagNumber,
        ]
      );
    } else {
      run(
        'INSERT INTO families (family_name, tag_number, primary_phone, authorized_pickup_names, notes) VALUES (?, ?, ?, ?, ?)',
        [
          familyName,
          tagNumber,
          row.primary_phone || row.phone || null,
          pickupNames,
          row.notes || '',
        ]
      );
      familiesCreated++;
    }

    const family = get('SELECT id FROM families WHERE tag_number = ?', [tagNumber]);
    const existingStudent = get(
      'SELECT id FROM students WHERE family_id = ? AND first_name = ? AND last_name = ?',
      [family.id, firstName, lastName]
    );
    if (existingStudent) {
      run('UPDATE students SET grade_class = ? WHERE id = ?', [gradeClass, existingStudent.id]);
      studentsUpdated++;
    } else {
      run(
        'INSERT INTO students (family_id, first_name, last_name, grade_class, status) VALUES (?, ?, ?, ?, ?)',
        [family.id, firstName, lastName, gradeClass, 'IN_CLASS']
      );
      studentsCreated++;
    }
  }

  return { familiesCreated, studentsCreated, studentsUpdated };
}

function getGrades() {
  return all('SELECT DISTINCT grade_class FROM students ORDER BY grade_class').map(
    (r) => r.grade_class
  );
}

function getFullState(sessionDate = today()) {
  return {
    session_date: sessionDate,
    queue: getQueueWithStudents(sessionDate),
    board: getBoardData(sessionDate),
    grades: getGrades(),
    families: getFamilies(),
    students: getStudents(),
  };
}

module.exports = {
  initDb,
  today,
  getFamilies,
  getFamilyByTag,
  searchFamiliesByTagPrefix,
  getStudents,
  getQueueWithStudents,
  getBoardData,
  checkIn,
  stageStudent,
  markLoaded,
  resetSession,
  importCsv,
  getGrades,
  getFullState,
};
