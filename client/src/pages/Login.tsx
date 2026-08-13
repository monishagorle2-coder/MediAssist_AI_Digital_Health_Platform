import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Activity,
  ShieldCheck,
  Stethoscope,
  User,
  Lock,
  ArrowRight,
  UserPlus,
  FileText,
} from "lucide-react";

export const Login: React.FC = () => {
  const { login, demoLogin, registerPatient } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Registration state
  const [regData, setRegData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    dob: "1995-05-20",
    gender: "Male",
    bloodGroup: "A+",
    address: "",
  });

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Failed to sign in. Check email and password."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await registerPatient(regData);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Registration failed. Please check inputs."
      );
    } finally {
      setLoading(false);
    }
  };

  // Frontend demo login for mentor/reviewer demonstration
  const quickLogin = (presetEmail: string, presetPw: string) => {
    const roleMap: Record<
      string,
      "DOCTOR" | "PATIENT" | "RECEPTIONIST" | "PHARMACIST" | "ADMIN"
    > = {
      "doctor.smith@mediassist.com": "DOCTOR",
      "patient@mediassist.com": "PATIENT",
      "receptionist@mediassist.com": "RECEPTIONIST",
      "pharmacist@mediassist.com": "PHARMACIST",
      "admin@mediassist.com": "ADMIN",
    };

    const role = roleMap[presetEmail.toLowerCase()];

    if (role) {
      setError("");
      demoLogin(role);
      return;
    }

    // Fallback to real backend login
    setEmail(presetEmail);
    setPassword(presetPw);

    login(presetEmail, presetPw).catch((err: any) => {
      setError(
        err.response?.data?.error || "Quick login failed."
      );
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="absolute bottom-10 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-400 shadow-xl shadow-cyan-500/25 mb-4">
          <Activity className="h-8 w-8 text-white animate-pulse" />
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Medi<span className="text-cyan-400">Assist</span>
        </h1>

        <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
          Internal Hospital Clinical Decision Support System & Ethical AI
          Platform
        </p>
      </div>

      {/* Quick Demo Login Bar */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block text-center mb-3">
            Quick 1-Click Role Login (Demo Accounts)
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {/* Doctor */}
            <button
              type="button"
              onClick={() =>
                quickLogin(
                  "doctor.smith@mediassist.com",
                  "DoctorPassword123!"
                )
              }
              className="px-2.5 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60 text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition-all"
            >
              <Stethoscope className="h-4 w-4 text-cyan-400" />
              <span>Doctor</span>
            </button>

            {/* Patient */}
            <button
              type="button"
              onClick={() =>
                quickLogin(
                  "patient@mediassist.com",
                  "PatientPassword123!"
                )
              }
              className="px-2.5 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition-all"
            >
              <User className="h-4 w-4 text-emerald-400" />
              <span>Patient</span>
            </button>

            {/* Receptionist */}
            <button
              type="button"
              onClick={() =>
                quickLogin(
                  "receptionist@mediassist.com",
                  "ReceptionPassword123!"
                )
              }
              className="px-2.5 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/60 text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition-all"
            >
              <UserPlus className="h-4 w-4 text-purple-400" />
              <span>Receptionist</span>
            </button>

            {/* Pharmacist */}
            <button
              type="button"
              onClick={() =>
                quickLogin(
                  "pharmacist@mediassist.com",
                  "PharmacyPassword123!"
                )
              }
              className="px-2.5 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60 text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition-all"
            >
              <FileText className="h-4 w-4 text-amber-400" />
              <span>Pharmacist</span>
            </button>

            {/* Admin */}
            <button
              type="button"
              onClick={() =>
                quickLogin(
                  "admin@mediassist.com",
                  "AdminPassword123!"
                )
              }
              className="col-span-2 sm:col-span-1 px-2.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition-all"
            >
              <ShieldCheck className="h-4 w-4 text-rose-400" />
              <span>Admin</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Login / Register Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-slate-900/90 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 backdrop-blur-xl">
          {/* Form Tabs */}
          <div className="flex border-b border-slate-800 mb-6 pb-2">
            <button
              type="button"
              onClick={() => setIsRegistering(false)}
              className={`flex-1 text-center py-2 text-sm font-semibold border-b-2 transition-all ${
                !isRegistering
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => setIsRegistering(true)}
              className={`flex-1 text-center py-2 text-sm font-semibold border-b-2 transition-all ${
                isRegistering
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              Patient Registration
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Login / Registration */}
          {!isRegistering ? (
            /* Login Form */
            <form
              onSubmit={handleLoginSubmit}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Email Address
                </label>

                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />

                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. doctor.smith@mediassist.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Password
                </label>

                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />

                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <span>
                  {loading
                    ? "Authenticating..."
                    : "Sign In to Platform"}
                </span>

                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            /* Patient Self-Registration Form */
            <form
              onSubmit={handleRegisterSubmit}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name
                </label>

                <input
                  type="text"
                  required
                  value={regData.name}
                  onChange={(e) =>
                    setRegData({
                      ...regData,
                      name: e.target.value,
                    })
                  }
                  placeholder="John Doe"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email
                </label>

                <input
                  type="email"
                  required
                  value={regData.email}
                  onChange={(e) =>
                    setRegData({
                      ...regData,
                      email: e.target.value,
                    })
                  }
                  placeholder="john@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password
                </label>

                <input
                  type="password"
                  required
                  value={regData.password}
                  onChange={(e) =>
                    setRegData({
                      ...regData,
                      password: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone
                  </label>

                  <input
                    type="text"
                    required
                    value={regData.phone}
                    onChange={(e) =>
                      setRegData({
                        ...regData,
                        phone: e.target.value,
                      })
                    }
                    placeholder="555-0192"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Blood Group
                  </label>

                  <select
                    value={regData.bloodGroup}
                    onChange={(e) =>
                      setRegData({
                        ...regData,
                        bloodGroup: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Address
                </label>

                <input
                  type="text"
                  required
                  value={regData.address}
                  onChange={(e) =>
                    setRegData({
                      ...regData,
                      address: e.target.value,
                    })
                  }
                  placeholder="123 Main St, City, State"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold text-xs shadow-lg flex items-center justify-center space-x-2"
              >
                <span>
                  {loading
                    ? "Creating Profile..."
                    : "Register as New Patient"}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};