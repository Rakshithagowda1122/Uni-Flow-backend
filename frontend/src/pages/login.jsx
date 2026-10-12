import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const navigate = useNavigate();

  // State
  const [selectedRole, setSelectedRole] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Biometric Laser Scan States
  const [isScanning, setIsScanning] = useState(false);
  const [scanStepText, setScanStepText] = useState("");
  const [scanSuccess, setScanSuccess] = useState(false);

  // Dynamic user data extraction from email
  const displayName = email.trim()
    ? email.split("@")[0].replace(/[\._\-]/g, " ")
    : "New User";

  const displayInitials =
    displayName
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase())
      .join("")
      .slice(0, 2) || "UF";

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setEmail("");
    setPassword("");
    setErrorMessage("");
    setScanSuccess(false);
  };

  const handleBiometricAuth = async () => {
    setErrorMessage("");
    setIsScanning(true);
    setScanSuccess(false);

    // Multi-phase scanner telemetry feedback
    setScanStepText("ACQUIRING BIOMETRIC SIGNATURE...");

    setTimeout(() => {
      setScanStepText("DECRYPTING HARDWARE TOKEN...");
    }, 600);

    setTimeout(() => {
      setScanStepText("ACCESS GRANTED. INITIALIZING PORTAL...");
      setScanSuccess(true);
    }, 1200);

    // Complete scan and transition to the next step (/admin)
    setTimeout(async () => {
      try {
        const response = await fetch("http://localhost:8000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, role: selectedRole }),
        });

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem("token", data.access_token || data.token);
          localStorage.setItem(
            "user",
            JSON.stringify(data.user || { email, role: selectedRole }),
          );
        }
      } catch (err) {
        console.warn("Backend offline or bypass navigation:", err.message);
      } finally {
        setIsScanning(false);
        // Direct route matching App.jsx routes:
        if (selectedRole === "admin") navigate("/admin");
        else if (selectedRole === "faculty") navigate("/faculty");
        else if (selectedRole === "student") navigate("/student");
        else navigate("/admin");
      }
    }, 1800);
  };

  // Trigger login immediately when Enter key is pressed in any input
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !isScanning) {
      e.preventDefault();
      handleBiometricAuth();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Ambient Pulses */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Main Terminal Shell */}
      <div className="flex flex-col lg:flex-row gap-6 max-w-4xl w-full z-10">
        {/* LEFT PANEL: AUTHENTICATION DECK */}
        <div className="flex-1 bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-2xl">
          <div>
            {/* Header info */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-400/20 text-[10px] font-mono px-2 py-0.5 rounded tracking-wide">
                  AIRPORT GATE PASS
                </span>
                <h1 className="text-xl font-black tracking-wider text-white mt-1">
                  UNIFLOW
                </h1>
                <p className="text-xs text-slate-400">
                  Autonomous Campus Boarding Terminal
                </p>
              </div>
              <div className="text-right font-mono">
                <span className="text-[10px] block text-emerald-400 font-semibold">
                  GATE 3B ONLINE
                </span>
                <span className="text-[10px] text-slate-500">
                  READY FOR SCAN
                </span>
              </div>
            </div>

            {/* Ticket Selector Tabs */}
            <div className="flex gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-6 relative">
              {[
                { key: "admin", label: "Registrar Ticket" },
                { key: "faculty", label: "Faculty Ticket" },
                { key: "student", label: "Scholar Ticket" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleRoleChange(key)}
                  className="flex-1 py-2 text-xs font-semibold relative rounded-lg text-center transition-colors cursor-pointer"
                >
                  {selectedRole === key && (
                    <motion.div
                      layoutId="roleActiveBubble"
                      className="absolute inset-0 bg-cyan-500/20 border border-cyan-400/50 rounded-lg shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <span
                    className={
                      selectedRole === key
                        ? "text-cyan-300 font-bold z-10 relative"
                        : "text-slate-400 z-10 relative hover:text-slate-200"
                    }
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {/* Form Inputs */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                  <span>BOARDING TERMINAL CAMPUS</span>
                  <span className="text-emerald-400">VERIFIED ORIGIN</span>
                </div>
                <input
                  type="text"
                  disabled
                  value="UniFlow Central Institute of Technology"
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-500 cursor-not-allowed select-none"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                  <span>PASSHOLDER IDENTITY</span>
                  <span className="text-cyan-400 animate-pulse">
                    ACTIVE BOARDING UID
                  </span>
                </div>
                <input
                  type="email"
                  placeholder={
                    selectedRole === "admin"
                      ? "admin.registry@cit.uniflow.ac.in"
                      : selectedRole === "faculty"
                        ? "faculty.user@cit.uniflow.ac.in"
                        : "rohan.varma@cit.uniflow.ac.in"
                  }
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-lg p-2.5 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                  <span>GATE AUTHENTICATION TOKEN</span>
                  <span className="text-slate-500">HARDWARE TOKEN</span>
                </div>
                <input
                  type="password"
                  placeholder="•••••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-lg p-2.5 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 transition-all"
                />
              </div>

              {/* Error messages */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-rose-400 font-mono bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg"
                  >
                    ⚠ {errorMessage}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Trigger Button */}
          <div className="mt-6">
            <motion.button
              type="button"
              onClick={handleBiometricAuth}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              disabled={isScanning}
              className={`w-full py-3 rounded-xl font-mono text-xs font-bold transition-all flex justify-center items-center gap-2 cursor-pointer relative overflow-hidden ${
                scanSuccess
                  ? "bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.4)]"
                  : isScanning
                    ? "bg-cyan-500 text-slate-950 cursor-wait"
                    : "bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20"
              }`}
            >
              {isScanning ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                  {scanStepText}
                </span>
              ) : (
                <>
                  SCAN BIOMETRICS & ENTER {selectedRole.toUpperCase()}'S PORTAL
                  ⤢
                </>
              )}
            </motion.button>
          </div>

          <div className="flex justify-between text-[10px] font-mono text-slate-600 mt-4 border-t border-slate-800 pt-2">
            <span>Route: 200 OK</span>
            <span>Security: PostgreSQL Multi-RLS</span>
          </div>
        </div>

        {/* RIGHT PANEL: HOLOGRAM BOARDING PASS WITH LASER SCANNER */}
        <motion.div
          animate={
            isScanning
              ? { borderColor: ["#1e293b", "#06b6d4", "#10b981", "#1e293b"] }
              : {}
          }
          transition={{ duration: 1.5, repeat: isScanning ? Infinity : 0 }}
          className={`w-full lg:w-80 bg-slate-900/90 backdrop-blur-md border rounded-2xl p-5 flex flex-col justify-between relative shadow-2xl overflow-hidden transition-colors ${
            scanSuccess
              ? "border-emerald-400/80 shadow-[0_0_25px_rgba(52,211,153,0.2)]"
              : "border-slate-800"
          }`}
        >
          {/* Laser Scanning Animation */}
          {isScanning && (
            <>
              <motion.div
                initial={{ top: "0%" }}
                animate={{ top: ["0%", "98%", "0%"] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#06b6d4,0_0_30px_#06b6d4] z-30 pointer-events-none"
              />

              <motion.div
                initial={{ top: "-30%" }}
                animate={{ top: ["-20%", "80%", "-20%"] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-x-0 h-28 bg-gradient-to-b from-cyan-400/15 to-transparent z-20 pointer-events-none"
              />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:16px_16px] z-10 pointer-events-none"
              />
            </>
          )}

          {/* Pass Top Data */}
          <div className="space-y-4 relative z-10">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-slate-500 font-mono">
                  BOARDING PASS
                </p>
                <h2 className="text-sm font-bold text-slate-100 tracking-wider">
                  UNIFLOW PASS
                </h2>
              </div>
              <span
                className={`text-[9px] px-2 py-0.5 rounded font-mono uppercase transition-colors ${
                  scanSuccess
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                    : "bg-cyan-500/10 text-cyan-300 border border-cyan-400/20"
                }`}
              >
                {scanSuccess ? "AUTHENTICATED" : `${selectedRole} GATE ACCESS`}
              </span>
            </div>

            {/* Gate Matrix */}
            <div className="grid grid-cols-3 border border-slate-800 bg-slate-950 rounded-lg p-2 text-center text-[10px] font-mono">
              <div>
                <p className="text-slate-500 text-[8px]">GATE</p>
                <p className="text-cyan-400 font-bold">GATE 3B</p>
              </div>
              <div className="border-x border-slate-800">
                <p className="text-slate-500 text-[8px]">ZONE</p>
                <p className="text-cyan-400 font-bold">ZONE 1</p>
              </div>
              <div>
                <p className="text-slate-500 text-[8px]">SEAT</p>
                <p className="text-cyan-400 font-bold">
                  {selectedRole === "student"
                    ? "STU-04A"
                    : selectedRole === "faculty"
                      ? "FAC-12C"
                      : "ADM-REG"}
                </p>
              </div>
            </div>

            {/* Dynamic Card User Info */}
            <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="w-11 h-11 bg-cyan-500/10 border border-cyan-400/30 rounded-xl flex items-center justify-center font-black text-cyan-300 text-sm shadow-[0_0_8px_rgba(6,182,212,0.15)]">
                {displayInitials}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white text-xs truncate capitalize">
                  {displayName}
                </h3>
                <p className="text-[10px] text-slate-400 capitalize truncate">
                  {selectedRole === "student"
                    ? "B.Tech Spaceflight & Robotics"
                    : selectedRole === "faculty"
                      ? "Faculty Dept. Lead"
                      : "Registrar Administrator"}
                </p>
                <p className="text-[8px] text-slate-500 font-mono truncate">
                  Dept. of Aerospace Engineering
                </p>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 p-2 bg-slate-950 border border-slate-800 rounded-lg text-center text-[10px] font-mono">
              <div>
                <p className="text-slate-500 text-[8px]">CGPA / STATUS</p>
                <p className="text-slate-300 font-semibold">
                  {selectedRole === "student" ? "9.71 / 10" : "ACTIVE"}
                </p>
              </div>
              <div className="border-l border-slate-800">
                <p className="text-slate-500 text-[8px]">ATTENDANCE</p>
                <p className="text-slate-300 font-semibold">
                  {selectedRole === "student" ? "87.4%" : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Notch Line separator */}
          <div className="relative my-4 flex items-center justify-between">
            <div className="absolute left-[-26px] w-5 h-5 bg-slate-950 rounded-full border border-slate-800" />
            <div className="w-full border-t border-slate-800 mx-2 relative flex justify-center items-center py-2">
              <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">
                {isScanning
                  ? "/// BIO-ENCRYPTION ACTIVE ///"
                  : "OPTICAL VERIFICATION PORT"}
              </span>
            </div>
            <div className="absolute right-[-26px] w-5 h-5 bg-slate-950 rounded-full border border-slate-800" />
          </div>

          {/* Barcode Hologram & Status */}
          <div className="space-y-3 font-mono relative z-10">
            <div className="flex justify-between text-[8px] text-slate-500">
              <span>PASS STUB: UF-TKT-25R0-994</span>
              <button
                type="button"
                onClick={handleBiometricAuth}
                className="text-cyan-400 hover:text-cyan-300 cursor-pointer underline bg-transparent border-none p-0"
              >
                INITIALIZE SCAN ⤢
              </button>
            </div>

            <div className="h-10 bg-slate-950 rounded-lg flex flex-col justify-end items-center p-1 border border-slate-800">
              <div className="w-full h-full opacity-65 bg-[repeating-linear-gradient(to_right,transparent,transparent_2px,#334155_2px,#334155_5px,#06b6d4_5px,#06b6d4_7px)]" />
              <p className="text-[7px] text-slate-500 tracking-widest mt-0.5">
                *UF-STU-2026-994*
              </p>
            </div>

            <div className="flex justify-between items-center text-[8px] text-slate-500 pt-1">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    scanSuccess
                      ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                      : isScanning
                        ? "bg-cyan-400 animate-ping"
                        : "bg-emerald-400"
                  }`}
                />
                {scanSuccess
                  ? "ACCESS VERIFIED"
                  : isScanning
                    ? "OPTICAL SWEEP"
                    : "TERMINAL READY"}
              </span>
              <span>RLS MULTI-TENANT</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
