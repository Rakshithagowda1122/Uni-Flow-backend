from copy import deepcopy
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_tenant_session
from app.dependencies.auth import (
    AuthenticatedPrincipal,
    UserRole,
    require_role,
)
from app.models import (
    Class,
    College,
    Department,
    Enrollment,
    Notice,
    PortalDashboard,
    User,
)

router = APIRouter(tags=["Portals"])
AdminAccess = Annotated[
    AuthenticatedPrincipal, Depends(require_role(UserRole.ADMIN))
]
FacultyAccess = Annotated[
    AuthenticatedPrincipal, Depends(require_role(UserRole.FACULTY))
]
StudentAccess = Annotated[
    AuthenticatedPrincipal, Depends(require_role(UserRole.STUDENT))
]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]

DEFAULTS: dict[str, dict[str, Any]] = {
    "ADMIN": {
        "institution": {
            "name": "UniFlow Central Institute of Technology",
            "term": "Fall Semester 2026",
            "system_status": "Operational",
        },
        "stats": {
            "total_students": 0,
            "total_faculty": 0,
            "overall_campus_occupancy": "0%",
            "pending_administrative_approvals": 0,
        },
        "departments": [],
    },
    "FACULTY": {
        "instructor": {
            "name": "Faculty Member",
            "designation": "Faculty",
            "department": "Academic Department",
            "office": "Not assigned",
        },
        "stats": {
            "lectures_remaining": "0 remaining",
            "avg_attendance": "0%",
            "student_inquiries": "0 Pending",
        },
        "lectures_today": [],
        "advisory_notices": [],
    },
    "STUDENT": {
        "student_profile": {
            "name": "Student",
            "program": "Program not assigned",
            "semester": "Semester not assigned",
            "enrollment_status": "Active Enrolled",
            "advisory_batch": "Not assigned",
        },
        "academic_progress": {
            "cgpa": 0,
            "cgpa_scale": 10,
            "sgpa_current": 0,
            "standing": "Not available",
        },
        "courses": [],
        "notice_board": [],
    },
}


async def get_dashboard(
    session: AsyncSession, principal: AuthenticatedPrincipal
) -> dict[str, Any]:
    result = await session.execute(
        select(PortalDashboard).where(
            PortalDashboard.college_id == principal.college_id,
            PortalDashboard.user_id == principal.user_id,
            PortalDashboard.role == principal.role.value,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        data = deepcopy(DEFAULTS[principal.role.value])
        user = await session.get(User, principal.user_id)
        if user is not None:
            department = (
                await session.get(Department, user.department_id)
                if user.department_id is not None
                else None
            )
            if principal.role == UserRole.STUDENT:
                data["student_profile"]["name"] = user.full_name
                if department is not None:
                    data["student_profile"]["program"] = department.name
            elif principal.role == UserRole.FACULTY:
                data["instructor"]["name"] = user.full_name
                if department is not None:
                    data["instructor"]["department"] = department.name
        if principal.role == UserRole.ADMIN:
            college = await session.get(College, principal.college_id)
            if college is not None:
                data["institution"]["name"] = college.name
            data["stats"]["total_students"] = await session.scalar(
                select(func.count(User.id)).where(
                    User.college_id == principal.college_id,
                    User.role == UserRole.STUDENT.value,
                    User.status == "active",
                )
            )
            data["stats"]["total_faculty"] = await session.scalar(
                select(func.count(User.id)).where(
                    User.college_id == principal.college_id,
                    User.role == UserRole.FACULTY.value,
                    User.status == "active",
                )
            )
        record = PortalDashboard(
            college_id=principal.college_id,
            user_id=principal.user_id,
            role=principal.role.value,
            data=data,
        )
        session.add(record)
        await session.flush()
    data = dict(record.data)
    if principal.role == UserRole.ADMIN:
        college = await session.get(College, principal.college_id)
        if college is not None:
            data.setdefault("institution", {})["name"] = college.name
        data.setdefault("stats", {})["total_students"] = await session.scalar(
            select(func.count(User.id)).where(
                User.college_id == principal.college_id,
                User.role == UserRole.STUDENT.value,
                User.status == "active",
            )
        )
        data["stats"]["total_faculty"] = await session.scalar(
            select(func.count(User.id)).where(
                User.college_id == principal.college_id,
                User.role == UserRole.FACULTY.value,
                User.status == "active",
            )
        )
        terms = (
            await session.execute(
                select(Class.term)
                .where(Class.college_id == principal.college_id)
                .distinct()
                .order_by(Class.term)
            )
        ).scalars().all()
        data.setdefault("institution", {})["term"] = (
            ", ".join(terms) if terms else "Academic term not set"
        )
        department_counts = await session.execute(
            select(
                Department.id,
                Department.code,
                Department.name,
                func.count(case((User.role == "STUDENT", 1))),
                func.count(case((User.role == "FACULTY", 1))),
            )
            .outerjoin(
                User,
                (User.department_id == Department.id)
                & (User.college_id == Department.college_id),
            )
            .where(Department.college_id == principal.college_id)
            .group_by(Department.id)
            .order_by(Department.code)
        )
        data["departments"] = [
            {
                "id": str(department_id),
                "code": code,
                "name": name,
                "students": students,
                "faculty": faculty,
            }
            for department_id, code, name, students, faculty in department_counts
        ]
    elif principal.role in (UserRole.FACULTY, UserRole.STUDENT):
        user = await session.get(User, principal.user_id)
        department = (
            await session.get(Department, user.department_id)
            if user is not None and user.department_id is not None
            else None
        )
        if principal.role == UserRole.STUDENT and user is not None:
            student_profile = dict(data.get("student_profile", {}))
            student_profile["name"] = user.full_name
            student_profile["email"] = user.email
            student_profile["program"] = (
                department.name if department is not None else "Department not assigned"
            )
            active_enrollments = (
                select(Enrollment.class_id)
                .where(
                    Enrollment.college_id == principal.college_id,
                    Enrollment.student_id == principal.user_id,
                    Enrollment.status == "enrolled",
                )
                .subquery()
            )
            student_terms = (
                await session.execute(
                    select(Class.term)
                    .join(active_enrollments, active_enrollments.c.class_id == Class.id)
                    .where(Class.college_id == principal.college_id)
                    .distinct()
                    .order_by(Class.term)
                )
            ).scalars().all()
            student_sections = (
                await session.execute(
                    select(Class.section)
                    .join(active_enrollments, active_enrollments.c.class_id == Class.id)
                    .where(Class.college_id == principal.college_id)
                    .distinct()
                    .order_by(Class.section)
                )
            ).scalars().all()
            student_profile["semester"] = (
                ", ".join(student_terms) if student_terms else "No active term"
            )
            student_profile["enrollment_status"] = (
                "Enrolled" if student_terms else "No active enrollments"
            )
            student_profile["advisory_batch"] = (
                ", ".join(section for section in student_sections if section)
                or "Section not assigned"
            )
            data["student_profile"] = student_profile
        elif principal.role == UserRole.FACULTY and user is not None:
            instructor = dict(data.get("instructor", {}))
            instructor["name"] = user.full_name
            instructor["email"] = user.email
            if department is not None:
                instructor["department"] = department.name
            data["instructor"] = instructor
        notices = (
            await session.execute(
                select(Notice, User.full_name)
                .join(User, User.id == Notice.author_id)
                .where(Notice.college_id == principal.college_id)
                .order_by(Notice.created_at.desc())
            )
        ).all()
        if principal.role == UserRole.STUDENT:
            data["notice_board"] = [
                {
                    "id": str(notice.id),
                    "title": notice.title,
                    "author": author,
                    "badge": notice.category,
                    "date": notice.created_at.strftime("%b %d, %Y"),
                }
                for notice, author in notices
            ]
        else:
            data["advisory_notices"] = [
                {
                    "id": str(notice.id),
                    "title": notice.title,
                    "due": notice.created_at.strftime("%b %d, %Y"),
                }
                for notice, _author in notices
            ]
    return data


async def update_dashboard(
    session: AsyncSession,
    principal: AuthenticatedPrincipal,
    patch: dict[str, Any],
) -> dict[str, Any]:
    if not patch or any(not isinstance(key, str) for key in patch):
        raise HTTPException(status_code=422, detail="A non-empty JSON object is required.")
    data = dict(await get_dashboard(session, principal))
    changes = dict(patch)
    if principal.role == UserRole.ADMIN and "departments" in changes:
        departments = changes.pop("departments")
        if not isinstance(departments, list) or len(departments) > 200:
            raise HTTPException(status_code=422, detail="Departments must be a list of at most 200 items.")
        codes: set[str] = set()
        for item in departments:
            if not isinstance(item, dict):
                raise HTTPException(status_code=422, detail="Each department must be an object.")
            code = item.get("code")
            name = item.get("name")
            if (
                not isinstance(code, str)
                or not code.strip()
                or len(code) > 20
                or not isinstance(name, str)
                or not name.strip()
                or len(name) > 150
            ):
                raise HTTPException(status_code=422, detail="Each department needs a valid code and name.")
            normalized_code = code.strip().upper()
            if normalized_code in codes:
                raise HTTPException(status_code=422, detail="Department codes must be unique.")
            codes.add(normalized_code)
            raw_id = item.get("id")
            if raw_id is not None:
                try:
                    department_id = UUID(str(raw_id))
                except ValueError as error:
                    raise HTTPException(
                        status_code=422, detail="Department id must be a UUID."
                    ) from error
                department = await session.scalar(
                    select(Department).where(
                        Department.id == department_id,
                        Department.college_id == principal.college_id,
                    )
                )
                if department is None:
                    raise HTTPException(status_code=404, detail="Department was not found.")
            else:
                department = await session.scalar(
                    select(Department).where(
                        Department.college_id == principal.college_id,
                        Department.code == normalized_code,
                    )
                )
            conflicting_department = await session.scalar(
                select(Department.id).where(
                    Department.college_id == principal.college_id,
                    Department.code == normalized_code,
                    Department.id != department.id if department is not None else True,
                )
            )
            if conflicting_department is not None:
                raise HTTPException(
                    status_code=409,
                    detail=f"Department code '{normalized_code}' is already in use.",
                )
            if department is None:
                session.add(
                    Department(
                        college_id=principal.college_id,
                        code=normalized_code,
                        name=name.strip(),
                    )
                )
            else:
                department.name = name.strip()
        await session.flush()
    data.update(changes)
    if principal.role == UserRole.ADMIN and "departments" in patch:
        data = dict(await get_dashboard(session, principal))
    result = await session.execute(
        select(PortalDashboard).where(
            PortalDashboard.college_id == principal.college_id,
            PortalDashboard.user_id == principal.user_id,
            PortalDashboard.role == principal.role.value,
        )
    )
    record = result.scalar_one()
    record.data = data
    record.updated_at = func.clock_timestamp()
    await session.flush()
    return data


@router.get("/admin/dashboard")
async def read_admin_dashboard(
    principal: AdminAccess, session: TenantSession
) -> dict[str, Any]:
    return await get_dashboard(session, principal)


@router.put("/admin/dashboard")
async def write_admin_dashboard(
    payload: Annotated[dict[str, Any], Body()],
    principal: AdminAccess,
    session: TenantSession,
) -> dict[str, Any]:
    return await update_dashboard(session, principal, payload)


@router.get("/faculty/dashboard")
async def read_faculty_dashboard(
    principal: FacultyAccess, session: TenantSession
) -> dict[str, Any]:
    data = await get_dashboard(session, principal)
    user = await session.get(User, principal.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Faculty profile was not found.")
    instructor = dict(data.get("instructor", {}))
    instructor["name"] = user.full_name
    instructor["email"] = user.email
    instructor["designation"] = "Faculty"
    instructor["department"] = "Department not assigned"
    if user.department_id is not None:
        department = await session.get(Department, user.department_id)
        if department is not None:
            instructor["department"] = department.name
    data["instructor"] = instructor
    return data


@router.put("/faculty/dashboard")
async def write_faculty_dashboard(
    payload: Annotated[dict[str, Any], Body()],
    principal: FacultyAccess,
    session: TenantSession,
) -> dict[str, Any]:
    return await update_dashboard(session, principal, payload)


@router.get("/student/dashboard")
async def read_student_dashboard(
    principal: StudentAccess, session: TenantSession
) -> dict[str, Any]:
    return await get_dashboard(session, principal)


@router.put("/student/dashboard")
async def write_student_dashboard(
    payload: Annotated[dict[str, Any], Body()],
    principal: StudentAccess,
    session: TenantSession,
) -> dict[str, Any]:
    return await update_dashboard(session, principal, payload)
