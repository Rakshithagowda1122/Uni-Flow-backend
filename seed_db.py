"""Seed UniFlow colleges, departments, admins, faculty, and students.

Uses PostgreSQL schema reflection so the script never creates or alters tables.
Set DATABASE_URL to override the local connection settings. Set SEED_PASSWORD
to provision usable demo accounts with a fresh PBKDF2 password hash. The
default marker is intentionally not a usable password hash.
"""

import os
import re
import sys
import uuid
from datetime import date, time, timedelta

try:
    from sqlalchemy import MetaData, create_engine, select, text
    from sqlalchemy.exc import SQLAlchemyError
    from app.security import hash_password
except ImportError as exc:
    print(
        "SQLAlchemy is required to seed the database. Install SQLAlchemy and a "
        "PostgreSQL driver in the active Python environment.",
        file=sys.stderr,
    )
    raise SystemExit(1) from exc


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://uniflow_admin:uniflow_secure_pass123@localhost:5432/uniflow_db",
)
PASSWORD_HASH = os.getenv("SEED_PASSWORD_HASH")
if PASSWORD_HASH is None:
    seed_password = os.getenv("SEED_PASSWORD")
    PASSWORD_HASH = hash_password(seed_password) if seed_password else "!seeded-account-no-login!"

COLLEGES = (
    {
        "name": "Northstar State University",
        "slug": "northstar-state",
        "domain": "northstar.example.edu",
    },
    {
        "name": "Lakeside Polytechnic Institute",
        "slug": "lakeside-polytechnic",
        "domain": "lakeside.example.edu",
    },
)

DEPARTMENTS = (
    {"name": "Computer Science", "code": "CS"},
    {"name": "Electrical Engineering", "code": "EE"},
)

FACULTY_NAMES = (
    "Avery Bennett", "Jordan Chen", "Morgan Patel", "Riley Thompson",
    "Casey Rivera", "Taylor Brooks", "Cameron Reed", "Quinn Foster",
    "Drew Sullivan", "Skyler James",
)

STUDENT_NAMES = (
    "Alex Morgan", "Sam Taylor", "Jamie Parker", "Robin Lee", "Charlie Davis",
    "Emerson Clark", "Kendall Lewis", "Finley Walker", "Reese Hall", "Dakota Young",
    "Harper Allen", "Rowan King", "Peyton Wright", "Sage Scott", "Blake Green",
    "Ari Adams", "Elliot Baker", "Remy Nelson", "Shiloh Carter", "Micah Mitchell",
    "Noel Perez", "Frankie Roberts", "Marley Turner", "Jules Phillips", "Lennon Campbell",
    "Cory Parker", "Ash Morgan", "Rory Edwards", "Ellis Collins", "River Stewart",
    "Kit Morris", "Oakley Rogers", "Milan Cook", "Indigo Bailey", "Wren Murphy",
    "Sasha Bell", "Toby Cooper", "Alden Richardson", "Mackenzie Cox", "Lane Howard",
    "Dylan Ward", "Avery Torres", "Bailey Peterson", "Cedar Gray", "Shawn Ramirez",
    "Logan James", "Jesse Watson", "Phoenix Brooks", "Cameron Kelly", "Tatum Sanders",
)


def require_schema(metadata):
    expected = {
        "colleges": {"id", "name", "slug", "domain"},
        "departments": {"id", "college_id", "name", "code"},
        "users": {
            "id", "college_id", "department_id", "email", "password_hash",
            "full_name", "role", "status",
        },
        "courses": {"id", "college_id", "department_id", "code", "title"},
        "classes": {
            "id", "college_id", "course_id", "instructor_id", "term", "section",
        },
        "enrollments": {"id", "college_id", "class_id", "student_id", "status"},
        "class_meetings": {
            "id", "college_id", "class_id", "day_of_week", "starts_at", "ends_at",
        },
        "attendance_records": {
            "id", "college_id", "class_id", "student_id", "session_date", "status",
        },
        "test_assessments": {
            "id", "college_id", "class_id", "title", "max_score", "due_date",
        },
        "student_marks": {
            "id", "college_id", "test_id", "student_id", "score",
        },
        "course_materials": {
            "id", "college_id", "class_id", "title", "url", "description",
        },
        "notices": {
            "id", "college_id", "author_id", "title", "content", "category",
        },
        "academic_calendar_entries": {
            "id", "college_id", "title", "event_type", "starts_on", "ends_on",
        },
    }
    missing_tables = sorted(set(expected) - set(metadata.tables))
    if missing_tables:
        raise RuntimeError(
            "Required existing tables were not found: " + ", ".join(missing_tables)
        )

    for table_name, required_columns in expected.items():
        actual_columns = set(metadata.tables[table_name].c.keys())
        missing_columns = sorted(required_columns - actual_columns)
        if missing_columns:
            raise RuntimeError(
                f"Table '{table_name}' is missing required columns: "
                + ", ".join(missing_columns)
            )


def get_existing_id(connection, table, filters):
    statement = select(table.c.id).where(
        *(table.c[column] == value for column, value in filters.items())
    )
    return connection.execute(statement).scalar_one_or_none()


def get_or_create_record(connection, table, filters, values, counts, entity):
    existing_id = get_existing_id(connection, table, filters)
    if existing_id is not None:
        counts[f"{entity}_reused"] += 1
        return existing_id
    counts[f"{entity}_created"] += 1
    return insert_record(connection, table, {**filters, **values})


def provision_student_login(
    connection,
    colleges,
    departments,
    users,
    courses,
    classes,
    enrollments,
    college_slug,
    email,
    password,
    counts,
):
    email = email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise RuntimeError("SEED_STUDENT_EMAIL must be a valid email address.")
    if not password or len(password) < 8 or len(password) > 256:
        raise RuntimeError("SEED_STUDENT_PASSWORD must be between 8 and 256 characters.")

    college_id = get_existing_id(connection, colleges, {"slug": college_slug})
    if college_id is None:
        raise RuntimeError(
            f"Cannot provision student; college '{college_slug}' was not found."
        )
    connection.execute(
        text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
        {"tenant_id": str(college_id)},
    )
    department_id = get_existing_id(
        connection,
        departments,
        {"college_id": college_id, "code": "CS"},
    )
    if department_id is None:
        raise RuntimeError(
            f"Cannot provision student; college '{college_slug}' has no CS department."
        )

    student_id = get_existing_id(
        connection,
        users,
        {"college_id": college_id, "email": email},
    )
    password_hash = hash_password(password)
    if student_id is not None:
        existing = connection.execute(
            select(users.c.role).where(users.c.id == student_id)
        ).scalar_one()
        if existing != "STUDENT":
            raise RuntimeError(
                f"Cannot provision '{email}'; the address belongs to a non-student account."
            )
        connection.execute(
            users.update()
            .where(users.c.id == student_id)
            .values(password_hash=password_hash, status="active")
        )
        print("Existing student login password updated.")
    else:
        display_name = os.getenv(
            "SEED_STUDENT_NAME",
            email.split("@", 1)[0].replace(".", " ").replace("_", " ").title(),
        ).strip()
        if not display_name or len(display_name) > 150:
            raise RuntimeError(
                "SEED_STUDENT_NAME must be between 1 and 150 characters."
            )
        student_id = insert_record(
            connection,
            users,
            {
                "college_id": college_id,
                "department_id": department_id,
                "email": email,
                "password_hash": password_hash,
                "full_name": display_name,
                "role": "STUDENT",
                "status": "active",
            },
        )
        counts["student_created"] += 1
        print("Student login account created.")

    course_id = get_existing_id(
        connection,
        courses,
        {"college_id": college_id, "code": "CS101"},
    )
    class_id = (
        get_existing_id(
            connection,
            classes,
            {
                "college_id": college_id,
                "course_id": course_id,
                "term": "Fall 2026",
                "section": "A",
            },
        )
        if course_id is not None
        else None
    )
    if class_id is None:
        raise RuntimeError(
            f"Cannot provision student; college '{college_slug}' has no seeded CS101 class."
        )
    enrollment_id = get_existing_id(
        connection,
        enrollments,
        {
            "college_id": college_id,
            "class_id": class_id,
            "student_id": student_id,
        },
    )
    if enrollment_id is None:
        insert_record(
            connection,
            enrollments,
            {
                "college_id": college_id,
                "class_id": class_id,
                "student_id": student_id,
                "status": "enrolled",
            },
        )
    return student_id


def insert_record(connection, table, values):
    record = {key: value for key, value in values.items() if key in table.c}
    record["id"] = uuid.uuid4()

    missing_required = [
        column.name
        for column in table.columns
        if column.name not in record
        and not column.nullable
        and column.default is None
        and column.server_default is None
        and not column.autoincrement
        and not column.primary_key
    ]
    if missing_required:
        raise RuntimeError(
            f"Cannot seed '{table.name}'; required columns have no values or "
            "database defaults: " + ", ".join(missing_required)
        )

    connection.execute(table.insert().values(**record))
    return record["id"]


def get_or_create_college(connection, table, values, counts):
    existing_id = get_existing_id(connection, table, {"slug": values["slug"]})
    if existing_id is not None:
        existing_name = connection.execute(
            select(table.c.name).where(table.c.id == existing_id)
        ).scalar_one()
        if existing_name != values["name"]:
            raise RuntimeError(
                f"College slug '{values['slug']}' already belongs to a different name."
            )
        counts["colleges_reused"] += 1
        return existing_id

    counts["colleges_created"] += 1
    return insert_record(
        connection,
        table,
        {
            **values,
            "subscription_tier": "standard",
            "status": "active",
        },
    )


def get_or_create_department(connection, table, college_id, values, counts):
    existing_id = get_existing_id(
        connection,
        table,
        {"college_id": college_id, "code": values["code"]},
    )
    if existing_id is not None:
        existing_name = connection.execute(
            select(table.c.name).where(table.c.id == existing_id)
        ).scalar_one()
        if existing_name != values["name"]:
            raise RuntimeError(
                f"Department code '{values['code']}' already has a different name "
                f"in college {college_id}."
            )
        counts["departments_reused"] += 1
        return existing_id

    counts["departments_created"] += 1
    return insert_record(
        connection,
        table,
        {"college_id": college_id, **values},
    )


def seed_demo_dashboard_data(connection, tables, college, college_id, counts):
    connection.execute(
        text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
        {"tenant_id": str(college_id)},
    )
    class_row = connection.execute(
        select(tables["classes"].c.id, tables["classes"].c.instructor_id)
        .join(
            tables["courses"],
            (tables["courses"].c.id == tables["classes"].c.course_id)
            & (tables["courses"].c.college_id == tables["classes"].c.college_id),
        )
        .where(
            tables["classes"].c.college_id == college_id,
            tables["courses"].c.code == "CS101",
        )
    ).first()
    if class_row is None:
        return
    class_id, faculty_id = class_row
    student_ids = connection.execute(
        select(tables["enrollments"].c.student_id)
        .where(
            tables["enrollments"].c.college_id == college_id,
            tables["enrollments"].c.class_id == class_id,
            tables["enrollments"].c.status == "enrolled",
        )
        .order_by(tables["enrollments"].c.student_id)
    ).scalars().all()

    attendance_statuses = ("present", "present", "late", "present", "absent")
    for student_index, student_id in enumerate(student_ids):
        for session_index, attendance_status in enumerate(attendance_statuses):
            session_date = date.today() - timedelta(days=7 * (session_index + 1))
            get_or_create_record(
                connection,
                tables["attendance_records"],
                {
                    "college_id": college_id,
                    "class_id": class_id,
                    "student_id": student_id,
                    "session_date": session_date,
                },
                {"status": attendance_status},
                counts,
                "demo_attendance",
            )

    assessment_title = "DEMO: CS101 Quiz 1"
    assessment_id = get_or_create_record(
        connection,
        tables["test_assessments"],
        {
            "college_id": college_id,
            "class_id": class_id,
            "title": assessment_title,
        },
        {
            "max_score": 100,
            "due_date": date.today() - timedelta(days=3),
        },
        counts,
        "demo_assessment",
    )
    for student_index, student_id in enumerate(student_ids):
        get_or_create_record(
            connection,
            tables["student_marks"],
            {"college_id": college_id, "test_id": assessment_id, "student_id": student_id},
            {"score": 82 + (student_index % 16)},
            counts,
            "demo_mark",
        )

    get_or_create_record(
        connection,
        tables["course_materials"],
        {
            "college_id": college_id,
            "class_id": class_id,
            "title": "DEMO: CS101 course guide",
        },
        {
            "url": "https://example.edu/uniflow-demo-course-guide",
            "description": "Sample course resource link. Replace with your class materials.",
        },
        counts,
        "demo_material",
    )
    admin_id = get_existing_id(
        connection,
        tables["users"],
        {"college_id": college_id, "email": f"admin@{college['domain']}"},
    )
    if admin_id is not None:
        get_or_create_record(
            connection,
            tables["notices"],
            {
                "college_id": college_id,
                "author_id": admin_id,
                "title": "DEMO: Welcome to UniFlow",
            },
            {
                "content": "This is sample campus data. Edit or remove it from the admin dashboard.",
                "category": "Sample",
            },
            counts,
            "demo_notice",
        )
    calendar_table = tables["academic_calendar_entries"]
    existing_calendar_entry = connection.execute(
        select(calendar_table.c.id).where(
            calendar_table.c.college_id == college_id,
            calendar_table.c.title == "DEMO: Midterm assessment week",
        )
    ).scalar_one_or_none()
    if existing_calendar_entry is None:
        insert_record(
            connection,
            calendar_table,
            {
                "college_id": college_id,
                "title": "DEMO: Midterm assessment week",
                "event_type": "exam",
                "starts_on": date.today() + timedelta(days=14),
                "ends_on": date.today() + timedelta(days=18),
                "description": "Sample academic calendar event.",
            },
        )
        counts["demo_calendar_created"] += 1
    else:
        counts["demo_calendar_reused"] += 1


def get_or_create_user(connection, table, college_id, department_id, email, name, role, counts):
    existing_id = get_existing_id(
        connection,
        table,
        {"college_id": college_id, "email": email},
    )
    if existing_id is not None:
        existing = connection.execute(
            select(table.c.full_name, table.c.role, table.c.department_id).where(
                table.c.id == existing_id
            )
        ).one()
        if (existing.full_name, existing.role, existing.department_id) != (
            name,
            role,
            department_id,
        ):
            raise RuntimeError(
                f"Seed email '{email}' already exists with different user data; "
                "no existing data was changed."
            )
        counts[f"{role.lower()}_reused"] += 1
        return existing_id

    counts[f"{role.lower()}_created"] += 1
    return insert_record(
        connection,
        table,
        {
            "college_id": college_id,
            "department_id": department_id,
            "email": email,
            "password_hash": PASSWORD_HASH,
            "full_name": name,
            "role": role,
            "status": "active",
        },
    )


def seed_database():
    sync_database_url = DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg://", 1
    )
    engine = create_engine(sync_database_url, pool_pre_ping=True)
    try:
        metadata = MetaData()
        metadata.reflect(
            bind=engine,
            only=[
                "colleges",
                "departments",
                "users",
                "courses",
                "classes",
                "enrollments",
                "class_meetings",
                "attendance_records",
                "test_assessments",
                "student_marks",
                "course_materials",
                "notices",
                "academic_calendar_entries",
            ],
        )
        require_schema(metadata)

        colleges = metadata.tables["colleges"]
        departments = metadata.tables["departments"]
        users = metadata.tables["users"]
        courses = metadata.tables["courses"]
        classes = metadata.tables["classes"]
        enrollments = metadata.tables["enrollments"]
        class_meetings = metadata.tables["class_meetings"]
        tables = {
            table_name: metadata.tables[table_name]
            for table_name in (
                "classes",
                "courses",
                "enrollments",
                "attendance_records",
                "test_assessments",
                "student_marks",
                "course_materials",
                "notices",
                "academic_calendar_entries",
                "users",
            )
        }
        custom_student_email = os.getenv("SEED_STUDENT_EMAIL")
        custom_student_password = os.getenv("SEED_STUDENT_PASSWORD")
        if bool(custom_student_email) != bool(custom_student_password):
            raise RuntimeError(
                "Set both SEED_STUDENT_EMAIL and SEED_STUDENT_PASSWORD to provision a student login."
            )
        counts = {
            f"{entity}_{action}": 0
            for entity in (
                "colleges",
                "departments",
                "admin",
                "faculty",
                "student",
                "course",
                "class",
                "enrollment",
                "class_meeting",
                "demo_attendance",
                "demo_assessment",
                "demo_mark",
                "demo_material",
                "demo_notice",
                "demo_calendar",
            )
            for action in ("created", "reused")
        }

        with engine.begin() as connection:
            college_ids = []
            department_ids = []
            for college in COLLEGES:
                college_id = get_or_create_college(connection, colleges, college, counts)
                connection.execute(
                    text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                    {"tenant_id": str(college_id)},
                )
                college_ids.append(college_id)
                department_ids.append(
                    [
                        get_or_create_department(
                            connection,
                            departments,
                            college_id,
                            department,
                            counts,
                        )
                        for department in DEPARTMENTS
                    ]
                )

            for college_index, college in enumerate(COLLEGES):
                college_id = college_ids[college_index]
                connection.execute(
                    text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                    {"tenant_id": str(college_id)},
                )
                college_departments = department_ids[college_index]
                domain = college["domain"]

                get_or_create_user(
                    connection,
                    users,
                    college_id,
                    None,
                    f"admin@{domain}",
                    f"{college['name']} Administrator",
                    "ADMIN",
                    counts,
                )

                faculty_ids = []
                for faculty_index in range(5):
                    name = FACULTY_NAMES[college_index * 5 + faculty_index]
                    department_id = college_departments[faculty_index % 2]
                    faculty_ids.append(
                        get_or_create_user(
                            connection,
                            users,
                            college_id,
                            department_id,
                            f"faculty{faculty_index + 1:02d}@{domain}",
                            name,
                            "FACULTY",
                            counts,
                        )
                    )

                student_ids = []
                for student_index in range(25):
                    name = STUDENT_NAMES[college_index * 25 + student_index]
                    department_id = college_departments[student_index % 2]
                    student_ids.append(
                        get_or_create_user(
                            connection,
                            users,
                            college_id,
                            department_id,
                            f"student{student_index + 1:02d}@{domain}",
                            name,
                            "STUDENT",
                            counts,
                        )
                    )

                course_id = get_or_create_record(
                    connection,
                    courses,
                    {"college_id": college_id, "code": "CS101"},
                    {
                        "department_id": college_departments[0],
                        "title": "Introduction to Computer Science",
                        "credits": 3,
                    },
                    counts,
                    "course",
                )
                class_id = get_or_create_record(
                    connection,
                    classes,
                    {
                        "college_id": college_id,
                        "course_id": course_id,
                        "term": "Fall 2026",
                        "section": "A",
                    },
                    {
                        "instructor_id": faculty_ids[0],
                        "room": "Lecture Hall 1",
                    },
                    counts,
                    "class",
                )
                get_or_create_record(
                    connection,
                    enrollments,
                    {
                        "college_id": college_id,
                        "class_id": class_id,
                        "student_id": student_ids[0],
                    },
                    {"status": "enrolled"},
                    counts,
                    "enrollment",
                )
                get_or_create_record(
                    connection,
                    class_meetings,
                    {
                        "college_id": college_id,
                        "class_id": class_id,
                        "day_of_week": 0,
                        "starts_at": time(9, 0),
                    },
                    {"ends_at": time(10, 30)},
                    counts,
                    "class_meeting",
                )

            if custom_student_email and custom_student_password:
                custom_college_slug = os.getenv(
                    "SEED_STUDENT_COLLEGE_SLUG", "northstar-state"
                )
                provision_student_login(
                    connection,
                    metadata.tables["colleges"],
                    departments,
                    users,
                    courses,
                    classes,
                    enrollments,
                    custom_college_slug,
                    custom_student_email,
                    custom_student_password,
                    counts,
                )
                print(
                    f"Student login is ready for {custom_student_email} "
                    f"at campus '{custom_college_slug}'."
                )

            for college_index, college in enumerate(COLLEGES):
                seed_demo_dashboard_data(
                    connection,
                    tables,
                    college,
                    college_ids[college_index],
                    counts,
                )

        print("Database seeding completed.")
        for entity in (
            "colleges",
            "departments",
            "admin",
            "faculty",
            "student",
            "course",
            "class",
            "enrollment",
            "class_meeting",
            "demo_attendance",
            "demo_assessment",
            "demo_mark",
            "demo_material",
            "demo_notice",
            "demo_calendar",
        ):
            print(
                f"  {entity}: {counts[f'{entity}_created']} created, "
                f"{counts[f'{entity}_reused']} already present"
            )
        if PASSWORD_HASH == "!seeded-account-no-login!" and any(
            counts[f"{entity}_created"] for entity in ("admin", "faculty", "student")
        ):
            print(
                "  Accounts created by the general seed use a non-login placeholder. "
                "Set SEED_PASSWORD_HASH to an application-generated hash if those "
                "accounts need to authenticate."
            )
    finally:
        engine.dispose()


if __name__ == "__main__":
    try:
        seed_database()
    except SQLAlchemyError as exc:
        print(
            "Database connection or seeding failed. Confirm PostgreSQL is running "
            "on localhost:5432 and DATABASE_URL/credentials are correct. "
            f"Details: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc
    except ModuleNotFoundError as exc:
        print(f"ACTUAL MODULE ERROR: {exc}", file=sys.stderr)

        raise SystemExit(1) from exc
    except RuntimeError as exc:
        print(f"Database schema or seed conflict: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc