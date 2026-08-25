import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { db } from './lib/db';
import { publish, negotiate } from './lib/pubsub';
import { parseCsv, lastNameFromFamily } from './lib/csvParser';
import { subscribe, mockStore } from './lib/mockStore';
import { isMockMode } from './lib/types';

mockStore.init();

const app = express();
const PORT = Number(process.env.PORT || process.env.API_PORT) || 7071;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mock: isMockMode(), mode: isProduction ? 'demo' : 'dev' });
});

app.get('/api/queue', async (_req, res) => {
  try {
    res.json(await db.getQueue());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/queue', async (req, res) => {
  try {
    const tag = String(req.body.tag_number ?? '').trim();
    const lane = Number(req.body.lane_number) || 1;
    if (!tag) return res.status(400).json({ error: 'tag_number is required' });
    const item = await db.checkIn(tag, lane);
    await publish({ type: 'CAR_QUEUED', data: item });
    res.status(201).json(item);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.patch('/api/queue/:id', async (req, res) => {
  try {
    let item;
    let removed = false;
    if (req.body.student_id) {
      if (req.body.action === 'load') {
        item = await db.loadStudent(req.body.student_id);
        removed = !!item && item.status === 'loaded';
      } else {
        item = await db.stageStudent(req.body.student_id);
      }
      if (!item) return res.status(404).json({ error: 'Not found' });
    } else if (req.body.status) {
      item = await db.updateQueueStatus(req.params.id, req.body.status);
      removed = req.body.status === 'loaded';
    } else {
      return res.status(400).json({ error: 'status or student_id required' });
    }
    if (removed) {
      await publish({ type: 'QUEUE_REMOVED', data: { id: item.id } });
    } else {
      await publish({ type: 'QUEUE_UPDATED', data: item });
    }
    res.json(item);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post('/api/queue/undo', async (_req, res) => {
  try {
    const item = await db.undoLast();
    if (item) await publish({ type: 'QUEUE_REMOVED', data: { id: item.id } });
    res.json({ undone: item });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/api/negotiate', async (_req, res) => {
  try {
    res.json(await negotiate());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/roster', async (_req, res) => {
  try {
    res.json(await db.getRoster());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/students/morning-check-in', async (req, res) => {
  try {
    let student;
    if (req.body.student_id) {
      student = await db.morningCheckInStudent(req.body.student_id);
    } else if (req.body.tag_number) {
      student = await db.morningCheckIn(String(req.body.tag_number).trim());
    } else {
      return res.status(400).json({ error: 'tag_number or student_id required' });
    }
    await publish({ type: 'STUDENT_CHECKED_IN', data: student });
    res.json(student);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post('/api/admin/restart-session', async (req, res) => {
  try {
    const result = await db.restartSession(String(req.body.password ?? ''));
    await publish({ type: 'SESSION_RESET', data: { session_date: result.session_date } });
    await publish({ type: 'SYNC', data: await db.getQueue() });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post('/api/roster/import', async (req, res) => {
  try {
    const rows = parseCsv(req.body.csv ?? '');
    const result = await db.importRoster(rows);
    await publish({ type: 'SYNC', data: await db.getQueue() });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/api/m365/sync-roster', async (_req, res) => {
  try {
    const result = await db.syncM365Roster();
    await publish({ type: 'ROSTER_SYNCED', data: { studentsSynced: result.studentsSynced, groupsSynced: result.groupsSynced } });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/m365/my-classes', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) {
      // Mock fallback
      const { fetchTeacherClassesFromToken } = await import('./lib/graph');
      res.json({ gradeRooms: await fetchTeacherClassesFromToken('mock') });
      return;
    }
    const { fetchTeacherClassesFromToken } = await import('./lib/graph');
    const token = auth.replace(/^Bearer\s+/i, '');
    const gradeRooms = await fetchTeacherClassesFromToken(token);
    res.json({ gradeRooms });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/tags', async (_req, res) => {
  try {
    res.json(await db.getTags());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/tags/unassigned', async (_req, res) => {
  try {
    res.json(await db.getUnassignedStudents());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/tags', async (req, res) => {
  try {
    const record = await db.upsertTag(req.body);
    res.status(201).json(record);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.patch('/api/tags/:tagNumber', async (req, res) => {
  try {
    const record = await db.upsertTag({ ...req.body, tag_number: req.params.tagNumber });
    res.json(record);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/api/settings/pickup-zone', async (_req, res) => {
  try {
    res.json(await db.getPickupZone());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.put('/api/settings/pickup-zone', async (req, res) => {
  try {
    res.json(await db.setPickupZone(req.body));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/api/families/:tagNumber/status', async (req, res) => {
  try {
    res.json(await db.getFamilyPickupStatus(req.params.tagNumber));
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

app.post('/api/queue/arrive', async (req, res) => {
  try {
    const tag = String(req.body.tag_number ?? '').trim();
    const source = req.body.source ?? 'manual';
    const lane = Number(req.body.lane_number) || 1;
    if (!tag) return res.status(400).json({ error: 'tag_number is required' });
    // Privacy: we never receive GPS coordinates — only tag + arrival source
    const item = await db.checkIn(tag, lane);
    await publish({ type: 'CAR_QUEUED', data: item });
    res.status(201).json({ ...item, arrival_source: source });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/api/GetRoles', (_req, res) => {
  res.json({ roles: ['admin'] });
});

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  db.getQueue().then((queue) => send({ type: 'SYNC', data: queue }));
  const unsub = subscribe((msg) => send(msg));
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsub();
  });
});

// Serve built React app in production/demo (single-port deploy)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Carpool Hero ${isProduction ? 'DEMO' : 'dev'} (mock=${isMockMode()}) → http://0.0.0.0:${PORT}`);
});
