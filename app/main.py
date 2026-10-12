from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import uvicorn

app = FastAPI(title="Campus Unified API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# IN-MEMORY DATA STORAGE
# ============================================================================

FACULTY_DATA: Dict[str, Any] = {
    "instructor": {
        "name": "Dr. Professor",
        "department": "Computer Science & Engineering",
        "designation": "Associate Professor",
        "office": "Academic Block B, Room 312"
    },
    "stats": {
        "lectures_remaining": "2 remaining",
        "avg_attendance": "92.6%",
        "student_inquiries": "5 Pending"
    },
    "lectures_today": [
        {
            "id": 1,
            "time": "09:00 AM - 10:30 AM",
            "room": "Lab 3",
            "course": "Data Structures & Algorithms",
            "section": "CS-3A",
            "students_count": "52 Students",
            "status": "Attendance Submitted"
        },
        {
            "id": 2,
            "time": "11:00 AM - 12:30 PM",
            "room": "Hall 204",
            "course": "Database Management Systems",
            "section": "CS-5B",
            "students_count": "58 Students",
            "status": "Pending"
        },
        {
            "id": 3,
            "time": "02:00 PM - 03:30 PM",
            "room": "Hall 101",
            "course": "Operating Systems",
            "section": "IT-3A",
            "students_count": "45 Students",
            "status": "Attendance Submitted"
        }
    ],
    "advisory_notices": [
        {"id": 1, "title": "Mid-term question paper moderation deadline", "due": "Oct 15, 2026"},
        {"id": 2, "title": "Internal lab assessment grading due", "due": "Oct 24, 2026"}
    ]
}

ADMIN_DATA: Dict[str, Any] = {
    "institution": {
        "name": "Institute of Technology & Science",
        "term": "Fall 2026",
        "system_status": "Operational & Synced"
    },
    "stats": {
        "total_students": 3420,
        "total_faculty": 184,
        "overall_campus_occupancy": "87.4%",
        "pending_administrative_approvals": 12
    },
    "departments": [
        {"code": "CSE", "name": "Computer Science & Engineering", "students": 840, "faculty": 36},
        {"code": "ECE", "name": "Electronics & Communication", "students": 720, "faculty": 32},
        {"code": "MECH", "name": "Mechanical Engineering", "students": 610, "faculty": 28},
        {"code": "IT", "name": "Information Technology", "students": 550, "faculty": 24}
    ]
}

STUDENT_DATA: Dict[str, Any] = {
    "student_profile": {
        "name": "Enrolled Student",
        "program": "B.Tech Computer Science",
        "semester": "Semester 5",
        "enrollment_status": "Active Enrolled",
        "advisory_batch": "2024 - 2028"
    },
    "academic_progress": {
        "cgpa": 8.82,
        "cgpa_scale": 10.0,
        "sgpa_current": 9.10,
        "standing": "Dean's List"
    },
    "courses": [
        {"code": "CS501", "name": "Database Management Systems", "credits": 4, "attendance": "94%", "ia1": 28, "ia2": 29, "max_ia": 30},
        {"code": "CS502", "name": "Operating Systems", "credits": 4, "attendance": "91%", "ia1": 27, "ia2": 26, "max_ia": 30},
        {"code": "CS503", "name": "Computer Networks", "credits": 3, "attendance": "89%", "ia1": 25, "ia2": 28, "max_ia": 30},
        {"code": "CS504", "name": "Theory of Computation", "credits": 3, "attendance": "96%", "ia1": 30, "ia2": 29, "max_ia": 30}
    ],
    "notice_board": [
        {"id": 1, "author": "Academic Dean", "title": "Mid-Term Examination Seating Plan", "date": "Oct 14, 2026", "badge": "Important"},
        {"id": 2, "author": "Hostel Affairs", "title": "Diwali Vacation Hostel Access Verification", "date": "Oct 20, 2026", "badge": "Campus"}
    ]
}

# ============================================================================
# FACULTY ENDPOINTS
# ============================================================================

@app.get("/api/faculty/dashboard")
def get_faculty():
    return FACULTY_DATA

@app.put("/api/faculty/dashboard")
def update_faculty(payload: Dict[str, Any]):
    global FACULTY_DATA
    FACULTY_DATA.update(payload)
    return {"status": "success", "data": FACULTY_DATA}

@app.put("/api/faculty/lectures/{lecture_id}")
def update_lecture(lecture_id: int, payload: Dict[str, Any]):
    global FACULTY_DATA
    for idx, lec in enumerate(FACULTY_DATA["lectures_today"]):
        if lec["id"] == lecture_id:
            FACULTY_DATA["lectures_today"][idx].update(payload)
            return {"status": "success", "lecture": FACULTY_DATA["lectures_today"][idx]}
    raise HTTPException(status_code=404, detail="Lecture not found")

# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@app.get("/api/admin/dashboard")
def get_admin():
    return ADMIN_DATA

@app.put("/api/admin/dashboard")
def update_admin(payload: Dict[str, Any]):
    global ADMIN_DATA
    ADMIN_DATA.update(payload)
    return {"status": "success", "data": ADMIN_DATA}

# ============================================================================
# STUDENT ENDPOINTS
# ============================================================================

@app.get("/api/student/dashboard")
def get_student():
    return STUDENT_DATA

@app.put("/api/student/dashboard")
def update_student(payload: Dict[str, Any]):
    global STUDENT_DATA
    STUDENT_DATA.update(payload)
    return {"status": "success", "data": STUDENT_DATA}

@app.post("/api/student/notices")
def add_student_notice(payload: Dict[str, Any]):
    global STUDENT_DATA
    new_id = len(STUDENT_DATA["notice_board"]) + 1
    notice = {
        "id": new_id,
        "author": payload.get("author", "Student Council"),
        "title": payload.get("title", "Announcement"),
        "date": payload.get("date", "Today"),
        "badge": payload.get("badge", "General")
    }
    STUDENT_DATA["notice_board"].insert(0, notice)
    return {"status": "success", "notices": STUDENT_DATA["notice_board"]}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)