import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { Department } from "../types";
import { 
  Building2, 
  Users, 
  ShieldAlert, 
  Activity, 
  Plus, 
  DollarSign, 
  UserCheck, 
  Calendar,
  Clock,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Edit3,
  KeyRound,
  Shield,
  TrendingUp,
  RefreshCw,
  X
} from "lucide-react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend, 
  BarChart, 
  Bar 
} from "recharts";

interface AdminDashboardProps {
  activeTab: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ activeTab }) => {
  // Analytics Overview State
  const [dateRange, setDateRange] = useState<string>("30d");
  const [kpis, setKpis] = useState<any>(null);
  const [departmentStats, setDepartmentStats] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [queueDistribution, setQueueDistribution] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [userStatusFilter, setUserStatusFilter] = useState("ALL");
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);

  // User Modals State
  const [selectedUserForStatus, setSelectedUserForStatus] = useState<any>(null);
  const [statusReason, setStatusReason] = useState("");
  const [statusActionLoading, setStatusActionLoading] = useState(false);

  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({ name: "", phone: "", specialization: "", departmentId: "" });
  const [editLoading, setEditLoading] = useState(false);

  const [selectedUserForReset, setSelectedUserForReset] = useState<any>(null);
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Doctor Creation State
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
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");
  const [auditRoleFilter, setAuditRoleFilter] = useState("ALL");
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (activeTab === "overview") {
      fetchAnalytics();
    } else if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "audit-logs") {
      fetchAuditLogs();
    }
  }, [activeTab, dateRange, userRoleFilter, userStatusFilter, userPage, auditActionFilter, auditRoleFilter, auditPage]);

  const fetchDepartments = async () => {
    try {
      const res = await api.get("/departments");
      setDepartmentsList(res.data);
      if (res.data.length > 0 && !newDoctor.departmentId) {
        setNewDoctor(prev => ({ ...prev, departmentId: res.data[0].id }));
      }
    } catch (err) {
      console.error("Failed to fetch departments", err);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const [overviewRes, deptRes, trendsRes] = await Promise.all([
        api.get(`/admin/analytics/overview?range=${dateRange}`),
        api.get(`/admin/analytics/departments?range=${dateRange}`),
        api.get(`/admin/analytics/trends?days=${dateRange === "7d" ? 7 : dateRange === "today" ? 1 : 30}`),
      ]);

      setKpis(overviewRes.data.kpi);
      setDepartmentStats(deptRes.data.departments || []);
      setTrends(trendsRes.data.trends || []);
      setQueueDistribution(trendsRes.data.statusDistribution || null);
    } catch (err) {
      console.error("Failed to load analytics", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await api.get("/admin/users", {
        params: {
          search: userSearch || undefined,
          role: userRoleFilter !== "ALL" ? userRoleFilter : undefined,
          status: userStatusFilter !== "ALL" ? userStatusFilter : undefined,
          page: userPage,
          limit: 15,
        },
      });
      setUsers(res.data.users);
      setUserTotalPages(res.data.pagination.totalPages || 1);
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await api.get("/admin/audit-logs", {
        params: {
          search: auditSearch || undefined,
          action: auditActionFilter !== "ALL" ? auditActionFilter : undefined,
          role: auditRoleFilter !== "ALL" ? auditRoleFilter : undefined,
          page: auditPage,
          limit: 20,
        },
      });
      setAuditLogs(res.data.logs);
      setAuditTotalPages(res.data.pagination.totalPages || 1);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setAuditLoading(false);
    }
  };

  // User Actions
  const handleToggleUserStatus = async () => {
    if (!selectedUserForStatus) return;
    setStatusActionLoading(true);
    try {
      const newStatus = !selectedUserForStatus.isActive;
      await api.put(`/admin/users/${selectedUserForStatus.id}/status`, {
        isActive: newStatus,
        reason: statusReason,
      });
      setSelectedUserForStatus(null);
      setStatusReason("");
      fetchUsers();
      alert(`User ${newStatus ? "activated" : "deactivated"} successfully.`);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update user status.");
    } finally {
      setStatusActionLoading(false);
    }
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;
    setEditLoading(true);
    try {
      await api.put(`/admin/users/${selectedUserForEdit.id}/profile`, editFormData);
      setSelectedUserForEdit(null);
      fetchUsers();
      alert("Staff profile updated successfully.");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update profile.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForReset) return;
    setResetLoading(true);
    try {
      await api.post(`/admin/users/${selectedUserForReset.id}/reset-password`, {
        newPassword: adminNewPassword,
      });
      setSelectedUserForReset(null);
      setAdminNewPassword("");
      alert("Password has been reset successfully.");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocLoading(true);
    try {
      await api.post("/doctors", newDoctor);
      setShowAddDoctorModal(false);
      setNewDoctor({
        name: "",
        email: "",
        password: "",
        specialization: "General Practice",
        departmentId: departmentsList[0]?.id || "",
        phone: "",
      });
      fetchUsers();
      alert("New doctor account created successfully!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create doctor account.");
    } finally {
      setDocLoading(false);
    }
  };

  // CSV Exports
  const downloadCsv = (endpoint: string, filename: string) => {
    const token = localStorage.getItem("token");
    const baseURL = api.defaults.baseURL || "http://localhost:5000/api";
    const url = `${baseURL}${endpoint}`;

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch((err) => alert("Failed to export report: " + err.message));
  };

  const PIE_COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#8b5cf6", "#f43f5e", "#64748b"];

  const pieData = queueDistribution
    ? [
        { name: "Completed", value: queueDistribution.COMPLETED || 0 },
        { name: "In Consultation", value: queueDistribution.IN_CONSULTATION || 0 },
        { name: "Checked In", value: queueDistribution.CHECKED_IN || 0 },
        { name: "Waiting", value: queueDistribution.WAITING || 0 },
        { name: "Cancelled", value: queueDistribution.CANCELLED || 0 },
        { name: "No Show", value: queueDistribution.NO_SHOW || 0 },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      
      {/* ==================================================================== */}
      {/* OVERVIEW & HOSPITAL ANALYTICS TAB */}
      {/* ==================================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Header & Date Range Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-rose-400" />
                <span>Hospital Operational Command & Analytics</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Executive intelligence across patient flow, departmental performance, and hospital finances.
              </p>
            </div>

            {/* Date Range Selector & Exports */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center space-x-1 text-xs">
                {[
                  { id: "today", label: "Today" },
                  { id: "7d", label: "7 Days" },
                  { id: "30d", label: "30 Days" },
                  { id: "month", label: "This Month" },
                  { id: "all", label: "All Time" },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setDateRange(r.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      dateRange === r.id
                        ? "bg-rose-600 text-white shadow-md"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => downloadCsv("/admin/reports/departments/csv", "department_analytics.csv")}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 shadow-md"
                  title="Export Department Analytics CSV"
                >
                  <Download className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Dept CSV</span>
                </button>
                <button
                  onClick={() => downloadCsv("/admin/reports/revenue/csv", "revenue_report.csv")}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 shadow-md"
                  title="Export Revenue & Billing CSV"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Revenue CSV</span>
                </button>
                <button
                  onClick={fetchAnalytics}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                  title="Refresh Telemetry"
                >
                  <RefreshCw className={`h-4 w-4 ${analyticsLoading ? "animate-spin text-cyan-400" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          {/* 6 High-Level KPI Cards */}
          {kpis && (
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-bold uppercase">Total Patients</span>
                  <Users className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-slate-100 font-mono">{kpis.totalPatients}</div>
                <span className="text-[10px] text-cyan-400 font-semibold">{kpis.periodPatients} in selected period</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-bold uppercase">Active Doctors</span>
                  <Activity className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-slate-100 font-mono">{kpis.totalDoctors}</div>
                <span className="text-[10px] text-slate-500">Across {departmentStats.length} departments</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-bold uppercase">Appointments</span>
                  <Calendar className="h-4 w-4 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-slate-100 font-mono">{kpis.totalAppointments}</div>
                <span className="text-[10px] text-emerald-400 font-semibold">{kpis.completedConsultations} completed</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-bold uppercase">Hospital Revenue</span>
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">${kpis.totalRevenue.toFixed(2)}</div>
                <span className="text-[10px] text-slate-500">Gross cleared receipts</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-bold uppercase">Pending Due</span>
                  <Clock className="h-4 w-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">${kpis.pendingDue.toFixed(2)}</div>
                <span className="text-[10px] text-amber-500/80 font-semibold">Unpaid patient balances</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-bold uppercase">Active Staff</span>
                  <UserCheck className="h-4 w-4 text-teal-400" />
                </div>
                <div className="text-2xl font-black text-slate-100 font-mono">{kpis.activeStaffCount}</div>
                <span className="text-[10px] text-slate-500">Verified system accounts</span>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue & Appointments Trend Chart */}
            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <span>Longitudinal Revenue & Patient Volume Trends</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Daily telemetry</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(v) => v.slice(5)} />
                    <YAxis yAxisId="left" stroke="#10b981" fontSize={10} />
                    <YAxis yAxisId="right" orientation="right" stroke="#06b6d4" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#020617", borderColor: "#334155", borderRadius: "0.75rem", fontSize: "12px" }} 
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue ($)" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="appointments" stroke="#06b6d4" name="Appointments" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Appointment Queue Lifecycle Breakdown */}
            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-purple-400" />
                  <span>Consultation Queue Distribution</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Lifecycle breakdown for all scheduled visits</p>
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#020617", borderColor: "#334155", borderRadius: "0.75rem", fontSize: "12px" }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {pieData.map((d, idx) => (
                  <div key={idx} className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <span className="text-slate-300 font-medium">{d.name}:</span>
                    <span className="font-bold text-slate-100 font-mono">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Department Analytics Table & Bar Chart */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-rose-400" />
                  <span>Department Performance & Patient Inflow</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Aggregated clinical and financial performance per specialty department</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Department Bar Chart */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: "#020617", borderColor: "#334155", borderRadius: "0.75rem", fontSize: "12px" }} />
                    <Bar dataKey="totalAppointments" fill="#f43f5e" name="Appointments" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" fill="#10b981" name="Revenue ($)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Department Details Table */}
              <div className="lg:col-span-2 overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Specialty Department</th>
                      <th className="px-3 py-3 text-center">Doctors</th>
                      <th className="px-3 py-3 text-center">Patients</th>
                      <th className="px-3 py-3 text-center">Appointments</th>
                      <th className="px-3 py-3 text-center">Completed</th>
                      <th className="px-4 py-3 text-right">Revenue ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {departmentStats.map((dept) => (
                      <tr key={dept.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-100">
                          {dept.name}
                          <span className="block text-[10px] text-slate-400 font-normal">{dept.description}</span>
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-cyan-400 font-bold">{dept.doctorCount}</td>
                        <td className="px-3 py-3 text-center font-mono text-slate-200">{dept.uniquePatients}</td>
                        <td className="px-3 py-3 text-center font-mono text-slate-200">{dept.totalAppointments}</td>
                        <td className="px-3 py-3 text-center font-mono text-emerald-400 font-semibold">{dept.completedConsultations}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                          ${dept.revenue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* USER & STAFF MANAGEMENT TAB */}
      {/* ==================================================================== */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <Users className="h-5 w-5 text-rose-400" />
                <span>Hospital Staff & User Management</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage accounts, activate/deactivate staff, reset credentials, and edit clinical profiles.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => downloadCsv("/admin/reports/users/csv", "hospital_users_directory.csv")}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 shadow-md"
              >
                <Download className="h-3.5 w-3.5 text-cyan-400" />
                <span>Export Users CSV</span>
              </button>
              <button
                onClick={() => setShowAddDoctorModal(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg flex items-center space-x-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Create Doctor Account</span>
              </button>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
                placeholder="Search by name, email..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400 font-medium">Role:</span>
                <select
                  value={userRoleFilter}
                  onChange={(e) => {
                    setUserRoleFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2.5 text-slate-200 focus:outline-none"
                >
                  <option value="ALL">All Roles</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="PHARMACIST">Pharmacist</option>
                  <option value="LAB_TECHNICIAN">Lab Tech</option>
                  <option value="PATIENT">Patient</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400 font-medium">Status:</span>
                <select
                  value={userStatusFilter}
                  onChange={(e) => {
                    setUserStatusFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2.5 text-slate-200 focus:outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Deactivated</option>
                </select>
              </div>

              <button
                onClick={fetchUsers}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
              >
                Apply
              </button>
            </div>
          </div>

          {/* User Directory Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">User / Staff Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3">Last Login</th>
                    <th className="px-4 py-3">Registered</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading hospital user directory...</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No users found matching current filters.</td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-100 text-sm">{u.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            u.role === "DOCTOR"
                              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                              : u.role === "ADMIN"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : u.role === "PATIENT"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center space-x-1 w-fit ${
                            u.isActive
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          }`}>
                            {u.isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            <span>{u.isActive ? "ACTIVE" : "INACTIVE"}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          <div>{u.details}</div>
                          <div className="text-[10px] text-slate-500">Phone: {u.phone}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Edit Profile */}
                            <button
                              onClick={() => {
                                setSelectedUserForEdit(u);
                                setEditFormData({
                                  name: u.name,
                                  phone: u.phone !== "N/A" ? u.phone : "",
                                  specialization: u.doctor?.specialization || "",
                                  departmentId: u.doctor?.department?.id || "",
                                });
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                              title="Edit Staff Profile"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                setSelectedUserForReset(u);
                                setAdminNewPassword("");
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-all"
                              title="Reset Password"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>

                            {/* Activate / Deactivate */}
                            <button
                              onClick={() => setSelectedUserForStatus(u)}
                              className={`px-2 py-1 rounded-lg font-bold text-[10px] border transition-all ${
                                u.isActive
                                  ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30"
                                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              }`}
                            >
                              {u.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-4 border-t border-slate-800 text-xs text-slate-400">
              <div>Page {userPage} of {userTotalPages}</div>
              <div className="flex items-center space-x-2">
                <button
                  disabled={userPage <= 1}
                  onClick={() => setUserPage(prev => prev - 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={userPage >= userTotalPages}
                  onClick={() => setUserPage(prev => prev + 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* AUDIT LOGS TAB */}
      {/* ==================================================================== */}
      {activeTab === "audit-logs" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <ShieldAlert className="h-5 w-5 text-rose-400" />
                <span>Hospital Security & System Audit Trail</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Immutable chronological log of all administrative, clinical, and financial actions.
              </p>
            </div>

            <button
              onClick={() => downloadCsv("/admin/reports/audit-logs/csv", "system_audit_logs.csv")}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 shadow-md w-fit"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              <span>Export Audit Logs CSV</span>
            </button>
          </div>

          {/* Audit Filters */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchAuditLogs()}
                placeholder="Search action or details..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400 font-medium">Action:</span>
                <select
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditActionFilter(e.target.value);
                    setAuditPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2.5 text-slate-200 focus:outline-none"
                >
                  <option value="ALL">All Actions</option>
                  <option value="USER_LOGIN">User Login</option>
                  <option value="USER_ACTIVATED">User Activated</option>
                  <option value="USER_DEACTIVATED">User Deactivated</option>
                  <option value="USER_PASSWORD_CHANGE">Password Change</option>
                  <option value="USER_PASSWORD_RESET_BY_ADMIN">Admin Reset</option>
                  <option value="PAY_BILL">Pay Bill</option>
                  <option value="REFUND_BILL">Refund Bill</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400 font-medium">Actor Role:</span>
                <select
                  value={auditRoleFilter}
                  onChange={(e) => {
                    setAuditRoleFilter(e.target.value);
                    setAuditPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2.5 text-slate-200 focus:outline-none"
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="PHARMACIST">Pharmacist</option>
                  <option value="LAB_TECHNICIAN">Lab Tech</option>
                  <option value="PATIENT">Patient</option>
                </select>
              </div>

              <button
                onClick={fetchAuditLogs}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
              >
                Filter
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Event Details</th>
                    <th className="px-4 py-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading audit trail...</td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No audit records found matching criteria.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-200">{log.actor.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{log.actor.email} ({log.actor.role})</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono font-bold text-rose-400">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 max-w-md break-words">
                          {log.details}
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                          {log.ipAddress}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-4 border-t border-slate-800 text-xs text-slate-400">
              <div>Page {auditPage} of {auditTotalPages}</div>
              <div className="flex items-center space-x-2">
                <button
                  disabled={auditPage <= 1}
                  onClick={() => setAuditPage(prev => prev - 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={auditPage >= auditTotalPages}
                  onClick={() => setAuditPage(prev => prev + 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STATUS TOGGLE CONFIRMATION MODAL */}
      {/* ==================================================================== */}
      {selectedUserForStatus && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Shield className="h-5 w-5 text-rose-400" />
              <span>Confirm Account {selectedUserForStatus.isActive ? "Deactivation" : "Activation"}</span>
            </h3>
            
            <p className="text-xs text-slate-400">
              Are you sure you want to {selectedUserForStatus.isActive ? "deactivate" : "activate"} user{" "}
              <strong className="text-slate-200">{selectedUserForStatus.email}</strong>?{" "}
              {selectedUserForStatus.isActive && "Deactivated users are immediately prevented from logging into the platform."}
            </p>

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Administrative Reason (Audit Log)</label>
              <textarea
                rows={2}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="e.g. Leave of absence / Staff transition"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedUserForStatus(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusActionLoading}
                onClick={handleToggleUserStatus}
                className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-lg ${
                  selectedUserForStatus.isActive
                    ? "bg-rose-600 hover:bg-rose-500"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {statusActionLoading ? "Processing..." : selectedUserForStatus.isActive ? "Confirm Deactivation" : "Confirm Activation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* EDIT STAFF PROFILE MODAL */}
      {/* ==================================================================== */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Edit3 className="h-5 w-5 text-rose-400" />
                <span>Edit Staff Member Profile</span>
              </h3>
              <button onClick={() => setSelectedUserForEdit(null)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditProfile} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                />
              </div>

              {selectedUserForEdit.role === "DOCTOR" && (
                <>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Specialization</label>
                    <input
                      type="text"
                      value={editFormData.specialization}
                      onChange={(e) => setEditFormData({ ...editFormData, specialization: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Department</label>
                    <select
                      value={editFormData.departmentId}
                      onChange={(e) => setEditFormData({ ...editFormData, departmentId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                    >
                      {departmentsList.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserForEdit(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg"
                >
                  {editLoading ? "Saving..." : "Save Profile Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN RESET PASSWORD MODAL */}
      {/* ==================================================================== */}
      {selectedUserForReset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <KeyRound className="h-5 w-5 text-cyan-400" />
                <span>Reset User Password</span>
              </h3>
              <button onClick={() => setSelectedUserForReset(null)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Set a new secure temporary password for <strong className="text-slate-200">{selectedUserForReset.email}</strong>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserForReset(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg"
                >
                  {resetLoading ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CREATE DOCTOR MODAL */}
      {/* ==================================================================== */}
      {showAddDoctorModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Plus className="h-5 w-5 text-rose-400" />
                <span>Register New Physician / Doctor</span>
              </h3>
              <button onClick={() => setShowAddDoctorModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddDoctor} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Doctor Name *</label>
                  <input
                    type="text"
                    required
                    value={newDoctor.name}
                    onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })}
                    placeholder="e.g. Dr. Jane Doe"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newDoctor.email}
                    onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })}
                    placeholder="doctor@hospital.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newDoctor.password}
                    onChange={(e) => setNewDoctor({ ...newDoctor, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={newDoctor.phone}
                    onChange={(e) => setNewDoctor({ ...newDoctor, phone: e.target.value })}
                    placeholder="10-digit number"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Specialization *</label>
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
                  <label className="block text-slate-300 font-semibold mb-1">Assigned Department *</label>
                  <select
                    value={newDoctor.departmentId}
                    onChange={(e) => setNewDoctor({ ...newDoctor, departmentId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  >
                    {departmentsList.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
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
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg"
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

export default AdminDashboard;
