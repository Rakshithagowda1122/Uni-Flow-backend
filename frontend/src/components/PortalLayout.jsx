import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Search,
  Users,
} from "lucide-react";
import { apiRequest, clearClientSession } from "../api/client.js";

const PORTAL_NAVIGATION = {
  admin: [
    { label: "Dashboard", href: "#overview", icon: LayoutDashboard },
    { label: "User Directory", href: "#directory", icon: Users },
    { label: "Campus Attendance", href: "#attendance", icon: ClipboardCheck },
    { label: "Master Timetables", href: "#timetables", icon: CalendarDays },
    { label: "Announcements", href: "#announcements", icon: Megaphone },
  ],
  faculty: [
    { label: "Dashboard", href: "#overview", icon: LayoutDashboard },
    { label: "Teaching Schedule", href: "#timetable", icon: CalendarDays },
    { label: "Gradebook", href: "#grades", icon: ChartNoAxesCombined },
    { label: "Course Materials", href: "#materials", icon: BookOpen },
    { label: "Announcements", href: "#announcements", icon: Megaphone },
  ],
  student: [
    { label: "Dashboard", href: "#overview", icon: LayoutDashboard },
    { label: "Attendance Hub", href: "#attendance", icon: ClipboardCheck },
    { label: "Class Timetable", href: "#timetable", icon: CalendarDays },
    { label: "Grades & CGPA", href: "#grades", icon: ChartNoAxesCombined },
    { label: "Announcements", href: "#announcements", icon: Megaphone },
    { label: "My Profile", href: "#profile", icon: Users },
  ],
};

const ROLE_LABELS = {
  admin: "College Admin",
  faculty: "Faculty Member",
  student: "Student Portal",
};

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

export default function PortalLayout({
  role,
  activeSection = "overview",
  term,
  searchValue = "",
  onSearchChange,
  children,
}) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const user = getStoredUser();
  const name = user.name || ROLE_LABELS[role];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    document.documentElement.classList.add("session-checking");
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch (error) {
      if (error.status !== 401) {
        sessionStorage.setItem(
          "uniflow_logout_error",
          `The server could not confirm logout: ${error.message} Please retry after reconnecting.`,
        );
      }
    } finally {
      clearClientSession();
      navigate("/login", { replace: true });
      document.documentElement.classList.remove("session-checking");
      setSigningOut(false);
    }
  };

  return (
    <div className="portal-shell min-h-screen bg-[#070b18] text-slate-100">
      <div className="portal-aurora" aria-hidden="true">
        <span className="portal-aurora__glow portal-aurora__glow--blue" />
        <span className="portal-aurora__glow portal-aurora__glow--violet" />
        <span className="portal-aurora__glow portal-aurora__glow--teal" />
      </div>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-800/80 bg-[#080c19] lg:flex">
        <Link to="/" className="flex h-[76px] items-center gap-3 border-b border-slate-800/80 px-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25">
            <GraduationCap size={22} />
          </span>
          <span>
            <span className="block text-lg font-bold tracking-tight text-white">UniFlow</span>
            <span className="block text-[9px] font-semibold tracking-[0.18em] text-slate-500">
              CAMPUS MANAGEMENT
            </span>
          </span>
        </Link>

        <div className="mx-3 mt-5 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {ROLE_LABELS[role]}
          </span>
          <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-300">
            ACTIVE
          </span>
        </div>

        <nav className="mt-5 space-y-1 px-3" aria-label={`${ROLE_LABELS[role]} navigation`}>
          {PORTAL_NAVIGATION[role].map(({ label, href, icon: Icon }) => {
            const active = href === `#${activeSection}`;
            return (
              <a
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                }`}
              >
                <Icon size={16} />
                {label}
              </a>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-slate-800/80 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-200">
              {initials || "UF"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">{name}</span>
              <span className="block truncate text-[10px] text-slate-500">{user.email || ""}</span>
            </span>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              disabled={signingOut}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="portal-content lg:pl-60">
        <header className="sticky top-0 z-20 flex min-h-[76px] items-center gap-3 border-b border-slate-800/80 bg-[#080c19]/95 px-4 backdrop-blur-xl sm:px-7">
          {onSearchChange ? (
            <div className="relative hidden max-w-xl flex-1 md:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search subjects, schedules, notices..."
                aria-label="Search dashboard"
                className="w-full rounded-xl border border-slate-800 bg-[#101629] py-2.5 pl-10 pr-4 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-500/70"
              />
            </div>
          ) : (
            <div className="hidden flex-1 md:block" />
          )}
          <span className="ml-auto hidden items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-[11px] text-indigo-200 sm:flex">
            <CalendarDays size={14} />
            {term || "Academic term not set"}
          </span>
          <button
            type="button"
            onClick={() => document.getElementById("announcements")?.scrollIntoView({ behavior: "smooth" })}
            aria-label="View announcements"
            title="View announcements"
            className="relative rounded-xl border border-slate-800 bg-[#101629] p-2.5 text-slate-300 hover:text-white"
          >
            <Bell size={16} />
          </button>
          <div className="hidden items-center gap-2 border-l border-slate-800 pl-4 sm:flex">
            <span className="max-w-36 truncate text-right text-xs font-semibold text-slate-100">{name}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
              {initials || "UF"}
            </span>
          </div>
        </header>
        <div className="border-b border-slate-800/70 bg-[#080c19] px-4 py-2 lg:hidden">
          <nav className="flex gap-2 overflow-x-auto" aria-label="Dashboard navigation">
            {PORTAL_NAVIGATION[role].map(({ label, href }) => (
              <a key={href} href={href} className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-300">
                {label}
              </a>
            ))}
          </nav>
        </div>
        <main className="portal-dashboard-content min-h-[calc(100vh-76px)] px-4 py-6 sm:px-7 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
