# UniFlow — API Specification

This document describes the implemented UniFlow API routes and their tenant-scoped database actions.

## 1. API Design Conventions

| Convention         | Standard                 |
| ------------------ | ------------------------ |
| API Base Path      | `/api/v1/`               |
| Architecture Style | REST-oriented            |
| Data Format        | JSON                     |
| Versioning         | URL-based                |
| Functional Source  | Project Requirement.md   |
| Database Source    | Database Architecture.md |

## 2. Admin Routes

| Route                                                      | Method | Feature (PRD)                                          | DB Table(s)                         | DB Action                                                 |
| ---------------------------------------------------------- | ------ | ------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------- |
| `/api/v1/admin/attendance?scope=college&aggregate=average` | GET    | ADM-01 — View average college-wide student attendance  | `attendance_records`                | SELECT attendance records; calculate a read-only average. |
| `/api/v1/admin/attendance/audit?limit={limit}`              | GET    | Review recent student attendance sessions               | `attendance_records`, `users`, `classes`, `courses` | SELECT tenant-scoped attendance events with student, class, and course details. |
| `/api/v1/admin/users?search={query}`                         | GET    | Search the campus directory                             | `users`, `departments`               | SELECT tenant-scoped campus accounts and their department. |
| `/api/v1/admin/timetable`                                    | GET    | View scheduled campus classes and assigned instructors  | `classes`, `class_meetings`, `courses`, `users` | SELECT tenant-scoped master timetable entries. |
| `/api/v1/admin/campus`                                       | PUT    | Update the campus display name                          | `colleges`                            | UPDATE the authenticated tenant's campus name. |
| `/api/v1/admin/users/{user_id}`                              | PUT    | Edit a campus user's name, department, or status         | `users`, `departments`                | UPDATE a tenant-scoped account; validate its department. |
| `/api/v1/admin/attendance/{attendance_id}`                   | PUT    | Correct a recorded student attendance status             | `attendance_records`                 | UPDATE a tenant-scoped attendance record. |
| `/api/v1/admin/classes/{class_id}`                           | PUT    | Edit class term, section, room, instructor, and meetings | `classes`, `class_meetings`, `users`  | UPDATE class details and replace its weekly meeting list in one transaction. |
| `/api/v1/admin/notices`                                    | GET    | Review campus announcements                              | `notices`, `users`                   | SELECT campus notices with author names. |
| `/api/v1/admin/notices`                                    | POST   | ADM-02 — Post global announcements to the Notice Board | `notices`                            | INSERT a campus announcement. |
| `/api/v1/admin/notices/{notice_id}`                         | PUT    | Edit a campus announcement                              | `notices`                             | UPDATE a tenant-scoped announcement. |
| `/api/v1/admin/notices/{notice_id}`                         | DELETE | Remove a campus announcement                            | `notices`                             | DELETE a tenant-scoped announcement. |
| `/api/v1/admin/faculty-attendance`                         | GET    | ADM-03 — View faculty attendance records               | `faculty_attendance`, `users`        | SELECT campus faculty attendance. |

## 3. Faculty Routes

| Route                                                                            | Method | Feature (PRD)                                                                | DB Table(s)                         | DB Action                                                                         |
| -------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| `/api/v1/faculty/classes/{class_id}/attendance`                                  | POST   | FAC-01 — Take daily attendance for assigned classes                          | `classes`, `attendance_records`     | SELECT the assigned class; INSERT attendance records.                             |
| `/api/v1/faculty/classes/{class_id}/attendance/{student_id}?session_date={date}` | PUT    | FAC-01 — Update daily attendance for an existing record in an assigned class | `classes`, `attendance_records`     | SELECT the assigned class; UPDATE the matching attendance record.                 |
| `/api/v1/faculty/timetable?session_date={date}`                                  | GET    | FAC-02 — View weekly teaching timetable with instructor and attendance status | `classes`, `class_meetings`, `courses`, `users`, `enrollments`, `attendance_records` | SELECT assigned weekly sessions, faculty identity, active enrollment, and roll-call summaries. |
| `/api/v1/faculty/classes/{class_id}/attendance?aggregate=average`                | GET    | FAC-03 — View average student attendance for specific classes                | `classes`, `attendance_records`     | SELECT the class and its attendance records; calculate a read-only class average. |
| `/api/v1/faculty/classes/{class_id}/tests`                                      | GET    | FAC-04 — View assigned-class assessments and marks                           | `classes`, `test_assessments`, `student_marks`, `users` | SELECT assessments and their recorded student grades. |
| `/api/v1/faculty/classes/{class_id}/tests/{test_id}/marks`                       | POST   | FAC-04 — Create an assessment and optionally upload marks                    | `classes`, `test_assessments`, `student_marks`, `enrollments` | SELECT assigned class and active students; INSERT test and marks. |
| `/api/v1/faculty/classes/{class_id}/tests/{test_id}/marks`                       | PUT    | FAC-04 — Save multiple grades atomically                                     | `classes`, `test_assessments`, `student_marks`, `enrollments` | SELECT assigned class and active students; INSERT or UPDATE marks in one transaction. |
| `/api/v1/faculty/classes/{class_id}/tests/{test_id}/marks/{student_id}`          | PUT    | FAC-04 — Create or update a student's test mark                              | `classes`, `test_assessments`, `student_marks`, `enrollments` | SELECT assigned class and active student; INSERT or UPDATE mark. |
| `/api/v1/faculty/classes/{class_id}/tests/{test_id}`                            | PUT    | Edit assessment title, maximum score, and due date                            | `classes`, `test_assessments`, `student_marks` | UPDATE assessment after checking existing marks against the new maximum. |
| `/api/v1/faculty/classes/{class_id}/materials`                                  | GET    | View shared links for assigned-class materials (extension)                   | `classes`, `course_materials`        | SELECT links for the assigned class. |
| `/api/v1/faculty/classes/{class_id}/materials`                                  | POST   | Share a course material link (extension)                                     | `classes`, `course_materials`        | SELECT assigned class; INSERT material title, URL, and description. |
| `/api/v1/faculty/classes/{class_id}/materials/{material_id}`                    | DELETE | Remove an assigned-class material link (extension)                           | `classes`, `course_materials`        | SELECT assigned class; DELETE its material. |
| `/api/v1/faculty/classes/{class_id}/materials/{material_id}`                    | PUT    | Edit an assigned-class material link (extension)                              | `classes`, `course_materials`        | SELECT assigned class; UPDATE its title, URL, and description. |
| `/api/v1/faculty/me/profile`                                                    | PATCH  | Edit the faculty member's display name                                       | `users`                              | UPDATE the authenticated faculty account only. |
| `/api/v1/faculty/notices`                                                        | GET    | FAC-05 — View the global Notice Board                                        | `notices`, `users` | SELECT campus notices with author names. |

## 4. Student Routes

| Route                                | Method | Feature (PRD)                                   | DB Table(s)                         | DB Action                                                                                          |
| ------------------------------------ | ------ | ----------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/api/v1/students/me/attendance`     | GET    | STD-01 — View personal attendance records       | `attendance_records`                | SELECT attendance records for the current student.                                                 |
| `/api/v1/students/me/profile`        | PATCH  | Edit the student's display name                 | `users`                             | UPDATE the authenticated student account only. |
| `/api/v1/students/me/timetable`      | GET    | STD-02 — View personal class timetable          | `enrollments`, `classes`            | SELECT the current student's enrollments and related classes.                                      |
| `/api/v1/students/me/materials`      | GET    | View materials shared with enrolled classes (extension)     | `enrollments`, `course_materials`    | SELECT shared material links for actively enrolled classes.                                       |
| `/api/v1/students/me/marks`          | GET    | STD-03 — Check test marks and academic progress | `student_marks`, `test_assessments`, `classes`, `courses` | SELECT assessments and marks for the authenticated student. |
| `/api/v1/students/academic-calendar` | GET    | STD-04 — View upcoming holidays and exam dates  | `academic_calendar_entries`          | SELECT upcoming tenant calendar events. |
| `/api/v1/students/notices`           | GET    | STD-05 — View the global Notice Board           | `notices`, `users`                   | SELECT campus notices with author names. |

## 5. Requirement Traceability

| Requirement                                                   | Agent   | API Route                                                                                                                           | Method    |
| ------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------- |
| ADM-01 — View average college-wide student attendance         | Admin   | `/api/v1/admin/attendance?scope=college&aggregate=average`                                                                          | GET       |
| ADM-02 — Post global announcements to the Notice Board        | Admin   | `/api/v1/admin/notices`                                                                                                             | POST      |
| ADM-03 — View faculty attendance records                      | Admin   | `/api/v1/admin/faculty-attendance`                                                                                                  | GET       |
| FAC-01 — Take daily attendance for assigned classes           | Faculty | `/api/v1/faculty/classes/{class_id}/attendance`; `/api/v1/faculty/classes/{class_id}/attendance/{student_id}?session_date={date}`   | POST, PUT |
| FAC-02 — View personal teaching timetable                     | Faculty | `/api/v1/faculty/timetable`                                                                                                         | GET       |
| FAC-03 — View average student attendance for specific classes | Faculty | `/api/v1/faculty/classes/{class_id}/attendance?aggregate=average`                                                                   | GET       |
| FAC-04 — Assign and upload marks for student tests            | Faculty | `/api/v1/faculty/classes/{class_id}/tests`; `/api/v1/faculty/classes/{class_id}/tests/{test_id}/marks`; `/api/v1/faculty/classes/{class_id}/tests/{test_id}/marks/{student_id}` | GET, POST, PUT |
| FAC-05 — View the global Notice Board                         | Faculty | `/api/v1/faculty/notices`                                                                                                           | GET       |
| STD-01 — View personal attendance records                     | Student | `/api/v1/students/me/attendance`                                                                                                    | GET       |
| STD-02 — View personal class timetable                        | Student | `/api/v1/students/me/timetable`                                                                                                     | GET       |
| STD-03 — Check test marks and academic progress               | Student | `/api/v1/students/me/marks`                                                                                                         | GET       |
| STD-04 — View upcoming holidays and exam dates                | Student | `/api/v1/students/academic-calendar`                                                                                                | GET       |
| STD-05 — View the global Notice Board                         | Student | `/api/v1/students/notices`                                                                                                          | GET       |

## 6. Architecture Alignment Notes

- **ADM-02, FAC-05, STD-05 — Notices:** The implementation adds a tenant-scoped `notices` table with an author, category, title, content, and creation time.
- **ADM-03 — Faculty attendance:** The implementation adds `faculty_attendance`; faculty records are separate from student attendance.
- **FAC-02, STD-02 — Timetables:** The implementation adds `class_meetings`, related to `classes`, for weekly day/time slots.
- **FAC-04 — Test marks:** The implementation adds `test_assessments` and `student_marks`, linked to classes, enrolled students, and each other.
- **Course materials extension:** The implementation adds `course_materials` for tenant-scoped titles, descriptions, and URLs shared by faculty with enrolled students.
- **STD-03 — Test marks and academic progress:** Individual test marks are stored in `student_marks`. The current dashboard's CGPA, SGPA, and standing fields are persisted as per-user portal data; no grade-point conversion rule is inferred from `final_grade`.
- **STD-04 — Holidays and exam dates:** The implementation adds `academic_calendar_entries` with `holiday` and `exam` event types.
- **Dashboard integration:** Dashboard views derive current account names, counts, class terms, and schedules from tenant tables. Role-scoped profile and record endpoints update the authoritative `users`, attendance, assessment, material, class, and notice records rather than displaying UI-only edits.
- **Development sample records:** Running the idempotent `seed_db.py` script adds clearly labeled `DEMO:` notices, assessments, and materials, plus sample attendance and a calendar event for enrolled CS101 students. Existing records are reused, not overwritten.
- **Authentication:** `POST /api/v1/auth/login` accepts campus slug, email, password, and role; it sets a short-lived `HttpOnly`, `SameSite=Lax` session cookie scoped to that user and campus. `GET /api/v1/auth/session` validates it against the active account and its authentication version. `POST /api/v1/auth/logout` increments the account authentication version and expires the cookie, invalidating previously issued sessions. Configure trusted browser origins using `FRONTEND_ORIGINS`; unsafe API requests are origin-checked. Protected API responses disable caching.

## 7. API Completeness Verification

| Verification                                        | Status                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| All 13 PRD requirements are mapped                  | Verified — each requirement appears in the traceability table.                           |
| All PRD API operations are implemented              | Verified — supported by original entities or the schema extensions described above. |
| Database references match the implemented schema    | Verified — the original schema is extended with tenant-owned relational entities. |
| Routes are grouped by portal                        | Verified                                                                                 |
| HTTP methods are appropriate                        | Verified                                                                                 |
| Requirement traceability is maintained              | Verified — PRD IDs and responsible agents are retained.                                  |
| Tenant isolation and role checks are enforced        | Verified — cookie session auth, scoped sessions, and PostgreSQL RLS policies. |

## 8. Implementation Readiness

All routes are implemented and run against PostgreSQL. For ADM-01 and FAC-03,
`present` and `late` count as attended; `excused` records are excluded from the
denominator. A class timetable can be returned once its `class_meetings` rows
are provisioned. Sample development records are created only when the explicit
idempotent `seed_db.py` command is run.

The faculty timetable returns one row per assigned weekly meeting, with the
instructor, weekday (`0` = Monday through `6` = Sunday), start/end time, room,
section, active enrollment count, today's roll-call completion, and historical
present/late counts. Historical attendance excludes excused records from its
denominator.
