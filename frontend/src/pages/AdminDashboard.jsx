import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Megaphone,
  Pencil,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { apiRequest } from "../api/client.js";
import AnimatedContent from "../components/AnimatedContent.jsx";
import PortalLayout from "../components/PortalLayout.jsx";

const panelClass =
  "portal-card rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-xl shadow-black/10";
const tableHeadClass =
  "border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500";
const cellClass = "border-b border-slate-800/60 px-4 py-3 text-xs text-slate-300";

function formatDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "Date not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Date not recorded"
    : parsed.toLocaleDateString(undefined, options);
}

function formatTime(value) {
  if (!value) return "Time not assigned";
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClass(status) {
  if (status === "present") return "bg-emerald-500/10 text-emerald-300";
  if (status === "late") return "bg-amber-500/10 text-amber-300";
  if (status === "excused") return "bg-sky-500/10 text-sky-300";
  return "bg-rose-500/10 text-rose-300";
}

function MetricCard({ icon: Icon, label, value, detail, accent, delay = 0 }) {
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>
            <p className={`mt-3 text-3xl font-semibold tracking-tight ${accent}`}>{value}</p>
          </div>
          <span className="rounded-xl border border-slate-700/70 bg-slate-800/70 p-2.5 text-slate-300">
            <Icon size={17} />
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{detail}</p>
      </article>
    </AnimatedContent>
  );
}

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [audit, setAudit] = useState([]);
  const [users, setUsers] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [notices, setNotices] = useState([]);
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    content: "",
    category: "General",
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingNotice, setSavingNotice] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [savingUserId, setSavingUserId] = useState("");
  const [attendanceDrafts, setAttendanceDrafts] = useState({});
  const [savingAttendanceId, setSavingAttendanceId] = useState("");
  const [editingTimetable, setEditingTimetable] = useState(null);
  const [savingTimetable, setSavingTimetable] = useState(false);
  const [editingCampus, setEditingCampus] = useState(false);
  const [campusNameDraft, setCampusNameDraft] = useState("");
  const [savingCampus, setSavingCampus] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [dashboardData, attendanceData, auditData, userData, timetableData, noticeData] =
        await Promise.all([
          apiRequest("/admin/dashboard"),
          apiRequest("/admin/attendance?scope=college&aggregate=average"),
          apiRequest("/admin/attendance/audit?limit=100"),
          apiRequest("/admin/users"),
          apiRequest("/admin/timetable"),
          apiRequest("/admin/notices"),
        ]);
      if (
        !Array.isArray(auditData) ||
        !Array.isArray(userData) ||
        !Array.isArray(timetableData) ||
        !Array.isArray(noticeData)
      ) {
        throw new Error("The admin dashboard returned an invalid list response.");
      }
      setDashboard(dashboardData);
      setAttendance(attendanceData);
      setAudit(auditData);
      setUsers(userData);
      setTimetable(timetableData);
      setNotices(noticeData);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load campus data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        [user.name, user.email, user.role, user.department]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
      ),
    [users, normalizedSearch],
  );
  const filteredAudit = useMemo(
    () =>
      audit.filter((record) =>
        [
          record.student_name,
          record.student_email,
          record.course_code,
          record.course,
          record.section,
          record.status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
      ),
    [audit, normalizedSearch],
  );
  const filteredTimetable = useMemo(
    () =>
      timetable.filter((meeting) =>
        [
          meeting.course_code,
          meeting.course,
          meeting.instructor,
          meeting.section,
          meeting.room,
          meeting.term,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
      ),
    [timetable, normalizedSearch],
  );

  const beginNoticeEdit = (notice) => {
    setEditingNoticeId(notice.id);
    setNoticeForm({
      title: notice.title,
      content: notice.content,
      category: notice.category || "General",
    });
    document.getElementById("announcement-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const saveCampus = async (event) => {
    event.preventDefault();
    setSavingCampus(true);
    setErrorMessage("");
    try {
      const updated = await apiRequest("/admin/campus", {
        method: "PUT",
        body: JSON.stringify({ name: campusNameDraft }),
      });
      setDashboard((current) => ({
        ...current,
        institution: { ...current.institution, name: updated.name },
      }));
      setEditingCampus(false);
      setSuccessMessage("Campus name updated.");
    } catch (error) {
      setErrorMessage(error.message || "Unable to update campus name.");
    } finally {
      setSavingCampus(false);
    }
  };

  const postNotice = async (event) => {
    event.preventDefault();
    setSavingNotice(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const notice = await apiRequest(
        editingNoticeId ? `/admin/notices/${editingNoticeId}` : "/admin/notices",
        {
        method: editingNoticeId ? "PUT" : "POST",
        body: JSON.stringify(noticeForm),
        },
      );
      setNotices((current) =>
        editingNoticeId
          ? current.map((item) => item.id === editingNoticeId ? { ...item, ...notice } : item)
          : [notice, ...current],
      );
      setNoticeForm({ title: "", content: "", category: "General" });
      setSuccessMessage(editingNoticeId ? "Announcement updated." : "Announcement published to the campus notice board.");
      setEditingNoticeId("");
    } catch (error) {
      setErrorMessage(error.message || "Unable to publish announcement.");
    } finally {
      setSavingNotice(false);
    }
  };

  const saveUser = async (event) => {
    event.preventDefault();
    if (!editingUser) return;
    setSavingUserId(editingUser.id);
    setErrorMessage("");
    try {
      const rawDept = editingUser.department_id;
      const department_id =
        rawDept && typeof rawDept === "string" && rawDept.trim() && rawDept !== "none" && rawDept !== "null"
          ? rawDept.trim()
          : null;
      const status = (editingUser.status || "active").toLowerCase().trim();

      const updated = await apiRequest(`/admin/users/${editingUser.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editingUser.name.trim(),
          status,
          department_id,
        }),
      });
      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
      setEditingUser(null);
      setSuccessMessage("Campus user updated.");
    } catch (error) {
      setErrorMessage(error.message || "Unable to update this campus user.");
    } finally {
      setSavingUserId("");
    }
  };

  const saveAttendanceStatus = async (record) => {
    const rawStatus = attendanceDrafts[record.id] || record.status;
    const status = (rawStatus || "present").toLowerCase().trim();
    setSavingAttendanceId(record.id);
    setErrorMessage("");
    try {
      await apiRequest(`/admin/attendance/${record.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setAudit((current) => current.map((item) => item.id === record.id ? { ...item, status } : item));
      setAttendanceDrafts((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      const attendanceData = await apiRequest("/admin/attendance?scope=college&aggregate=average");
      setAttendance(attendanceData);
      setSuccessMessage("Attendance record updated.");
    } catch (error) {
      setErrorMessage(error.message || "Unable to update this attendance record.");
    } finally {
      setSavingAttendanceId("");
    }
  };

  const beginTimetableEdit = (meeting) => {
    setEditingTimetable({
      rowIndex: timetable.indexOf(meeting),
      class_id: meeting.class_id,
      term: meeting.term || "",
      section: meeting.section || "",
      room: meeting.room || "",
      instructor_id: meeting.instructor_id,
      day_of_week: meeting.day_of_week ?? 0,
      starts_at: meeting.starts_at?.slice(0, 5) || "09:00",
      ends_at: meeting.ends_at?.slice(0, 5) || "10:00",
    });
  };

  const saveTimetable = async (event) => {
    event.preventDefault();
    if (!editingTimetable) return;
    setSavingTimetable(true);
    setErrorMessage("");
    try {
      const currentClassMeetings = timetable.filter(
        (meeting) => meeting.class_id === editingTimetable.class_id && meeting.day_of_week !== null,
      );
      const meetings = currentClassMeetings.map((meeting) => {
        const globalIndex = timetable.indexOf(meeting);
        return globalIndex === editingTimetable.rowIndex
          ? {
              day_of_week: Number(editingTimetable.day_of_week),
              starts_at: editingTimetable.starts_at,
              ends_at: editingTimetable.ends_at,
            }
          : {
              day_of_week: meeting.day_of_week,
              starts_at: meeting.starts_at,
              ends_at: meeting.ends_at,
            };
      });
      if (!meetings.length || currentClassMeetings.length === 0) {
        meetings.push({
          day_of_week: Number(editingTimetable.day_of_week),
          starts_at: editingTimetable.starts_at,
          ends_at: editingTimetable.ends_at,
        });
      }
      await apiRequest(`/admin/classes/${editingTimetable.class_id}`, {
        method: "PUT",
        body: JSON.stringify({
          term: editingTimetable.term,
          section: editingTimetable.section,
          room: editingTimetable.room || null,
          instructor_id: editingTimetable.instructor_id,
          meetings,
        }),
      });
      setEditingTimetable(null);
      await loadData();
      setSuccessMessage("Class details and timetable updated.");
    } catch (error) {
      setErrorMessage(error.message || "Unable to update this timetable entry.");
    } finally {
      setSavingTimetable(false);
    }
  };

  const deleteNotice = async (notice) => {
    if (!globalThis.confirm(`Delete "${notice.title}"?`)) return;
    setErrorMessage("");
    try {
      await apiRequest(`/admin/notices/${notice.id}`, { method: "DELETE" });
      setNotices((current) => current.filter((item) => item.id !== notice.id));
      setSuccessMessage("Announcement deleted.");
    } catch (error) {
      setErrorMessage(error.message || "Unable to delete this announcement.");
    }
  };

  if (loading && !dashboard) {
    return (
      <PortalLayout role="admin">
        <div className="mx-auto max-w-7xl animate-pulse py-12 text-sm text-slate-400">
          Loading live campus data…
        </div>
      </PortalLayout>
    );
  }

  const counts = attendance?.status_counts || {};
  const stats = dashboard?.stats || {};
  const institution = dashboard?.institution || {};
  const attendancePercentage =
    attendance?.record_count > 0 ? `${attendance.attendance_percentage}%` : "No records";

  return (
    <PortalLayout role="admin" term={institution.term} searchValue={search} onSearchChange={setSearch}>
      <div className="mx-auto max-w-7xl space-y-7">
        <section id="overview" className="scroll-mt-28">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-300">
                Campus overview
              </p>
              {editingCampus ? (
                <form onSubmit={saveCampus} className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="text-[10px] text-slate-400">Campus name
                    <input required maxLength={255} value={campusNameDraft} onChange={(event) => setCampusNameDraft(event.target.value)} className="mt-1 block min-w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-lg font-semibold text-white" />
                  </label>
                  <button type="submit" disabled={savingCampus} className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{savingCampus ? "Saving…" : "Save name"}</button>
                  <button type="button" onClick={() => setEditingCampus(false)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Cancel</button>
                </form>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {institution.name || "Campus administration"}
                  </h1>
                  <button type="button" onClick={() => { setCampusNameDraft(institution.name || ""); setEditingCampus(true); }} aria-label="Edit campus name" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-indigo-500">
                    <Pencil size={14} />
                  </button>
                </div>
              )}
              <p className="mt-2 text-xs text-slate-400">
                Live student, faculty, timetable, and attendance records from your campus.
              </p>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="w-fit rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-200 hover:border-indigo-500 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh campus data"}
            </button>
          </div>
        </section>

        {(errorMessage || successMessage) && (
          <div
            role={errorMessage ? "alert" : "status"}
            className={`rounded-xl border px-4 py-3 text-xs ${
              errorMessage
                ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {errorMessage || successMessage}
            {errorMessage && !dashboard && (
              <button type="button" onClick={loadData} className="ml-3 underline">
                Retry
              </button>
            )}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={GraduationCap}
            label="Active students"
            value={stats.total_students ?? "—"}
            detail="Current active campus accounts"
            accent="text-indigo-200"
            delay={0}
          />
          <MetricCard
            icon={Users}
            label="Active faculty"
            value={stats.total_faculty ?? "—"}
            detail="Current active faculty accounts"
            accent="text-cyan-200"
            delay={0.08}
          />
          <MetricCard
            icon={ClipboardCheck}
            label="Attendance average"
            value={attendancePercentage}
            detail={
              attendance?.record_count
                ? `${attendance.record_count} attendance records; excused records excluded`
                : "No attendance has been recorded"
            }
            accent="text-emerald-200"
            delay={0.16}
          />
          <MetricCard
            icon={Activity}
            label="Attendance records"
            value={attendance?.record_count ?? "—"}
            detail="Tenant-scoped database records"
            accent="text-amber-200"
            delay={0.24}
          />
        </section>

        <section id="attendance" className="scroll-mt-28 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <article className={`${panelClass} p-5 sm:p-6`}>
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-200">
                <ClipboardCheck size={18} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">Attendance breakdown</h2>
                <p className="mt-1 text-[11px] text-slate-500">All recorded student sessions</p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {[
                ["Present", counts.present ?? 0, "bg-emerald-400"],
                ["Late", counts.late ?? 0, "bg-amber-400"],
                ["Absent", counts.absent ?? 0, "bg-rose-400"],
                ["Excused", counts.excused ?? 0, "bg-sky-400"],
              ].map(([label, count, color]) => {
                const total = attendance?.record_count || 0;
                const percentage = total ? (Number(count) / total) * 100 : 0;
                return (
                  <div key={label}>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-slate-300">{label}</span>
                      <span className="font-medium text-slate-100">
                        {count}
                        {total ? ` · ${Math.round(percentage)}%` : ""}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex items-center gap-2 border-t border-slate-800 pt-4 text-[11px] text-slate-500">
              <CheckCircle2 size={14} className="text-emerald-300" />
              Average attendance: <span className="font-semibold text-slate-200">{attendancePercentage}</span>
            </div>
          </article>

          <article className={`${panelClass} overflow-hidden`}>
            <div className="flex flex-col justify-between gap-2 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:px-6">
              <div>
                <h2 className="text-sm font-semibold text-white">Attendance audit trail</h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  Latest {audit.length} student session records
                </p>
              </div>
              <span className="text-[10px] text-slate-500">Search filters this table</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className={tableHeadClass}>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Session date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Recorded</th>
                    <th className="px-4 py-3">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-800/30">
                      <td className={cellClass}>
                        <span className="block font-medium text-slate-100">{record.student_name}</span>
                        <span className="mt-1 block text-[10px] text-slate-500">{record.student_email}</span>
                      </td>
                      <td className={cellClass}>
                        <span className="font-medium text-slate-200">{record.course_code}</span>
                        <span className="mt-1 block text-[10px] text-slate-500">
                          Section {record.section || "not assigned"}
                        </span>
                      </td>
                      <td className={cellClass}>{formatDate(record.session_date)}</td>
                      <td className={cellClass}>
                        <select
                          aria-label={`Attendance status for ${record.student_name} on ${record.session_date}`}
                          value={attendanceDrafts[record.id] ?? record.status}
                          onChange={(event) => setAttendanceDrafts((current) => ({
                            ...current,
                            [record.id]: event.target.value,
                          }))}
                          className={`rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] capitalize ${statusClass(attendanceDrafts[record.id] ?? record.status)}`}
                        >
                          {["present", "late", "absent", "excused"].map((value) => <option key={value}>{value}</option>)}
                        </select>
                      </td>
                      <td className={cellClass}>{formatDate(record.recorded_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                      <td className={cellClass}>
                        <button
                          type="button"
                          onClick={() => saveAttendanceStatus(record)}
                          disabled={savingAttendanceId === record.id || (attendanceDrafts[record.id] ?? record.status) === record.status}
                          className="rounded-lg border border-indigo-500/30 px-2 py-1 text-[10px] text-indigo-200 disabled:opacity-40"
                        >
                          {savingAttendanceId === record.id ? "Saving…" : "Save"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAudit.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-4 py-10 text-center text-xs text-slate-500">
                        {audit.length ? "No attendance records match your search." : "No student attendance has been recorded yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section id="directory" className={`scroll-mt-28 ${panelClass} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-800 p-5 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-white">Campus directory</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                {filteredUsers.length} of {users.length} tenant users
              </p>
            </div>
            <Users size={17} className="text-slate-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px]">
              <thead>
                <tr className={tableHeadClass}>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Edit</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <React.Fragment key={user.id}>
                  <tr className="hover:bg-slate-800/30">
                    <td className={`${cellClass} font-medium text-slate-100`}>{user.name}</td>
                    <td className={cellClass}>{user.email}</td>
                    <td className={cellClass}>{user.department || "Not assigned"}</td>
                    <td className={`${cellClass} capitalize`}>{user.role.toLowerCase()}</td>
                    <td className={cellClass}>
                      <span className={`rounded-full px-2 py-1 text-[10px] capitalize ${user.status === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className={cellClass}>
                      <button
                        type="button"
                        onClick={() => setEditingUser({
                          id: user.id,
                          name: user.name,
                          status: (user.status || "active").toLowerCase(),
                          department_id: user.department_id || "",
                        })}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-indigo-500"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                  {editingUser?.id === user.id && (
                    <tr>
                      <td colSpan="6" className="border-b border-slate-800 p-3">
                        <form onSubmit={saveUser} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
                          <input
                            aria-label={`Edit name for ${user.email}`}
                            value={editingUser.name}
                            maxLength={150}
                            required
                            onChange={(event) => setEditingUser({ ...editingUser, name: event.target.value })}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                          />
                          <select
                            aria-label={`Edit department for ${user.email}`}
                            value={editingUser.department_id}
                            onChange={(event) => setEditingUser({ ...editingUser, department_id: event.target.value })}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                          >
                            <option value="">No department</option>
                            {(dashboard?.departments || []).map((department) => (
                              <option key={department.id} value={department.id}>{department.name}</option>
                            ))}
                          </select>
                          <select
                            aria-label={`Edit status for ${user.email}`}
                            value={editingUser.status}
                            onChange={(event) => setEditingUser({ ...editingUser, status: event.target.value })}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                          >
                            {["active", "inactive", "suspended"].map((value) => <option key={value}>{value}</option>)}
                          </select>
                          <button type="submit" disabled={savingUserId === user.id} className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                            {savingUserId === user.id ? "Saving…" : "Save"}
                          </button>
                          <button type="button" onClick={() => setEditingUser(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">
                            Cancel
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-xs text-slate-500">
                      No campus users match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="timetables" className={`scroll-mt-28 ${panelClass} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-800 p-5 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-white">Master timetable</h2>
              <p className="mt-1 text-[11px] text-slate-500">Scheduled classes and assigned instructors</p>
            </div>
            <CalendarDays size={17} className="text-slate-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className={tableHeadClass}>
                  <th className="px-4 py-3">Day</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Instructor</th>
                  <th className="px-4 py-3">Section / room</th>
                  <th className="px-4 py-3">Edit</th>
                </tr>
              </thead>
              <tbody>
                {filteredTimetable.map((meeting, index) => (
                  <tr key={`${meeting.class_id}-${meeting.day_of_week}-${meeting.starts_at}-${index}`} className="hover:bg-slate-800/30">
                    <td className={cellClass}>
                      {meeting.day_of_week === null ? "Not scheduled" : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][meeting.day_of_week]}
                    </td>
                    <td className={cellClass}>
                      {meeting.starts_at ? `${formatTime(meeting.starts_at)} – ${formatTime(meeting.ends_at)}` : "Not assigned"}
                    </td>
                    <td className={cellClass}>
                      <span className="font-medium text-slate-100">{meeting.course_code}</span>
                      <span className="mt-1 block text-[10px] text-slate-500">{meeting.course}</span>
                    </td>
                    <td className={cellClass}>{meeting.instructor}</td>
                    <td className={cellClass}>
                      {meeting.section || "—"} / {meeting.room || "Room not assigned"}
                    </td>
                    <td className={cellClass}>
                      <button
                        type="button"
                        onClick={() => beginTimetableEdit(meeting)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-indigo-500"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTimetable.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-xs text-slate-500">
                      No scheduled classes match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="announcements" className="scroll-mt-28 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <form id="announcement-form" onSubmit={postNotice} className={`${panelClass} space-y-4 p-5 sm:p-6`}>
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-200">
                <Megaphone size={18} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">{editingNoticeId ? "Edit announcement" : "Publish announcement"}</h2>
                <p className="mt-1 text-[11px] text-slate-500">Visible to campus portals</p>
              </div>
            </div>
            <label className="block text-[11px] text-slate-400">
              Title
              <input
                required
                maxLength="200"
                value={noticeForm.title}
                onChange={(event) => setNoticeForm({ ...noticeForm, title: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block text-[11px] text-slate-400">
              Announcement
              <textarea
                required
                maxLength="10000"
                rows="4"
                value={noticeForm.content}
                onChange={(event) => setNoticeForm({ ...noticeForm, content: event.target.value })}
                className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block text-[11px] text-slate-400">
              Category
              <select
                value={noticeForm.category}
                onChange={(event) => setNoticeForm({ ...noticeForm, category: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
              >
                {["General", "Academic", "Events", "Urgent"].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={savingNotice}
              className="w-full rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {savingNotice ? (editingNoticeId ? "Saving…" : "Publishing…") : (editingNoticeId ? "Save announcement" : "Publish announcement")}
            </button>
            {editingNoticeId && (
              <button
                type="button"
                onClick={() => {
                  setEditingNoticeId("");
                  setNoticeForm({ title: "", content: "", category: "General" });
                }}
                className="w-full rounded-xl border border-slate-700 px-4 py-2.5 text-xs text-slate-300"
              >
                Cancel edit
              </button>
            )}
          </form>

          <article className={`${panelClass} overflow-hidden`}>
            <div className="border-b border-slate-800 p-5 sm:px-6">
              <h2 className="text-sm font-semibold text-white">Campus announcements</h2>
              <p className="mt-1 text-[11px] text-slate-500">{notices.length} published notices</p>
            </div>
            <div className="divide-y divide-slate-800/70">
              {notices.slice(0, 8).map((notice) => (
                <div key={notice.id} className="p-5 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-slate-100">{notice.title}</h3>
                    <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-[9px] text-indigo-200">
                      {notice.category || "General"}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">{notice.content}</p>
                  <p className="mt-3 text-[10px] text-slate-600">
                    {notice.author || "Campus administration"} · {formatDate(notice.created_at)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => beginNoticeEdit(notice)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-200 hover:border-indigo-500"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNotice(notice)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/20 px-2.5 py-1.5 text-[10px] text-rose-200 hover:border-rose-500"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))}
              {notices.length === 0 && (
                <p className="p-8 text-center text-xs text-slate-500">No announcements have been published.</p>
              )}
            </div>
          </article>
        </section>

        {editingTimetable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
            <form onSubmit={saveTimetable} className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Edit class schedule</h2>
                  <p className="mt-1 text-xs text-slate-400">Changes are saved to the campus timetable.</p>
                </div>
                <button type="button" aria-label="Close schedule editor" onClick={() => setEditingTimetable(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
                  <X size={16} />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-400">Term
                  <input required maxLength={32} value={editingTimetable.term} onChange={(event) => setEditingTimetable({ ...editingTimetable, term: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                </label>
                <label className="text-xs text-slate-400">Section
                  <input required maxLength={16} value={editingTimetable.section} onChange={(event) => setEditingTimetable({ ...editingTimetable, section: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                </label>
                <label className="text-xs text-slate-400">Room
                  <input maxLength={64} value={editingTimetable.room} onChange={(event) => setEditingTimetable({ ...editingTimetable, room: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                </label>
                <label className="text-xs text-slate-400">Instructor
                  <select required value={editingTimetable.instructor_id} onChange={(event) => setEditingTimetable({ ...editingTimetable, instructor_id: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                    {users.filter((user) => user.role === "FACULTY" && user.status === "active").map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-400">Day
                  <select value={editingTimetable.day_of_week} onChange={(event) => setEditingTimetable({ ...editingTimetable, day_of_week: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, index) => <option key={day} value={index}>{day}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-400">Starts
                    <input required type="time" value={editingTimetable.starts_at} onChange={(event) => setEditingTimetable({ ...editingTimetable, starts_at: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                  </label>
                  <label className="text-xs text-slate-400">Ends
                    <input required type="time" value={editingTimetable.ends_at} onChange={(event) => setEditingTimetable({ ...editingTimetable, ends_at: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                  </label>
                </div>
              </div>
              {errorMessage && <p role="alert" className="text-xs text-rose-300">{errorMessage}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingTimetable(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300">Cancel</button>
                <button type="submit" disabled={savingTimetable} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  <Save size={14} /> {savingTimetable ? "Saving…" : "Save class"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
