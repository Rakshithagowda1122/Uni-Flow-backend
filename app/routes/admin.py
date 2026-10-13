from datetime import date, time
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_tenant_session
from app.dependencies.auth import (
    AuthenticatedPrincipal,
    UserRole,
    require_role,
)
from app.models import (
    AcademicCalendarEntry,
    AttendanceRecord,
    Class,
    ClassMeeting,
    College,
    Course,
    Department,
    FacultyAttendance,
    Notice,
    User,
)

router = APIRouter(prefix="/admin", tags=["Admin"])
AdminAccess = Annotated[
    AuthenticatedPrincipal, Depends(require_role(UserRole.ADMIN))
]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]


class NoticeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=10_000)
    category: str = Field(default="General", min_length=1, max_length=40)

    model_config = ConfigDict(extra="forbid")


class CalendarEntryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    event_type: Literal["holiday", "exam"]
    starts_on: date
    ends_on: date
    description: str | None = Field(default=None, max_length=10_000)

    model_config = ConfigDict(extra="forbid")


class ClassMeetingInput(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    starts_at: time
    ends_at: time

    model_config = ConfigDict(extra="forbid")


class ClassMeetingsReplace(BaseModel):
    meetings: list[ClassMeetingInput] = Field(max_length=14)

    model_config = ConfigDict(extra="forbid")


class CampusUserUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    status: Literal["active", "inactive", "suspended"]
    department_id: UUID | None

    model_config = ConfigDict(extra="forbid")


class NoticeUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=10_000)
    category: str = Field(min_length=1, max_length=40)

    model_config = ConfigDict(extra="forbid")


class AttendanceStatusUpdate(BaseModel):
    status: Literal["present", "absent", "late", "excused"]

    model_config = ConfigDict(extra="forbid")


class ClassDetailsUpdate(BaseModel):
    term: str = Field(min_length=1, max_length=32)
    section: str = Field(min_length=1, max_length=16)
    room: str | None = Field(default=None, max_length=64)
    instructor_id: UUID
    meetings: list[ClassMeetingInput] = Field(max_length=14)

    model_config = ConfigDict(extra="forbid")


class CampusUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)

    model_config = ConfigDict(extra="forbid")


@router.get("/notices")
async def get_global_notices(
    principal: AdminAccess, session: TenantSession
) -> list[dict[str, object]]:
    statement = (
        select(Notice, User.full_name)
        .join(User, User.id == Notice.author_id)
        .where(Notice.college_id == principal.college_id)
        .order_by(Notice.created_at.desc())
    )
    rows = (await session.execute(statement)).all()
    return [
        {
            "id": str(notice.id),
            "title": notice.title,
            "content": notice.content,
            "category": notice.category,
            "author": author,
            "created_at": notice.created_at,
        }
        for notice, author in rows
    ]


@router.get("/attendance")
async def get_college_attendance(
    principal: AdminAccess,
    session: TenantSession,
    scope: Literal["college"] = Query(...),
    aggregate: Literal["average"] = Query(...),
) -> dict[str, object]:
    del scope, aggregate
    total, attended, excluded = (
        await session.execute(
            select(
                func.count(AttendanceRecord.id),
                func.count(
                    case(
                        (AttendanceRecord.status.in_(("present", "late")), 1),
                    )
                ),
                func.count(
                    case((AttendanceRecord.status == "excused", 1))
                ),
            ).where(AttendanceRecord.college_id == principal.college_id)
        )
    ).one()
    denominator = total - excluded
    status_counts = (
        await session.execute(
            select(
                func.count(case((AttendanceRecord.status == "present", 1))),
                func.count(case((AttendanceRecord.status == "absent", 1))),
                func.count(case((AttendanceRecord.status == "late", 1))),
                func.count(case((AttendanceRecord.status == "excused", 1))),
            ).where(AttendanceRecord.college_id == principal.college_id)
        )
    ).one()
    return {
        "scope": "college",
        "aggregate": "average",
        "attendance_percentage": round(attended * 100 / denominator, 2)
        if denominator
        else 0.0,
        "record_count": total,
        "excluded_excused_records": excluded,
        "status_counts": {
            "present": status_counts[0],
            "absent": status_counts[1],
            "late": status_counts[2],
            "excused": status_counts[3],
        },
    }


@router.get("/attendance/audit")
async def get_attendance_audit(
    principal: AdminAccess,
    session: TenantSession,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[dict[str, object]]:
    rows = (
        await session.execute(
            select(
                AttendanceRecord,
                User.full_name,
                User.email,
                Course.code,
                Course.title,
                Class.section,
                Class.room,
            )
            .join(
                User,
                (User.id == AttendanceRecord.student_id)
                & (User.college_id == AttendanceRecord.college_id),
            )
            .join(
                Class,
                (Class.id == AttendanceRecord.class_id)
                & (Class.college_id == AttendanceRecord.college_id),
            )
            .join(
                Course,
                (Course.id == Class.course_id)
                & (Course.college_id == Class.college_id),
            )
            .where(AttendanceRecord.college_id == principal.college_id)
            .order_by(
                AttendanceRecord.session_date.desc(),
                AttendanceRecord.recorded_at.desc(),
            )
            .limit(limit)
        )
    ).all()
    return [
        {
            "id": str(record.id),
            "student_id": str(record.student_id),
            "student_name": student_name,
            "student_email": student_email,
            "course_code": course_code,
            "course": course_title,
            "section": section,
            "room": room,
            "session_date": record.session_date,
            "status": record.status,
            "recorded_at": record.recorded_at,
        }
        for (
            record,
            student_name,
            student_email,
            course_code,
            course_title,
            section,
            room,
        ) in rows
    ]


@router.put("/attendance/{attendance_id}")
async def update_campus_attendance(
    attendance_id: UUID,
    payload: AttendanceStatusUpdate,
    principal: AdminAccess,
    session: TenantSession,
) -> dict[str, object]:
    record = await session.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.id == attendance_id,
            AttendanceRecord.college_id == principal.college_id,
        )
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Attendance record was not found.")
    record.status = payload.status
    record.recorded_at = func.clock_timestamp()
    await session.flush()
    await session.refresh(record)
    return {
        "id": str(record.id),
        "student_id": str(record.student_id),
        "class_id": str(record.class_id),
        "session_date": record.session_date,
        "status": record.status,
        "recorded_at": record.recorded_at,
    }


@router.get("/users")
async def get_campus_users(
    principal: AdminAccess,
    session: TenantSession,
    search: str = Query(default="", max_length=100),
) -> list[dict[str, object]]:
    statement = (
        select(User, Department.name)
        .outerjoin(
            Department,
            (Department.id == User.department_id)
            & (Department.college_id == User.college_id),
        )
        .where(User.college_id == principal.college_id)
        .order_by(User.role, User.full_name)
        .limit(500)
    )
    normalized_search = search.strip()
    if normalized_search:
        pattern = f"%{normalized_search}%"
        statement = statement.where(
            User.full_name.ilike(pattern) | User.email.ilike(pattern)
        )
    rows = (await session.execute(statement)).all()
    return [
        {
            "id": str(user.id),
            "name": user.full_name,
            "email": user.email,
            "role": user.role,
            "status": user.status,
            "department": department_name,
            "department_id": str(user.department_id) if user.department_id else None,
        }
        for user, department_name in rows
    ]


@router.put("/campus")
async def update_campus(
    payload: CampusUpdate,
    principal: AdminAccess,
    session: TenantSession,
) -> dict[str, str]:
    college = await session.get(College, principal.college_id)
    if college is None:
        raise HTTPException(status_code=404, detail="Campus was not found.")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Campus name cannot be blank.")
    college.name = name
    await session.flush()
    return {"id": str(college.id), "name": college.name}


@router.put("/users/{user_id}")
async def update_campus_user(
    user_id: UUID,
    payload: CampusUserUpdate,
    principal: AdminAccess,
    session: TenantSession,
) -> dict[str, object]:
    user = await session.scalar(
        select(User).where(
            User.id == user_id,
            User.college_id == principal.college_id,
        )
    )
    if user is None:
        raise HTTPException(status_code=404, detail="Campus user was not found.")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be blank.")
    if user.id == principal.user_id and payload.status != "active":
        raise HTTPException(status_code=422, detail="You cannot deactivate your own admin account.")
    if payload.department_id is not None:
        department = await session.scalar(
            select(Department.id).where(
                Department.id == payload.department_id,
                Department.college_id == principal.college_id,
            )
        )
        if department is None:
            raise HTTPException(status_code=422, detail="Department must belong to this campus.")
    user.full_name = name
    user.status = payload.status
    user.department_id = payload.department_id
    await session.flush()
    department_name = await session.scalar(
        select(Department.name).where(
            Department.id == user.department_id,
            Department.college_id == principal.college_id,
        )
    ) if user.department_id else None
    return {
        "id": str(user.id),
        "name": user.full_name,
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "department": department_name,
        "department_id": str(user.department_id) if user.department_id else None,
    }


@router.get("/timetable")
async def get_campus_timetable(
    principal: AdminAccess, session: TenantSession
) -> list[dict[str, object]]:
    rows = (
        await session.execute(
            select(Class, Course, ClassMeeting, User.full_name)
            .join(
                Course,
                (Course.id == Class.course_id)
                & (Course.college_id == Class.college_id),
            )
            .join(
                User,
                (User.id == Class.instructor_id)
                & (User.college_id == Class.college_id),
            )
            .outerjoin(
                ClassMeeting,
                (ClassMeeting.class_id == Class.id)
                & (ClassMeeting.college_id == Class.college_id),
            )
            .where(Class.college_id == principal.college_id)
            .order_by(
                ClassMeeting.day_of_week,
                ClassMeeting.starts_at,
                Course.code,
            )
            .limit(1000)
        )
    ).all()
    return [
        {
            "class_id": str(class_record.id),
            "course_code": course.code,
            "course": course.title,
            "instructor_id": str(class_record.instructor_id),
            "instructor": instructor_name,
            "term": class_record.term,
            "section": class_record.section,
            "room": class_record.room,
            "day_of_week": meeting.day_of_week if meeting else None,
            "starts_at": meeting.starts_at.isoformat() if meeting else None,
            "ends_at": meeting.ends_at.isoformat() if meeting else None,
        }
        for class_record, course, meeting, instructor_name in rows
    ]


@router.post("/notices", status_code=status.HTTP_201_CREATED)
async def post_global_notice(
    payload: NoticeCreate,
    principal: AdminAccess,
    session: TenantSession,
) -> dict[str, object]:
    notice = Notice(
        college_id=principal.college_id,
        author_id=principal.user_id,
        title=payload.title,
        content=payload.content,
        category=payload.category,
    )
    session.add(notice)
    await session.flush()
    return {
        "id": str(notice.id),
        "title": notice.title,
        "content": notice.content,
        "category": notice.category,
        "created_at": notice.created_at,
    }


@router.put("/notices/{notice_id}")
async def update_global_notice(
    notice_id: UUID,
    payload: NoticeUpdate,
    principal: AdminAccess,
    session: TenantSession,
) -> dict[str, object]:
    notice = await session.scalar(
        select(Notice).where(
            Notice.id == notice_id,
            Notice.college_id == principal.college_id,
        )
    )
    if notice is None:
        raise HTTPException(status_code=404, detail="Announcement was not found.")
    title, content, category = payload.title.strip(), payload.content.strip(), payload.category.strip()
    if not title or not content or not category:
        raise HTTPException(status_code=422, detail="Announcement fields cannot be blank.")
    notice.title, notice.content, notice.category = title, content, category
    await session.flush()
    return {
        "id": str(notice.id),
        "title": notice.title,
        "content": notice.content,
        "category": notice.category,
        "created_at": notice.created_at,
    }


@router.delete("/notices/{notice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_global_notice(
    notice_id: UUID,
    principal: AdminAccess,
    session: TenantSession,
) -> None:
    notice = await session.scalar(
        select(Notice).where(
            Notice.id == notice_id,
            Notice.college_id == principal.college_id,
        )
    )
    if notice is None:
        raise HTTPException(status_code=404, detail="Announcement was not found.")
    await session.delete(notice)


@router.get("/faculty-attendance")
async def get_faculty_attendance(
    principal: AdminAccess,
    session: TenantSession,
    session_date: date | None = Query(default=None),
) -> list[dict[str, object]]:
    statement = (
        select(FacultyAttendance, User.full_name, User.email)
        .join(
            User,
            (User.id == FacultyAttendance.faculty_id)
            & (User.college_id == FacultyAttendance.college_id),
        )
        .where(FacultyAttendance.college_id == principal.college_id)
        .order_by(FacultyAttendance.session_date.desc(), User.full_name)
    )
    if session_date is not None:
        statement = statement.where(FacultyAttendance.session_date == session_date)
    rows = (await session.execute(statement)).all()
    return [
        {
            "id": str(record.id),
            "faculty_id": str(record.faculty_id),
            "name": name,
            "email": email,
            "session_date": record.session_date,
            "status": record.status,
            "recorded_at": record.recorded_at,
        }
        for record, name, email in rows
    ]


@router.post("/academic-calendar", status_code=status.HTTP_201_CREATED)
async def create_calendar_entry(
    payload: CalendarEntryCreate,
    principal: AdminAccess,
    session: TenantSession,
) -> dict[str, object]:
    if payload.ends_on < payload.starts_on:
        raise HTTPException(status_code=422, detail="Event end date must not precede its start date.")
    entry = AcademicCalendarEntry(
        college_id=principal.college_id,
        title=payload.title,
        event_type=payload.event_type,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        description=payload.description,
    )
    session.add(entry)
    await session.flush()
    return {
        "id": str(entry.id),
        "title": entry.title,
        "event_type": entry.event_type,
        "starts_on": entry.starts_on,
        "ends_on": entry.ends_on,
        "description": entry.description,
    }


@router.put("/classes/{class_id}/meetings")
async def replace_class_meetings(
    class_id: UUID,
    payload: ClassMeetingsReplace,
    principal: AdminAccess,
    session: TenantSession,
) -> list[dict[str, object]]:
    class_record = await session.scalar(
        select(Class).where(
            Class.id == class_id,
            Class.college_id == principal.college_id,
        )
    )
    if class_record is None:
        raise HTTPException(status_code=404, detail="Class was not found.")
    if any(meeting.ends_at <= meeting.starts_at for meeting in payload.meetings):
        raise HTTPException(status_code=422, detail="Meeting end time must be after start time.")
    await session.execute(
        delete(ClassMeeting).where(
            ClassMeeting.college_id == principal.college_id,
            ClassMeeting.class_id == class_id,
        )
    )
    meetings = [
        ClassMeeting(
            college_id=principal.college_id,
            class_id=class_id,
            day_of_week=meeting.day_of_week,
            starts_at=meeting.starts_at,
            ends_at=meeting.ends_at,
        )
        for meeting in payload.meetings
    ]
    session.add_all(meetings)
    await session.flush()
    return [
        {
            "id": str(meeting.id),
            "class_id": str(meeting.class_id),
            "day_of_week": meeting.day_of_week,
            "starts_at": meeting.starts_at,
            "ends_at": meeting.ends_at,
        }
        for meeting in meetings
    ]


@router.put("/classes/{class_id}")
async def update_campus_class(
    class_id: UUID,
    payload: ClassDetailsUpdate,
    principal: AdminAccess,
    session: TenantSession,
) -> dict[str, object]:
    class_record = await session.scalar(
        select(Class).where(
            Class.id == class_id,
            Class.college_id == principal.college_id,
        )
    )
    if class_record is None:
        raise HTTPException(status_code=404, detail="Class was not found.")
    if any(meeting.ends_at <= meeting.starts_at for meeting in payload.meetings):
        raise HTTPException(status_code=422, detail="Meeting end time must be after start time.")
    term, section = payload.term.strip(), payload.section.strip()
    if not term or not section:
        raise HTTPException(status_code=422, detail="Term and section cannot be blank.")
    instructor = await session.scalar(
        select(User).where(
            User.id == payload.instructor_id,
            User.college_id == principal.college_id,
            User.role == UserRole.FACULTY.value,
            User.status == "active",
        )
    )
    if instructor is None:
        raise HTTPException(status_code=422, detail="Instructor must be an active faculty member at this campus.")
    class_record.term = term
    class_record.section = section
    class_record.room = payload.room.strip() if payload.room and payload.room.strip() else None
    class_record.instructor_id = instructor.id
    await session.execute(
        delete(ClassMeeting).where(
            ClassMeeting.college_id == principal.college_id,
            ClassMeeting.class_id == class_id,
        )
    )
    meetings = [
        ClassMeeting(
            college_id=principal.college_id,
            class_id=class_id,
            day_of_week=meeting.day_of_week,
            starts_at=meeting.starts_at,
            ends_at=meeting.ends_at,
        )
        for meeting in payload.meetings
    ]
    session.add_all(meetings)
    await session.flush()
    return {
        "class_id": str(class_record.id),
        "term": class_record.term,
        "section": class_record.section,
        "room": class_record.room,
        "instructor_id": str(class_record.instructor_id),
        "instructor": instructor.full_name,
    }
