import React, { useState, useEffect } from "react";

const API_URL = "http://localhost:8000/api/student";

// Fallback student dataset with internal marks and assessment details
const defaultStudentData = {
  student_profile: {
    name: "Rohan Varma",
    program: "B.Tech Aerospace & Spaceflight Systems",
    semester: "Semester 7",
    enrollment_status: "Active / Good Standing",
    advisory_batch: "2023 - 2027",
  },
  academic_progress: {
    cgpa: 9.71,
    cgpa_scale: 10.0,
    sgpa_current: 9.85,
    standing: "Dean's Honour List",
  },
  courses: [
    {
      code: "AE401",
      name: "Orbital Mechanics & Astrodynamics",
      credits: 4,
      attendance: "94%",
      ia1: 28.5,
      ia2: 29.0,
      assignment: 19.5, // out of 20
      internal_total: 48.0, // out of 50
      status: "Eligible for End-Sem",
    },
    {
      code: "AE405",
      name: "Hypersonic Propulsion Systems",
      credits: 4,
      attendance: "88%",
      ia1: 26.0,
      ia2: 27.5,
      assignment: 18.0,
      internal_total: 44.5,
      status: "Eligible for End-Sem",
    },
    {
      code: "AE412",
      name: "Spacecraft Structural Design",
      credits: 3,
      attendance: "91%",
      ia1: 27.0,
      ia2: 28.0,
      assignment: 19.0,
      internal_total: 46.0,
      status: "Eligible for End-Sem",
    },
    {
      code: "CS308",
      name: "Autonomous Guidance & Avionics",
      credits: 3,
      attendance: "85%",
      ia1: 25.0,
      ia2: 26.0,
      assignment: 17.5,
      internal_total: 42.5,
      status: "Eligible for End-Sem",
    },
    {
      code: "AE499",
      name: "Capstone Flight Simulation Lab",
      credits: 2,
      attendance: "96%",
      ia1: 29.0,
      ia2: 30.0,
      assignment: 20.0,
      internal_total: 49.0,
      status: "Eligible for End-Sem",
    },
  ],
  notice_board: [
    {
      id: 1,
      author: "Office of the Controller of Examinations",
      badge: "Exam Notice",
      title: "End-Semester Practical and Viva Examination Timetable Released",
      date: "Oct 12, 2026",
    },
    {
      id: 2,
      author: "Dean of Academic Affairs",
      badge: "IA Grievance",
      title:
        "IA-2 Mark Verification & Grievance Redressal Window open till Friday",
      date: "Oct 10, 2026",
    },
    {
      id: 3,
      author: "Aero & Robotics Club",
      badge: "Symposium",
      title: "Annual Mars Rover Propulsion Demonstration at Hall 302",
      date: "Oct 08, 2026",
    },
  ],
};

export default function StudentDashboard() {
  const [data, setData] = useState(defaultStudentData);
  const [loading, setLoading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    ...defaultStudentData.student_profile,
    ...defaultStudentData.academic_progress,
  });
  const [newNotice, setNewNotice] = useState({
    title: "",
    author: "Student Council",
    badge: "General",
  });

  const loadData = async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setProfileForm({ ...json.student_profile, ...json.academic_progress });
      }
    } catch (e) {
      console.warn("Backend offline, utilizing cached student demo state.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setData((prev) => ({
      ...prev,
      student_profile: {
        name: profileForm.name,
        program: profileForm.program,
        semester: profileForm.semester,
        enrollment_status: profileForm.enrollment_status,
        advisory_batch: profileForm.advisory_batch,
      },
      academic_progress: {
        cgpa: parseFloat(profileForm.cgpa) || 0,
        cgpa_scale: 10.0,
        sgpa_current: parseFloat(profileForm.sgpa_current) || 0,
        standing: profileForm.standing,
      },
    }));

    try {
      await fetch(`${API_URL}/dashboard`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_profile: {
            name: profileForm.name,
            program: profileForm.program,
            semester: profileForm.semester,
            enrollment_status: profileForm.enrollment_status,
            advisory_batch: profileForm.advisory_batch,
          },
          academic_progress: {
            cgpa: parseFloat(profileForm.cgpa) || 0,
            cgpa_scale: 10.0,
            sgpa_current: parseFloat(profileForm.sgpa_current) || 0,
            standing: profileForm.standing,
          },
        }),
      });
    } catch (err) {
      console.warn("Offline: updated student records locally.");
    }
    setIsEditingProfile(false);
  };

  const handlePostNotice = async (e) => {
    e.preventDefault();
    if (!newNotice.title) return;

    const noticeItem = {
      id: Date.now(),
      title: newNotice.title,
      author: newNotice.author,
      badge: newNotice.badge,
      date: "Just now",
    };

    setData((prev) => ({
      ...prev,
      notice_board: [noticeItem, ...prev.notice_board],
    }));

    try {
      await fetch(`${API_URL}/notices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newNotice),
      });
    } catch (err) {
      console.warn("Offline: posted notice locally.");
    }

    setNewNotice({ title: "", author: "Student Council", badge: "General" });
  };

  if (loading)
    return (
      <div className="p-10 text-violet-400 font-mono animate-pulse">
        Loading Academic Records...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 relative overflow-hidden font-sans">
      {/* Ambient Orb */}
      <div className="absolute top-[-5%] left-[-5%] w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-10 relative z-10">
        {/* Profile Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center shadow-2xl">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                {data.student_profile.name}
              </h1>
              <span className="bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs px-3 py-1 rounded-full font-semibold">
                {data.student_profile.enrollment_status}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-2">
              {data.student_profile.program} &bull;{" "}
              {data.student_profile.semester} &bull; Batch{" "}
              {data.student_profile.advisory_batch}
            </p>
          </div>
          <button
            onClick={() => setIsEditingProfile(!isEditingProfile)}
            className="mt-4 md:mt-0 px-5 py-2.5 rounded-xl border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 text-sm font-semibold transition transform hover:scale-105 cursor-pointer"
          >
            {isEditingProfile
              ? "Close Profile Editor"
              : "✎ Edit GPA & Standing"}
          </button>
        </div>

        {/* Profile Editor */}
        {isEditingProfile && (
          <form
            onSubmit={saveProfile}
            className="bg-slate-900/90 border border-violet-500/40 p-6 rounded-2xl space-y-4"
          >
            <h3 className="text-violet-400 font-bold text-sm">
              Update Academic Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-slate-400">Student Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, name: e.target.value })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">
                  Cumulative GPA (CGPA)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={profileForm.cgpa}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, cgpa: e.target.value })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Semester SGPA</label>
                <input
                  type="number"
                  step="0.01"
                  value={profileForm.sgpa_current}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      sgpa_current: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">
                  Academic Standing
                </label>
                <input
                  type="text"
                  value={profileForm.standing}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, standing: e.target.value })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-violet-600 rounded-lg text-sm font-bold text-white cursor-pointer hover:bg-violet-500"
              >
                Save Records
              </button>
            </div>
          </form>
        )}

        {/* GPA Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl hover:border-violet-500/50 transition duration-300 shadow-xl">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-mono">
              Cumulative GPA
            </span>
            <div className="text-3xl font-black text-violet-400 mt-3">
              {data.academic_progress.cgpa} / 10.0
            </div>
          </div>
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl hover:border-fuchsia-500/50 transition duration-300 shadow-xl">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-mono">
              Current SGPA
            </span>
            <div className="text-3xl font-black text-fuchsia-400 mt-3">
              {data.academic_progress.sgpa_current}
            </div>
          </div>
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl hover:border-emerald-500/50 transition duration-300 shadow-xl">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-mono">
              Academic Standing
            </span>
            <div className="text-3xl font-black text-emerald-400 mt-3">
              {data.academic_progress.standing}
            </div>
          </div>
        </div>

        {/* Courses & Internal Assessment Marks Table */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Internal Assessment (IA) & Progress Ledger
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluated against midterm test parameters and assignments
              </p>
            </div>
            <span className="text-xs font-mono bg-violet-950/80 border border-violet-800 text-violet-300 px-3 py-1 rounded-full">
              Scale: 50 Marks Internal
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/40 text-slate-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Code</th>
                  <th className="py-3 px-4">Course Name</th>
                  <th className="py-3 px-4">Credits</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4">IA-1 (/30)</th>
                  <th className="py-3 px-4">IA-2 (/30)</th>
                  <th className="py-3 px-4">IA Total (/50)</th>
                  <th className="py-3 px-4 text-right rounded-r-xl">
                    Exam Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.courses.map((course) => (
                  <tr
                    key={course.code}
                    className="hover:bg-slate-800/30 transition"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-violet-400">
                      {course.code}
                    </td>
                    <td className="py-3.5 px-4 text-white font-medium">
                      {course.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {course.credits}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-emerald-400 font-semibold">
                        {course.attendance}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-cyan-300">
                      {course.ia1}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-cyan-300">
                      {course.ia2}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-fuchsia-300">
                      {course.internal_total ||
                        (course.ia1 * 0.5 + course.ia2 * 0.5 + 15).toFixed(1)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-semibold">
                        {course.status || "Eligible"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Editable Campus Notice Board */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <h2 className="text-xl font-bold tracking-tight text-white">
            Interactive Campus Notice Board
          </h2>

          {/* Post New Notice Form */}
          <form
            onSubmit={handlePostNotice}
            className="bg-slate-800/40 border border-slate-700/60 p-4 rounded-2xl flex flex-col sm:flex-row gap-3"
          >
            <input
              type="text"
              placeholder="Notice title or announcement..."
              value={newNotice.title}
              onChange={(e) =>
                setNewNotice({ ...newNotice, title: e.target.value })
              }
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
            <input
              type="text"
              placeholder="Tag (e.g. Exam, Sports)"
              value={newNotice.badge}
              onChange={(e) =>
                setNewNotice({ ...newNotice, badge: e.target.value })
              }
              className="w-36 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
            <button
              type="submit"
              className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition cursor-pointer"
            >
              Publish Notice
            </button>
          </form>

          {/* Notice List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.notice_board.map((notice) => (
              <div
                key={notice.id}
                className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-violet-400">
                    {notice.author}
                  </span>
                  <span className="bg-violet-950/80 text-violet-300 border border-violet-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {notice.badge}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white">
                  {notice.title}
                </h4>
                <p className="text-xs text-slate-500 font-mono">
                  {notice.date}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
