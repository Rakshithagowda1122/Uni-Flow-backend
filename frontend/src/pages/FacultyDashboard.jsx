import React, { useState, useEffect, useMemo } from "react";
import { apiRequest } from "../api/client.js";
import AnimatedContent from "../components/AnimatedContent.jsx";
import PortalLayout from "../components/PortalLayout.jsx";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value) {
  if (!value) return "Time not assigned";
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return value;
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function calculateDuration(startTime, endTime) {
  const parseMinutes = (value) => {
    const match = /^(\d{2}):(\d{2})/.exec(value || "");
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const start = parseMinutes(startTime);
  const end = parseMinutes(endTime);
  if (start === null || end === null || end <= start) return "—";
  const duration = end - start;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return hours
    ? `${hours}h${minutes ? ` ${minutes}m` : ""}`
    : `${minutes} min`;
}

function buildGradeDrafts(tests, students) {
  return Object.fromEntries(
    tests.map((test) => {
      const marks = new Map(
        test.marks.map((mark) => [mark.student_id, String(mark.score)])
      );
      return [
        test.id,
        Object.fromEntries(
          students.map((student) => [
            student.student_id,
            marks.get(student.student_id) || "",
          ])
        ),
      ];
    })
  );
}

async function fetchClassGradeData(classId) {
  const [students, tests] = await Promise.all([
    apiRequest(`/faculty/classes/${classId}/students`),
    apiRequest(`/faculty/classes/${classId}/tests`),
  ]);
  if (!Array.isArray(students) || !Array.isArray(tests)) {
    throw new Error("The gradebook response is invalid.");
  }
  return { students, tests };
}

export default function FacultyDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Attendance Modal States
  const [attendanceClass, setAttendanceClass] = useState(null);
  const [attendanceRoster, setAttendanceRoster] = useState([]);
  const [attendanceStatuses, setAttendanceStatuses] = useState({});
  const [attendanceDate, setAttendanceDate] = useState(() => getLocalDateValue());
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [gradeStudents, setGradeStudents] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [gradeDrafts, setGradeDrafts] = useState({});
  const [gradeLoading, setGradeLoading] = useState(false);
  const [gradeSavingId, setGradeSavingId] = useState("");
  const [gradeError, setGradeError] = useState("");
  const [gradeMessage, setGradeMessage] = useState("");
  const [editingAssessmentId, setEditingAssessmentId] = useState("");
  const [assessmentDraft, setAssessmentDraft] = useState(null);
  const [assessmentSaving, setAssessmentSaving] = useState(false);
  const [gradeForm, setGradeForm] = useState({
    title: "",
    max_score: "100",
    due_date: "",
  });
  const [materials, setMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsSaving, setMaterialsSaving] = useState(false);
  const [materialDeletingId, setMaterialDeletingId] = useState("");
  const [editingMaterialId, setEditingMaterialId] = useState("");
  const [materialsError, setMaterialsError] = useState("");
  const [materialForm, setMaterialForm] = useState({
    title: "",
    url: "",
    description: "",
  });

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [dashboard, timetable, notices] = await Promise.all([
        apiRequest("/faculty/dashboard"),
        apiRequest(`/faculty/timetable?session_date=${getLocalDateValue()}`),
        apiRequest("/faculty/notices"),
      ]);

      if (!dashboard.instructor || !Array.isArray(timetable) || !Array.isArray(notices)) {
        throw new Error("The faculty dashboard response is missing profile or schedule data.");
      }

      const todayIndex = (new Date().getDay() + 6) % 7;
      const lectures = timetable.map((slot) => ({
        id: `${slot.class_id}-${slot.day_of_week ?? "unscheduled"}-${slot.starts_at ?? "time"}`,
        class_id: slot.class_id,
        course_code: slot.course_code,
        course_name: slot.course,
        term: slot.term,
        room: slot.room || "Room not assigned",
        section: slot.section,
        day_index: slot.day_of_week,
        day_name:
          Number.isInteger(slot.day_of_week) && WEEKDAYS[slot.day_of_week]
            ? WEEKDAYS[slot.day_of_week]
            : "Day not assigned",
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        formatted_start: formatTime(slot.starts_at),
        formatted_end: formatTime(slot.ends_at),
        duration: calculateDuration(slot.starts_at, slot.ends_at),
        enrolled_count: slot.enrolled_students,
        faculty_name: slot.instructor_name,
        faculty_email: slot.instructor_email,
        attendance_submitted: slot.attendance_submitted,
        attendance_recorded_count: slot.attendance_recorded_count,
        attendance_record_count: slot.attendance_record_count,
        attendance_present_count: slot.attendance_present_count,
        attendance_rate:
          slot.attendance_record_count > 0
            ? `${((slot.attendance_present_count / slot.attendance_record_count) * 100).toFixed(1)}%`
            : null,
        is_today: slot.day_of_week === todayIndex,
      }));

      const classes = [...new Map(lectures.map((lecture) => [lecture.class_id, lecture])).values()];
      setSelectedClassId((currentId) =>
        classes.some((lecture) => lecture.class_id === currentId)
          ? currentId
          : classes[0]?.class_id || ""
      );
      const attendanceRecordCount = classes.reduce(
        (total, lecture) => total + lecture.attendance_record_count,
        0
      );
      const attendancePresentCount = classes.reduce(
        (total, lecture) => total + lecture.attendance_present_count,
        0
      );
      const todayLectures = lectures.filter((lecture) => lecture.is_today);
      const completedToday = todayLectures.filter(
        (lecture) => lecture.attendance_submitted
      ).length;

      setData({
        faculty: dashboard.instructor,
        stats: {
          total_classes: lectures.length,
          today_classes: todayLectures.length,
          completed_classes: completedToday,
          pending_classes: todayLectures.length - completedToday,
          avg_attendance: attendanceRecordCount
            ? `${((attendancePresentCount / attendanceRecordCount) * 100).toFixed(1)}%`
            : null,
        },
        lectures,
        notices,
      });
    } catch (err) {
      setErrorMessage(err.message || "Failed to synchronise faculty dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const assignedClasses = useMemo(
    () =>
      data?.lectures
        ? [...new Map(data.lectures.map((lecture) => [lecture.class_id, lecture])).values()]
        : [],
    [data]
  );

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setErrorMessage("");
    try {
      const updated = await apiRequest("/faculty/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ full_name: profileNameDraft }),
      });
      setData((current) => ({
        ...current,
        faculty: { ...current.faculty, name: updated.full_name },
      }));
      try {
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem("user", JSON.stringify({ ...storedUser, name: updated.full_name }));
      } catch {
        localStorage.removeItem("user");
      }
      setEditingProfile(false);
    } catch (error) {
      setErrorMessage(error.message || "Unable to update your faculty profile.");
    } finally {
      setProfileSaving(false);
    }
  };
  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!selectedClassId) return undefined;

    let cancelled = false;
    const loadGrades = async () => {
      setGradeLoading(true);
      setGradeError("");
      try {
        const { students, tests } = await fetchClassGradeData(selectedClassId);
        if (!cancelled) {
          setGradeStudents(students);
          setAssessments(tests);
          setGradeDrafts(buildGradeDrafts(tests, students));
        }
      } catch (err) {
        if (!cancelled) {
          setGradeError(err.message || "Could not load the class gradebook.");
        }
      } finally {
        if (!cancelled) setGradeLoading(false);
      }
    };

    loadGrades();
    return () => {
      cancelled = true;
    };
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) return undefined;

    let cancelled = false;
    const loadMaterials = async () => {
      setMaterialsLoading(true);
      setMaterialsError("");
      try {
        const response = await apiRequest(
          `/faculty/classes/${selectedClassId}/materials`
        );
        if (!Array.isArray(response)) {
          throw new Error("The course materials response is invalid.");
        }
        if (!cancelled) setMaterials(response);
      } catch (err) {
        if (!cancelled) {
          setMaterialsError(err.message || "Could not load course materials.");
        }
      } finally {
        if (!cancelled) setMaterialsLoading(false);
      }
    };

    loadMaterials();
    return () => {
      cancelled = true;
    };
  }, [selectedClassId]);

  const openAttendanceModal = (lecture) => {
    setActionError("");
    setAttendanceClass(lecture);
    setAttendanceRoster([]);
    setAttendanceStatuses({});
    setAttendanceLoading(true);
  };

  useEffect(() => {
    if (!attendanceClass) return undefined;
    let cancelled = false;

    const loadRoster = async () => {
      setAttendanceLoading(true);
      setActionError("");
      try {
        const roster = await apiRequest(
          `/faculty/classes/${attendanceClass.class_id}/students?session_date=${attendanceDate}`
        );
        if (!Array.isArray(roster)) {
          throw new Error("The student roster response is invalid.");
        }
        if (!cancelled) {
          setAttendanceRoster(roster);
          setAttendanceStatuses(
            Object.fromEntries(
              roster.map((student) => [student.student_id, student.status || ""])
            )
          );
        }
      } catch (err) {
        if (!cancelled) {
          setActionError(err.message || "Failed to load student roster for this section.");
        }
      } finally {
        if (!cancelled) setAttendanceLoading(false);
      }
    };

    loadRoster();
    return () => {
      cancelled = true;
    };
  }, [attendanceClass, attendanceDate]);

  const setAllAttendance = (status) => {
    const updated = {};
    attendanceRoster.forEach((student) => {
      updated[student.student_id] = status;
    });
    setAttendanceStatuses(updated);
  };

  // Submit attendance records
  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();
    if (!attendanceRoster.length) {
      setActionError("Cannot submit attendance for an empty roster.");
      return;
    }
    if (
      attendanceRoster.some(
        (student) =>
          !["present", "absent", "late", "excused"].includes(
            attendanceStatuses[student.student_id]
          )
      )
    ) {
      setActionError("Choose an attendance status for every enrolled student.");
      return;
    }

    setAttendanceSaving(true);
    setActionError("");

    try {
      await apiRequest(
        `/faculty/classes/${attendanceClass.class_id}/attendance/batch`,
        {
          method: "POST",
          body: JSON.stringify({
            session_date: attendanceDate,
            records: attendanceRoster.map((s) => ({
              student_id: s.student_id,
              status: attendanceStatuses[s.student_id],
            })),
          }),
        }
      );
      setAttendanceClass(null);
      await loadDashboard();
    } catch (err) {
      setActionError(err.message || "Attendance submission failed. Please verify records.");
    } finally {
      setAttendanceSaving(false);
    }
  };

  const handleCreateAssessment = async (event) => {
    event.preventDefault();
    const maxScore = Number(gradeForm.max_score);
    if (!selectedClassId || !gradeForm.title.trim() || !Number.isFinite(maxScore) || maxScore <= 0) {
      setGradeError("Enter an assessment title and a maximum score greater than zero.");
      return;
    }

    setGradeError("");
    setGradeMessage("");
    setGradeSavingId("new");
    try {
      await apiRequest(`/faculty/classes/${selectedClassId}/tests/${crypto.randomUUID()}/marks`, {
        method: "POST",
        body: JSON.stringify({
          title: gradeForm.title.trim(),
          max_score: maxScore,
          due_date: gradeForm.due_date || null,
          marks: [],
        }),
      });
      const { students, tests } = await fetchClassGradeData(selectedClassId);
      setGradeStudents(students);
      setAssessments(tests);
      setGradeDrafts(buildGradeDrafts(tests, students));
      setGradeForm({ title: "", max_score: "100", due_date: "" });
      setGradeMessage("Assessment created. Enter student scores below.");
    } catch (err) {
      setGradeError(err.message || "Could not create the assessment.");
    } finally {
      setGradeSavingId("");
    }
  };

  const handleSaveGrades = async (assessment) => {
    const drafts = gradeDrafts[assessment.id] || {};
    const enteredMarks = gradeStudents
      .filter((student) => drafts[student.student_id]?.trim())
      .map((student) => ({
        studentId: student.student_id,
        score: Number(drafts[student.student_id]),
      }));
    if (!enteredMarks.length) {
      setGradeError("Enter at least one student score before saving.");
      return;
    }
    if (
      enteredMarks.some(
        ({ score }) =>
          !Number.isFinite(score) || score < 0 || score > Number(assessment.max_score)
      )
    ) {
      setGradeError(`Scores must be between 0 and ${assessment.max_score}.`);
      return;
    }

    setGradeError("");
    setGradeMessage("");
    setGradeSavingId(assessment.id);
    try {
      await apiRequest(
        `/faculty/classes/${selectedClassId}/tests/${assessment.id}/marks`,
        {
          method: "PUT",
          body: JSON.stringify({
            marks: enteredMarks.map(({ studentId, score }) => ({
              student_id: studentId,
              score,
            })),
          }),
        }
      );
      const { students, tests } = await fetchClassGradeData(selectedClassId);
      setGradeStudents(students);
      setAssessments(tests);
      setGradeDrafts(buildGradeDrafts(tests, students));
      setGradeMessage(`${assessment.title} scores saved.`);
    } catch (err) {
      setGradeError(err.message || "Could not save the grades.");
    } finally {
      setGradeSavingId("");
    }
  };

  const beginAssessmentEdit = (assessment) => {
    setEditingAssessmentId(assessment.id);
    setAssessmentDraft({
      title: assessment.title,
      max_score: String(assessment.max_score),
      due_date: assessment.due_date || "",
    });
    setGradeError("");
  };

  const handleAssessmentUpdate = async (event) => {
    event.preventDefault();
    if (!assessmentDraft || !editingAssessmentId) return;
    setAssessmentSaving(true);
    setGradeError("");
    try {
      await apiRequest(`/faculty/classes/${selectedClassId}/tests/${editingAssessmentId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: assessmentDraft.title,
          max_score: Number(assessmentDraft.max_score),
          due_date: assessmentDraft.due_date || null,
        }),
      });
      const { students, tests } = await fetchClassGradeData(selectedClassId);
      setGradeStudents(students);
      setAssessments(tests);
      setGradeDrafts(buildGradeDrafts(tests, students));
      setEditingAssessmentId("");
      setAssessmentDraft(null);
      setGradeMessage("Assessment details updated.");
    } catch (error) {
      setGradeError(error.message || "Could not update assessment details.");
    } finally {
      setAssessmentSaving(false);
    }
  };

  const beginMaterialEdit = (material) => {
    setEditingMaterialId(material.id);
    setMaterialForm({
      title: material.title,
      url: material.url,
      description: material.description || "",
    });
    setMaterialsError("");
  };

  const handleCreateMaterial = async (event) => {
    event.preventDefault();
    if (!selectedClassId) {
      setMaterialsError("Select one of your assigned classes first.");
      return;
    }

    setMaterialsError("");
    setMaterialsSaving(true);
    try {
      const material = await apiRequest(
        `/faculty/classes/${selectedClassId}/materials${editingMaterialId ? `/${editingMaterialId}` : ""}`,
        {
          method: editingMaterialId ? "PUT" : "POST",
          body: JSON.stringify({
            title: materialForm.title.trim(),
            url: materialForm.url.trim(),
            description: materialForm.description.trim() || null,
          }),
        }
      );
      setMaterials((current) =>
        editingMaterialId
          ? current.map((item) => item.id === material.id ? material : item)
          : [material, ...current],
      );
      setMaterialForm({ title: "", url: "", description: "" });
      setEditingMaterialId("");
    } catch (err) {
      setMaterialsError(err.message || "Could not save this course material.");
    } finally {
      setMaterialsSaving(false);
    }
  };

  const handleDeleteMaterial = async (material) => {
    if (!globalThis.confirm(`Remove "${material.title}" from this class?`)) return;
    setMaterialsError("");
    setMaterialDeletingId(material.id);
    try {
      await apiRequest(
        `/faculty/classes/${selectedClassId}/materials/${material.id}`,
        { method: "DELETE" }
      );
      setMaterials((current) =>
        current.filter((item) => item.id !== material.id)
      );
    } catch (err) {
      setMaterialsError(err.message || "Could not remove this course material.");
    } finally {
      setMaterialDeletingId("");
    }
  };

  const filteredLectures = useMemo(() => {
    if (!data?.lectures) return [];
    return data.lectures.filter((lec) => {
      const matchesSearch =
        lec.course_name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        lec.course_code.toLowerCase().includes(filterQuery.toLowerCase()) ||
        lec.faculty_name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        lec.room.toLowerCase().includes(filterQuery.toLowerCase()) ||
        lec.day_name.toLowerCase().includes(filterQuery.toLowerCase());

      if (activeTab === "today") return matchesSearch && lec.is_today;
      if (activeTab === "needs-attendance") {
        return matchesSearch && lec.is_today && !lec.attendance_submitted;
      }
      return matchesSearch;
    });
  }, [data, filterQuery, activeTab]);

  if (loading) {
    return (
      <PortalLayout role="faculty">
        <div className="flex flex-col items-center justify-center space-y-4 py-20 text-slate-400">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium tracking-wide">Loading academic portal...</p>
        </div>
      </PortalLayout>
    );
  }

  if (errorMessage && !data) {
    return (
      <PortalLayout role="faculty">
        <div className="mx-auto flex max-w-xl items-center justify-center p-6">
        <div className="w-full space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center font-bold text-lg">
            !
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Service Connectivity Issue</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{errorMessage}</p>
          <button
            onClick={loadDashboard}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition shadow-lg shadow-indigo-600/20"
          >
            Retry Sync
          </button>
        </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      role="faculty"
      term={[...new Set(data.lectures.map((lecture) => lecture.term).filter(Boolean))].join(", ")}
    >
      <div className="mx-auto max-w-7xl space-y-8">
        <section id="overview" className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-300">Faculty overview</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Welcome, {data.faculty.name}</h1>
            <p className="mt-2 text-xs text-slate-400">{data.faculty.department} · {data.faculty.email}</p>
          </div>
          {editingProfile ? (
            <form onSubmit={handleProfileSave} className="flex flex-wrap items-end gap-2">
              <label className="text-[10px] text-slate-400">Display name
                <input required maxLength={150} value={profileNameDraft} onChange={(event) => setProfileNameDraft(event.target.value)} className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
              </label>
              <button type="submit" disabled={profileSaving} className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{profileSaving ? "Saving…" : "Save name"}</button>
              <button type="button" onClick={() => setEditingProfile(false)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Cancel</button>
            </form>
          ) : (
            <button type="button" onClick={() => { setProfileNameDraft(data.faculty.name); setEditingProfile(true); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-indigo-500">
              Edit profile
            </button>
          )}
        </section>
        {/* Metrics Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AnimatedContent className="portal-animated-content h-full" distance={36} duration={0.85} scale={0.96} threshold={0.1}>
            <div className="portal-card h-full bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Classes This Week</span>
              <div className="text-2xl font-bold text-white mt-2">{data.stats.total_classes}</div>
              <p className="text-[11px] text-slate-500 mt-1">Assigned weekly class sessions</p>
            </div>
          </AnimatedContent>
          <AnimatedContent className="portal-animated-content h-full" distance={36} duration={0.85} scale={0.96} threshold={0.1} delay={0.08}>
            <div className="portal-card h-full bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Classes Today</span>
              <div className="text-2xl font-bold text-white mt-2">{data.stats.today_classes}</div>
              <p className="text-[11px] text-slate-500 mt-1">From your weekly timetable</p>
            </div>
          </AnimatedContent>
          <AnimatedContent className="portal-animated-content h-full" distance={36} duration={0.85} scale={0.96} threshold={0.1} delay={0.16}>
            <div className="portal-card h-full bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Roll Calls Recorded Today</span>
              <div className="text-2xl font-bold text-amber-400 mt-2">
                {data.stats.completed_classes} / {data.stats.today_classes}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Completed class attendance sheets</p>
            </div>
          </AnimatedContent>
          <AnimatedContent className="portal-animated-content h-full" distance={36} duration={0.85} scale={0.96} threshold={0.1} delay={0.24}>
            <div className="portal-card h-full bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl">
              <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Avg. Presence Rate</span>
              <div className="text-2xl font-bold text-indigo-400 mt-2">
                {data.stats.avg_attendance || "No records"}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Across your assigned classes</p>
            </div>
          </AnimatedContent>
        </section>

        {/* Schedule & Attendance Hub */}
        <section id="timetable" className="portal-card bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">Weekly Class Schedule</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Assigned instructor, day, time, room, enrollment, and attendance
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search course, instructor, day, room..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 sm:w-60"
              />
              <div className="flex bg-slate-950/60 p-1 rounded-lg border border-slate-800 text-xs">
                {[
                  ["all", "All week"],
                  ["today", "Today"],
                  ["needs-attendance", "Attendance due"],
                ].map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded font-medium transition ${
                      activeTab === tab
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/40 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-5">Day, Time & Duration</th>
                  <th className="py-3.5 px-5">Course & Code</th>
                  <th className="py-3.5 px-5">Faculty Assigned</th>
                  <th className="py-3.5 px-5">Room & Batch</th>
                  <th className="py-3.5 px-5">Enrolled</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredLectures.length > 0 ? (
                  filteredLectures.map((lec) => (
                    <tr key={lec.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="font-semibold text-indigo-300">
                          {lec.day_name}{lec.is_today ? " · Today" : ""}
                        </div>
                        <div className="font-semibold text-slate-100">
                          {lec.formatted_start} – {lec.formatted_end}
                        </div>
                        <span className="text-[10px] text-slate-500">{lec.duration} slot</span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-semibold text-slate-200">{lec.course_name}</div>
                        <span className="text-[10px] font-mono text-indigo-400">{lec.course_code}</span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-medium text-slate-200">{lec.faculty_name}</div>
                        <span className="text-[10px] text-slate-400">{lec.faculty_email}</span>
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                          {lec.room}
                        </span>
                        <span className="ml-2 text-slate-400">{lec.section}</span>
                      </td>
                      <td className="py-4 px-5 font-mono text-slate-300">
                        {lec.enrolled_count} {lec.enrolled_count === 1 ? "student" : "students"}
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                            lec.attendance_submitted
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : lec.is_today
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              lec.attendance_submitted
                                ? "bg-emerald-400"
                                : lec.is_today
                                  ? "bg-amber-400"
                                  : "bg-slate-500"
                            }`}
                          />
                          {lec.attendance_submitted
                            ? `Recorded ${lec.attendance_recorded_count}/${lec.enrolled_count} today`
                            : lec.is_today
                              ? "Attendance due today"
                              : "Weekly session"}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Historical presence: {lec.attendance_rate || "No records"}
                        </div>
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <button
                          onClick={() => openAttendanceModal(lec)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            lec.attendance_submitted
                              ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30"
                          }`}
                        >
                          {lec.attendance_submitted ? "Edit attendance" : "Record attendance"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500 font-mono text-xs">
                      No schedule entries found matching current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          id="grades"
          className="portal-card scroll-mt-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Class Gradebook</h2>
              <p className="mt-1 text-sm text-slate-400">
                Create assessments and enter scores for students in your assigned classes.
              </p>
            </div>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Class
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                disabled={!assignedClasses.length}
                className="min-w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {assignedClasses.map((lecture) => (
                  <option key={lecture.class_id} value={lecture.class_id}>
                    {lecture.course_code} · Section {lecture.section}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {gradeError && (
            <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-300">
              {gradeError}
            </p>
          )}
          {gradeMessage && (
            <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-300">
              {gradeMessage}
            </p>
          )}

          {assignedClasses.length === 0 ? (
            <p className="text-sm text-slate-400">No assigned classes are available for grading.</p>
          ) : (
            <>
              <form
                onSubmit={handleCreateAssessment}
                className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 md:grid-cols-[minmax(12rem,1fr)_9rem_12rem_auto]"
              >
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Assessment title
                  <input
                    required
                    maxLength={150}
                    value={gradeForm.title}
                    onChange={(event) =>
                      setGradeForm({ ...gradeForm, title: event.target.value })
                    }
                    placeholder="Quiz 1"
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Maximum score
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={gradeForm.max_score}
                    onChange={(event) =>
                      setGradeForm({ ...gradeForm, max_score: event.target.value })
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Due date
                  <input
                    type="date"
                    value={gradeForm.due_date}
                    onChange={(event) =>
                      setGradeForm({ ...gradeForm, due_date: event.target.value })
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  />
                </label>
                <button
                  type="submit"
                  disabled={gradeLoading || gradeSavingId === "new"}
                  className="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {gradeSavingId === "new" ? "Creating..." : "Create assessment"}
                </button>
              </form>

              {gradeLoading ? (
                <p className="text-sm text-slate-400">Loading class gradebook…</p>
              ) : assessments.length ? (
                <div className="space-y-4">
                  {assessments.map((assessment) => (
                    <article
                      key={assessment.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-white">{assessment.title}</h3>
                          <p className="text-xs text-slate-400">
                            Maximum {assessment.max_score}
                            {assessment.due_date ? ` · Due ${assessment.due_date}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editingAssessmentId === assessment.id
                              ? (setEditingAssessmentId(""), setAssessmentDraft(null))
                              : beginAssessmentEdit(assessment)}
                            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200"
                          >
                            {editingAssessmentId === assessment.id ? "Cancel edit" : "Edit details"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveGrades(assessment)}
                            disabled={gradeSavingId === assessment.id || !gradeStudents.length}
                            className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
                          >
                            {gradeSavingId === assessment.id ? "Saving..." : "Save scores"}
                          </button>
                        </div>
                      </div>
                      {editingAssessmentId === assessment.id && assessmentDraft && (
                        <form onSubmit={handleAssessmentUpdate} className="mb-4 grid gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3 sm:grid-cols-[1fr_8rem_12rem_auto]">
                          <label className="text-[10px] text-slate-400">Assessment title
                            <input required maxLength={150} value={assessmentDraft.title} onChange={(event) => setAssessmentDraft({ ...assessmentDraft, title: event.target.value })} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white" />
                          </label>
                          <label className="text-[10px] text-slate-400">Maximum score
                            <input required type="number" min="0.01" step="0.01" value={assessmentDraft.max_score} onChange={(event) => setAssessmentDraft({ ...assessmentDraft, max_score: event.target.value })} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white" />
                          </label>
                          <label className="text-[10px] text-slate-400">Due date
                            <input type="date" value={assessmentDraft.due_date} onChange={(event) => setAssessmentDraft({ ...assessmentDraft, due_date: event.target.value })} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white" />
                          </label>
                          <button type="submit" disabled={assessmentSaving} className="self-end rounded-md bg-indigo-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{assessmentSaving ? "Saving…" : "Save details"}</button>
                        </form>
                      )}
                      {gradeStudents.length ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {gradeStudents.map((student) => (
                            <label
                              key={student.student_id}
                              className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 px-3 py-2 text-sm"
                            >
                              <span className="text-slate-200">{student.name}</span>
                              <input
                                type="number"
                                min="0"
                                max={assessment.max_score}
                                step="0.01"
                                aria-label={`${assessment.title} score for ${student.name}`}
                                value={gradeDrafts[assessment.id]?.[student.student_id] ?? ""}
                                onChange={(event) =>
                                  setGradeDrafts((current) => ({
                                    ...current,
                                    [assessment.id]: {
                                      ...current[assessment.id],
                                      [student.student_id]: event.target.value,
                                    },
                                  }))
                                }
                                className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-right text-white"
                              />
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">No enrolled students in this class.</p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  No assessments yet. Create one above to start recording grades.
                </p>
              )}
            </>
          )}
        </section>

        <section
          id="materials"
          className="portal-card scroll-mt-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Course Materials</h2>
              <p className="mt-1 text-sm text-slate-400">
                Share resource links with students enrolled in your assigned class.
              </p>
            </div>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Class
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                disabled={!assignedClasses.length}
                className="min-w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {assignedClasses.map((lecture) => (
                  <option key={lecture.class_id} value={lecture.class_id}>
                    {lecture.course_code} · Section {lecture.section}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {materialsError && (
            <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-300">
              {materialsError}
            </p>
          )}

          {assignedClasses.length > 0 && (
            <form
              onSubmit={handleCreateMaterial}
              className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 md:grid-cols-2"
            >
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Resource title
                <input
                  required
                  maxLength={150}
                  value={materialForm.title}
                  onChange={(event) =>
                    setMaterialForm({ ...materialForm, title: event.target.value })
                  }
                  placeholder="Lecture slides — Week 1"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Resource URL
                <input
                  required
                  type="url"
                  maxLength={2048}
                  value={materialForm.url}
                  onChange={(event) =>
                    setMaterialForm({ ...materialForm, url: event.target.value })
                  }
                  placeholder="https://example.edu/resource"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400 md:col-span-2">
                Description (optional)
                <textarea
                  maxLength={2000}
                  rows={2}
                  value={materialForm.description}
                  onChange={(event) =>
                    setMaterialForm({ ...materialForm, description: event.target.value })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </label>
              <button
                type="submit"
                disabled={materialsSaving}
                className="justify-self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {materialsSaving ? "Saving..." : editingMaterialId ? "Save material changes" : "Share with class"}
              </button>
              {editingMaterialId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMaterialId("");
                    setMaterialForm({ title: "", url: "", description: "" });
                  }}
                  className="justify-self-start rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
                >
                  Cancel edit
                </button>
              )}
            </form>
          )}

          {!assignedClasses.length ? (
            <p className="text-sm text-slate-400">
              Materials will appear here when you are assigned a class.
            </p>
          ) : materialsLoading ? (
            <p className="text-sm text-slate-400">Loading class materials…</p>
          ) : materials.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {materials.map((material) => (
                <li
                  key={material.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                >
                  <div className="min-w-0">
                    <a
                      href={material.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-indigo-300 hover:text-indigo-200 hover:underline"
                    >
                      {material.title}
                    </a>
                    {material.description && (
                      <p className="mt-1 text-sm text-slate-400">{material.description}</p>
                    )}
                    <p className="mt-2 break-all text-xs text-slate-500">{material.url}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => beginMaterialEdit(material)}
                      className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-indigo-500"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMaterial(material)}
                      disabled={materialDeletingId === material.id}
                      className="rounded-lg border border-rose-500/20 px-2.5 py-1.5 text-xs text-rose-300 hover:border-rose-500 disabled:opacity-50"
                    >
                      {materialDeletingId === material.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">
              No resource links have been shared with this class yet.
            </p>
          )}
        </section>

        <section id="announcements" className="portal-card scroll-mt-28 bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">Campus announcements</h2>
            <p className="mt-1 text-xs text-slate-400">Updates published by campus administration</p>
          </div>
          <div className="divide-y divide-slate-800/70">
            {data.notices.map((notice) => (
              <article key={notice.id} className="p-5 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-slate-100">{notice.title}</h3>
                  <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[10px] text-indigo-200">
                    {notice.category || "General"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">{notice.content}</p>
                <p className="mt-3 text-[10px] text-slate-600">
                  {notice.author} · {notice.created_at ? new Date(notice.created_at).toLocaleDateString() : "Date unavailable"}
                </p>
              </article>
            ))}
            {data.notices.length === 0 && (
              <p className="p-8 text-center text-xs text-slate-500">No campus announcements have been published.</p>
            )}
          </div>
        </section>

        {/* Modal: Student Attendance */}
        {attendanceClass && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <form onSubmit={handleAttendanceSubmit}>
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Attendance: {attendanceClass.course_name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {attendanceClass.day_name} &bull; {attendanceClass.formatted_start}–
                      {attendanceClass.formatted_end} &bull; Room {attendanceClass.room} &bull;
                      {" "}Section {attendanceClass.section}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <label className="text-[10px] text-slate-400 mb-1">Session Date</label>
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) =>
                        setAttendanceDate(e.target.value || getLocalDateValue())
                      }
                      className="bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                </div>

              {actionError && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-mono">
                  {actionError}
                </div>
              )}

              {/* Roster student list */}
              {attendanceLoading ? (
                <div className="py-10 text-center text-violet-400 font-mono text-sm animate-pulse">
                  Fetching enrolled students from database...
                </div>
              ) : attendanceRoster.length > 0 ? (
                <>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAllAttendance("present")}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      Mark all present
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllAttendance("absent")}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      Mark all absent
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-3 pr-2 divide-y divide-slate-800/60">
                    {attendanceRoster.map((student) => (
                      <div
                        key={student.student_id}
                        className="pt-3 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{student.name}</p>
                          <span className="text-xs text-slate-400 font-mono">
                            ID: {student.student_id}
                          </span>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          {["present", "absent", "late", "excused"].map((status) => (
                            <button
                              type="button"
                              key={status}
                              onClick={() =>
                                setAttendanceStatuses((prev) => ({
                                  ...prev,
                                  [student.student_id]: status,
                                }))
                              }
                              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                                attendanceStatuses[student.student_id] === status
                                  ? status === "present"
                                    ? "bg-emerald-600 text-white"
                                    : status === "late"
                                      ? "bg-amber-600 text-white"
                                      : status === "absent"
                                        ? "bg-rose-600 text-white"
                                        : "bg-indigo-600 text-white"
                                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-slate-400 font-mono text-xs">
                  No students found in this roster.
                </div>
              )}

              {/* Modal action buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAttendanceClass(null)}
                  disabled={attendanceSaving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    attendanceSaving ||
                    attendanceLoading ||
                    attendanceRoster.length === 0 ||
                    attendanceRoster.some(
                      (student) =>
                        !["present", "absent", "late", "excused"].includes(
                          attendanceStatuses[student.student_id]
                        )
                    )
                  }
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition cursor-pointer disabled:opacity-50"
                >
                  {attendanceSaving ? "Saving..." : "Submit Attendance"}
                </button>
              </div>
            </form>
          </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}