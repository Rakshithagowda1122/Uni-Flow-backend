from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import (
    AuthenticatedPrincipal,
    UserRole,
    require_role,
)
from app.models import (
    AttendanceRecord,
    Class,
    ClassMeeting,
    Course,
    CourseMaterial,
    Enrollment,
    FacultyAttendance,
    Notice,
    StudentMark,
    TestAssessment,
    User,
)
from app.schemas.attendance import (
    AttendanceCreate,
    AttendanceRead,
    AttendanceStatus,
    AttendanceUpdate,
)
from app.services.attendance import (
    create_attendance,
    ensure_assigned_class,
    update_attendance,
)
from app.database.session import get_tenant_session

router = APIRouter(prefix="/faculty", tags=["Faculty"])
FacultyAccess = Annotated[
    AuthenticatedPrincipal, Depends(require_role(UserRole.FACULTY))
]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]


class MarkInput(BaseModel):
    student_id: UUID
    score: Decimal = Field(ge=0)

    model_config = ConfigDict(extra="forbid")


class MarkUpload(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    max_score: Decimal = Field(gt=0)
    due_date: date | None = None
    marks: list[MarkInput] = Field(default_factory=list, max_length=500)

    model_config = ConfigDict(extra="forbid")


class MarkBatch(BaseModel):
    marks: list[MarkInput] = Field(min_length=1, max_length=500)

    model_config = ConfigDict(extra="forbid")


class MarkUpdate(BaseModel):
    score: Decimal = Field(ge=0)

    model_config = ConfigDict(extra="forbid")


class FacultyAttendanceCreate(BaseModel):
    status: Literal["present", "absent", "late", "excused"]
    session_date: date | None = None

    model_config = ConfigDict(extra="forbid")


class StudentAttendanceInput(BaseModel):
    student_id: UUID
    status: AttendanceStatus

    model_config = ConfigDict(extra="forbid")


class AttendanceBatch(BaseModel):
    session_date: date
    records: list[StudentAttendanceInput] = Field(min_length=1, max_length=500)

    model_config = ConfigDict(extra="forbid")


class CourseMaterialCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    url: HttpUrl
    description: str | None = Field(default=None, max_length=2000)

    model_config = ConfigDict(extra="forbid")


class CourseMaterialUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    url: HttpUrl
    description: str | None = Field(default=None, max_length=2000)

    model_config = ConfigDict(extra="forbid")


class TestAssessmentUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    max_score: Decimal = Field(gt=0)
    due_date: date | None = None

    model_config = ConfigDict(extra="forbid")


class FacultyProfileUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)

    model_config = ConfigDict(extra="forbid")


def is_unique_violation(error: IntegrityError) -> bool:
    original = error.orig
    sqlstate = getattr(original, "sqlstate", None) or getattr(
        original, "pgcode", None
    )
    if sqlstate is None:
        sqlstate = getattr(getattr(original, "__cause__", None), "sqlstate", None)
    return sqlstate == "23505"


@router.patch("/me/profile")
async def update_faculty_profile(
    payload: FacultyProfileUpdate,
    principal: FacultyAccess,
    session: TenantSession,
) -> dict[str, str]:
    user = await session.scalar(
        select(User).where(
            User.id == principal.user_id,
            User.college_id == principal.college_id,
            User.role == UserRole.FACULTY.value,
        )
    )
    if user is None:
        raise HTTPException(status_code=404, detail="Faculty profile was not found.")
    full_name = payload.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=422, detail="Name cannot be blank.")
    user.full_name = full_name
    await session.flush()
    return {"id": str(user.id), "full_name": user.full_name}


@router.post("/me/attendance", status_code=status.HTTP_201_CREATED)
async def record_faculty_attendance(
    payload: FacultyAttendanceCreate,
    principal: FacultyAccess,
    session: TenantSession,
) -> dict[str, object]:
    record = FacultyAttendance(
        college_id=principal.college_id,
        faculty_id=principal.user_id,
        status=payload.status,
        **({"session_date": payload.session_date} if payload.session_date else {}),
    )
    session.add(record)
    try:
        await session.flush()
    except IntegrityError as error:
        if is_unique_violation(error):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Faculty attendance has already been recorded for this date.",
            ) from error
        raise
    return {
        "id": str(record.id),
        "faculty_id": str(record.faculty_id),
        "session_date": record.session_date,
        "status": record.status,
        "recorded_at": record.recorded_at,
    }


@router.post(
    "/classes/{class_id}/attendance",
    response_model=AttendanceRead,
    status_code=status.HTTP_201_CREATED,
)
async def take_class_attendance(
    class_id: UUID,
    payload: AttendanceCreate,
    principal: FacultyAccess,
    session: TenantSession,
) -> AttendanceRecord:
    try:
        return await create_attendance(session, principal, class_id, payload)
    except IntegrityError as error:
        if is_unique_violation(error):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An attendance record already exists for this student, class, and date.",
            ) from error
        raise


@router.get("/classes/{class_id}/students")
async def get_class_students(
    class_id: UUID,
    principal: FacultyAccess,
    session: TenantSession,
    session_date: date = Query(default_factory=date.today),
) -> list[dict[str, object]]:
    await ensure_assigned_class(session, principal, class_id)
    students = (
        await session.execute(
            select(User.id, User.full_name, AttendanceRecord.status)
            .join(
                Enrollment,
                (Enrollment.student_id == User.id)
                & (Enrollment.college_id == User.college_id),
            )
            .outerjoin(
                AttendanceRecord,
                (AttendanceRecord.student_id == User.id)
                & (AttendanceRecord.class_id == Enrollment.class_id)
                & (AttendanceRecord.college_id == Enrollment.college_id)
                & (AttendanceRecord.session_date == session_date),
            )
            .where(
                Enrollment.college_id == principal.college_id,
                Enrollment.class_id == class_id,
                Enrollment.status == "enrolled",
                User.role == UserRole.STUDENT.value,
                User.status == "active",
            )
            .order_by(User.full_name)
        )
    ).all()
    return [
        {
            "student_id": str(student_id),
            "name": full_name,
            "status": attendance_status,
        }
        for student_id, full_name, attendance_status in students
    ]


@router.post("/classes/{class_id}/attendance/batch")
async def record_class_attendance(
    class_id: UUID,
    payload: AttendanceBatch,
    principal: FacultyAccess,
    session: TenantSession,
) -> list[dict[str, object]]:
    await ensure_assigned_class(session, principal, class_id)
    student_ids = [record.student_id for record in payload.records]
    if len(student_ids) != len(set(student_ids)):
        raise HTTPException(status_code=422, detail="A student may appear only once.")
    enrolled = set(
        (
            await session.scalars(
                select(Enrollment.student_id).where(
                    Enrollment.college_id == principal.college_id,
                    Enrollment.class_id == class_id,
                    Enrollment.student_id.in_(student_ids),
                    Enrollment.status == "enrolled",
                )
            )
        ).all()
    )
    if enrolled != set(student_ids):
        raise HTTPException(
            status_code=422,
            detail="Every attendance record must belong to an actively enrolled student.",
        )
    existing_records = (
        await session.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.college_id == principal.college_id,
                AttendanceRecord.class_id == class_id,
                AttendanceRecord.student_id.in_(student_ids),
                AttendanceRecord.session_date == payload.session_date,
            )
        )
    ).all()
    existing_by_student = {record.student_id: record for record in existing_records}
    records = []
    for entry in payload.records:
        record = existing_by_student.get(entry.student_id)
        if record is None:
            record = AttendanceRecord(
                college_id=principal.college_id,
                class_id=class_id,
                student_id=entry.student_id,
                session_date=payload.session_date,
                status=entry.status.value,
            )
            session.add(record)
        else:
            record.status = entry.status.value
            record.recorded_at = func.clock_timestamp()
        records.append(record)
    await session.flush()
    return [
        {
            "id": str(record.id),
            "class_id": str(record.class_id),
            "student_id": str(record.student_id),
            "session_date": record.session_date,
            "status": record.status,
            "recorded_at": record.recorded_at,
        }
        for record in records
    ]


@router.put(
    "/classes/{class_id}/attendance/{student_id}",
    response_model=AttendanceRead,
)
async def edit_class_attendance(
    class_id: UUID,
    student_id: UUID,
    *,
    session_date: date = Query(...),
    payload: AttendanceUpdate,
    principal: FacultyAccess,
    session: TenantSession,
) -> AttendanceRecord:
    return await update_attendance(
        session,
        principal,
        class_id,
        student_id,
        session_date,
        payload.status,
    )


@router.get("/timetable")
async def get_faculty_timetable(
    principal: FacultyAccess,
    session: TenantSession,
    session_date: date = Query(default_factory=date.today),
) -> list[dict[str, object]]:
    enrollment_count = (
        select(func.count(Enrollment.id))
        .where(
            Enrollment.college_id == principal.college_id,
            Enrollment.class_id == Class.id,
            Enrollment.status == "enrolled",
        )
        .correlate(Class)
        .scalar_subquery()
    )
    attendance_today_count = (
        select(func.count(AttendanceRecord.id))
        .join(
            Enrollment,
            (Enrollment.class_id == AttendanceRecord.class_id)
            & (Enrollment.student_id == AttendanceRecord.student_id)
            & (Enrollment.college_id == AttendanceRecord.college_id),
        )
        .where(
            Enrollment.college_id == Class.college_id,
            Enrollment.class_id == Class.id,
            Enrollment.status == "enrolled",
            AttendanceRecord.college_id == Class.college_id,
            AttendanceRecord.class_id == Class.id,
            AttendanceRecord.session_date == session_date,
        )
        .correlate(Class)
        .scalar_subquery()
    )
    attendance_record_count = (
        select(func.count(AttendanceRecord.id))
        .join(
            Enrollment,
            (Enrollment.class_id == AttendanceRecord.class_id)
            & (Enrollment.student_id == AttendanceRecord.student_id)
            & (Enrollment.college_id == AttendanceRecord.college_id),
        )
        .where(
            Enrollment.college_id == Class.college_id,
            Enrollment.class_id == Class.id,
            Enrollment.status == "enrolled",
            AttendanceRecord.college_id == Class.college_id,
            AttendanceRecord.class_id == Class.id,
            AttendanceRecord.status != "excused",
        )
        .correlate(Class)
        .scalar_subquery()
    )
    attendance_present_count = (
        select(func.count(AttendanceRecord.id))
        .join(
            Enrollment,
            (Enrollment.class_id == AttendanceRecord.class_id)
            & (Enrollment.student_id == AttendanceRecord.student_id)
            & (Enrollment.college_id == AttendanceRecord.college_id),
        )
        .where(
            Enrollment.college_id == Class.college_id,
            Enrollment.class_id == Class.id,
            Enrollment.status == "enrolled",
            AttendanceRecord.college_id == Class.college_id,
            AttendanceRecord.class_id == Class.id,
            AttendanceRecord.status.in_(("present", "late")),
        )
        .correlate(Class)
        .scalar_subquery()
    )
    statement = (
        select(
            Class,
            Course,
            ClassMeeting,
            User.full_name,
            User.email,
            enrollment_count,
            attendance_today_count,
            attendance_record_count,
            attendance_present_count,
        )
        .join(Course, Course.id == Class.course_id)
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
        .where(
            Class.college_id == principal.college_id,
            Class.instructor_id == principal.user_id,
        )
        .order_by(ClassMeeting.day_of_week, ClassMeeting.starts_at, Course.code)
    )
    rows = (await session.execute(statement)).all()
    return [
        {
            "class_id": str(class_record.id),
            "course_code": course.code,
            "course": course.title,
            "instructor_name": instructor_name,
            "instructor_email": instructor_email,
            "term": class_record.term,
            "section": class_record.section,
            "room": class_record.room,
            "day_of_week": meeting.day_of_week if meeting else None,
            "starts_at": meeting.starts_at.isoformat() if meeting else None,
            "ends_at": meeting.ends_at.isoformat() if meeting else None,
            "enrolled_students": enrolled_count,
            "attendance_date": session_date.isoformat(),
            "attendance_recorded_count": attendance_records_today,
            "attendance_submitted": (
                enrolled_count > 0
                and attendance_records_today >= enrolled_count
            ),
            "attendance_record_count": attendance_records,
            "attendance_present_count": attendance_present,
        }
        for (
            class_record,
            course,
            meeting,
            instructor_name,
            instructor_email,
            enrolled_count,
            attendance_records_today,
            attendance_records,
            attendance_present,
        ) in rows
    ]


@router.get("/classes/{class_id}/attendance")
async def get_class_attendance_average(
    class_id: UUID,
    principal: FacultyAccess,
    session: TenantSession,
    aggregate: Literal["average"] = Query(...),
) -> dict[str, object]:
    del aggregate
    await ensure_assigned_class(session, principal, class_id)
    total, attended, excluded = (
        await session.execute(
            select(
                func.count(AttendanceRecord.id),
                func.count(
                    case((AttendanceRecord.status.in_(("present", "late")), 1))
                ),
                func.count(case((AttendanceRecord.status == "excused", 1))),
            ).where(
                AttendanceRecord.college_id == principal.college_id,
                AttendanceRecord.class_id == class_id,
            )
        )
    ).one()
    denominator = total - excluded
    return {
        "class_id": str(class_id),
        "aggregate": "average",
        "attendance_percentage": round(attended * 100 / denominator, 2)
        if denominator
        else 0.0,
        "record_count": total,
        "excluded_excused_records": excluded,
    }


@router.get("/classes/{class_id}/tests")
async def get_class_tests(
    class_id: UUID,
    principal: FacultyAccess,
    session: TenantSession,
) -> list[dict[str, object]]:
    await ensure_assigned_class(session, principal, class_id)
    tests = (
        await session.scalars(
            select(TestAssessment)
            .where(
                TestAssessment.college_id == principal.college_id,
                TestAssessment.class_id == class_id,
            )
            .order_by(TestAssessment.due_date.nullslast(), TestAssessment.created_at)
        )
    ).all()
    if not tests:
        return []

    mark_rows = (
        await session.execute(
            select(StudentMark, User.full_name)
            .join(User, User.id == StudentMark.student_id)
            .where(
                StudentMark.college_id == principal.college_id,
                StudentMark.test_id.in_([test.id for test in tests]),
            )
            .order_by(User.full_name)
        )
    ).all()
    marks_by_test: dict[UUID, list[dict[str, object]]] = {}
    for mark, student_name in mark_rows:
        marks_by_test.setdefault(mark.test_id, []).append(
            {
                "student_id": str(mark.student_id),
                "student_name": student_name,
                "score": mark.score,
            }
        )
    return [
        {
            "id": str(test.id),
            "class_id": str(test.class_id),
            "title": test.title,
            "max_score": test.max_score,
            "due_date": test.due_date,
            "marks": marks_by_test.get(test.id, []),
        }
        for test in tests
    ]


@router.put("/classes/{class_id}/tests/{test_id}")
async def update_test_assessment(
    class_id: UUID,
    test_id: UUID,
    payload: TestAssessmentUpdate,
    principal: FacultyAccess,
    session: TenantSession,
) -> dict[str, object]:
    await ensure_assigned_class(session, principal, class_id)
    test = await session.scalar(
        select(TestAssessment).where(
            TestAssessment.id == test_id,
            TestAssessment.class_id == class_id,
            TestAssessment.college_id == principal.college_id,
        )
    )
    if test is None:
        raise HTTPException(status_code=404, detail="Assessment was not found.")
    maximum_mark = await session.scalar(
        select(func.max(StudentMark.score)).where(
            StudentMark.college_id == principal.college_id,
            StudentMark.test_id == test_id,
        )
    )
    if maximum_mark is not None and maximum_mark > payload.max_score:
        raise HTTPException(
            status_code=422,
            detail="Maximum score cannot be lower than an existing student score.",
        )
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Assessment title cannot be blank.")
    test.title = title
    test.max_score = payload.max_score
    test.due_date = payload.due_date
    await session.flush()
    return {
        "id": str(test.id),
        "class_id": str(test.class_id),
        "title": test.title,
        "max_score": test.max_score,
        "due_date": test.due_date,
    }


@router.post("/classes/{class_id}/tests/{test_id}/marks")
async def upload_test_marks(
    class_id: UUID,
    test_id: UUID,
    payload: MarkUpload,
    principal: FacultyAccess,
    session: TenantSession,
) -> dict[str, object]:
    await ensure_assigned_class(session, principal, class_id)
    existing = await session.get(TestAssessment, test_id)
    if existing is not None:
        raise HTTPException(status_code=409, detail="This test already exists.")
    if any(mark.score > payload.max_score for mark in payload.marks):
        raise HTTPException(status_code=422, detail="A mark exceeds the test maximum.")
    student_ids = [mark.student_id for mark in payload.marks]
    if len(student_ids) != len(set(student_ids)):
        raise HTTPException(status_code=422, detail="A student may appear only once.")
    if student_ids:
        enrolled = set(
            (
                await session.scalars(
                    select(Enrollment.student_id).where(
                        Enrollment.college_id == principal.college_id,
                        Enrollment.class_id == class_id,
                        Enrollment.student_id.in_(student_ids),
                        Enrollment.status == "enrolled",
                    )
                )
            ).all()
        )
        if enrolled != set(student_ids):
            raise HTTPException(
                status_code=422,
                detail="Every marked student must be actively enrolled in this class.",
            )
    test = TestAssessment(
        id=test_id,
        college_id=principal.college_id,
        class_id=class_id,
        title=payload.title,
        max_score=payload.max_score,
        due_date=payload.due_date,
    )
    session.add(test)
    await session.flush()
    marks = [
        StudentMark(
            college_id=principal.college_id,
            test_id=test_id,
            student_id=mark.student_id,
            score=mark.score,
        )
        for mark in payload.marks
    ]
    session.add_all(marks)
    await session.flush()
    return {
        "id": str(test.id),
        "class_id": str(test.class_id),
        "title": test.title,
        "max_score": test.max_score,
        "due_date": test.due_date,
        "marks": [
            {"student_id": str(mark.student_id), "score": mark.score}
            for mark in marks
        ],
    }


@router.get("/classes/{class_id}/materials")
async def get_class_materials(
    class_id: UUID,
    principal: FacultyAccess,
    session: TenantSession,
) -> list[dict[str, object]]:
    await ensure_assigned_class(session, principal, class_id)
    materials = (
        await session.scalars(
            select(CourseMaterial)
            .where(
                CourseMaterial.college_id == principal.college_id,
                CourseMaterial.class_id == class_id,
            )
            .order_by(CourseMaterial.created_at.desc())
        )
    ).all()
    return [
        {
            "id": str(material.id),
            "class_id": str(material.class_id),
            "title": material.title,
            "url": material.url,
            "description": material.description,
            "created_at": material.created_at,
        }
        for material in materials
    ]


@router.post(
    "/classes/{class_id}/materials",
    status_code=status.HTTP_201_CREATED,
)
async def create_class_material(
    class_id: UUID,
    payload: CourseMaterialCreate,
    principal: FacultyAccess,
    session: TenantSession,
) -> dict[str, object]:
    await ensure_assigned_class(session, principal, class_id)
    material = CourseMaterial(
        college_id=principal.college_id,
        class_id=class_id,
        title=payload.title.strip(),
        url=str(payload.url),
        description=payload.description.strip() if payload.description else None,
    )
    session.add(material)
    await session.flush()
    return {
        "id": str(material.id),
        "class_id": str(material.class_id),
        "title": material.title,
        "url": material.url,
        "description": material.description,
        "created_at": material.created_at,
    }


@router.delete(
    "/classes/{class_id}/materials/{material_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_class_material(
    class_id: UUID,
    material_id: UUID,
    principal: FacultyAccess,
    session: TenantSession,
) -> None:
    await ensure_assigned_class(session, principal, class_id)
    material = await session.scalar(
        select(CourseMaterial).where(
            CourseMaterial.id == material_id,
            CourseMaterial.college_id == principal.college_id,
            CourseMaterial.class_id == class_id,
        )
    )
    if material is None:
        raise HTTPException(status_code=404, detail="Course material was not found.")
    await session.delete(material)


@router.put(
    "/classes/{class_id}/materials/{material_id}",
)
async def update_class_material(
    class_id: UUID,
    material_id: UUID,
    payload: CourseMaterialUpdate,
    principal: FacultyAccess,
    session: TenantSession,
) -> dict[str, object]:
    await ensure_assigned_class(session, principal, class_id)
    material = await session.scalar(
        select(CourseMaterial).where(
            CourseMaterial.id == material_id,
            CourseMaterial.college_id == principal.college_id,
            CourseMaterial.class_id == class_id,
        )
    )
    if material is None:
        raise HTTPException(status_code=404, detail="Course material was not found.")
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Course material title cannot be blank.")
    material.title = title
    material.url = str(payload.url)
    material.description = payload.description.strip() if payload.description else None
    await session.flush()
    return {
        "id": str(material.id),
        "class_id": str(material.class_id),
        "title": material.title,
        "url": material.url,
        "description": material.description,
        "created_at": material.created_at,
    }


@router.put("/classes/{class_id}/tests/{test_id}/marks/{student_id}")
async def update_test_marks(
    class_id: UUID,
    test_id: UUID,
    student_id: UUID,
    payload: MarkUpdate,
    principal: FacultyAccess,
    session: TenantSession,
) -> dict[str, object]:
    await ensure_assigned_class(session, principal, class_id)
    test = await session.scalar(
        select(TestAssessment).where(
            TestAssessment.id == test_id,
            TestAssessment.class_id == class_id,
            TestAssessment.college_id == principal.college_id,
        )
    )
    if test is None:
        raise HTTPException(status_code=404, detail="Test was not found.")
    if payload.score > test.max_score:
        raise HTTPException(status_code=422, detail="The mark exceeds the test maximum.")
    mark = await session.scalar(
        select(StudentMark).where(
            StudentMark.test_id == test_id,
            StudentMark.student_id == student_id,
            StudentMark.college_id == principal.college_id,
        )
    )
    if mark is None:
        enrollment = await session.scalar(
            select(Enrollment.id).where(
                Enrollment.class_id == class_id,
                Enrollment.student_id == student_id,
                Enrollment.college_id == principal.college_id,
                Enrollment.status == "enrolled",
            )
        )
        if enrollment is None:
            raise HTTPException(status_code=404, detail="Enrolled student was not found.")
        mark = StudentMark(
            college_id=principal.college_id,
            test_id=test_id,
            student_id=student_id,
            score=payload.score,
        )
        session.add(mark)
    else:
        mark.score = payload.score
        mark.updated_at = func.clock_timestamp()
    await session.flush()
    return {
        "test_id": str(test_id),
        "student_id": str(student_id),
        "score": mark.score,
    }


@router.put("/classes/{class_id}/tests/{test_id}/marks")
async def update_test_marks_batch(
    class_id: UUID,
    test_id: UUID,
    payload: MarkBatch,
    principal: FacultyAccess,
    session: TenantSession,
) -> dict[str, object]:
    await ensure_assigned_class(session, principal, class_id)
    test = await session.scalar(
        select(TestAssessment).where(
            TestAssessment.id == test_id,
            TestAssessment.class_id == class_id,
            TestAssessment.college_id == principal.college_id,
        )
    )
    if test is None:
        raise HTTPException(status_code=404, detail="Test was not found.")
    if any(mark.score > test.max_score for mark in payload.marks):
        raise HTTPException(status_code=422, detail="A mark exceeds the test maximum.")

    student_ids = [mark.student_id for mark in payload.marks]
    if len(student_ids) != len(set(student_ids)):
        raise HTTPException(status_code=422, detail="A student may appear only once.")
    enrolled = set(
        (
            await session.scalars(
                select(Enrollment.student_id).where(
                    Enrollment.college_id == principal.college_id,
                    Enrollment.class_id == class_id,
                    Enrollment.student_id.in_(student_ids),
                    Enrollment.status == "enrolled",
                )
            )
        ).all()
    )
    if enrolled != set(student_ids):
        raise HTTPException(
            status_code=422,
            detail="Every grade must belong to an actively enrolled student.",
        )

    existing_marks = (
        await session.scalars(
            select(StudentMark).where(
                StudentMark.college_id == principal.college_id,
                StudentMark.test_id == test_id,
                StudentMark.student_id.in_(student_ids),
            )
        )
    ).all()
    marks_by_student = {mark.student_id: mark for mark in existing_marks}
    results = []
    for entry in payload.marks:
        mark = marks_by_student.get(entry.student_id)
        if mark is None:
            mark = StudentMark(
                college_id=principal.college_id,
                test_id=test_id,
                student_id=entry.student_id,
                score=entry.score,
            )
            session.add(mark)
        else:
            mark.score = entry.score
            mark.updated_at = func.clock_timestamp()
        results.append(mark)
    await session.flush()
    return {
        "test_id": str(test_id),
        "marks": [
            {"student_id": str(mark.student_id), "score": mark.score}
            for mark in results
        ],
    }


@router.get("/notices")
async def get_global_notices(
    principal: FacultyAccess, session: TenantSession
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
            "author": name,
            "created_at": notice.created_at,
        }
        for notice, name in rows
    ]
