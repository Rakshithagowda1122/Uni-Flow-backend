import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  // Simulated live telemetry state
  const [telemetry, setTelemetry] = useState({
    activeTerminals: 1420,
    syncLatency: 14,
    dbStatus: "OPTIMAL (Multi-RLS)",
    currentGate: "GATE 03-ALPHA",
  });

  // Minor telemetry jitter for realistic live-system feel
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        syncLatency: Math.floor(12 + Math.random() * 5),
        activeTerminals: prev.activeTerminals + (Math.random() > 0.5 ? 1 : -1),
      }));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col justify-between selection:bg-cyan-400 selection:text-black font-mono relative overflow-hidden">
      {/* ========================================================= */}
      {/* 1. AEROSPACE SCANLINES & MATRIX GRID BACKGROUND          */}
      {/* ========================================================= */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,255,247,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(18,255,247,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="fixed inset-0 pointer-events-none opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
      <div className="fixed -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-cyan-500/10 blur-[140px] pointer-events-none rounded-full" />

      {/* ========================================================= */}
      {/* 2. REAL-TIME TELEMETRY TICKER BAR                         */}
      {/* ========================================================= */}
      <div className="w-full bg-slate-950/80 border-b border-slate-800/80 px-4 py-1.5 text-[10px] flex items-center justify-between text-slate-400 backdrop-blur-md relative z-20">
        <div className="flex items-center gap-4 overflow-hidden">
          <span className="flex items-center gap-1.5 text-cyan-400 font-bold tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            UNIFLOW // LIVE TELEMETRY
          </span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline">
            DB NODE:{" "}
            <span className="text-emerald-400">{telemetry.dbStatus}</span>
          </span>
          <span className="hidden md:inline text-slate-600">|</span>
          <span className="hidden md:inline">
            ACTIVE SESSIONS:{" "}
            <span className="text-slate-200">{telemetry.activeTerminals}</span>
          </span>
          <span className="hidden lg:inline text-slate-600">|</span>
          <span className="hidden lg:inline">
            GATEWAY LATENCY:{" "}
            <span className="text-cyan-300">{telemetry.syncLatency}ms</span>
          </span>
        </div>
        <div className="text-right tracking-wider text-slate-500">
          NODE: CIT-CAMPUS-AP-01
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. FLIGHT DECK TOP NAVBAR                                */}
      {/* ========================================================= */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between relative z-20">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <div className="w-10 h-10 bg-cyan-950/60 border border-cyan-500/50 rounded-lg flex items-center justify-center font-black text-cyan-400 text-sm shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            UF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-widest text-white">
                UNIFLOW
              </span>
              <span className="text-[9px] px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 rounded font-semibold">
                SYSTEM OS
              </span>
            </div>
            <p className="text-[9px] text-slate-500 tracking-wider">
              CAMPUS BOARDING & MULTI-TENANT OS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white rounded-lg text-xs font-semibold tracking-wider transition-colors cursor-pointer"
          >
            TERMINAL ACCESS
          </button>
          <button
            onClick={() => navigate("/login")}
            className="px-5 py-2 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 rounded-lg text-xs font-black tracking-wider shadow-lg shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            ENTER PORTAL <span className="text-sm font-bold">→</span>
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 4. HERO SECTION                                          */}
      {/* ========================================================= */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex flex-col items-center text-center relative z-10">
        {/* Radar Orbit Visual Badge */}
        <div className="relative mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-xs text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>
              CENTRAL INSTITUTE OF TECHNOLOGY // AUTONOMOUS BOARDING GATE
            </span>
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* DISTINCT HEADLINE: ORBITRON FONT + EXCLUSIVE ANIMATION   */}
        {/* --------------------------------------------------------- */}
        <div className="relative my-4 select-none w-full max-w-5xl">
          <h1
            style={{ fontFamily: "'Orbitron', sans-serif" }}
            className="text-3xl sm:text-5xl md:text-6xl font-black tracking-wider uppercase text-white leading-tight"
          >
            {/* Top Primary Headline */}
            <span className="block drop-shadow-[0_0_20px_rgba(6,182,212,0.35)]">
              NEXT-GEN AIRSPACE ACADEMIA
            </span>

            {/* Exclusive Holographic Sweep & Glow Line */}
            <span className="relative inline-block mt-3 font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-teal-300 tracking-[0.18em] sm:tracking-[0.22em] text-xl sm:text-3xl md:text-4xl">
              ORBITAL CAMPUS CONTROL MATRIX
              {/* Laser scanner animation limited to this line */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent animate-[pulse_2.2s_cubic-bezier(0.4,0,0.6,1)_infinite] pointer-events-none mix-blend-screen" />
              {/* Glowing bottom indicator bar */}
              <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />
            </span>
          </h1>
        </div>

        <p className="mt-6 text-sm sm:text-base text-slate-400 max-w-2xl font-sans leading-relaxed">
          UniFlow replaces legacy administrative silos with a single terminal
          architecture. Access student academic standing, faculty course
          modules, and registrar multi-tenant infrastructure instantly.
        </p>

        {/* Action Controls */}
        <div className="mt-10 flex flex-wrap gap-4 justify-center items-center">
          <button
            onClick={() => navigate("/login")}
            className="group relative px-8 py-3.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black rounded-xl text-xs tracking-widest uppercase transition-all duration-200 shadow-[0_0_30px_rgba(6,182,212,0.4)] active:scale-95 cursor-pointer flex items-center gap-2 overflow-hidden"
          >
            <span className="relative z-10">BOARD TERMINAL NOW</span>
            <span className="relative z-10 text-sm transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
            {/* Shimmer sweep effect */}
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
          </button>

          <button
            onClick={() => {
              const el = document.getElementById("modules");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="px-6 py-3.5 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold tracking-wider transition-colors cursor-pointer"
          >
            INSPECT MODULES [03]
          </button>
        </div>

        {/* ========================================================= */}
        {/* 5. INTERACTIVE 3-TIER ROLE MODULE DOCKS                   */}
        {/* ========================================================= */}
        <div
          id="modules"
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left"
        >
          {/* Card 1: Student / Scholar Portal */}
          <div
            onClick={() => navigate("/login")}
            className="group relative p-6 bg-slate-950/70 border border-slate-800 rounded-2xl hover:border-cyan-400 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-1"
          >
            {/* Target corner reticles */}
            <div className="absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 border-cyan-400/40 group-hover:border-cyan-400 transition-colors" />
            <div className="absolute top-2 right-2 w-2 h-2 border-t-2 border-r-2 border-cyan-400/40 group-hover:border-cyan-400 transition-colors" />
            <div className="absolute bottom-2 left-2 w-2 h-2 border-b-2 border-l-2 border-cyan-400/40 group-hover:border-cyan-400 transition-colors" />
            <div className="absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 border-cyan-400/40 group-hover:border-cyan-400 transition-colors" />

            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-400/20 px-2 py-0.5 rounded font-mono">
                DECK 01 // SCHOLAR
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                GATE 3B
              </span>
            </div>

            <h3 className="text-base font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
              Scholar Passholder
            </h3>
            <p className="text-xs text-slate-400 font-sans leading-relaxed mb-6">
              Instant access to cumulative CGPA tracking, term marksheet PDFs,
              and live daily attendance percentage records.
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[10px] text-slate-500 group-hover:text-cyan-400 transition-colors font-mono">
              <span>LAUNCH SCHOLAR DASHBOARD</span>
              <span>→</span>
            </div>
          </div>

          {/* Card 2: Faculty Management */}
          <div
            onClick={() => navigate("/login")}
            className="group relative p-6 bg-slate-950/70 border border-slate-800 rounded-2xl hover:border-blue-400 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1"
          >
            <div className="absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 border-blue-400/40 group-hover:border-blue-400 transition-colors" />
            <div className="absolute top-2 right-2 w-2 h-2 border-t-2 border-r-2 border-blue-400/40 group-hover:border-blue-400 transition-colors" />
            <div className="absolute bottom-2 left-2 w-2 h-2 border-b-2 border-l-2 border-blue-400/40 group-hover:border-blue-400 transition-colors" />
            <div className="absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 border-blue-400/40 group-hover:border-blue-400 transition-colors" />

            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] bg-blue-500/10 text-blue-300 border border-blue-400/20 px-2 py-0.5 rounded font-mono">
                DECK 02 // FACULTY
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                GATE 12C
              </span>
            </div>

            <h3 className="text-base font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
              Faculty Instructor
            </h3>
            <p className="text-xs text-slate-400 font-sans leading-relaxed mb-6">
              Record classroom attendance with real-time updates, modify marks,
              review course schedules, and manage student rosters.
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[10px] text-slate-500 group-hover:text-blue-400 transition-colors font-mono">
              <span>LAUNCH FACULTY DASHBOARD</span>
              <span>→</span>
            </div>
          </div>

          {/* Card 3: Registrar Administrator */}
          <div
            onClick={() => navigate("/login")}
            className="group relative p-6 bg-slate-950/70 border border-slate-800 rounded-2xl hover:border-indigo-400 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1"
          >
            <div className="absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 border-indigo-400/40 group-hover:border-indigo-400 transition-colors" />
            <div className="absolute top-2 right-2 w-2 h-2 border-t-2 border-r-2 border-indigo-400/40 group-hover:border-indigo-400 transition-colors" />
            <div className="absolute bottom-2 left-2 w-2 h-2 border-b-2 border-l-2 border-indigo-400/40 group-hover:border-indigo-400 transition-colors" />
            <div className="absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 border-indigo-400/40 group-hover:border-indigo-400 transition-colors" />

            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-400/20 px-2 py-0.5 rounded font-mono">
                DECK 03 // REGISTRAR
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                GATE ADM
              </span>
            </div>

            <h3 className="text-base font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
              Registrar Multi-Tenant
            </h3>
            <p className="text-xs text-slate-400 font-sans leading-relaxed mb-6">
              Campus-wide tenant governance, PostgreSQL multi-RLS policies,
              department quotas, and user lifecycle administration.
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[10px] text-slate-500 group-hover:text-indigo-400 transition-colors font-mono">
              <span>LAUNCH ADMIN DASHBOARD</span>
              <span>→</span>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================= */}
      {/* 6. SYSTEM FOOTER                                          */}
      {/* ========================================================= */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 gap-4 relative z-10">
        <div>
          <span>UNIFLOW PLATFORM // CIT CENTRAL AUTONOMOUS REPOSITORY</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            FASTAPI LIVE
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            POSTGRESQL MULTI-RLS
          </span>
          <span>BUILD 2026.10</span>
        </div>
      </footer>
    </div>
  );
}
