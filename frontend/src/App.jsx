import React, { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import LandingPage from "./pages/Landingpage.jsx";
import Login from "./pages/login.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import FacultyDashboard from "./pages/FacultyDashboard.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";

// Sequence order for pressing Enter
const pageSequence = ["/", "/login", "/admin", "/faculty", "/student"];

// Global keyboard listener to cycle pages on Enter key press
function EnterKeyNavigator() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        const currentIndex = pageSequence.indexOf(location.pathname);

        // If we are on one of the sequence pages and not yet at the last page
        if (currentIndex !== -1 && currentIndex < pageSequence.length - 1) {
          // Prevents form submit reloads from blocking the page transition
          event.preventDefault();
          navigate(pageSequence[currentIndex + 1]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [location.pathname, navigate]);

  return null;
}

// Guided Step-by-Step Flow Bar (shown across dashboards)
function StepProgressHeader() {
  const location = useLocation();
  const currentPath = location.pathname;

  // Don't show step wizard on Landing or Login
  if (currentPath === "/" || currentPath === "/login") return null;

  const steps = [
    { name: "1. Admin Portal", path: "/admin" },
    { name: "2. Faculty Portal", path: "/faculty" },
    { name: "3. Student Portal", path: "/student" },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="text-xs uppercase font-mono tracking-wider text-slate-400 hover:text-white transition"
        >
          ← Back to Home
        </Link>
        <span className="text-slate-700">|</span>
        <span className="font-bold text-sm text-indigo-400">
          Campus Demo Flow
        </span>
      </div>

      <div className="flex items-center gap-2">
        {steps.map((s) => {
          const active = currentPath === s.path;
          return (
            <Link
              key={s.path}
              to={s.path}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                active
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/50"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {s.name}
            </Link>
          );
        })}
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Listens for Enter and handles transitions */}
      <EnterKeyNavigator />

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <StepProgressHeader />
        <main className="flex-1">
          <Routes>
            {/* 1. Landing Page initially */}
            <Route path="/" element={<LandingPage />} />

            {/* 2. Login Page next */}
            <Route path="/login" element={<Login />} />

            {/* 3. Admin Dashboard next */}
            <Route path="/admin" element={<AdminDashboard />} />

            {/* 4. Faculty Dashboard next */}
            <Route path="/faculty" element={<FacultyDashboard />} />

            {/* 5. Student Dashboard next */}
            <Route path="/student" element={<StudentDashboard />} />

            {/* Fallback to landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
