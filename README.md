# Carpool Hero — Agasthiyar Academy

Mobile-first PWA for Sunday School carpool check-in and dismissal, built for **Azure Static Web Apps** with **Microsoft Entra ID**, **Azure Functions**, **PostgreSQL**, and **Azure Web PubSub**.

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React (Vite) + Tailwind + Lucide + MSAL |
| Hosting | Azure Static Web Apps + `staticwebapp.config.json` |
| API | Azure Functions (Node.js TS v4) in `/api` |
| Database | Azure Database for PostgreSQL |
| Real-time | Azure Web PubSub (+ SSE mock fallback) |
| Auth | Microsoft Entra ID via `@azure/msal-react` |

## Views

| Route | Role | Purpose |
|-------|------|---------|
| `/driver-pickup` | Public (family tag) | Hands-free geofence arrival + pickup status |
| `/faq` | Public | Privacy & how-it-works FAQ |
| `/lane-scanner` | Traffic Controller, Dispatcher | Numeric keypad + QR check-in (fallback for non-app drivers) |
| `/classroom-board` | Teacher, Dispatcher | Live dismissal board with TTS/chime |
| `/admin-roster` | Dispatcher | Roster search + CSV import + M365 sync |
| `/admin-tags` | Dispatcher | Placard tag → student mapping |
| `/admin-pickup-zone` | Dispatcher | Configure geofence for auto-arrival |

## Driver Auto-Arrival (Beeline-style)

Parents/drivers use **`/driver-pickup`** — no school login required:

1. Enter family placard tag (e.g. `104`) — share with any authorized driver
2. Enable **Auto-Arrival** — geofence detects pickup zone locally on the phone
3. When entering the zone, only the **tag number** is sent (never GPS coordinates)
4. Live **children status**: In Class → Walking to Car → Picked Up
5. One-tap **I've Arrived** fallback if geofence is unavailable

**Traffic controller fallback:** Drivers without smartphones use **Traffic Control** keypad (same queue).

See **`/faq`** for privacy explanations tailored to parents.

## Local Development (Mock Mode)

No Azure resources required. Mock auth, in-memory DB, and SSE realtime are enabled by default.

```cmd
cd d:\code\carpool-hero
npm install
cd api && npm install && cd ..
cd client && npm install && cd ..
npm run dev
```

- **Client:** http://localhost:5174
- **API:** http://localhost:7071/api
- **Mock auth:** enabled via `client/.env` (`VITE_MOCK_AUTH=true`)
- Switch roles using the dropdown in the header (Dispatcher / Teacher / Traffic Controller)

### Demo flow

1. Open **Traffic Control** → enter tag `104` → car appears on board
2. Open **Board** (switch role to Teacher) → tap **Stage →** on a child
3. Tap **Dismiss / Loaded** when child reaches the curb
4. **Dispatcher** → import CSV or view roster

## Azure Deployment

### 1. Provision resources

- Azure Static Web App (with Functions)
- Azure Database for PostgreSQL Flexible Server
- Azure Web PubSub
- Microsoft Entra ID app registration

### 2. Run database migration

```bash
psql $DATABASE_URL -f database/schema.sql
```

### 3. Configure SWA application settings

```
DATABASE_URL=postgresql://...
WEBPUBSUB_CONNECTION_STRING=Endpoint=https://...
WEBPUBSUB_HUB=carpool
MOCK_MODE=false
AAD_CLIENT_ID=<entra-app-client-id>
AAD_CLIENT_SECRET=<secret>
```

### 4. Configure Entra ID app roles

Create app roles in Entra ID matching `staticwebapp.config.json`:

- `dispatcher`
- `teacher`
- `trafficcontroller`

Assign users/groups to roles. SWA reads roles via `/api/GetRoles`.

### 5. Client environment (build time)

```
VITE_MOCK_AUTH=false
VITE_AAD_CLIENT_ID=<client-id>
VITE_AAD_AUTHORITY=https://login.microsoftonline.com/<tenant-id>
VITE_AAD_REDIRECT_URI=https://<your-swa>.azurestaticapps.net
```

### 6. Deploy

SWA GitHub Action or `swa deploy` with:
- `app_location`: `client`
- `api_location`: `api`
- `output_location`: `dist`

## Microsoft 365 Integration

### Teacher SSO & Auto-Class Gating
- Teachers sign in with M365 (`User.Read`, `GroupMember.Read.All` scopes)
- App calls `GET /api/m365/my-classes` using the user's Graph token
- `/classroom-board` auto-filters to the teacher's class group (e.g. `Class-K-1` → `K-1`)
- In mock mode, switch role to **Teacher** to see auto-gating to `K-1`

### M365 Roster Sync (Dispatcher)
- **Dispatcher → Roster → Sync from Microsoft 365** triggers `GET /api/m365/sync-roster`
- Backend queries Entra groups matching `Class-*`, `Grade-*`, `SundaySchool-*`
- Upserts student records with `m365_user_id`, `m365_group_id`, and `grade_room`

### Placard Tag Mapping (Dispatcher)
- **`/admin-tags`** — map 2–4 digit placard numbers to M365 student records (siblings)
- Set authorized pickup names and safety/allergy notes per family

### Azure App Registration Requirements

| Permission | Type | Purpose |
|------------|------|---------|
| `User.Read` | Delegated | Teacher SSO |
| `GroupMember.Read.All` | Delegated | Teacher class auto-gate |
| `Group.Read.All` | Application | Dispatcher roster sync |
| `User.Read.All` | Application | Fetch group members |

Configure application settings:
```
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
MOCK_MODE=false
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/m365/sync-roster` | Sync students from M365 class groups |
| GET | `/api/m365/my-classes` | Teacher's grade rooms (Bearer token) |
| GET | `/api/tags` | All placard tag mappings |
| GET | `/api/tags/unassigned` | M365 students without a tag |
| POST | `/api/tags` | Create/update tag mapping |
| PATCH | `/api/tags/:tagNumber` | Update tag mapping |
| GET | `/api/queue` | Active queue for today |
| POST | `/api/queue` | Check in `{ tag_number, lane_number }` |
| PATCH | `/api/queue/:id` | Update status or stage student |
| POST | `/api/queue/undo` | Undo last check-in |
| GET | `/api/negotiate` | Web PubSub client URL (or `{ mock: true }`) |
| GET | `/api/events` | SSE stream (mock mode only) |
| GET | `/api/roster` | Full roster |
| POST | `/api/roster/import` | CSV bulk import |
| GET | `/api/GetRoles` | SWA role source |

## CSV Format

```csv
TagNumber,StudentFirstName,FamilyName,GradeRoom
104,Emma,Smith Family,K-1
205,Liam,Johnson Family,3rd-4th
```

Tab-separated files with the same four columns are also accepted. Last name is derived from the family name (e.g. Smith Family → Smith). Phone, notes, and authorized pickups are configured separately under **Tags**.
