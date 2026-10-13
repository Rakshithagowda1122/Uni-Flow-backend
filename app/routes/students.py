from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
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
    Course,
    CourseMaterial,
    Enrollment,
    Notice,
    StudentMark,
    TestAssessment,
    User,
)
from app.routes.dashboards import get_dashboard
from app.schemas.attendance import AttendanceRead
from app.services.attendance import get_student_attendance

router = APIRouter(prefix="/students", tags=["Student"])
StudentAccess = Annotated[
    AuthenticatedPrincipal, Depends(require_role(UserRole.STUDENT))
]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]


class StudentNoticeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    badge: str = Field(default="General", min_length=1, max_length=40)

    model_config = ConfigDict(extra="forbid")


class StudentProfileUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)

    model_config = ConfigDict(extra="forbid")


@router.patch("/me/profile")
async def update_student_profile(
    payload: StudentProfileUpdate,
    principal: StudentAccess,
    session: TenantSession,
) -> dict[str, str]:
    user = await session.scalar(
        select(User).where(
            User.id == principal.user_id,
            User.college_id == principal.college_id,
            User.role == UserRole.STUDENT.value,
        )
    )
    if user is None:
        raise HTTPException(status_code=404, detail="Student profile was not found.")
    full_name = payload.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=422, detail="Name cannot be blank.")
    user.full_name = full_name
    await session.flush()
    return {"id": str(user.id), "full_name": user.full_name}


@router.get("/me/attendance", response_model=list[AttendanceRead])
async def get_my_attendance(
    principal: StudentAccess,
    session: TenantSession,
) -> list[AttendanceRecord]:
    return await get_student_attendance(session, principal)


@router.get("/me/timetable")
async def get_my_timetable(
    principal: StudentAccess,
    session: TenantSession,
) -> list[dict[str, object]]:
    statement = (
        select(Class, Course, ClassMeeting, User.full_name)
        .join(Enrollment, Enrollment.class_id == Class.id)
        .join(Course, Course.id == Class.course_id)
        .join(User, User.id == Class.instructor_id)
        .outerjoin(
            ClassMeeting,
            (ClassMeeting.class_id == Class.id)
            & (ClassMeeting.college_id == Class.college_id),
        )
        .where(
            Class.college_id == principal.college_id,
            Enrollment.college_id == principal.college_id,
            Enrollment.student_id == principal.user_id,
            Enrollment.status == "enrolled",
        )
        .order_by(ClassMeeting.day_of_week, ClassMeeting.starts_at, Course.code)
    )
    rows = (await session.execute(statement)).all()
    return [
        {
            "class_id": str(class_record.id),
            "course_code": course.code,
            "course": course.title,
            "credits": course.credits,
            "term": class_record.term,
            "section": class_record.section,
            "room": class_record.room,
            "instructor": instructor_name,
            "day_of_week": meeting.day_of_week if meeting else None,
            "starts_at": meeting.starts_at.isoformat() if meeting else None,
            "ends_at": meeting.ends_at.isoformat() if meeting else None,
        }
        for class_record, course, meeting, instructor_name in rows
    ]


@router.get("/me/materials")
async def get_my_course_materials(
    principal: StudentAccess,
    session: TenantSession,
) -> list[dict[str, object]]:
    rows = (
        await session.execute(
            select(
                CourseMaterial,
                Course.code,
                Course.title,
                Class.section,
            )
            .join(
                Class,
                (Class.id == CourseMaterial.class_id)
                & (Class.college_id == CourseMaterial.college_id),
            )
            .join(
                Enrollment,
                (Enrollment.class_id == Class.id)
                & (Enrollment.college_id == Class.college_id),
            )
            .join(
                Course,
                (Course.id == Class.course_id)
                & (Course.college_id == Class.college_id),
            )
            .where(
                CourseMaterial.college_id == principal.college_id,
                Enrollment.college_id == principal.college_id,
                Enrollment.student_id == principal.user_id,
                Enrollment.status == "enrolled",
            )
            .order_by(Course.code, CourseMaterial.created_at.desc())
        )
    ).all()
    return [
        {
            "id": str(material.id),
            "class_id": str(material.class_id),
            "course_code": course_code,
            "course": course_title,
            "section": section,
            "title": material.title,
            "url": material.url,
            "description": material.description,
            "created_at": material.created_at,
        }
        for material, course_code, course_title, section in rows
    ]


@router.get("/me/marks")
async def get_my_marks(
    principal: StudentAccess,
    session: TenantSession,
) -> dict[str, object]:
    statement = (
        select(StudentMark, TestAssessment, Course)
        .join(TestAssessment, TestAssessment.id == StudentMark.test_id)
        .join(Class, Class.id == TestAssessment.class_id)
        .join(Course, Course.id == Class.course_id)
        .where(
            StudentMark.college_id == principal.college_id,
            StudentMark.student_id == principal.user_id,
        )
        .order_by(TestAssessment.due_date, Course.code, TestAssessment.title)
    )
    rows = (await session.execute(statement)).all()
    dashboard = await get_dashboard(session, principal)
    return {
        "academic_progress": dashboard["academic_progress"],
        "marks": [
            {
                "test_id": str(test.id),
                "title": test.title,
                "course_code": course.code,
                "course": course.title,
                "score": mark.score,
                "max_score": test.max_score,
                "due_date": test.due_date,
            }
            for mark, test, course in rows
        ],
    }


@router.get("/academic-calendar")
async def get_academic_calendar(
    principal: StudentAccess,
    session: TenantSession,
) -> list[dict[str, object]]:
    statement = (
        select(AcademicCalendarEntry)
        .where(
            AcademicCalendarEntry.college_id == principal.college_id,
            AcademicCalendarEntry.ends_on >= date.today(),
        )
        .order_by(AcademicCalendarEntry.starts_on)
    )
    entries = (await session.execute(statement)).scalars().all()
    return [
        {
            "id": str(entry.id),
            "title": entry.title,
            "event_type": entry.event_type,
            "starts_on": entry.starts_on,
            "ends_on": entry.ends_on,
            "description": entry.description,
        }
        for entry in entries
    ]


@router.get("/notices")
async def get_student_notices(
    principal: StudentAccess, session: TenantSession
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


@router.post("/notices", status_code=status.HTTP_201_CREATED)
async def post_student_notice(
    payload: StudentNoticeCreate,
    principal: StudentAccess,
    session: TenantSession,
) -> dict[str, object]:
    user = await session.get(User, principal.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Authenticated student was not found.")
    notice = Notice(
        college_id=principal.college_id,
        author_id=principal.user_id,
        title=payload.title,
        content=payload.title,
        category=payload.badge,
    )
    session.add(notice)
    await session.flush()
    return {
        "id": str(notice.id),
        "title": notice.title,
        "author": user.full_name,
        "badge": notice.category,
        "created_at": notice.created_at,
    }
