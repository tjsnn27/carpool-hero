const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
});

const PORT = process.env.PORT || 5001;
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

function broadcastState() {
  const state = db.getFullState();
  io.emit('state:update', state);
  return state;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, session_date: db.today() });
});

app.get('/api/state', (_req, res) => {
  res.json(db.getFullState());
});

app.get('/api/families', (_req, res) => {
  res.json(db.getFamilies());
});

app.get('/api/families/search', (req, res) => {
  const prefix = String(req.query.q || '').trim();
  if (!prefix) return res.json([]);
  res.json(db.searchFamiliesByTagPrefix(prefix));
});

app.get('/api/families/:tagNumber', (req, res) => {
  const family = db.getFamilyByTag(req.params.tagNumber);
  if (!family) return res.status(404).json({ error: 'Family not found' });
  const students = db.getStudents({ family_id: family.id });
  res.json({ ...family, students });
});

app.get('/api/students', (req, res) => {
  const filters = {};
  if (req.query.grade_class) filters.grade_class = req.query.grade_class;
  if (req.query.status) filters.status = req.query.status;
  res.json(db.getStudents(filters));
});

app.get('/api/grades', (_req, res) => {
  res.json(db.getGrades());
});

app.get('/api/queue', (_req, res) => {
  res.json(db.getQueueWithStudents());
});

app.get('/api/board', (req, res) => {
  const gradeClass = req.query.grade_class || null;
  res.json(db.getBoardData(db.today(), gradeClass));
});

app.post('/api/check-in', (req, res) => {
  try {
    const tagNumber = String(req.body.tag_number || '').trim();
    const laneNumber = Number(req.body.lane_number) || 1;
    if (!tagNumber) return res.status(400).json({ error: 'tag_number is required' });

    const result = db.checkIn(tagNumber, laneNumber);
    const state = broadcastState();
    res.json({ ...result, state });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/students/:id/stage', (req, res) => {
  try {
    const students = db.stageStudent(Number(req.params.id));
    const state = broadcastState();
    res.json({ students, state });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/queue/:id/loaded', (req, res) => {
  try {
    const entry = db.markLoaded(Number(req.params.id));
    const state = broadcastState();
    res.json({ entry, state });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/session/reset', (_req, res) => {
  db.resetSession();
  const state = broadcastState();
  res.json({ ok: true, state });
});

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

app.post('/api/import/csv', upload.single('file'), (req, res) => {
  try {
    let text = '';
    if (req.file) {
      text = req.file.buffer.toString('utf-8');
    } else if (req.body.csv) {
      text = req.body.csv;
    } else {
      return res.status(400).json({ error: 'CSV file or text required' });
    }

    const rows = parseCsv(text);
    const result = db.importCsv(rows);
    const state = broadcastState();
    res.json({ ...result, rowsProcessed: rows.length, state });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/seed', (_req, res) => {
  const sampleCsv = `Family Name,Tag #,Child Name,Grade/Room,Authorized Pickup,Notes
Smith Family,104,Emma Smith,K-1,John Smith; Jane Smith,
Johnson Family,205,Liam Johnson,3rd-4th,Mike Johnson,Custody: mother only pickup
Williams Family,312,Sophia Williams,K-1,Chris Williams,Allergy: peanuts
Davis Family,418,Noah Davis,5th-6th,Sarah Davis; Tom Davis,
Brown Family,104,Olivia Brown,K-1,John Smith; Jane Smith,Sibling of Emma Smith`;

  const rows = parseCsv(sampleCsv);
  const result = db.importCsv(rows);
  const state = broadcastState();
  res.json({ ...result, state });
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

io.on('connection', (socket) => {
  socket.emit('state:update', db.getFullState());

  socket.on('check-in', ({ tag_number, lane_number }, callback) => {
    try {
      const result = db.checkIn(String(tag_number).trim(), lane_number || 1);
      const state = broadcastState();
      callback?.({ ok: true, ...result, state });
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  socket.on('stage-student', ({ student_id }, callback) => {
    try {
      const students = db.stageStudent(Number(student_id));
      const state = broadcastState();
      callback?.({ ok: true, students, state });
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  socket.on('mark-loaded', ({ queue_id }, callback) => {
    try {
      const entry = db.markLoaded(Number(queue_id));
      const state = broadcastState();
      callback?.({ ok: true, entry, state });
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });
});

async function start() {
  await db.initDb();
  server.listen(PORT, () => {
    console.log(`Carpool Hero server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
