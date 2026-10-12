import React, { useState, useEffect } from "react";

const API_URL = "http://localhost:8000/api/admin";

// Fallback data when backend is not running
const defaultAdminData = {
  institution: {
    name: "UniFlow Central Institute of Technology",
    term: "Fall Semester 2026",
    system_status: "Operational",
  },
  stats: {
    total_students: 4280,
    total_faculty: 312,
    overall_campus_occupancy: "94.2%",
    pending_administrative_approvals: 18,
  },
  departments: [
    {
      code: "CSE",
      name: "Computer Science & Engineering",
      students: 1240,
      faculty: 78,
    },
    {
      code: "AERO",
      name: "Aerospace & Astronautics",
      students: 620,
      faculty: 45,
    },
    {
      code: "ROBO",
      name: "Robotics & Autonomous Systems",
      students: 540,
      faculty: 38,
    },
    {
      code: "ECE",
      name: "Electronics & Communication",
      students: 980,
      faculty: 64,
    },
    {
      code: "AI",
      name: "Artificial Intelligence & Data Science",
      students: 900,
      faculty: 57,
    },
  ],
};

export default function AdminDashboard() {
  const [data, setData] = useState(defaultAdminData);
  const [loading, setLoading] = useState(false);
  const [isEditingMetrics, setIsEditingMetrics] = useState(false);
  const [isEditingDepts, setIsEditingDepts] = useState(false);
  const [metricsForm, setMetricsForm] = useState({
    ...defaultAdminData.stats,
    ...defaultAdminData.institution,
  });
  const [departmentsForm, setDepartmentsForm] = useState(
    defaultAdminData.departments,
  );
  const [newDept, setNewDept] = useState({
    code: "",
    name: "",
    students: 0,
    faculty: 0,
  });

  const loadData = async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setMetricsForm({ ...json.stats, ...json.institution });
        setDepartmentsForm(json.departments || defaultAdminData.departments);
      }
    } catch (e) {
      console.warn("Backend offline, utilizing cached admin demo state.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveMetrics = async (e) => {
    e.preventDefault();
    setData((prev) => ({
      ...prev,
      institution: {
        name: metricsForm.name,
        term: metricsForm.term,
        system_status: metricsForm.system_status,
      },
      stats: {
        total_students: parseInt(metricsForm.total_students) || 0,
        total_faculty: parseInt(metricsForm.total_faculty) || 0,
        overall_campus_occupancy: metricsForm.overall_campus_occupancy,
        pending_administrative_approvals:
          parseInt(metricsForm.pending_administrative_approvals) || 0,
      },
    }));

    try {
      await fetch(`${API_URL}/dashboard`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution: {
            name: metricsForm.name,
            term: metricsForm.term,
            system_status: metricsForm.system_status,
          },
          stats: {
            total_students: parseInt(metricsForm.total_students) || 0,
            total_faculty: parseInt(metricsForm.total_faculty) || 0,
            overall_campus_occupancy: metricsForm.overall_campus_occupancy,
            pending_administrative_approvals:
              parseInt(metricsForm.pending_administrative_approvals) || 0,
          },
        }),
      });
    } catch (err) {
      console.warn("Offline: updated admin metrics locally.");
    }
    setIsEditingMetrics(false);
  };

  const saveDepartments = async (e) => {
    e.preventDefault();
    setData((prev) => ({
      ...prev,
      departments: departmentsForm,
    }));

    try {
      await fetch(`${API_URL}/dashboard`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departments: departmentsForm }),
      });
    } catch (err) {
      console.warn("Offline: updated departments locally.");
    }
    setIsEditingDepts(false);
  };

  const addDepartment = (e) => {
    e.preventDefault();
    if (!newDept.code) return;
    const updated = [
      ...departmentsForm,
      {
        ...newDept,
        students: Number(newDept.students),
        faculty: Number(newDept.faculty),
      },
    ];
    setDepartmentsForm(updated);
    setData((prev) => ({ ...prev, departments: updated }));
    setNewDept({ code: "", name: "", students: 0, faculty: 0 });
  };

  if (loading)
    return (
      <div className="p-10 text-emerald-400 font-mono animate-pulse">
        Loading Institutional Mesh...
      </div>
    );

  return (
    <div className="min-h-screen bg-neutral-950 text-slate-100 p-6 md:p-12 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[300px] bg-emerald-500/10 blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-10 relative z-10">
        {/* Banner */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-900/40 p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center shadow-2xl">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                {data.institution.name}
              </h1>
            </div>
            <p className="text-emerald-400/80 text-sm mt-1">
              {data.institution.term} &bull; Status:{" "}
              {data.institution.system_status}
            </p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <button
              onClick={() => setIsEditingMetrics(!isEditingMetrics)}
              className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 rounded-xl text-sm font-semibold transition"
            >
              {isEditingMetrics ? "Close Editor" : "✎ Edit All Metrics"}
            </button>
            <button
              onClick={() => setIsEditingDepts(!isEditingDepts)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition"
            >
              {isEditingDepts ? "Close Depts" : "Manage Departments"}
            </button>
          </div>
        </div>

        {/* Edit Institutional Metrics Drawer */}
        {isEditingMetrics && (
          <form
            onSubmit={saveMetrics}
            className="bg-slate-900/95 border border-emerald-500/40 p-6 rounded-2xl space-y-4"
          >
            <h3 className="text-emerald-400 font-bold text-sm">
              Update Institutional Counters
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-slate-400">Total Enrolled</label>
                <input
                  type="number"
                  value={metricsForm.total_students}
                  onChange={(e) =>
                    setMetricsForm({
                      ...metricsForm,
                      total_students: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Total Faculty</label>
                <input
                  type="number"
                  value={metricsForm.total_faculty}
                  onChange={(e) =>
                    setMetricsForm({
                      ...metricsForm,
                      total_faculty: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">
                  Campus Occupancy
                </label>
                <input
                  type="text"
                  value={metricsForm.overall_campus_occupancy}
                  onChange={(e) =>
                    setMetricsForm({
                      ...metricsForm,
                      overall_campus_occupancy: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">
                  Pending Approvals
                </label>
                <input
                  type="number"
                  value={metricsForm.pending_administrative_approvals}
                  onChange={(e) =>
                    setMetricsForm({
                      ...metricsForm,
                      pending_administrative_approvals: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white"
              >
                Save Numbers
              </button>
            </div>
          </form>
        )}

        {/* 4 Interactive Animated Metric Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:border-emerald-500 transition duration-300 hover:-translate-y-1">
            <span className="text-xs uppercase text-slate-400 tracking-wider">
              Total Enrolled
            </span>
            <div className="text-3xl font-extrabold text-emerald-400 mt-2">
              {data.stats.total_students}
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:border-cyan-500 transition duration-300 hover:-translate-y-1">
            <span className="text-xs uppercase text-slate-400 tracking-wider">
              Total Faculty
            </span>
            <div className="text-3xl font-extrabold text-cyan-400 mt-2">
              {data.stats.total_faculty}
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:border-amber-500 transition duration-300 hover:-translate-y-1">
            <span className="text-xs uppercase text-slate-400 tracking-wider">
              Campus Occupancy
            </span>
            <div className="text-3xl font-extrabold text-amber-400 mt-2">
              {data.stats.overall_campus_occupancy}
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:border-rose-500 transition duration-300 hover:-translate-y-1">
            <span className="text-xs uppercase text-slate-400 tracking-wider">
              Pending Approvals
            </span>
            <div className="text-3xl font-extrabold text-rose-400 mt-2">
              {data.stats.pending_administrative_approvals}
            </div>
          </div>
        </div>

        {/* Department Management Panel */}
        {isEditingDepts && (
          <div className="bg-slate-900/90 border border-slate-700 p-6 rounded-3xl space-y-6">
            <h3 className="text-lg font-bold text-slate-200">
              Department Roster Editor
            </h3>
            <div className="space-y-3">
              {departmentsForm.map((dept, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-4 gap-2 bg-slate-800/60 p-3 rounded-xl items-center"
                >
                  <input
                    type="text"
                    value={dept.code}
                    onChange={(e) => {
                      const updated = [...departmentsForm];
                      updated[idx].code = e.target.value;
                      setDepartmentsForm(updated);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={dept.name}
                    onChange={(e) => {
                      const updated = [...departmentsForm];
                      updated[idx].name = e.target.value;
                      setDepartmentsForm(updated);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={dept.students}
                    onChange={(e) => {
                      const updated = [...departmentsForm];
                      updated[idx].students = parseInt(e.target.value) || 0;
                      setDepartmentsForm(updated);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={dept.faculty}
                    onChange={(e) => {
                      const updated = [...departmentsForm];
                      updated[idx].faculty = parseInt(e.target.value) || 0;
                      setDepartmentsForm(updated);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                  />
                </div>
              ))}
            </div>

            {/* Add New Dept Form */}
            <form
              onSubmit={addDepartment}
              className="grid grid-cols-5 gap-2 pt-2 border-t border-slate-800"
            >
              <input
                placeholder="Code (e.g. AI)"
                value={newDept.code}
                onChange={(e) =>
                  setNewDept({ ...newDept, code: e.target.value })
                }
                className="bg-slate-800 rounded p-2 text-xs text-white"
              />
              <input
                placeholder="Department Name"
                value={newDept.name}
                onChange={(e) =>
                  setNewDept({ ...newDept, name: e.target.value })
                }
                className="bg-slate-800 rounded p-2 text-xs text-white"
              />
              <input
                type="number"
                placeholder="Students"
                value={newDept.students}
                onChange={(e) =>
                  setNewDept({ ...newDept, students: e.target.value })
                }
                className="bg-slate-800 rounded p-2 text-xs text-white"
              />
              <input
                type="number"
                placeholder="Faculty"
                value={newDept.faculty}
                onChange={(e) =>
                  setNewDept({ ...newDept, faculty: e.target.value })
                }
                className="bg-slate-800 rounded p-2 text-xs text-white"
              />
              <button
                type="submit"
                className="bg-emerald-600 rounded text-xs font-bold text-white px-3"
              >
                Add Row
              </button>
            </form>
            <div className="flex justify-end">
              <button
                onClick={saveDepartments}
                className="px-5 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white"
              >
                Save All Departments
              </button>
            </div>
          </div>
        )}

        {/* Academic Departments Table */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold tracking-tight mb-6">
            Academic Departments
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/40 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Department Name</th>
                  <th className="py-3 px-4">Enrolled Students</th>
                  <th className="py-3 px-4">Active Faculty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.departments.map((dept) => (
                  <tr key={dept.code} className="hover:bg-slate-800/30">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      {dept.code}
                    </td>
                    <td className="py-3.5 px-4 text-white font-medium">
                      {dept.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {dept.students}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {dept.faculty}
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
