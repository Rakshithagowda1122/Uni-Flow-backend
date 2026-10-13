import React, { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { apiRequest, clearClientSession } from "./api/client.js";
import LandingPage from "./pages/Landingpage.jsx";
import Login from "./pages/login.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import FacultyDashboard from "./pages/FacultyDashboard.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";

const ROLE_PATHS = {
  admin: "/admin",
  faculty: "/faculty",
  student: "/student",
};

function parseStoredUser(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function ProtectedPortal({ role, children }) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const verifySession = useCallback(async () => {
    document.documentElement.classList.add("session-checking");
    setChecking(true);

    const storedUser = parseStoredUser(localStorage.getItem("user"));
    if (!storedUser || typeof storedUser.role !== "string") {
      clearClientSession();
      setAuthorized(false);
      navigate("/login", { replace: true });
      setChecking(false);
      document.documentElement.classList.remove("session-checking");
      return;
    }

    try {
      const session = await apiRequest("/auth/session");
      const sessionRole = session?.user?.role?.toLowerCase();
      if (!session?.authenticated || !ROLE_PATHS[sessionRole]) {
        throw new Error("The server returned an invalid session.");
      }

      if (sessionRole !== role) {
        setAuthorized(false);
        navigate(ROLE_PATHS[sessionRole], { replace: true });
        return;
      }

      setAuthorized(true);
    } catch {
      clearClientSession();
      setAuthorized(false);
      navigate("/login", { replace: true });
    } finally {
      setChecking(false);
      document.documentElement.classList.remove("session-checking");
    }
  }, [navigate, role]);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => {
      void verifySession();
    }, 0);

    const handleHistoryRestore = () => {
      void verifySession();
    };
    const handlePageShow = (event) => {
      if (event.persisted) handleHistoryRestore();
    };
    const handleSessionEnded = () => {
      setAuthorized(false);
      navigate("/login", { replace: true });
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handleHistoryRestore);
    window.addEventListener("uniflow:session-ended", handleSessionEnded);
    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handleHistoryRestore);
      window.removeEventListener("uniflow:session-ended", handleSessionEnded);
    };
  }, [location.pathname, navigate, verifySession]);

  if (checking || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        Verifying your session…
      </div>
    );
  }

  return children;
}

export default function App() {
  useEffect(() => {
    localStorage.removeItem("token");
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <ProtectedPortal role="admin">
                  <AdminDashboard />
                </ProtectedPortal>
              }
            />
            <Route
              path="/faculty"
              element={
                <ProtectedPortal role="faculty">
                  <FacultyDashboard />
                </ProtectedPortal>
              }
            />
            <Route
              path="/student"
              element={
                <ProtectedPortal role="student">
                  <StudentDashboard />
                </ProtectedPortal>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
