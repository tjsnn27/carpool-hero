# Demo Deployment Guide

Deploy Carpool Hero to a **free public URL** for demos (mock mode — no Azure required).

## Recommended: Render.com (Free)

Render gives you a public HTTPS URL like `https://carpool-hero-demo.onrender.com`.

### One-time setup (~5 minutes)

1. **Push code to GitHub**
   ```cmd
   cd d:\code\carpool-hero
   git init
   git add .
   git commit -m "Carpool Hero demo ready for deploy"
   ```
   Create a repo on GitHub, then:
   ```cmd
   git remote add origin https://github.com/YOUR_USERNAME/carpool-hero.git
   git branch -M main
   git push -u origin main
   ```

2. **Create free Render account** → [render.com](https://render.com) (sign in with GitHub)

3. **New → Web Service** → connect your `carpool-hero` repo

4. **Settings:**
   | Field | Value |
   |-------|-------|
   | Name | `carpool-hero-demo` |
   | Runtime | Node |
   | Build Command | `npm run build:demo` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |

5. **Environment variables** (add in Render dashboard):
   ```
   NODE_ENV=production
   MOCK_MODE=true
   ```

6. Click **Create Web Service** — first deploy takes ~3–5 minutes.

Your demo URL will be shown on the Render dashboard.

---

## Share with demo users

Send them the Render URL. Suggested demo script:

1. **Driver** tab → enter tag `104` → tap **I've Arrived**
2. **Board** tab (switch mock role to Teacher) → see Emma & Olivia queued
3. **Traffic Control** tab (Traffic Controller role) → manual keypad fallback
4. **FAQ** tab → privacy explanations

Mock auth is enabled — use the **Role** dropdown in the header to switch views.

---

## Notes

- **Free tier sleeps** after 15 min idle — first visit may take ~30 sec to wake up
- **Geolocation** (Driver auto-arrival) requires HTTPS — Render provides this automatically
- **Dispatcher → Zone → Use My Current Location** to test geofence at your demo site
- Data resets when the service restarts (in-memory mock DB)

---

## Alternative: Azure SWA (when ready for production)

When moving off demo, deploy to Azure Static Web Apps using the existing `staticwebapp.config.json` and `/api` Azure Functions folder.

---

## Local production test (before cloud deploy)

```cmd
cd d:\code\carpool-hero
npm run build:demo
set NODE_ENV=production&& set MOCK_MODE=true&& npm start
```

Open http://localhost:7071 (single port — API + app together)
