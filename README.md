# UniFlow

UniFlow is a React/Vite frontend backed by a FastAPI API and a tenant-isolated
PostgreSQL database.

## Run the integrated stack

1. Copy `.env.example` to `.env` and replace the placeholder secrets with unique
   values. Keep passwords URL-safe because `DATABASE_URL` embeds the application
   database password.
2. Start Docker Desktop, then run:

   ```powershell
   docker compose up --build
   ```

   The frontend is available at `http://localhost:3000`; the API and OpenAPI
   documentation are available at `http://localhost:8000` and
   `http://localhost:8000/docs`. The browser calls FastAPI directly using
   `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`), not the
   frontend server. If you change the backend host port, update this URL too.
3. On a new database, the API creates the mapped tables and tenant RLS policies
   at startup. The database initialization script creates a non-superuser
   `uniflow_app` role for API access. For an existing database, create that role
   and grant it schema/table ownership or equivalent privileges before starting
   the API; do not delete the existing database volume.
4. Seed development accounts after the API is healthy. In PowerShell, set
   `SEED_PASSWORD` to a private development password, then run:

   ```powershell
   $env:SEED_PASSWORD = "choose-a-private-development-password"
   docker compose exec -e SEED_PASSWORD=$env:SEED_PASSWORD backend python seed_db.py
   ```

   The script is idempotent and creates two demo campuses. For
   `northstar-state`, the accounts are `admin@northstar.example.edu`,
   `faculty01@northstar.example.edu`, and `student01@northstar.example.edu`;
   `lakeside-polytechnic` uses the same account pattern at
   `lakeside.example.edu`. All seeded accounts use the `SEED_PASSWORD` value.
   Seeded records intentionally have no default password. Each campus also gets
   an introductory CS101 class with one enrolled student and a weekly meeting,
   so the timetable and class-roster flows are ready to try. The seed script
   also creates idempotent, clearly labeled `DEMO:` assessments, marks,
   materials, a campus notice, a calendar entry, and sample attendance records.
   These development records are persisted in PostgreSQL and can be edited from
   their appropriate role dashboards.

   To provision or reset one specific student account without changing the
   passwords of the other seeded accounts, set `SEED_STUDENT_EMAIL` and
   `SEED_STUDENT_PASSWORD` for that seed run. Optionally set
   `SEED_STUDENT_COLLEGE_SLUG` (defaults to `northstar-state`) and
   `SEED_STUDENT_NAME`:

   ```powershell
   $env:SEED_STUDENT_EMAIL = "student@example.edu"
   $env:SEED_STUDENT_PASSWORD = "choose-a-private-password"
   $env:SEED_STUDENT_COLLEGE_SLUG = "northstar-state"
   docker compose exec `
     -e SEED_STUDENT_EMAIL=$env:SEED_STUDENT_EMAIL `
     -e SEED_STUDENT_PASSWORD=$env:SEED_STUDENT_PASSWORD `
     -e SEED_STUDENT_COLLEGE_SLUG=$env:SEED_STUDENT_COLLEGE_SLUG `
     backend python seed_db.py
   ```

   The account is activated and enrolled in the campus's seeded CS101 class.
   This operation only creates or updates the explicitly named student account.

For local development without Docker, start PostgreSQL with a database and
non-superuser account, configure `DATABASE_URL` and `TOKEN_SECRET`, then run
`uvicorn app.main:app --reload --port 8000` from the repository root and
`npm run dev` from `frontend`. The Vite client sends API requests directly to
`VITE_API_BASE_URL`, which defaults to `http://localhost:8000/api/v1` and rejects
configuration that targets the frontend port 3000. `NEXT_PUBLIC_API_URL` is a
Next.js-specific variable and is not used by this Vite application.

## Deploy the frontend to Vercel

Create or update the Vercel project with `frontend` as its Root Directory. Use
`npm run build` as the build command and `dist` as the output directory.
`frontend/vercel.json` rewrites application routes such as `/login` to the Vite
entry point so they load correctly when opened directly or refreshed.

The frontend routes `/api/v1` requests through a same-origin Vercel function;
this keeps the authentication cookie on the Vercel site while the function
forwards requests to FastAPI. In Vercel Production, set the server-only
`API_BASE_URL` environment variable to the HTTPS origin of the deployed FastAPI
service (for example, `https://uniflow-api.onrender.com`), then redeploy. Do
not set it to the Supabase database URL: the frontend calls FastAPI, and FastAPI
connects to PostgreSQL.

To deploy FastAPI on Render, create a Blueprint from this repository using
`render.yaml`. Set its `DATABASE_URL` to the Supabase Session Pooler connection
URL, using the `postgresql+asyncpg://` scheme required by this backend and
preserving Supabase's TLS requirement (`ssl=require` for asyncpg). URL-encode
special characters in the database username or password. Set
`FRONTEND_ORIGINS` to the exact Vercel site origin; update the value in
`render.yaml` if the Vercel domain changes. Render generates `TOKEN_SECRET`
automatically. The Render `/health` check verifies the database connection as
well as API availability.

If the Supabase database does not already contain campus and user records, set
a private `SEED_PASSWORD` in Render and run `python seed_db.py` from the
service's Shell after deployment. The seeded accounts use that password. The
login page reports whether both FastAPI and PostgreSQL are reachable; it does
not claim they are online before checking them.

## Authentication and tenant isolation

`POST /api/v1/auth/login` accepts `email`, `password`, `role` (`ADMIN`,
`FACULTY`, or `STUDENT`), and `college_slug`. It establishes a short-lived
signed session in an `HttpOnly`, `SameSite=Lax` cookie; production sets the
`Secure` flag. The browser never stores or sends the signing token from
JavaScript. `GET /api/v1/auth/session` verifies the session with the backend,
and `POST /api/v1/auth/logout` revokes it server-side and expires the cookie.
The frontend checks sessions before rendering protected routes and after
browser history restoration. Protected API responses are marked `no-store`.
Configure comma-separated trusted frontend origins with `FRONTEND_ORIGINS`;
unsafe API requests from other origins are rejected.

Tenant-scoped database requests set `app.current_tenant_id` transaction-locally.
The API enables and forces PostgreSQL row-level security for tenant-owned tables.
Logging out increments the user's authentication version, invalidating all
previously issued sessions for that account. The API adds this column to
existing databases at startup.
`TOKEN_SECRET` must be a unique random value of at least 32 characters. Do not
use the example values in a deployed environment.

## API coverage

The API base path is `/api/v1`. Endpoints from `api_spec.md` are implemented:

| Role | Route | Purpose |
| --- | --- | --- |
| Auth | `POST /auth/login` | Authenticate a user within a campus |
| Auth | `GET /auth/session` | Verify the server-side session |
| Auth | `POST /auth/logout` | Revoke sessions and expire the session cookie |
| Admin | `GET /admin/attendance?scope=college&aggregate=average` | College attendance average |
| Admin | `POST /admin/notices` | Publish a global notice |
| Admin | `GET /admin/faculty-attendance` | View faculty attendance |
| Admin | `PUT /admin/campus` | Edit the campus display name |
| Admin | `PUT /admin/users/{user_id}` | Edit a user's name, department, or status |
| Admin | `PUT /admin/attendance/{attendance_id}` | Correct an attendance record |
| Admin | `PUT /admin/classes/{class_id}` | Edit class details and weekly timetable |
| Faculty | `POST /faculty/classes/{class_id}/attendance` | Record attendance |
| Faculty | `PUT /faculty/classes/{class_id}/attendance/{student_id}?session_date={date}` | Update attendance |
| Faculty | `PATCH /faculty/me/profile` | Edit faculty display name |
| Faculty | `GET /faculty/timetable` | View assigned class schedule |
| Faculty | `GET /faculty/classes/{class_id}/attendance?aggregate=average` | View class attendance average |
| Faculty | `POST /faculty/classes/{class_id}/tests/{test_id}/marks` | Create a test and upload marks |
| Faculty | `PUT /faculty/classes/{class_id}/tests/{test_id}/marks/{student_id}` | Update a mark |
| Faculty | `PUT /faculty/classes/{class_id}/tests/{test_id}` | Edit assessment details |
| Faculty | `PUT /faculty/classes/{class_id}/materials/{material_id}` | Edit a shared material link |
| Faculty | `GET /faculty/notices` | Read campus notices |
| Admin | `PUT`/`DELETE /admin/notices/{notice_id}` | Edit or remove campus announcements |
| Student | `GET /students/me/attendance` | Read personal attendance |
| Student | `PATCH /students/me/profile` | Edit student display name |
| Student | `GET /students/me/timetable` | Read enrolled class schedule |
| Student | `GET /students/me/marks` | Read marks and saved academic progress |
| Student | `GET /students/academic-calendar` | Read upcoming holidays and exams |
| Student | `GET /students/notices` | Read campus notices |

Dashboard summary values are derived from current tenant database records.
Profile edits update only the authenticated user's display name; official
attendance and grades are edited by faculty, and campus schedules, user
directory entries, and announcements by administrators. Each edit uses a
role-checked API and persists to PostgreSQL. Students can edit their own display
name, but cannot change official academic records.

The extended relational schema includes weekly class meetings, tests and marks,
notices, faculty attendance, and academic-calendar entries. Attendance
averages count `present` and `late` records as attended and exclude `excused`
records from the denominator. Empty database-backed lists are returned as
empty lists; the frontend shows API errors rather than pretending unsaved demo
data was persisted.
