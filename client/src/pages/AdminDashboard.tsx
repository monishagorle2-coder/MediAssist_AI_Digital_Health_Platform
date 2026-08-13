import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { AuditLog, Department, Doctor } from "../types";
import { Building2, Users, ShieldAlert, Activity, Plus, DollarSign, UserCheck, AlertCircle } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface AdminDashboardProps {
  activeTab: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ activeTab }) => {
  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Create Doctor State
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [newDoctor, setNewDoctor] = useState({
    name: "",
    email: "",
    password: "",
    specialization: "General Practice",
    departmentId: "",
    phone: "",
  });
  const [docLoading, setDocLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === "overview") {
        const statsRes = await api.get("/hospital/admin/stats");
        setStats(statsRes.data);
      } else if (activeTab === "audit-logs") {
        const logRes = await api.get("/hospital/admin/audit-logs");
        setAuditLogs(logRes.data);
      } else if (activeTab === "users") {
        const docRes = await api.get("/hospital/doctors");
        setDoctors(docRes.data);
        const deptRes = await api.get("/hospital/departments");
        setDepartments(deptRes.data);
      }
    } catch (err) {
      console.error("Failed to load admin data", err);
    }
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocLoading(true);
    try {
      await api.post("/hospital/doctors", newDoctor);
      setShowAddDoctorModal(false);
      setNewDoctor({
        name: "",
        email: "",
        password: "",
        specialization: "General Practice",
        departmentId: "",
        phone: "",
      });
      fetchData();
      alert("New doctor account created successfully!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create doctor account.");
    } finally {
      setDocLoading(false);
    }
  };

  const pieData = stats ? [
    { name: "Confirmed Diagnoses", value: stats.confirmedDiagnoses || 0 },
    { name: "Pending Diagnoses", value: stats.pendingDiagnoses || 0 },
  ] : [];

  const COLORS = ["#10b981", "#f59e0b"];

  return (
    <div className="space-y-6">
      
      {/* OVERVIEW TAB */}
      {activeTab === "overview" && stats && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-rose-400" />
              <span>Hospital Operational Command & Analytics</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Real-time telemetry across clinical decision workflows, pharmacy, and hospital revenue.
            </p>
          </div>

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-950 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Registered Patients</span>
                <div className="text-xl font-extrabold text-slate-100">{stats.patients}</div>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-950 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Active Doctors</span>
                <div className="text-xl font-extrabold text-slate-100">{stats.doctors}</div>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-purple-950 border border-purple-800/50 flex items-center justify-center text-purple-400">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Appointments</span>
                <div className="text-xl font-extrabold text-slate-100">{stats.appointments}</div>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-teal-950 border border-teal-800/50 flex items-center justify-center text-teal-400">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Hospital Revenue</span>
                <div className="text-xl font-extrabold text-emerald-400">${stats.revenue?.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Diagnosis Status Pie Chart */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Clinical Diagnosis Confirmation Rate</h4>
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center space-x-6 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-slate-300">Confirmed: {stats.confirmedDiagnoses}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <span className="text-slate-300">Pending Review: {stats.pendingDiagnoses}</span>
                </div>
              </div>
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <span>Pharmacy Alert Telemetry</span>
              </h4>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200">Critical Low-Stock Inventory Alerts</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Medications at or below safety reorder threshold</p>
                </div>
                <span className={`px-3 py-1 text-sm font-extrabold rounded-xl border ${
                  stats.lowStockCount > 0 ? "bg-rose-500/20 text-rose-400 border-rose-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                }`}>
                  {stats.lowStockCount} Items
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* USER MANAGEMENT TAB */}
      {activeTab === "users" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <Users className="h-5 w-5 text-rose-400" />
                <span>Physician & Staff Directory</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage doctor credentials, specialization assignments, and clinical accounts.
              </p>
            </div>

            <button
              onClick={() => setShowAddDoctorModal(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg flex items-center space-x-2 transition-all w-fit"
            >
              <Plus className="h-4 w-4" />
              <span>Create Doctor Account</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {doctors.map((doc) => (
              <div key={doc.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-100">{doc.name}</h4>
                  <span className="px-2.5 py-0.5 bg-cyan-950 text-cyan-400 text-[10px] font-bold rounded-full border border-cyan-800">
                    DOCTOR
                  </span>
                </div>
                <div className="text-xs text-slate-400">{doc.specialization} • <span className="text-slate-300">{doc.department?.name}</span></div>
                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">Email: {doc.email} • Phone: {doc.phone}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SYSTEM AUDIT LOGS TAB */}
      {activeTab === "audit-logs" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <ShieldAlert className="h-5 w-5 text-rose-400" />
              <span>System Compliance Audit Log</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Immutable log of medical record confirmations, pharmacy dispenses, and role accesses.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action Type</th>
                    <th className="px-4 py-3">User Email</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {auditLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-850/60 transition-colors">
                      <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-slate-950 text-cyan-400 font-mono text-[10px] font-bold rounded border border-slate-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{log.user?.email || "System"}</td>
                      <td className="px-4 py-3 text-slate-400 leading-snug">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE DOCTOR MODAL */}
      {showAddDoctorModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <Plus className="h-5 w-5 text-rose-400" />
              <span>Create Physician Credentials</span>
            </h3>

            <form onSubmit={handleAddDoctor} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newDoctor.name}
                  onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })}
                  placeholder="Dr. Jane Smith"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newDoctor.email}
                    onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })}
                    placeholder="doctor@mediassist.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={newDoctor.password}
                    onChange={(e) => setNewDoctor({ ...newDoctor, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Specialization</label>
                <input
                  type="text"
                  required
                  value={newDoctor.specialization}
                  onChange={(e) => setNewDoctor({ ...newDoctor, specialization: e.target.value })}
                  placeholder="e.g. Cardiology"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Department</label>
                <select
                  required
                  value={newDoctor.departmentId}
                  onChange={(e) => setNewDoctor({ ...newDoctor, departmentId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Contact Phone</label>
                <input
                  type="text"
                  required
                  value={newDoctor.phone}
                  onChange={(e) => setNewDoctor({ ...newDoctor, phone: e.target.value })}
                  placeholder="555-0100"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDoctorModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={docLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-lg"
                >
                  {docLoading ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
