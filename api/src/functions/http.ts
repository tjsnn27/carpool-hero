import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { db } from '../lib/db';
import { publish } from '../lib/pubsub';

app.http('queueGet', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'queue',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const queue = await db.getQueue();
      return { status: 200, jsonBody: queue, headers: { 'Access-Control-Allow-Origin': '*' } };
    } catch (err) {
      return { status: 500, jsonBody: { error: (err as Error).message } };
    }
  },
});

app.http('queuePost', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'queue',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (req.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }
    try {
      const body = (await req.json()) as { tag_number?: string; lane_number?: number };
      const tagNumber = String(body.tag_number ?? '').trim();
      const laneNumber = Number(body.lane_number) || 1;
      if (!tagNumber) {
        return { status: 400, jsonBody: { error: 'tag_number is required' }, headers: corsHeaders() };
      }

      const item = await db.checkIn(tagNumber, laneNumber);
      await publish({ type: 'CAR_QUEUED', data: item });

      return { status: 201, jsonBody: item, headers: corsHeaders() };
    } catch (err) {
      return { status: 400, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('queuePatch', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'queue/{id}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (req.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }
    try {
      const id = req.params.id;
      const body = (await req.json()) as { status?: string; student_id?: string; action?: string };

      let item;
      let removed = false;
      if (body.student_id) {
        if (body.action === 'load') {
          item = await db.loadStudent(body.student_id);
          if (!item) {
            return { status: 404, jsonBody: { error: 'Queue entry not found' }, headers: corsHeaders() };
          }
          removed = item.status === 'loaded';
        } else {
          item = await db.stageStudent(body.student_id);
          if (!item) {
            return { status: 404, jsonBody: { error: 'Queue entry not found' }, headers: corsHeaders() };
          }
        }
      } else if (body.status) {
        item = await db.updateQueueStatus(id, body.status as 'waiting' | 'staged' | 'loaded' | 'cancelled');
        removed = body.status === 'loaded';
      } else {
        return { status: 400, jsonBody: { error: 'status or student_id required' }, headers: corsHeaders() };
      }

      if (removed) {
        await publish({ type: 'QUEUE_REMOVED', data: { id: item.id } });
      } else {
        await publish({ type: 'QUEUE_UPDATED', data: item });
      }

      return { status: 200, jsonBody: item, headers: corsHeaders() };
    } catch (err) {
      return { status: 400, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('queueUndo', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'queue/undo',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (req.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }
    try {
      const item = await db.undoLast();
      if (item) {
        await publish({ type: 'QUEUE_REMOVED', data: { id: item.id } });
      }
      return { status: 200, jsonBody: { undone: item }, headers: corsHeaders() };
    } catch (err) {
      return { status: 400, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('negotiate', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'negotiate',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (req.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }
    try {
      const { negotiate } = await import('../lib/pubsub');
      const result = await negotiate();
      return { status: 200, jsonBody: result, headers: corsHeaders() };
    } catch (err) {
      return { status: 500, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('rosterGet', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'roster',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const roster = await db.getRoster();
      return { status: 200, jsonBody: roster, headers: corsHeaders() };
    } catch (err) {
      return { status: 500, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('rosterExport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'roster/export',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const format = (req.query.get('format') ?? 'csv').toLowerCase();
      const roster = await db.getRoster();
      const rows = roster.students.map((s: any) => ({
        StudentID: s.tag_number ?? '',
        FirstName: s.first_name ?? '',
        LastName: s.last_name ?? '',
        Grade: s.grade_room ?? '',
        Family: s.family_name ?? '',
        Status: s.status ?? '',
      }));

      if (format === 'xlsx') {
        const xlsx = await import('xlsx');
        const ws = xlsx.utils.json_to_sheet(rows);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Attendance');
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return {
          status: 200,
          body: buf,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="attendance-${new Date().toISOString().slice(0,10)}.xlsx"`,
            'Access-Control-Allow-Origin': '*',
          },
        };
      }

      // default: csv
      const keys = rows.length > 0 ? Object.keys(rows[0]) : ['StudentID', 'FirstName', 'LastName', 'Grade', 'Family', 'Status'];
      const escape = (v: any) => {
        if (v == null) return '';
        const s = String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const lines = [keys.join(',')];
      for (const r of rows) lines.push(keys.map((k) => escape((r as any)[k])).join(','));
      const csv = lines.join('\n');
      const buf = Buffer.from(csv, 'utf-8');
      return { status: 200, body: buf, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="attendance-${new Date().toISOString().slice(0,10)}.csv"`, 'Access-Control-Allow-Origin': '*' } };
    } catch (err) {
      return { status: 500, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('studentsMorningCheckIn', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'students/morning-check-in',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (req.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }
    try {
      const body = (await req.json()) as { tag_number?: string; student_id?: string };
      let student;
      if (body.student_id) {
        student = await db.morningCheckInStudent(body.student_id);
      } else if (body.tag_number) {
        student = await db.morningCheckIn(String(body.tag_number).trim());
      } else {
        return { status: 400, jsonBody: { error: 'tag_number or student_id required' }, headers: corsHeaders() };
      }
      await publish({ type: 'STUDENT_CHECKED_IN', data: student });
      return { status: 200, jsonBody: student, headers: corsHeaders() };
    } catch (err) {
      return { status: 400, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('adminRestartSession', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'admin/restart-session',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (req.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }
    try {
      const body = (await req.json()) as { password?: string };
      const password = String(body.password ?? '');
      const result = await db.restartSession(password);
      await publish({ type: 'SESSION_RESET', data: { session_date: result.session_date } });
      await publish({ type: 'SYNC', data: await db.getQueue() });
      return { status: 200, jsonBody: result, headers: corsHeaders() };
    } catch (err) {
      return { status: 400, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('rosterImport', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'roster/import',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (req.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }
    try {
      const body = (await req.json()) as { csv?: string };
      if (!body.csv?.trim()) {
        return { status: 400, jsonBody: { error: 'csv field required' }, headers: corsHeaders() };
      }
      const { parseCsv } = await import('../lib/csvParser');
      const rows = parseCsv(body.csv);
      const result = await db.importRoster(rows);
      await publish({ type: 'SYNC', data: await db.getQueue() });
      return { status: 200, jsonBody: result, headers: corsHeaders() };
    } catch (err) {
      return { status: 400, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('m365SyncRoster', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'm365/sync-roster',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const result = await db.syncM365Roster();
      await publish({ type: 'ROSTER_SYNCED', data: { studentsSynced: result.studentsSynced, groupsSynced: result.groupsSynced } });
      return { status: 200, jsonBody: result, headers: corsHeaders() };
    } catch (err) {
      return { status: 500, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('m365MyClasses', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'm365/my-classes',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const auth = req.headers.get('authorization') ?? '';
      const { fetchTeacherClassesFromToken } = await import('../lib/graph');
      const token = auth.replace(/^Bearer\s+/i, '') || 'mock';
      const gradeRooms = await fetchTeacherClassesFromToken(token);
      return { status: 200, jsonBody: { gradeRooms }, headers: corsHeaders() };
    } catch (err) {
      return { status: 500, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('tagsGet', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'tags',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      return { status: 200, jsonBody: await db.getTags(), headers: corsHeaders() };
    } catch (err) {
      return { status: 500, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('tagsUnassigned', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'tags/unassigned',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      return { status: 200, jsonBody: await db.getUnassignedStudents(), headers: corsHeaders() };
    } catch (err) {
      return { status: 500, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('tagsPost', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'tags',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (req.method === 'OPTIONS') return { status: 204, headers: corsHeaders() };
    try {
      const body = (await req.json()) as import('../lib/types').UpsertTagPayload;
      const record = await db.upsertTag(body);
      return { status: 201, jsonBody: record, headers: corsHeaders() };
    } catch (err) {
      return { status: 400, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('tagsPatch', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'tags/{tagNumber}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (req.method === 'OPTIONS') return { status: 204, headers: corsHeaders() };
    try {
      const body = (await req.json()) as Omit<import('../lib/types').UpsertTagPayload, 'tag_number'>;
      const record = await db.upsertTag({ ...body, tag_number: req.params.tagNumber });
      return { status: 200, jsonBody: record, headers: corsHeaders() };
    } catch (err) {
      return { status: 400, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('pickupZoneGet', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'settings/pickup-zone',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      return { status: 200, jsonBody: await db.getPickupZone(), headers: corsHeaders() };
    } catch (err) {
      return { status: 500, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('pickupZonePut', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'settings/pickup-zone',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (req.method === 'OPTIONS') return { status: 204, headers: corsHeaders() };
    try {
      const body = (await req.json()) as import('../lib/types').PickupZone;
      return { status: 200, jsonBody: await db.setPickupZone(body), headers: corsHeaders() };
    } catch (err) {
      return { status: 400, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('familyStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'families/{tagNumber}/status',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      return { status: 200, jsonBody: await db.getFamilyPickupStatus(req.params.tagNumber), headers: corsHeaders() };
    } catch (err) {
      return { status: 404, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('queueArrive', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'queue/arrive',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (req.method === 'OPTIONS') return { status: 204, headers: corsHeaders() };
    try {
      const body = (await req.json()) as { tag_number?: string; source?: string; lane_number?: number };
      const tag = String(body.tag_number ?? '').trim();
      if (!tag) return { status: 400, jsonBody: { error: 'tag_number is required' }, headers: corsHeaders() };
      const item = await db.checkIn(tag, Number(body.lane_number) || 1);
      await publish({ type: 'CAR_QUEUED', data: item });
      return { status: 201, jsonBody: { ...item, arrival_source: body.source ?? 'manual' }, headers: corsHeaders() };
    } catch (err) {
      return { status: 400, jsonBody: { error: (err as Error).message }, headers: corsHeaders() };
    }
  },
});

app.http('getRoles', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'GetRoles',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const header = req.headers.get('x-ms-client-principal');
    if (!header) {
      return { status: 200, jsonBody: { roles: ['anonymous'] } };
    }
    try {
      const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
      const roles: string[] = decoded.userRoles ?? decoded.claims
        ?.filter((c: { typ: string }) => c.typ === 'roles')
        .map((c: { val: string }) => c.val.toLowerCase()) ?? [];
      return { status: 200, jsonBody: { roles } };
    } catch {
      return { status: 200, jsonBody: { roles: ['anonymous'] } };
    }
  },
});

// SSE endpoint for mock-mode realtime
app.http('events', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { subscribe } = await import('../lib/mockStore');
    const { db: database } = await import('../lib/db');

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        send({ type: 'SYNC', data: [] });

        database.getQueue().then((queue) => send({ type: 'SYNC', data: queue }));

        const unsub = subscribe((msg) => send(msg));

        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        }, 15000);

        // Cleanup when client disconnects is handled by runtime
        _ctx.log('SSE client connected');

        // Store cleanup refs on controller for GC
        (controller as unknown as { _cleanup?: () => void })._cleanup = () => {
          clearInterval(heartbeat);
          unsub();
        };
      },
      cancel() {
        // noop
      },
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
      body: stream,
    };
  },
});

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
