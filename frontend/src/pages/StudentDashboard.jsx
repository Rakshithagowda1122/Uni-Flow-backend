import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Megaphone,
  Pencil,
  Save,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "../api/client.js";
import AnimatedContent from "../components/AnimatedContent.jsx";
import PortalLayout from "../components/PortalLayout.jsx";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const panelClass = "portal-card rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-xl shadow-black/10";

function formatTime(value) {
  if (!value) return "Time not assigned";
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return value;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "Date not assigned";
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? "Date not assigned"
    : parsed.toLocaleDateString(undefined, options);
}

function findNextClass(schedule) {
  const now = new Date();
  const today = (now.getDay() + 6) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = schedule
    .filter((item) => Number.isInteger(item.day_of_week) && item.starts_at)
    .map((item) => {
      const [hours, minutes] = item.starts_at.split(":").map(Number);
      const startMinutes = hours * 60 + minutes;
      let daysAway = (item.day_of_week - today + 7) % 7;
      if (daysAway === 0 && startMinutes <= currentMinutes) daysAway = 7;
      return { ...item, daysAway, startMinutes };
    })
    .sort((first, second) =>
      first.daysAway - second.daysAway || first.startMinutes - second.startMinutes,
    );
  return upcoming[0] || null;
}

function SummaryCard({ icon: Icon, label, value, detail, color, delay = 0 }) {
  return (
    <AnimatedContent
      className="portal-animated-content h-full"
      distance={36}
      duration={0.85}
      scale={0.96}
      threshold={0.1}
      delay={delay}
    >
      <article className={`${panelClass} h-full p-5`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            {label}
          </span>
          <span className={`rounded-xl bg-slate-800/80 p-2.5 ${color}`}>
            <Icon size={17} />
          </span>
        </div>
        <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</p>
        <p className="mt-2 text-[11px] text-slate-500">{detail}</p>
      </article>
    </AnimatedContent>
  );
}

export default function StudentDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [notices, setNotices] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [search, setSearch] = useState("");
  const [todayLabel, setTodayLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    setTodayLabel(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    );
    try {
      const [
        dashboardData,
        timetableData,
        markData,
        attendanceData,
        noticeData,
        materialData,
        calendarData,
      ] = await Promise.all([
        apiRequest("/student/dashboard"),
        apiRequest("/students/me/timetable"),
        apiRequest("/students/me/marks"),
        apiRequest("/students/me/attendance"),
        apiRequest("/students/notices"),
        apiRequest("/students/me/materials"),
        apiRequest("/students/academic-calendar"),
      ]);
      if (
        !dashboardData?.student_profile ||
        !Array.isArray(timetableData) ||
        !Array.isArray(markData?.marks) ||
        !Array.isArray(attendanceData) ||
        !Array.isArray(noticeData) ||
        !Array.isArray(materialData) ||
        !Array.isArray(calendarData)
      ) {
        throw new Error("The student dashboard returned an invalid response.");
      }
      setDashboard(dashboardData);
      setSchedule(timetableData);
      setMarks(markData.marks);
      setAttendance(attendanceData);
      setNotices(noticeData);
      setMaterials(materialData);
      setCalendar(calendarData);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load student records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  const uniqueCourses = useMemo(
    () => [...new Map(schedule.map((item) => [item.class_id, item])).values()],
    [schedule],
  );
  const eligibleAttendance = attendance.filter((record) => record.status !== "excused");
  const attendedCount = eligibleAttendance.filter((record) =>
    ["present", "late"].includes(record.status),
  ).length;
  const attendancePercent = eligibleAttendance.length
    ? Math.round((attendedCount * 100) / eligibleAttendance.length)
    : null;
  const nextClass = findNextClass(schedule);
  const term = [...new Set(schedule.map((item) => item.term).filter(Boolean))].join(", ");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredSchedule = schedule.filter((item) =>
    [item.course_code, item.course, item.instructor, item.section, item.room, WEEKDAYS[item.day_of_week]]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  );
  const filteredNotices = notices.filter((notice) =>
    [notice.title, notice.content, notice.author, notice.category]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  );
  const filteredMaterials = materials.filter((material) =>
    [material.title, material.course, material.course_code, material.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  );
  const latestNotice = notices[0];
  const initials = dashboard?.student_profile?.name
    ?.split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setErrorMessage("");
    try {
      const updated = await apiRequest("/students/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ full_name: profileNameDraft }),
      });
      setDashboard((current) => ({
        ...current,
        student_profile: { ...current.student_profile, name: updated.full_name },
      }));
      try {
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem("user", JSON.stringify({ ...storedUser, name: updated.full_name }));
      } catch {
        localStorage.removeItem("user");
      }
      setEditingProfile(false);
    } catch (error) {
      setErrorMessage(error.message || "Unable to update your student profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading && !dashboard) {
    return (
      <PortalLayout role="student">
        <div className="mx-auto max-w-7xl animate-pulse py-12 text-sm text-slate-400">
          Loading your academic records…
        </div>
      </PortalLayout>
    );
  }

  if (!dashboard) {
    return (
      <PortalLayout role="student">
        <div className="mx-auto max-w-xl rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
          <AlertCircle className="mx-auto text-rose-300" size={24} />
          <h1 className="mt-4 text-lg font-semibold text-white">Student data unavailable</h1>
          <p role="alert" className="mt-2 text-xs leading-5 text-rose-100/80">
            {errorMessage || "We could not load your student portal."}
          </p>
          <button
            type="button"
            onClick={loadData}
            className="mt-5 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400"
          >
            Retry loading
          </button>
        </div>
      </PortalLayout>
    );
  }

  const profile = dashboard.student_profile;
  const assessmentSummary = marks.length
    ? `${marks.length} assessment${marks.length === 1 ? "" : "s"} graded`
    : "No marks recorded yet";

  return (
    <PortalLayout role="student" term={term} searchValue={search} onSearchChange={setSearch}>
      <div className="mx-auto max-w-7xl space-y-7">
        {errorMessage && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            <span>{errorMessage} Some sections may be out of date.</span>
            <button type="button" onClick={loadData} className="shrink-0 font-semibold underline">Retry</button>
          </div>
        )}

        <section id="overview" className="scroll-mt-28">
          <div className="student-hero relative isolate overflow-hidden rounded-[1.75rem] border border-indigo-400/20 bg-slate-950/70 px-5 py-7 shadow-2xl shadow-indigo-950/20 sm:px-8 sm:py-9">
            <div className="student-hero__mesh" aria-hidden="true" />
            <div className="relative z-10 flex flex-col justify-between gap-8 lg:min-h-52 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/[0.08] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-indigo-200">
                  <Sparkles size={13} className="student-hero__sparkle" />
                  Your learning space
                </p>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Welcome, <span className="student-hero__name">{profile.name}</span>
                </h1>
                <p className="mt-3 text-xs text-slate-300/80">
                  {profile.program || "Department not assigned"}
                  {profile.semester && profile.semester !== "Semester not assigned"
                    ? ` · ${profile.semester}`
                    : ""}
                  {profile.email ? ` · ${profile.email}` : ""}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <a
                    href="#timetable"
                    className="group inline-flex items-center gap-2 rounded-xl bg-indigo-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-indigo-300"
                  >
                    Explore my schedule
                    <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                  <span className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    {profile.enrollment_status} · {todayLabel}
                  </span>
                  <button
                    type="button"
                    onClick={loadData}
                    disabled={loading}
                    aria-label="Refresh student dashboard"
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] text-slate-300 transition hover:border-indigo-300/40 hover:text-white disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
                {editingProfile ? (
                  <form onSubmit={handleProfileSave} className="mt-5 flex flex-wrap items-end gap-2">
                    <label className="text-[10px] text-slate-400">Display name
                      <input required maxLength={150} value={profileNameDraft} onChange={(event) => setProfileNameDraft(event.target.value)} className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
                    </label>
                    <button type="submit" disabled={profileSaving} className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                      <Save size={13} /> {profileSaving ? "Saving…" : "Save profile"}
                    </button>
                    <button type="button" onClick={() => setEditingProfile(false)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Cancel</button>
                  </form>
                ) : (
                  <button type="button" onClick={() => { setProfileNameDraft(profile.name); setEditingProfile(true); }} className="mt-4 inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[10px] text-slate-300 transition hover:border-indigo-300/50 hover:text-white">
                    <Pencil size={12} /> Edit profile
                  </button>
                )}
              </div>
              <div className="student-hero__orbit relative hidden h-52 w-52 shrink-0 items-center justify-center lg:flex" aria-hidden="true">
                <div className="student-hero__orbit-ring student-hero__orbit-ring--outer" />
                <div className="student-hero__orbit-ring student-hero__orbit-ring--inner" />
                <span className="student-hero__orbit-dot student-hero__orbit-dot--one" />
                <span className="student-hero__orbit-dot student-hero__orbit-dot--two" />
                <span className="student-hero__orbit-dot student-hero__orbit-dot--three" />
                <div className="student-hero__avatar relative z-10 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/15 bg-gradient-to-br from-indigo-400 via-violet-500 to-cyan-400 text-3xl font-semibold text-white shadow-2xl shadow-indigo-500/30">
                  {initials || "ST"}
                </div>
                <Sparkles size={18} className="student-hero__orbit-star student-hero__orbit-star--one absolute right-5 top-8 text-cyan-200" />
                <Sparkles size={13} className="student-hero__orbit-star student-hero__orbit-star--two absolute bottom-8 left-7 text-violet-200" />
              </div>
            </div>
            <span className="student-hero__edge-glow" aria-hidden="true" />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={ClipboardCheck}
            label="Attendance"
            value={attendancePercent === null ? "No records" : `${attendancePercent}%`}
            detail={
              eligibleAttendance.length
                ? `${attendedCount} present or late of ${eligibleAttendance.length} non-excused sessions`
                : "No attendance records have been submitted"
            }
            color="text-emerald-200"
            delay={0}
          />
          <SummaryCard
            icon={BookOpen}
            label="Enrolled courses"
            value={uniqueCourses.length}
            detail={uniqueCourses.length ? "Active enrolled classes" : "No active classes assigned"}
            color="text-indigo-200"
            delay={0.08}
          />
          <SummaryCard
            icon={GraduationCap}
            label="Assessments"
            value={marks.length}
            detail={assessmentSummary}
            color="text-cyan-200"
            delay={0.16}
          />
          <SummaryCard
            icon={CalendarDays}
            label="Next class"
            value={nextClass ? formatTime(nextClass.starts_at) : "Not scheduled"}
            detail={
              nextClass
                ? `${nextClass.daysAway === 0 ? "Today" : nextClass.daysAway === 1 ? "Tomorrow" : WEEKDAYS[nextClass.day_of_week]} · ${nextClass.course_code}`
                : "No upcoming timetable entries"
            }
            color="text-amber-200"
            delay={0.24}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.5fr_0.8fr]">
          <article id="attendance" className={`${panelClass} scroll-mt-28 p-5 sm:p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Attendance snapshot</h2>
                <p className="mt-1 text-[11px] text-slate-500">Calculated from your recorded class attendance</p>
              </div>
              <span className="text-xs font-medium text-slate-300">
                {eligibleAttendance.length ? `${eligibleAttendance.length} sessions` : "No records"}
              </span>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-[150px_1fr] sm:items-center">
              <div
                className="mx-auto flex h-36 w-36 items-center justify-center rounded-full"
                style={{
                  background:
                    attendancePercent === null
                      ? "conic-gradient(#1e293b 0deg 360deg)"
                      : `conic-gradient(#818cf8 ${attendancePercent * 3.6}deg, #1e293b 0deg 360deg)`,
                }}
                role="img"
                aria-label={attendancePercent === null ? "No attendance data" : `Attendance ${attendancePercent} percent`}
              >
                <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[#0c1222]">
                  <span className="text-2xl font-semibold text-white">
                    {attendancePercent === null ? "—" : `${attendancePercent}%`}
                  </span>
                  <span className="mt-1 text-[9px] uppercase tracking-wider text-slate-500">Attendance</span>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  ["Present", attendance.filter((record) => record.status === "present").length, "bg-emerald-400"],
                  ["Late", attendance.filter((record) => record.status === "late").length, "bg-amber-400"],
                  ["Absent", attendance.filter((record) => record.status === "absent").length, "bg-rose-400"],
                  ["Excused", attendance.filter((record) => record.status === "excused").length, "bg-sky-400"],
                ].map(([label, count, color]) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-400">
                      <span className={`h-2 w-2 rounded-full ${color}`} />
                      {label}
                    </span>
                    <span className="font-medium text-slate-200">{count}</span>
                  </div>
                ))}
                <p className="border-t border-slate-800 pt-3 text-[10px] leading-4 text-slate-500">
                  Excused sessions are not included in the attendance percentage.
                </p>
              </div>
            </div>
          </article>

          <article className={`${panelClass} relative overflow-hidden p-5 sm:p-6`}>
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <span className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-200">
                <Clock3 size={18} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">Upcoming class</h2>
                <p className="mt-1 text-[11px] text-slate-500">From your enrolled timetable</p>
              </div>
            </div>
            {nextClass ? (
              <div className="relative mt-6">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
                  {nextClass.daysAway === 0 ? "Today" : nextClass.daysAway === 1 ? "Tomorrow" : WEEKDAYS[nextClass.day_of_week]}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">{nextClass.course}</h3>
                <p className="mt-1 text-xs text-slate-400">{nextClass.course_code} · Section {nextClass.section || "not assigned"}</p>
                <div className="mt-5 space-y-2 border-t border-slate-800 pt-4 text-xs text-slate-300">
                  <p className="flex items-center gap-2"><Clock3 size={14} className="text-indigo-300" />{formatTime(nextClass.starts_at)} – {formatTime(nextClass.ends_at)}</p>
                  <p className="flex items-center gap-2"><CalendarDays size={14} className="text-indigo-300" />{WEEKDAYS[nextClass.day_of_week]}</p>
                  <p className="flex items-center gap-2"><GraduationCap size={14} className="text-indigo-300" />{nextClass.instructor}</p>
                  <p className="flex items-center gap-2"><BookOpen size={14} className="text-indigo-300" />{nextClass.room || "Room not assigned"}</p>
                </div>
              </div>
            ) : (
              <p className="relative mt-8 rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">
                Your upcoming class will appear here when a class schedule is assigned.
              </p>
            )}
          </article>
        </section>

        {latestNotice && (
          <section className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.07] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-indigo-500/15 p-2.5 text-indigo-200">
                <Megaphone size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-indigo-300">Latest campus announcement</p>
                <h2 className="mt-2 text-sm font-semibold text-white">{latestNotice.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{latestNotice.content}</p>
                <p className="mt-3 text-[10px] text-slate-500">
                  {latestNotice.author} · {formatDate(latestNotice.created_at)}
                </p>
              </div>
              <a href="#announcements" aria-label="See all announcements" className="rounded-lg p-2 text-indigo-200 hover:bg-indigo-500/10">
                <ArrowUpRight size={16} />
              </a>
            </div>
          </section>
        )}

        <section id="grades" className={`scroll-mt-28 ${panelClass} overflow-hidden`}>
          <div className="flex flex-col justify-between gap-2 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-white">Grades & assessments</h2>
              <p className="mt-1 text-[11px] text-slate-500">Recorded assessment scores returned by your course instructors</p>
            </div>
            <span className="text-[10px] text-slate-500">Academic averages are not stored in the grade records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Assessment</th>
                  <th className="px-5 py-3">Course</th>
                  <th className="px-5 py-3">Score</th>
                  <th className="px-5 py-3">Max score</th>
                  <th className="px-5 py-3">Assessment date</th>
                </tr>
              </thead>
              <tbody>
                {marks.map((mark) => (
                  <tr key={mark.test_id} className="border-b border-slate-800/60 text-xs hover:bg-slate-800/30">
                    <td className="px-5 py-3 font-medium text-slate-100">{mark.title}</td>
                    <td className="px-5 py-3 text-slate-300">{mark.course_code} · {mark.course}</td>
                    <td className="px-5 py-3 font-semibold text-indigo-200">{mark.score}</td>
                    <td className="px-5 py-3 text-slate-400">{mark.max_score}</td>
                    <td className="px-5 py-3 text-slate-400">{formatDate(mark.due_date)}</td>
                  </tr>
                ))}
                {marks.length === 0 && (
                  <tr><td colSpan="5" className="px-5 py-10 text-center text-xs text-slate-500">No assessment marks have been published.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="timetable" className={`scroll-mt-28 ${panelClass} overflow-hidden`}>
          <div className="border-b border-slate-800 p-5 sm:px-6">
            <h2 className="text-sm font-semibold text-white">Class timetable</h2>
            <p className="mt-1 text-[11px] text-slate-500">Your active enrollment schedule, instructor, and room</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Day</th>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Course</th>
                  <th className="px-5 py-3">Instructor</th>
                  <th className="px-5 py-3">Section / room</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedule.map((item, index) => (
                  <tr key={`${item.class_id}-${item.day_of_week}-${item.starts_at}-${index}`} className="border-b border-slate-800/60 text-xs hover:bg-slate-800/30">
                    <td className="px-5 py-3 text-slate-300">{Number.isInteger(item.day_of_week) ? WEEKDAYS[item.day_of_week] : "Not scheduled"}</td>
                    <td className="px-5 py-3 text-slate-300">{item.starts_at ? `${formatTime(item.starts_at)} – ${formatTime(item.ends_at)}` : "Time not assigned"}</td>
                    <td className="px-5 py-3"><span className="font-medium text-slate-100">{item.course_code}</span><span className="mt-1 block text-[10px] text-slate-500">{item.course}</span></td>
                    <td className="px-5 py-3 text-slate-300">{item.instructor}</td>
                    <td className="px-5 py-3 text-slate-300">{item.section || "—"} / {item.room || "Room not assigned"}</td>
                  </tr>
                ))}
                {filteredSchedule.length === 0 && (
                  <tr><td colSpan="5" className="px-5 py-10 text-center text-xs text-slate-500">{schedule.length ? "No timetable entries match your search." : "No timetable entries are available for your active enrollments."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <article id="materials" className={`scroll-mt-28 ${panelClass} overflow-hidden`}>
            <div className="border-b border-slate-800 p-5 sm:px-6">
              <h2 className="text-sm font-semibold text-white">Course materials</h2>
              <p className="mt-1 text-[11px] text-slate-500">Links shared with your enrolled classes</p>
            </div>
            <div className="divide-y divide-slate-800/70">
              {filteredMaterials.map((material) => (
                <div key={material.id} className="flex items-center justify-between gap-4 p-5 sm:px-6">
                  <div className="min-w-0">
                    <h3 className="truncate text-xs font-semibold text-slate-100">{material.title}</h3>
                    <p className="mt-1 text-[10px] text-slate-500">{material.course_code} · {material.course}</p>
                    {material.description && <p className="mt-2 text-xs text-slate-400">{material.description}</p>}
                  </div>
                  <a
                    href={material.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-medium text-indigo-200 hover:border-indigo-500"
                  >
                    Open link <ArrowUpRight size={13} />
                  </a>
                </div>
              ))}
              {filteredMaterials.length === 0 && (
                <p className="p-8 text-center text-xs text-slate-500">
                  {materials.length ? "No materials match your search." : "No course materials have been shared with your classes yet."}
                </p>
              )}
            </div>
          </article>

          <article id="announcements" className={`scroll-mt-28 ${panelClass} overflow-hidden`}>
            <div className="border-b border-slate-800 p-5 sm:px-6">
              <h2 className="text-sm font-semibold text-white">Announcements & calendar</h2>
              <p className="mt-1 text-[11px] text-slate-500">Campus notices, exams, and holidays</p>
            </div>
            <div className="max-h-[420px] divide-y divide-slate-800/70 overflow-y-auto">
              {filteredNotices.map((notice) => (
                <div key={notice.id} className="p-5 sm:px-6">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-slate-100">{notice.title}</h3>
                    <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-[9px] text-indigo-200">{notice.category || "General"}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">{notice.content}</p>
                  <p className="mt-2 text-[10px] text-slate-600">{notice.author} · {formatDate(notice.created_at)}</p>
                </div>
              ))}
              {filteredNotices.length === 0 && <p className="p-6 text-xs text-slate-500">{notices.length ? "No announcements match your search." : "No campus announcements."}</p>}
              {calendar.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 p-5 sm:px-6">
                  <span className="rounded-lg bg-amber-500/10 p-2 text-amber-200"><CalendarDays size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-xs font-medium text-slate-200">{entry.title}</h3>
                    <p className="mt-1 text-[10px] capitalize text-slate-500">{entry.event_type} · {formatDate(entry.starts_on)}</p>
                  </div>
                  <CheckCircle2 size={14} className="text-slate-600" />
                </div>
              ))}
              {calendar.length === 0 && notices.length === 0 && (
                <p className="p-6 text-xs text-slate-500">No calendar events have been published.</p>
              )}
            </div>
          </article>
        </section>

        <section id="profile" className="scroll-mt-28 border-t border-slate-800/70 pt-5 text-[10px] text-slate-600">
          Student profile · {profile.name} · {profile.email} · {profile.program || "Department not assigned"}
        </section>
      </div>
    </PortalLayout>
  );
}
