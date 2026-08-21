# Azure Admin Access Request — Carpool Hero

**Copy the sections below into an email or ticket for your nonprofit Azure administrators.**

---

## Email subject

`Access request: Carpool Hero app — non-prod + prod Azure setup (Agasthiyar Academy)`

---

## Email body (send to Azure admin)

Hello,

I am deploying **Carpool Hero**, a Sunday School carpool check-in and dismissal web application for Agasthiyar Academy. The app will run in your **nonprofit Azure subscription** in two isolated environments: **non-production (non-prod)** and **production (prod)**.

I need your help with **subscription access**, **resource groups**, and **Microsoft Entra ID (Azure AD) identity setup**. I will handle application deployment and configuration once access is in place.

Please do **not** send passwords or secrets by email. Use Azure Portal, a password manager, or a secure handoff your organization already uses.

---

### 1. What we are building (both environments)

Each environment needs these Azure resources in its own resource group:

| Resource | Purpose |
|----------|---------|
| **Azure Static Web App** | Hosts the website + API (includes Azure Functions) |
| **Azure Database for PostgreSQL Flexible Server** | Stores roster, tags, and dismissal queue |
| **Azure Web PubSub** | Live updates on classroom dismissal boards |
| **Microsoft Entra ID app registration** | Staff sign-in (Dispatcher, Teacher, Traffic Controller) |

**Not in scope for launch:** GPS/geofence, Microsoft 365 roster sync (CSV import only).

**Public users (parents/drivers)** do not need accounts — they use a family tag number only.

---

### 2. Resource groups to create

Please create **two resource groups** in our preferred Azure region (suggest one close to the school, e.g. **Central US** or **East US**):

| Environment | Resource group name (suggested) |
|-------------|--------------------------------|
| Non-prod | `rg-carpool-hero-nonprod` |
| Production | `rg-carpool-hero-prod` |

Use the **same region** for both unless you have a policy requiring otherwise.

---

### 3. Azure IAM — access for the developer

Grant the following person **scoped access only to the two resource groups above** (not whole-subscription Owner unless that is your standard):

**Developer name:** `[YOUR FULL NAME]`  
**Developer email (Entra ID):** `[YOUR WORK OR PERSONAL M365 EMAIL IN THEIR TENANT]`

| Role | Scope | Why |
|------|-------|-----|
| **Contributor** | `rg-carpool-hero-nonprod` and `rg-carpool-hero-prod` | Create and manage app resources (SWA, PostgreSQL, Web PubSub) |
| **User Access Administrator** *(optional but helpful)* | Same two resource groups | Assign managed identities / service roles without opening a ticket each time |

**Do not grant:** Subscription Owner, Global Administrator, or broad Contributor on the entire subscription unless required by your policy.

If your policy forbids User Access Administrator, **Contributor alone is acceptable** — I will ask you to approve any IAM changes I cannot do myself.

---

### 4. Microsoft Entra ID — identity & app permissions

Staff will sign in with **Microsoft accounts in your nonprofit tenant**. Parents/drivers do **not** sign in.

#### 4a. Entra directory roles for the developer (pick one option)

**Option A — Preferred (developer can finish setup):**

| Entra role | Assigned to | Purpose |
|------------|-------------|---------|
| **Application Developer** | `[YOUR EMAIL]` | Create/update the Carpool Hero app registration, define app roles, configure redirect URIs |

**Option B — If you prefer not to grant Application Developer:**

- You create the app registration (see section 6) and add me as **Owner** on that app registration only.

#### 4b. What you (admin) must do in Entra — I cannot do without elevated directory rights

| Task | Who | Notes |
|------|-----|-------|
| Assign staff to app roles | **Global Admin**, **Privileged Role Admin**, or **Cloud Application Admin** | See role list in section 7 |
| Admin consent for API permissions | **Not needed at launch** | CSV roster only; no Microsoft Graph |
| Guest / member accounts for staff | **User Administrator** or your helpdesk process | Teachers, traffic controllers, dispatchers need accounts in this tenant |

---

### 5. GitHub deployment (Static Web Apps)

The application source code is in GitHub: **`https://github.com/tjsnn27/carpool-hero`**

For **each** Static Web App (non-prod and prod), either:

**Option A — Recommended:** When creating the Static Web App in Azure Portal, choose **Deployment source: GitHub**, authorize the Azure app, and connect:

- Non-prod SWA → branch `main` or `develop` (we will confirm)
- Prod SWA → branch `main` (production releases only)

Azure will automatically add a GitHub secret `AZURE_STATIC_WEB_APPS_API_TOKEN` to the repo.

**Option B:** If GitHub connection must be done by me, grant me **Contributor** on the Static Web App resource and provide the deployment token through your secure channel.

Please confirm which **GitHub organization/account** owns the repo is allowed to connect to your Azure tenant.

---

### 6. If you create the Entra app registration (Option B above)

Create **one app registration per environment** (recommended) or one app with both redirect URIs:

| Setting | Non-prod | Prod |
|---------|----------|------|
| Display name | `Carpool Hero (Non-Prod)` | `Carpool Hero (Prod)` |
| Supported account types | Single tenant (this organization only) | Same |
| Redirect URI (SPA) | `https://[nonprod-swa-name].azurestaticapps.net` | `https://[prod-swa-name].azurestaticapps.net` |

**App roles to create** (exact **Value** must match — case-sensitive):

| Display name | Value |
|--------------|-------|
| Dispatcher | `dispatcher` |
| Teacher | `teacher` |
| Traffic Controller | `trafficcontroller` |

Create a **client secret** for each app (or use certificate per your policy) for Static Web App backend authentication.

Add me as **Owner** on both app registrations.

---

### 7. Staff role assignments (school provides the list)

After app registration exists, please assign users or groups to these roles:

| Entra app role | Typical staff | Environment |
|----------------|---------------|-------------|
| `dispatcher` | Carpool coordinator / admin | non-prod + prod |
| `teacher` | Classroom teachers | non-prod + prod |
| `trafficcontroller` | Curb / lane volunteers | non-prod + prod |

**We will send a separate spreadsheet** with names and emails for non-prod testing and prod go-live.

---

### 8. Information to send back to the developer (secure handoff)

Once setup is complete, please provide:

| Item | Non-prod | Prod |
|------|----------|------|
| Azure **subscription ID** | ✓ | (same subscription) |
| Azure **tenant ID** | ✓ | ✓ |
| **Resource group** names | ✓ | ✓ |
| Static Web App **URL** | ✓ | ✓ |
| Entra app **client ID** | ✓ | ✓ |
| Confirmation GitHub deploy token is connected | ✓ | ✓ |
| PostgreSQL **server name** + database name `carpool_hero` | ✓ | ✓ |

**Secrets** (connection strings, client secrets, database passwords): use **Azure Key Vault**, **Static Web App Application Settings**, or your approved secret store — not email.

I will configure application settings myself if I have **Contributor** on the Static Web App and resource group.

---

### 9. Application settings (for admin reference — developer configures these)

These are set in **Static Web App → Environment variables**, not in email:

```
MOCK_MODE=false
DATABASE_URL=postgresql://...
WEBPUBSUB_CONNECTION_STRING=Endpoint=https://...
WEBPUBSUB_HUB=carpool
AAD_CLIENT_ID=<entra-app-client-id>
AAD_CLIENT_SECRET=<from-key-vault-or-portal>
```

GitHub Actions secrets for the frontend build:

```
VITE_MOCK_AUTH=false
VITE_AAD_CLIENT_ID=<same client id>
VITE_AAD_AUTHORITY=https://login.microsoftonline.com/<TENANT_ID>
VITE_AAD_REDIRECT_URI=<SWA URL>
```

---

### 10. Admin checklist

Please reply when each item is done:

- [ ] Nonprofit **Azure subscription** is active and billing/credits confirmed  
- [ ] Resource group **`rg-carpool-hero-nonprod`** created  
- [ ] Resource group **`rg-carpool-hero-prod`** created  
- [ ] **`[YOUR EMAIL]`** granted **Contributor** on both resource groups  
- [ ] **`[YOUR EMAIL]`** granted **Application Developer** *OR* app registration created with me as **Owner**  
- [ ] Entra app role(s) created: `dispatcher`, `teacher`, `trafficcontroller`  
- [ ] Static Web App(s) created and linked to GitHub (or deploy token shared securely)  
- [ ] Staff test accounts assigned to app roles for **non-prod**  
- [ ] Tenant ID and subscription ID shared with developer (non-secret)  
- [ ] Secrets stored in Key Vault / SWA settings — **not emailed**  

---

### 11. Security notes for your team

- This app stores **student roster and pickup information** — treat PostgreSQL as ** confidential school data**.
- Enable **HTTPS only** (default on Static Web Apps).
- Restrict PostgreSQL firewall to **Azure services** + admin IPs for migration.
- Use **separate databases** (or separate servers) for non-prod and prod.
- Non-prod may use smaller/cheaper SKUs; prod should use stable tiers before go-live.

---

Thank you. Please let me know if a short call would help — I can walk through the Portal clicks with your admin.

**Developer contact:** `[YOUR NAME]` · `[YOUR EMAIL]` · `[YOUR PHONE]`

---

## Short version (Slack / quick ask)

> We need Carpool Hero (Sunday School dismissal app) in Azure **non-prod + prod**. Please create resource groups `rg-carpool-hero-nonprod` and `rg-carpool-hero-prod`, grant `[YOUR EMAIL]` **Contributor** on both, and either **Application Developer** in Entra or an app registration named Carpool Hero with roles `dispatcher`, `teacher`, `trafficcontroller`. Connect Static Web Apps to GitHub repo `tjsnn27/carpool-hero`. No Graph API needed. Send tenant ID + SWA URLs back; secrets via Key Vault/SWA settings, not email.
