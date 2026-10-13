from datetime import date
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import AuthenticatedPrincipal
from app.models import AttendanceRecord, Class, Enrollment
from app.schemas.attendance import AttendanceCreate, AttendanceStatus


async def ensure_assigned_class(
    session: AsyncSession,
    principal: AuthenticatedPrincipal,
    class_id: UUID,
) -> Class:
    result = await session.execute(
        select(Class).where(
            Class.id == class_id,
            Class.college_id == principal.college_id,
            Class.instructor_id == principal.user_id,
        )
    )
    class_record = result.scalar_one_or_none()
    if class_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned class was not found.",
        )
    return class_record


async def create_attendance(
    session: AsyncSession,
    principal: AuthenticatedPrincipal,
    class_id: UUID,
    payload: AttendanceCreate,
) -> AttendanceRecord:
    await ensure_assigned_class(session, principal, class_id)
    enrollment_id = await session.scalar(
        select(Enrollment.id).where(
            Enrollment.college_id == principal.college_id,
            Enrollment.class_id == class_id,
            Enrollment.student_id == payload.student_id,
            Enrollment.status == "enrolled",
        )
    )
    if enrollment_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Actively enrolled student was not found in this class.",
        )
    values: dict[str, object] = {
        "college_id": principal.college_id,
        "class_id": class_id,
        "student_id": payload.student_id,
        "status": payload.status.value,
    }
    if payload.session_date is not None:
        values["session_date"] = payload.session_date
    record = AttendanceRecord(**values)
    session.add(record)
    await session.flush()
    return record


async def update_attendance(
    session: AsyncSession,
    principal: AuthenticatedPrincipal,
    class_id: UUID,
    student_id: UUID,
    session_date: date,
    attendance_status: AttendanceStatus,
) -> AttendanceRecord:
    await ensure_assigned_class(session, principal, class_id)
    result = await session.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.college_id == principal.college_id,
            AttendanceRecord.class_id == class_id,
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.session_date == session_date,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance record was not found.",
        )
    record.status = attendance_status.value
    await session.flush()
    return record


async def get_student_attendance(
    session: AsyncSession,
    principal: AuthenticatedPrincipal,
) -> list[AttendanceRecord]:
    result = await session.execute(
        select(AttendanceRecord)
        .where(
            AttendanceRecord.college_id == principal.college_id,
            AttendanceRecord.student_id == principal.user_id,
        )
        .order_by(
            AttendanceRecord.session_date.desc(),
            AttendanceRecord.class_id,
        )
    )
    return list(result.scalars().all())
