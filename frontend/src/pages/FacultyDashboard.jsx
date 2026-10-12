import React, { useState, useEffect } from "react";

const API_URL = "http://localhost:8000/api/faculty";

// Fallback data when backend is not running
const defaultFacultyData = {
  instructor: {
    name: "Dr. Vikram Malhotra",
    designation: "Professor & HOD",
    department: "Dept. of Aerospace Engineering",
    office: "Aero Block Lab 402",
  },
  stats: {
    lectures_remaining: "03 / 05",
    avg_attendance: "91.8%",
    student_inquiries: "14 Open",
  },
  lectures_today: [
    {
      id: 1,
      time: "09:00 - 10:30 AM",
      course: "Orbital Mechanics & Astrodynamics",
      room: "Hall 302",
      section: "Sec-A",
      students_count: 58,
      status: "Attendance Submitted",
    },
    {
      id: 2,
      time: "11:00 - 12:30 PM",
      course: "Hypersonic Propulsion Systems",
      room: "Lab 2B",
      section: "Sec-C",
      students_count: 42,
      status: "Pending",
    },
    {
      id: 3,
      time: "02:00 - 03:30 PM",
      course: "Spacecraft Structural Design",
      room: "Design Studio 4",
      section: "Sec-A",
      students_count: 51,
      status: "Pending",
    },
  ],
};

export default function FacultyDashboard() {
  const [data, setData] = useState(defaultFacultyData);
  const [loading, setLoading] = useState(false);
  const [editingStats, setEditingStats] = useState(false);
  const [editingLecture, setEditingLecture] = useState(null);
  const [statsForm, setStatsForm] = useState(defaultFacultyData.stats);

  const loadData = async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setStatsForm(json.stats || defaultFacultyData.stats);
      }
    } catch (e) {
      console.warn("Backend offline, utilizing cached faculty demo state.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveStats = async (e) => {
    e.preventDefault();
    setData((prev) => ({
      ...prev,
      stats: { ...statsForm },
    }));
    try {
      await fetch(`${API_URL}/dashboard`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats: statsForm }),
      });
    } catch (err) {
      console.warn("Offline: updated stats locally.");
    }
    setEditingStats(false);
  };

  const saveLecture = async (e) => {
    e.preventDefault();
    setData((prev) => ({
      ...prev,
      lectures_today: prev.lectures_today.map((l) =>
        l.id === editingLecture.id ? { ...editingLecture } : l,
      ),
    }));
    try {
      await fetch(`${API_URL}/lectures/${editingLecture.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingLecture),
      });
    } catch (err) {
      console.warn("Offline: updated lecture locally.");
    }
    setEditingLecture(null);
  };

  const toggleStatus = async (lec) => {
    const updated =
      lec.status === "Attendance Submitted"
        ? "Pending"
        : "Attendance Submitted";

    setData((prev) => ({
      ...prev,
      lectures_today: prev.lectures_today.map((item) =>
        item.id === lec.id ? { ...item, status: updated } : item,
      ),
    }));

    try {
      await fetch(`${API_URL}/lectures/${lec.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lec, status: updated }),
      });
    } catch (err) {
      console.warn("Offline: toggled status locally.");
    }
  };

  if (loading)
    return (
      <div className="p-10 text-cyan-400 animate-pulse font-mono">
        Connecting Faculty Terminal...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 relative overflow-hidden">
      {/* Dynamic Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-10 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl transition hover:border-slate-700">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
                {data.instructor.name}
              </h1>
              <span className="bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs px-3 py-1 rounded-full font-semibold">
                {data.instructor.designation}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-2">
              {data.instructor.department} &bull; {data.instructor.office}
            </p>
          </div>
          <button
            onClick={() => setEditingStats(!editingStats)}
            className="mt-4 md:mt-0 px-5 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-sm font-semibold transition transform hover:scale-105 active:scale-95"
          >
            {editingStats ? "Close Stats Editor" : "✎ Edit Stats & Inquiries"}
          </button>
        </div>

        {/* Stats Editor Form */}
        {editingStats && (
          <form
            onSubmit={saveStats}
            className="bg-slate-900/90 border border-cyan-500/30 p-6 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300"
          >
            <h3 className="text-cyan-400 font-semibold text-sm uppercase tracking-wider">
              Update Faculty Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Lectures Remaining
                </label>
                <input
                  type="text"
                  value={statsForm.lectures_remaining}
                  onChange={(e) =>
                    setStatsForm({
                      ...statsForm,
                      lectures_remaining: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-2.5 text-sm text-cyan-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Average Attendance
                </label>
                <input
                  type="text"
                  value={statsForm.avg_attendance}
                  onChange={(e) =>
                    setStatsForm({
                      ...statsForm,
                      avg_attendance: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-2.5 text-sm text-emerald-300"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Student Inquiries
                </label>
                <input
                  type="text"
                  value={statsForm.student_inquiries}
                  onChange={(e) =>
                    setStatsForm({
                      ...statsForm,
                      student_inquiries: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-2.5 text-sm text-amber-300"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition"
              >
                Save Metrics
              </button>
            </div>
          </form>
        )}

        {/* Telemetry Stat Cards with Hover Lift */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="group bg-slate-900/40 border border-slate-800 hover:border-cyan-500/50 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1.5 shadow-xl">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-mono">
              Lectures Remaining
            </span>
            <div className="text-3xl font-black text-cyan-400 mt-3 group-hover:scale-105 transition-transform">
              {data.stats.lectures_remaining}
            </div>
          </div>
          <div className="group bg-slate-900/40 border border-slate-800 hover:border-emerald-500/50 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1.5 shadow-xl">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-mono">
              Average Attendance
            </span>
            <div className="text-3xl font-black text-emerald-400 mt-3 group-hover:scale-105 transition-transform">
              {data.stats.avg_attendance}
            </div>
          </div>
          <div className="group bg-slate-900/40 border border-slate-800 hover:border-amber-500/50 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1.5 shadow-xl">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-mono">
              Student Inquiries
            </span>
            <div className="text-3xl font-black text-amber-400 mt-3 group-hover:scale-105 transition-transform">
              {data.stats.student_inquiries}
            </div>
          </div>
        </div>

        {/* Schedule Editor Modal */}
        {editingLecture && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <form
              onSubmit={saveLecture}
              className="bg-slate-900 border border-cyan-500/40 p-6 rounded-2xl max-w-lg w-full space-y-4"
            >
              <h3 className="text-lg font-bold text-cyan-300">
                Edit Class: {editingLecture.course}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Time Slot</label>
                  <input
                    type="text"
                    value={editingLecture.time}
                    onChange={(e) =>
                      setEditingLecture({
                        ...editingLecture,
                        time: e.target.value,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">
                    Course Subject
                  </label>
                  <input
                    type="text"
                    value={editingLecture.course}
                    onChange={(e) =>
                      setEditingLecture({
                        ...editingLecture,
                        course: e.target.value,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Room</label>
                  <input
                    type="text"
                    value={editingLecture.room}
                    onChange={(e) =>
                      setEditingLecture({
                        ...editingLecture,
                        room: e.target.value,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Section</label>
                  <input
                    type="text"
                    value={editingLecture.section}
                    onChange={(e) =>
                      setEditingLecture({
                        ...editingLecture,
                        section: e.target.value,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingLecture(null)}
                  className="px-4 py-2 bg-slate-800 rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 rounded text-sm font-bold text-white"
                >
                  Save Slot
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Schedule List */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-200">
              Today's Class Schedule
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Live Sync: Active
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/40 text-slate-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-4 px-4 rounded-l-xl">Time</th>
                  <th className="py-4 px-4">Course</th>
                  <th className="py-4 px-4">Room & Sec</th>
                  <th className="py-4 px-4">Enrolled</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4 text-right rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.lectures_today.map((lec) => (
                  <tr key={lec.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4 font-mono text-cyan-400 text-xs">
                      {lec.time}
                    </td>
                    <td className="py-4 px-4 font-semibold text-white">
                      {lec.course}
                    </td>
                    <td className="py-4 px-4 text-slate-300">
                      {lec.room} &bull; {lec.section}
                    </td>
                    <td className="py-4 px-4 text-slate-400">
                      {lec.students_count}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          lec.status === "Attendance Submitted"
                            ? "bg-emerald-950/80 border border-emerald-800 text-emerald-400"
                            : "bg-amber-950/80 border border-amber-800 text-amber-400"
                        }`}
                      >
                        {lec.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        onClick={() => setEditingLecture(lec)}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3 py-1.5 rounded-lg border border-slate-700 transition"
                      >
                        Edit Slot
                      </button>
                      <button
                        onClick={() => toggleStatus(lec)}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition"
                      >
                        Toggle Status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
