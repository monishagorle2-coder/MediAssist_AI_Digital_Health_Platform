import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Activity,
  User,
  Stethoscope,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Lock,
  Mail,
  Eye,
  EyeOff,
  UserPlus,
  Calendar,
  Pill,
  FlaskConical,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";

type ViewState =
  | "LANDING"
  | "PATIENT_LOGIN"
  | "PATIENT_REGISTER"
  | "STAFF_SELECT_ROLE"
  | "STAFF_LOGIN"
  | "ADMIN_LOGIN";

type StaffRole = "DOCTOR" | "RECEPTIONIST" | "PHARMACIST" | "LAB_TECHNICIAN";

export const Home: React.FC = () => {
  const { login, registerPatient } = useAuth();

  // Navigation State
  const [view, setView] = useState<ViewState>("LANDING");
  const [selectedStaffRole, setSelectedStaffRole] = useState<StaffRole>("DOCTOR");

  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Patient Registration Form State
  const [regData, setRegData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    dob: "1995-06-15",
    gender: "MALE",
    bloodGroup: "O+",
    address: "",
  });
  const [regShowPassword, setRegShowPassword] = useState(false);

  const resetForms = () => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError("");
    setLoading(false);
  };

  const handleNavigate = (newView: ViewState, role?: StaffRole) => {
    resetForms();
    if (role) {
      setSelectedStaffRole(role);
    }
    setView(newView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Authentication failed. Please verify your credentials and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (regData.password.length < 6) {
      setError("Password must be at least 6 characters in length.");
      return;
    }
    if (regData.phone.length < 10) {
      setError("Please enter a valid phone number with at least 10 digits.");
      return;
    }

    setLoading(true);

    try {
      await registerPatient(regData);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Registration could not be completed. Please review your information and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const staffRoleConfig: Record<
    StaffRole,
    { title: string; subtitle: string; icon: React.ReactNode; color: string; bg: string; border: string }
  > = {
    DOCTOR: {
      title: "Doctor / Attending Physician",
      subtitle: "Consultation Queue, Clinical Notes, Diagnosis, Prescription & AI Support",
      icon: <Stethoscope className="h-6 w-6 text-cyan-400" />,
      color: "text-cyan-400",
      bg: "bg-cyan-950/40 hover:bg-cyan-900/50",
      border: "border-cyan-800/60 hover:border-cyan-500",
    },
    RECEPTIONIST: {
      title: "Receptionist / OPD Front Desk",
      subtitle: "Patient Registration, Appointment Scheduling & Token Issuance",
      icon: <Calendar className="h-6 w-6 text-amber-400" />,
      color: "text-amber-400",
      bg: "bg-amber-950/40 hover:bg-amber-900/50",
      border: "border-amber-800/60 hover:border-amber-500",
    },
    PHARMACIST: {
      title: "Pharmacist / Dispensary",
      subtitle: "Electronic Prescription Dispensing, Inventory & Expiry Tracking",
      icon: <Pill className="h-6 w-6 text-emerald-400" />,
      color: "text-emerald-400",
      bg: "bg-emerald-950/40 hover:bg-emerald-900/50",
      border: "border-emerald-800/60 hover:border-emerald-500",
    },
    LAB_TECHNICIAN: {
      title: "Laboratory Technician",
      subtitle: "Sample Accessioning, Diagnostic Testing & Report Verification",
      icon: <FlaskConical className="h-6 w-6 text-indigo-400" />,
      color: "text-indigo-400",
      bg: "bg-indigo-950/40 hover:bg-indigo-900/50",
      border: "border-indigo-800/60 hover:border-indigo-500",
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-cyan-500 selection:text-white">
      {/* Background Ambience Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-cyan-600/15 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-96 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 -left-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Universal Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div
            onClick={() => handleNavigate("LANDING")}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-400 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform flex items-center justify-center">
              <Activity className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white">
                Medi<span className="text-cyan-400">Assist</span>
              </span>
              <span className="text-[10px] text-slate-400 block font-medium tracking-wide uppercase">
                Hospital Information Management System
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            {view !== "LANDING" && (
              <button
                type="button"
                onClick={() => handleNavigate("LANDING")}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 font-semibold flex items-center space-x-1.5 transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Return to Home</span>
              </button>
            )}

            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Hospital Systems Operational</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body Container */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-10 z-10">
        {/* ==================================================================== */}
        {/* 1. PUBLIC LANDING VIEW: 3 MAIN PORTAL TILES */}
        {/* ==================================================================== */}
        {view === "LANDING" && (
          <div className="max-w-7xl mx-auto w-full space-y-16">
            {/* Hero Section */}
            <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-950/80 to-slate-900 border border-cyan-800/50 text-cyan-300 text-xs font-semibold shadow-inner">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <span>Enterprise Hospital Ecosystem & Clinical AI</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
                Intelligent Healthcare,{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                  Unified Clinical Care
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                MediAssist connects patients, medical clinicians, laboratory pathologists,
                pharmacists, and hospital executives into a secure, HIPAA/HL7-compliant digital ecosystem.
              </p>
            </div>

            {/* 3 Main Entry Path Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* PORTAL 1: PATIENT */}
              <div className="relative group rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 hover:border-cyan-500/60 p-8 shadow-2xl transition-all duration-300 flex flex-col justify-between hover:shadow-cyan-500/10">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="h-14 w-14 rounded-2xl bg-cyan-950/80 border border-cyan-800/80 text-cyan-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <User className="h-7 w-7" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                      Public Access
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white">Patient Portal</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Book outpatient appointments, review verified EHR timelines, download diagnostic lab reports, manage prescriptions, and settle hospital invoices securely.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex items-center space-x-2 text-xs text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                      <span>Online Doctor Consultation Booking</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                      <span>Longitudinal Medical EHR History & Timeline</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                      <span>Diagnostic Reports & Pharmacy Prescriptions</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-8">
                  <button
                    type="button"
                    onClick={() => handleNavigate("PATIENT_LOGIN")}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-xs tracking-wide flex items-center justify-center space-x-2 shadow-lg shadow-cyan-600/25 transition-all"
                  >
                    <span>Sign In to Patient Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavigate("PATIENT_REGISTER")}
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 text-cyan-300 hover:text-cyan-200 border border-cyan-800/60 font-bold text-xs tracking-wide flex items-center justify-center space-x-2 transition-all"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Create Patient Account</span>
                  </button>
                </div>
              </div>

              {/* PORTAL 2: HOSPITAL STAFF */}
              <div className="relative group rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 hover:border-emerald-500/60 p-8 shadow-2xl transition-all duration-300 flex flex-col justify-between hover:shadow-emerald-500/10">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Stethoscope className="h-7 w-7" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      Staff Workspace
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white">Clinical & Staff Portal</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Unified departmental workspaces for Doctors, Receptionists, Pharmacists, and Laboratory Technicians with real-time consultation queue management.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center space-x-2">
                      <Stethoscope className="h-4 w-4 text-cyan-400" />
                      <span className="text-[11px] font-semibold text-slate-200">Doctor</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-amber-400" />
                      <span className="text-[11px] font-semibold text-slate-200">Receptionist</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center space-x-2">
                      <Pill className="h-4 w-4 text-emerald-400" />
                      <span className="text-[11px] font-semibold text-slate-200">Pharmacist</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center space-x-2">
                      <FlaskConical className="h-4 w-4 text-indigo-400" />
                      <span className="text-[11px] font-semibold text-slate-200">Lab Tech</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic">
                    Staff accounts are created and managed by Hospital Administration.
                  </p>
                </div>

                <div className="pt-8">
                  <button
                    type="button"
                    onClick={() => handleNavigate("STAFF_SELECT_ROLE")}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs tracking-wide flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/25 transition-all"
                  >
                    <span>Select Staff Role & Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* PORTAL 3: ADMIN */}
              <div className="relative group rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 hover:border-purple-500/60 p-8 shadow-2xl transition-all duration-300 flex flex-col justify-between hover:shadow-purple-500/10">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="h-14 w-14 rounded-2xl bg-purple-950/80 border border-purple-800/80 text-purple-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <ShieldCheck className="h-7 w-7" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                      Restricted Access
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white">Hospital Administration</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Executive hospital oversight, staff user lifecycle governance, departmental revenue analytics, system audit trails, and compliance management.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex items-center space-x-2 text-xs text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                      <span>Staff Provisioning & Credential Reset</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                      <span>Executive Revenue & Department Analytics</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                      <span>Immutable Security Audit Logs & CSV Exports</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic">
                    Restricted to authorized system administrators. Public registration disabled.
                  </p>
                </div>

                <div className="pt-8">
                  <button
                    type="button"
                    onClick={() => handleNavigate("ADMIN_LOGIN")}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs tracking-wide flex items-center justify-center space-x-2 shadow-lg shadow-purple-600/25 transition-all"
                  >
                    <span>Admin Console Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Platform Highlights & System Architecture Pillars */}
            <div className="pt-8 space-y-6 border-t border-slate-800/80">
              <div className="text-center space-y-1">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
                  Enterprise Hospital Architecture
                </span>
                <h3 className="text-xl font-bold text-white">
                  Built for Speed, Security, and Clinical Reliability
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
                    <Clock className="h-4 w-4" />
                    <span>Real-Time Consultation Queue</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Automated token issuance, priority status management, and real-time Server-Sent Events (SSE) synchronization.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                    <Sparkles className="h-4 w-4" />
                    <span>AI Clinical Intelligence & OCR</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Decision support with differential diagnosis, lab document OCR extraction, voice dictation, and discharge summaries.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Role-Based Access & Security</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Granular RBAC, hardened JWT tokens, strict IDOR boundary protection, and tamper-proof audit logging.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 2. PATIENT LOGIN VIEW */}
        {/* ==================================================================== */}
        {view === "PATIENT_LOGIN" && (
          <div className="max-w-md mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleNavigate("LANDING")}
                className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 font-semibold transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Portals</span>
              </button>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 uppercase">
                Patient Portal
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="text-center space-y-1">
                <div className="h-12 w-12 rounded-2xl bg-cyan-950 border border-cyan-800 text-cyan-400 mx-auto flex items-center justify-center mb-2">
                  <User className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-black text-white">Patient Sign In</h2>
                <p className="text-xs text-slate-400">
                  Access appointments, medical timeline, lab results & bills
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label htmlFor="patient-email" className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                    Email Address *
                  </label>
                  <div className="relative">
                    <input
                      id="patient-email"
                      name="email"
                      type="email"
                      required
                      autoFocus
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="patient@mediassist.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
                    />
                    <Mail className="h-4 w-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="patient-password" className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      id="patient-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-10 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
                    />
                    <Lock className="h-4 w-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-xs tracking-wide flex items-center justify-center space-x-2 shadow-lg shadow-cyan-600/25 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    <span>Sign In as Patient</span>
                  )}
                </button>
              </form>

              <div className="pt-4 border-t border-slate-800 text-center">
                <p className="text-xs text-slate-400">
                  New to MediAssist?{" "}
                  <button
                    type="button"
                    onClick={() => handleNavigate("PATIENT_REGISTER")}
                    className="text-cyan-400 hover:text-cyan-300 font-bold underline"
                  >
                    Create a Patient Account
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 3. PATIENT REGISTRATION VIEW */}
        {/* ==================================================================== */}
        {view === "PATIENT_REGISTER" && (
          <div className="max-w-xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleNavigate("LANDING")}
                className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 font-semibold transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Portals</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("PATIENT_LOGIN")}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-bold transition-colors"
              >
                Already have an account? Sign In
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="text-center space-y-1">
                <div className="h-12 w-12 rounded-2xl bg-cyan-950 border border-cyan-800 text-cyan-400 mx-auto flex items-center justify-center mb-2">
                  <UserPlus className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-black text-white">Create Patient Account</h2>
                <p className="text-xs text-slate-400">
                  Self-register to book appointments and access electronic health records
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                      Full Legal Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={regData.name}
                      onChange={(e) => setRegData({ ...regData, name: e.target.value })}
                      placeholder="John Doe"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                      Contact Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={regData.phone}
                      onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={regData.email}
                      onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                      placeholder="patient@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        type={regShowPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={regData.password}
                        onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                        placeholder="At least 6 characters"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 pr-10 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setRegShowPassword(!regShowPassword)}
                        className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                      >
                        {regShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      required
                      value={regData.dob}
                      onChange={(e) => setRegData({ ...regData, dob: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                      Gender *
                    </label>
                    <select
                      value={regData.gender}
                      onChange={(e) => setRegData({ ...regData, gender: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                      Blood Group *
                    </label>
                    <select
                      value={regData.bloodGroup}
                      onChange={(e) => setRegData({ ...regData, bloodGroup: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                    Residential Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={regData.address}
                    onChange={(e) => setRegData({ ...regData, address: e.target.value })}
                    placeholder="123 Health Ave, Metro City"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-xs tracking-wide flex items-center justify-center space-x-2 shadow-lg shadow-cyan-600/25 transition-all disabled:opacity-50 pt-3"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Patient Profile...</span>
                    </div>
                  ) : (
                    <span>Complete Registration & Sign In</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 4. STAFF ROLE SELECTION VIEW */}
        {/* ==================================================================== */}
        {view === "STAFF_SELECT_ROLE" && (
          <div className="max-w-3xl mx-auto w-full space-y-8">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleNavigate("LANDING")}
                className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 font-semibold transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Portals</span>
              </button>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase">
                Staff Department Selection
              </span>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-white tracking-tight">
                Select Your Clinical or Operational Role
              </h2>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                Choose your department below to proceed to the authenticated staff sign-in console.
              </p>
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-slate-400 text-xs inline-flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>Staff accounts are created and managed by Hospital Administration.</span>
              </div>
            </div>

            {/* 4 Role Selector Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(Object.keys(staffRoleConfig) as StaffRole[]).map((roleKey) => {
                const item = staffRoleConfig[roleKey];
                return (
                  <button
                    key={roleKey}
                    type="button"
                    onClick={() => handleNavigate("STAFF_LOGIN", roleKey)}
                    className={`p-6 rounded-2xl border ${item.border} ${item.bg} text-left transition-all group flex flex-col justify-between space-y-4 shadow-lg`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="h-12 w-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {item.icon}
                      </div>
                      <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </div>

                    <div className="space-y-1">
                      <h3 className={`text-base font-bold ${item.color}`}>
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {item.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 5. STAFF LOGIN VIEW */}
        {/* ==================================================================== */}
        {view === "STAFF_LOGIN" && (
          <div className="max-w-md mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleNavigate("STAFF_SELECT_ROLE")}
                className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 font-semibold transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Role Selection</span>
              </button>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 border uppercase ${staffRoleConfig[selectedStaffRole].color}`}>
                {selectedStaffRole.replace("_", " ")}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="text-center space-y-1">
                <div className="h-12 w-12 rounded-2xl bg-slate-950 border border-slate-800 mx-auto flex items-center justify-center mb-2">
                  {staffRoleConfig[selectedStaffRole].icon}
                </div>
                <h2 className="text-2xl font-black text-white">
                  {staffRoleConfig[selectedStaffRole].title.split("/")[0].trim()} Sign In
                </h2>
                <p className="text-xs text-slate-400">
                  Authenticate with your official institutional staff credentials
                </p>
                <p className="text-[11px] text-emerald-400 pt-1 font-medium">
                  Staff accounts are created and managed by Hospital Administration.
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label htmlFor="staff-email" className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                    Staff Email Address *
                  </label>
                  <div className="relative">
                    <input
                      id="staff-email"
                      name="email"
                      type="email"
                      required
                      autoFocus
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={
                        selectedStaffRole === "DOCTOR"
                          ? "doctor.smith@mediassist.com"
                          : selectedStaffRole === "RECEPTIONIST"
                          ? "receptionist@mediassist.com"
                          : selectedStaffRole === "PHARMACIST"
                          ? "pharmacist@mediassist.com"
                          : "lab@mediassist.com"
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                    <Mail className="h-4 w-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="staff-password" className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      id="staff-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-10 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                    <Lock className="h-4 w-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs tracking-wide flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Staff Credentials...</span>
                    </div>
                  ) : (
                    <span>Sign In to Workspace</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 6. ADMIN LOGIN VIEW */}
        {/* ==================================================================== */}
        {view === "ADMIN_LOGIN" && (
          <div className="max-w-md mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleNavigate("LANDING")}
                className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 font-semibold transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Portals</span>
              </button>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-400 border border-purple-800 uppercase">
                Admin Console
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="text-center space-y-1">
                <div className="h-12 w-12 rounded-2xl bg-purple-950 border border-purple-800 text-purple-400 mx-auto flex items-center justify-center mb-2">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-black text-white">Administration Console</h2>
                <p className="text-xs text-slate-400">
                  Restricted institutional governance and executive analytics
                </p>
                <p className="text-[11px] text-purple-300/80 pt-1 font-medium">
                  Public self-registration is strictly disabled.
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label htmlFor="admin-email" className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                    Admin Email Address *
                  </label>
                  <div className="relative">
                    <input
                      id="admin-email"
                      name="email"
                      type="email"
                      required
                      autoFocus
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@mediassist.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 text-xs"
                    />
                    <Mail className="h-4 w-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="admin-password" className="block font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                    Master Password *
                  </label>
                  <div className="relative">
                    <input
                      id="admin-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-10 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 text-xs"
                    />
                    <Lock className="h-4 w-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs tracking-wide flex items-center justify-center space-x-2 shadow-lg shadow-purple-600/25 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Master Credentials...</span>
                    </div>
                  ) : (
                    <span>Sign In to Admin Console</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-6 bg-slate-950/60 text-center text-xs text-slate-500 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
          <span>MediAssist Hospital Information System</span>
          <span>•</span>
          <span>HL7 & HIPAA Security Compliance</span>
          <span>•</span>
          <span>Role-Based Electronic Health Records (EHR)</span>
          <span>•</span>
          <span>Academic Demonstration Project</span>
        </div>
        <p className="text-[10px] text-slate-600">
          © 2026 MediAssist Multi-Specialty Hospital & Research Center. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Home;
