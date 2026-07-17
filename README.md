# DFN-PlaniX

Web-based engineering project and resource planning platform — **Phase 1**.

## Stack

- **Backend:** Spring Boot 3.2, MySQL 8, Redis (optional locally), JWT (RS256)
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Zustand, TanStack Query
- **Schema:** `sql/build.sql` + `sql/seed.sql` (Liquibase disabled for Phase 1 installs)

## Quick start (Docker)

```bash
docker compose up --build
```

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:5173        |
| API       | http://localhost:8080        |
| Swagger   | http://localhost:8080/swagger-ui.html |
| MailHog   | http://localhost:8025        |

**Demo login** (after `seed.sql`):

| Email | Password |
|-------|----------|
| admin@dfnpm.local | Admin@12345 |

Additional users are created from Team → Management Excel import or Admin → Users.

## Local development

See `RUN.md` for MySQL setup, `build.sql` / `seed.sql`, and run profiles.

### Backend

```bash
cd nexus-pm-backend
# copy application-local.yml.example → application-local.yml and set DB password
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev,local
```

### Frontend

```bash
cd nexus-pm-frontend
npm install
npm run dev
```

## Phase 1 deliverables

- [x] Spring Boot API + React app (DFN-PlaniX)
- [x] MySQL schema (~38 tables) via `sql/build.sql` + seed data
- [x] Auth: login, JWT refresh, logout, password reset / change
- [x] Org hierarchy, team roster, org structure / chart / stats
- [x] Projects, issues, allocations, time logging
- [x] Admin: reference data, roles & access, holidays, settings, audit log
- [x] Skills + experience on engineers; Excel imports
- [x] Docker Compose (API + MySQL + Redis + web + MailHog)

See `NexusPM_SRS_v1.1.txt` for the full specification.
