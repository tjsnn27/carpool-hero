# Azure Production Deploy — Carpool Hero

**Profile:** Option B (full production) · CSV roster only · No geofence (manual **I've Arrived** + Traffic Control)

Target stack: **Azure Static Web Apps** + **Functions** + **PostgreSQL** + **Web PubSub** + **Entra ID**

---

## What you need before starting

| Item | Example / notes |
|------|-----------------|
| Azure subscription | Nonprofit credits via [Microsoft for Nonprofits](https://www.microsoft.com/en-us/nonprofits/azure) |
| Azure region | e.g. `eastus`, `centralus` |
| GitHub repo | `tjsnn27/carpool-hero` (connected to SWA) |
| Entra Tenant ID | Azure Portal → Microsoft Entra ID → Overview |
| Staff emails | Who gets `dispatcher`, `teacher`, `trafficcontroller` |
| Custom domain | Optional — default `*.azurestaticapps.net` works |

**Not needed for this profile:** M365 roster sync, pickup zone / geofence setup.

---

## Architecture

```
GitHub (main) → SWA GitHub Action → Static Web App
                                      ├── client/dist (React PWA)
                                      └── api/ (Azure Functions)
                                              ├── PostgreSQL (roster, queue)
                                              ├── Web PubSub (live board)
                                              └── Entra ID (staff sign-in)
```

**Parents/drivers:** public `/driver-pickup` — family tag only, tap **I've Arrived** (no GPS).

---

## Step 1 — Create Azure resources

### 1a. PostgreSQL Flexible Server

1. Azure Portal → **Create a resource** → **Azure Database for PostgreSQL Flexible Server**
2. Suggested: **Burstable B1ms**, PostgreSQL 16, single zone
3. Note: server name, admin user, password, region
4. **Networking:** allow Azure services; add your IP for initial migration
5. Create database: `carpool_hero`

Run schema (from your machine with `psql` or Azure Cloud Shell):

```bash
psql "postgresql://USER:PASSWORD@SERVER.postgres.database.azure.com/carpool_hero?sslmode=require" \
  -f database/schema.sql
```

Connection string for app settings:

```
postgresql://USER:PASSWORD@SERVER.postgres.database.azure.com/carpool_hero?sslmode=require
```

### 1b. Web PubSub

1. Create **Web PubSub** resource (Free tier works for Sunday-only use)
2. Hub name: `carpool` (create hub in portal or it auto-creates on first use)
3. Copy **Connection string** from Keys

### 1c. Static Web App

1. Create **Static Web App**
2. Plan: **Free** (or Standard if you need custom auth rules / SLA)
3. Deployment: **GitHub** → select `tjsnn27/carpool-hero` → branch `main`
4. Build presets:
   - App location: `client`
   - Api location: `api`
   - Output location: `dist`
5. Finish create — Azure adds `AZURE_STATIC_WEB_APPS_API_TOKEN` to GitHub secrets automatically

Copy your site URL: `https://<name>.azurestaticapps.net`

---

## Step 2 — Entra ID app registration (staff login)

1. **Microsoft Entra ID** → **App registrations** → **New registration**
   - Name: `Carpool Hero`
   - Supported accounts: single tenant (your org)
   - Redirect URI: **Single-page application** → `https://<your-swa>.azurestaticapps.net`
2. Note **Application (client) ID** and **Directory (tenant) ID**
3. **Certificates & secrets** → New client secret (for SWA backend auth)
4. **App roles** → Create three roles (allowed member types: **Users/Groups**):

| Display name | Value | ID (auto) |
|--------------|-------|-----------|
| Dispatcher | `dispatcher` | (generated) |
| Teacher | `teacher` | (generated) |
| Traffic Controller | `trafficcontroller` | (generated) |

5. **Enterprise applications** → your app → **Users and groups** → assign staff to roles

**CSV-only note:** You do **not** need Microsoft Graph API permissions for launch. Skip Graph admin consent unless you add M365 sync later.

---

## Step 3 — SWA application settings

Azure Portal → your Static Web App → **Settings** → **Environment variables** (or Configuration):

| Name | Value |
|------|-------|
| `MOCK_MODE` | `false` |
| `DATABASE_URL` | PostgreSQL connection string |
| `WEBPUBSUB_CONNECTION_STRING` | Web PubSub connection string |
| `WEBPUBSUB_HUB` | `carpool` |
| `AAD_CLIENT_ID` | Entra app client ID |
| `AAD_CLIENT_SECRET` | Entra client secret |

Leave **unset** for CSV-only (Graph stays disabled):

- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`

---

## Step 4 — GitHub secrets (client build)

Repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Value |
|--------|-------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Auto-added by Azure when linking repo |
| `VITE_MOCK_AUTH` | `false` |
| `VITE_AAD_CLIENT_ID` | Same as `AAD_CLIENT_ID` |
| `VITE_AAD_AUTHORITY` | `https://login.microsoftonline.com/<TENANT_ID>` |
| `VITE_AAD_REDIRECT_URI` | `https://<your-swa>.azurestaticapps.net` |

Push to `main` (or re-run the GitHub Action) to deploy.

---

## Step 5 — First-time data (CSV)

1. Sign in as **Dispatcher**
2. **Roster** → paste or upload CSV:

```csv
TagNumber,StudentFirstName,FamilyName,GradeRoom
104,Emma,Smith Family,K-1
205,Liam,Johnson Family,3rd-4th
```

3. **Tags** → verify tag → student mappings and authorized pickups
4. Skip **Zone** (geofence not used) — drivers use **I've Arrived** on the Driver screen

---

## Step 6 — Smoke test

| Role | Test |
|------|------|
| Driver (no login) | Tag `104` → **I've Arrived** |
| Teacher | **Board** → Stage → Dismiss |
| Traffic Controller | **Traffic Control** → keypad `205` |
| Dispatcher | **Roster** search, **Tags** edit |

---

## Nonprofit cost tips

- **SWA Free** + **Web PubSub Free** + **PostgreSQL Burstable B1ms** ≈ lowest monthly cost
- Stop/dev-test PostgreSQL off-hours if budget is tight (production: leave running Sundays)
- Nonprofit Azure credits often cover this stack for a small school

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Staff can't sign in | Check redirect URI matches SWA URL exactly |
| Role dropdown missing pages | Assign Entra app role; sign out/in |
| Board not live-updating | Check `WEBPUBSUB_CONNECTION_STRING` and `MOCK_MODE=false` |
| API 500 on check-in | Verify `DATABASE_URL`, schema migrated, firewall allows Azure |
| Build fails on GitHub | Confirm `VITE_*` secrets set; client builds with `npm ci` |

---

## Later (optional)

- **M365 roster sync:** add Graph app permissions + `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
- **Geofence / auto-arrival:** configure **Zone** as Dispatcher; drivers enable Auto-Arrival
- **Custom domain:** SWA → Custom domains → DNS CNAME
