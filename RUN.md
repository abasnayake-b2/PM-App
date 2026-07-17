# DFN-PlaniX — Run locally on Windows

You already have: **Java 26**, **MySQL 80** (running), **database seeded** via Workbench.

You still need: **Maven**, **Node.js**, **Redis**.

---

## Step 0 — Create MySQL app user (if not done)

Default app credentials: `dfnpm` / `dfnpm`

Run in MySQL Workbench:

```sql
CREATE USER IF NOT EXISTS 'dfnpm'@'localhost' IDENTIFIED BY 'dfnpm';
GRANT ALL PRIVILEGES ON dfn_pm.* TO 'dfnpm'@'localhost';
FLUSH PRIVILEGES;
```

If you prefer **root**, skip this and set your root password in `application-local.yml` (Step 2).

---

## Step 1 — Install missing tools

Open **PowerShell as Administrator** and run:

```powershell
winget install Apache.Maven
winget install OpenJS.NodeJS.LTS
winget install Memurai.MemuraiDeveloper
```

Then **close and reopen** your terminal (or Cursor) so `mvn`, `node`, and `npm` are on PATH.

Verify:

```powershell
java -version
mvn -version
node --version
npm --version
```

Start Redis (Memurai installs as a Windows service — check Services for **Memurai** running on port **6379**).

> **Alternative (easiest):** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/), then from `C:\Dev\dfn-pm` run `docker compose up --build` — no local Maven/Node/Redis needed.

---

## Step 2 — Backend local config

Because you created the schema with `build.sql` (not Liquibase), disable Liquibase for local runs.

Copy the example config:

```powershell
copy C:\Dev\dfn-pm\nexus-pm-backend\src\main\resources\application-local.yml.example `
     C:\Dev\dfn-pm\nexus-pm-backend\src\main\resources\application-local.yml
```

Edit `application-local.yml` — set your MySQL username/password if not using `dfnpm`/`dfnpm`.

---

## Step 3 — Start the API (backend)

```powershell
cd C:\Dev\dfn-pm\nexus-pm-backend
mvn spring-boot:run "-Dspring-boot.run.profiles=dev,local"
```

Wait until you see: `Started NexusPmApplication`

| Check | URL |
|-------|-----|
| Health | http://localhost:8080/api/v1/actuator/health |
| Swagger | http://localhost:8080/api/v1/swagger-ui.html |

---

## Step 4 — Start the UI (frontend)

Open a **second terminal**:

```powershell
cd C:\Dev\dfn-pm\nexus-pm-frontend
npm install
npm run dev
```

Open: **http://localhost:5173**

---

## Step 5 — Log in

| Email | Password |
|-------|----------|
| admin@dfnpm.local | Admin@12345 |

Other accounts are created via Admin → Users or Management Excel import (not in `seed.sql`).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Communications link failure` (MySQL) | MySQL80 service running? User/password correct in `application-local.yml`? |
| `Unable to connect to Redis` | Start Memurai service or install Redis on port 6379 |
| `Table 'region' already exists` (Liquibase) | Use profile `local` — `liquibase.enabled: false` |
| `mvn` / `node` not found | Reopen terminal after winget install |
| Login fails | Re-run `seed.sql`; passwords are in seed file header |
| CORS error in browser | Frontend must be on http://localhost:5173 |

---

## All-in-one with Docker (optional)

```powershell
cd C:\Dev\dfn-pm
docker compose up --build
```

Frontend: http://localhost:5173  
API: http://localhost:8080/api/v1
