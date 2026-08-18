import React, { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import type { Appointment, Patient, Doctor, Bill } from "../types";
import { InvoiceModal } from "../components/InvoiceModal";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { 
  Calendar, 
  UserPlus, 
  Plus, 
  CheckCircle2, 
  Receipt, 
  Printer, 
  Search, 
  X, 
  Trash2, 
  DollarSign,
  TrendingUp,
  Clock
} from "lucide-react";

interface ReceptionistDashboardProps {
  activeTab: string;
}

export const ReceptionistDashboard: React.FC<ReceptionistDashboardProps> = ({ activeTab }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);

  // Billing Module State
  const [selectedInvoice, setSelectedInvoice] = useState<Bill | null>(null);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [billingStats, setBillingStats] = useState<any>(null);
  const [billingFilter, setBillingFilter] = useState<string>("ALL");
  const [billingSearch, setBillingSearch] = useState<string>("");
  const [createBillPatientId, setCreateBillPatientId] = useState<string>("");
  const [createBillItems, setCreateBillItems] = useState<Array<{ description: string; category: string; quantity: number; unitPrice: number }>>([
    { description: "General OPD Consultation", category: "CONSULTATION", quantity: 1, unitPrice: 150 },
  ]);
  const [createBillTaxRate, setCreateBillTaxRate] = useState<number>(0);
  const [createBillDiscount, setCreateBillDiscount] = useState<number>(0);
  const [createBillNotes, setCreateBillNotes] = useState<string>("");
  const [createBillLoading, setCreateBillLoading] = useState(false);
  const [createBillError, setCreateBillError] = useState("");

  // Register Patient State
  const [regData, setRegData] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "1990-01-01",
    gender: "Male",
    bloodGroup: "O+",
    address: "",
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState("");

  // Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [slotDate, setSlotDate] = useState("");
  const [reason, setReason] = useState("");
  const [availableSlots, setAvailableSlots] = useState<Array<{ time: string; slotDateTime: string; available: boolean; reason?: string }>>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsMessage, setSlotsMessage] = useState("");
  const [selectedSlotDateTime, setSelectedSlotDateTime] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [queueFilter, setQueueFilter] = useState<string>("ALL");
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      if (activeTab === "schedule") {
        const appRes = await api.get("/appointments");
        setAppointments(appRes.data);

        const patRes = await api.get("/patients");
        setPatients(patRes.data);

        const docRes = await api.get("/doctors");
        setDoctors(docRes.data);
      } else if (activeTab === "billing") {
        const [billRes, statsRes, patRes] = await Promise.all([
          api.get("/bills"),
          api.get("/bills/summary/stats"),
          api.get("/patients"),
        ]);
        setBills(billRes.data);
        setBillingStats(statsRes.data);
        setPatients(patRes.data);
      } else if (activeTab === "register") {
        const patRes = await api.get("/patients");
        setPatients(patRes.data);
      }
    } catch (err) {
      console.error("Failed to load receptionist data", err);
    }
  }, [activeTab]);

  // Real-time Event Subscription for live queue and billing updates
  useRealtimeNotifications(useCallback(() => {
    fetchData();
  }, [fetchData]));

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createBillPatientId) {
      setCreateBillError("Please select a registered patient");
      return;
    }
    if (createBillItems.length === 0) {
      setCreateBillError("Please add at least one line item");
      return;
    }
    setCreateBillLoading(true);
    setCreateBillError("");
    try {
      await api.post("/bills", {
        patientId: createBillPatientId,
        items: createBillItems,
        taxRate: createBillTaxRate,
        discountAmount: createBillDiscount,
        notes: createBillNotes || undefined,
      });
      setShowCreateInvoiceModal(false);
      setCreateBillPatientId("");
      setCreateBillItems([{ description: "General OPD Consultation", category: "CONSULTATION", quantity: 1, unitPrice: 150 }]);
      setCreateBillTaxRate(0);
      setCreateBillDiscount(0);
      setCreateBillNotes("");
      fetchData();
    } catch (err: any) {
      setCreateBillError(err.response?.data?.error || "Failed to create invoice");
    } finally {
      setCreateBillLoading(false);
    }
  };

  const handleCancelInvoice = async (billId: string) => {
    const reason = prompt("Enter reason for invoice cancellation:");
    if (reason === null) return;
    try {
      await api.put(`/bills/${billId}/cancel`, { reason });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to cancel invoice");
    }
  };

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegSuccess("");
    try {
      await api.post("/patients", regData);
      setRegSuccess(`Patient '${regData.name}' registered successfully! Temporary password generated: Welcome123!`);
      setRegData({
        name: "",
        email: "",
        phone: "",
        dob: "1990-01-01",
        gender: "Male",
        bloodGroup: "O+",
        address: "",
      });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Registration failed.");
    } finally {
      setRegLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDoctorId && slotDate) {
      fetchDoctorSlots(selectedDoctorId, slotDate);
    } else {
      setAvailableSlots([]);
      setSelectedSlotDateTime("");
      setSlotsMessage("");
    }
  }, [selectedDoctorId, slotDate]);

  const fetchDoctorSlots = async (doctorId: string, date: string) => {
    setSlotsLoading(true);
    setSlotsMessage("");
    setSelectedSlotDateTime("");
    try {
      const res = await api.get(`/appointments/doctors/${doctorId}/slots?date=${date}`);
      if (!res.data.isWorkingDay) {
        setSlotsMessage(res.data.message || "Doctor does not have consultation hours on this day.");
        setAvailableSlots([]);
      } else {
        setAvailableSlots(res.data.slots || []);
      }
    } catch (err: any) {
      setSlotsMessage(err.response?.data?.error || "Failed to load doctor consultation slots.");
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError("");
    if (!selectedSlotDateTime) {
      setScheduleError("Please select an available consultation time slot.");
      return;
    }
    setScheduleLoading(true);

    try {
      await api.post("/appointments", {
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        slotDateTime: selectedSlotDateTime,
        reason,
      });

      setShowScheduleModal(false);
      setReason("");
      setSelectedSlotDateTime("");
      setSelectedDoctorId("");
      setSelectedPatientId("");
      setSlotDate("");
      fetchData();
      alert("Appointment scheduled successfully!");
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Failed to schedule appointment.";
      setScheduleError(errMsg);
      if (selectedDoctorId && slotDate) {
        fetchDoctorSlots(selectedDoctorId, slotDate);
      }
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleCheckIn = async (appointmentId: string) => {
    setCheckingInId(appointmentId);
    try {
      const res = await api.post(`/appointments/${appointmentId}/check-in`);
      fetchData();
      alert(res.data?.message || "Patient checked in successfully!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to check in patient.");
    } finally {
      setCheckingInId(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* SCHEDULE CALENDAR TAB */}
      {activeTab === "schedule" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-purple-400" />
                <span>Hospital Master Schedule & Desk</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage appointment bookings, doctor availability, and clinic reception desk.
              </p>
            </div>

            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg flex items-center space-x-2 transition-all w-fit"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule New Visit</span>
            </button>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            {/* KPI STATS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Bookings</span>
                <span className="text-xl font-extrabold text-slate-100">{appointments.length}</span>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">Checked In & Waiting</span>
                <span className="text-xl font-extrabold text-cyan-400">
                  {appointments.filter(a => a.queueStatus === "CHECKED_IN").length}
                </span>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">In Consultation</span>
                <span className="text-xl font-extrabold text-amber-400">
                  {appointments.filter(a => a.queueStatus === "IN_CONSULTATION").length}
                </span>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Completed</span>
                <span className="text-xl font-extrabold text-emerald-400">
                  {appointments.filter(a => a.queueStatus === "COMPLETED").length}
                </span>
              </div>
            </div>

            {/* FILTER TABS */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
              {["ALL", "WAITING", "CHECKED_IN", "IN_CONSULTATION", "COMPLETED"].map((f) => (
                <button
                  key={f}
                  onClick={() => setQueueFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    queueFilter === f
                      ? "bg-purple-600 text-white shadow-md"
                      : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
                  }`}
                >
                  {f === "ALL" ? "All Visits" : f.replace("_", " ")}
                </button>
              ))}
            </div>

            {/* APPOINTMENTS & QUEUE LIST */}
            <div className="divide-y divide-slate-800/80">
              {appointments
                .filter(app => {
                  if (queueFilter === "ALL") return true;
                  return (app.queueStatus || "WAITING") === queueFilter;
                })
                .length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No appointments matching this queue filter.</div>
              ) : (
                appointments
                  .filter(app => {
                    if (queueFilter === "ALL") return true;
                    return (app.queueStatus || "WAITING") === queueFilter;
                  })
                  .map((app) => (
                    <div key={app.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div className="flex items-start space-x-3">
                        {/* Token Badge */}
                        <div className="shrink-0 text-center">
                          {app.tokenNumber ? (
                            <div className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 font-extrabold text-xs rounded-xl border border-cyan-500/30">
                              Token #{app.tokenNumber}
                            </div>
                          ) : (
                            <div className="px-2 py-1 bg-slate-950 text-slate-500 font-medium text-[10px] rounded-lg border border-slate-800">
                              No Token
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="font-bold text-slate-100 text-sm flex items-center space-x-2">
                            <span>{app.patient?.name || "Patient"}</span>
                            {app.patient?.phone && (
                              <span className="text-slate-500 text-xs font-normal">({app.patient.phone})</span>
                            )}
                          </div>
                          <div className="text-slate-400">
                            Physician: <span className="text-purple-400 font-semibold">{app.doctor?.name}</span>
                            {app.doctor?.department && (
                              <span className="text-slate-500"> • {app.doctor.department.name}</span>
                            )}
                          </div>
                          <div className="text-slate-400">
                            Reason: <span className="text-slate-300">{app.reason}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-right space-y-0.5">
                          <span className="text-slate-300 font-semibold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 block text-[11px]">
                            {new Date(app.slotDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(app.slotDateTime).toLocaleDateString()}
                          </span>
                          {app.checkedInAt && (
                            <span className="text-[10px] text-slate-500 block">
                              In: {new Date(app.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          app.queueStatus === "IN_CONSULTATION"
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : app.queueStatus === "CHECKED_IN"
                            ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                            : app.queueStatus === "COMPLETED"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}>
                          {app.queueStatus || "WAITING"}
                        </span>

                        {/* Check-in Action Button */}
                        {(!app.queueStatus || app.queueStatus === "WAITING") && app.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleCheckIn(app.id)}
                            disabled={checkingInId === app.id}
                            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center space-x-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{checkingInId === app.id ? "Checking In..." : "Check In"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* REGISTER PATIENT TAB */}
      {activeTab === "register" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <UserPlus className="h-5 w-5 text-purple-400" />
              <span>Walk-In Patient Registration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Create a new patient medical file and user profile.
            </p>
          </div>

          {regSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <span>{regSuccess}</span>
            </div>
          )}

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <form onSubmit={handleRegisterPatient} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regData.name}
                    onChange={(e) => setRegData({ ...regData, name: e.target.value })}
                    placeholder="Patient Name"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={regData.email}
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                    placeholder="patient@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    required
                    value={regData.phone}
                    onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                    placeholder="555-0199"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={regData.dob}
                    onChange={(e) => setRegData({ ...regData, dob: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Blood Group</label>
                  <select
                    value={regData.bloodGroup}
                    onChange={(e) => setRegData({ ...regData, bloodGroup: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Residential Address</label>
                <input
                  type="text"
                  required
                  value={regData.address}
                  onChange={(e) => setRegData({ ...regData, address: e.target.value })}
                  placeholder="Street address..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100"
                />
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition-all"
              >
                {regLoading ? "Registering Patient..." : "Create Patient Medical Account"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* BILLING COUNTER TAB */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <Receipt className="h-5 w-5 text-purple-400" />
                <span>Hospital Billing, Invoicing & Revenue Desk</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Process OPD consultations, pharmacy line items, diagnostic investigations, and print itemized tax invoices.
              </p>
            </div>

            <button
              onClick={() => setShowCreateInvoiceModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg flex items-center space-x-2 transition-all w-fit"
            >
              <Plus className="h-4 w-4" />
              <span>Create Custom Invoice</span>
            </button>
          </div>

          {/* Revenue & KPI Summary Cards */}
          {billingStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold">Total Invoices</span>
                  <Receipt className="h-4 w-4 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-slate-100">{billingStats.totalInvoices}</div>
                <span className="text-[10px] text-slate-500">{billingStats.paidCount} Paid • {billingStats.pendingCount} Pending</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold">Outstanding Due</span>
                  <Clock className="h-4 w-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">${billingStats.outstandingAmount.toFixed(2)}</div>
                <span className="text-[10px] text-slate-500">{billingStats.pendingCount} unpaid invoices</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold">Total Revenue</span>
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">${billingStats.totalRevenue.toFixed(2)}</div>
                <span className="text-[10px] text-slate-500">Collected to date</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold">Today's Collections</span>
                  <DollarSign className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-cyan-400 font-mono">${billingStats.todayCollections.toFixed(2)}</div>
                <span className="text-[10px] text-slate-500">Cleared today</span>
              </div>
            </div>
          )}

          {/* Search and Filters Bar */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient name or invoice #..."
                value={billingSearch}
                onChange={(e) => setBillingSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto">
              {["ALL", "PENDING", "PAID", "CANCELLED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setBillingFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    billingFilter === st
                      ? "bg-purple-600 text-white shadow-md"
                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {st === "ALL" ? "All Bills" : st === "PENDING" ? "Due / Outstanding" : st}
                </button>
              ))}
            </div>
          </div>

          {/* Invoices List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="divide-y divide-slate-800/80">
              {bills
                .filter((b) => {
                  if (billingFilter !== "ALL" && (b.paymentStatus || b.status) !== billingFilter) return false;
                  if (billingSearch.trim()) {
                    const q = billingSearch.toLowerCase();
                    const patName = (b.patient?.name || "").toLowerCase();
                    const invNo = (b.invoiceNumber || b.id).toLowerCase();
                    return patName.includes(q) || invNo.includes(q);
                  }
                  return true;
                })
                .length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No invoices match the selected filter or search query.
                </div>
              ) : (
                bills
                  .filter((b) => {
                    if (billingFilter !== "ALL" && (b.paymentStatus || b.status) !== billingFilter) return false;
                    if (billingSearch.trim()) {
                      const q = billingSearch.toLowerCase();
                      const patName = (b.patient?.name || "").toLowerCase();
                      const invNo = (b.invoiceNumber || b.id).toLowerCase();
                      return patName.includes(q) || invNo.includes(q);
                    }
                    return true;
                  })
                  .map((bill: any) => {
                    const isPaid = bill.status === "PAID" || bill.paymentStatus === "PAID";
                    const isCancelled = bill.status === "CANCELLED" || bill.paymentStatus === "CANCELLED";
                    const items = bill.billItems && bill.billItems.length > 0
                      ? bill.billItems
                      : (Array.isArray(bill.items) ? bill.items : []);

                    return (
                      <div key={bill.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-xs text-purple-400">
                              {bill.invoiceNumber || `INV-${bill.id.slice(0, 8).toUpperCase()}`}
                            </span>
                            <span className="text-slate-300 font-bold text-sm">{bill.patient?.name || "Patient"}</span>
                            <span className="text-slate-500">({bill.patient?.phone || "No Phone"})</span>
                          </div>

                          {/* Line items category pills */}
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {items.map((item: any, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 bg-slate-950 rounded text-slate-300 text-[11px] border border-slate-800">
                                <strong className="text-slate-400">{item.category || "SERVICE"}:</strong> {item.description} (${(item.amount || item.cost || 0).toFixed(2)})
                              </span>
                            ))}
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center space-x-3 pt-0.5">
                            <span>Created: {new Date(bill.createdAt).toLocaleDateString()}</span>
                            {bill.paidAt && (
                              <span className="text-emerald-400">Paid: {new Date(bill.paidAt).toLocaleDateString()} ({bill.paymentMethod || "CASH"})</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Net</span>
                            <span className="text-base font-extrabold text-cyan-400 font-mono">
                              ${(bill.totalAmount ?? bill.amount).toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border inline-flex items-center space-x-1 ${
                              isPaid
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : isCancelled
                                ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                                : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            }`}>
                              {isPaid && <CheckCircle2 className="h-3 w-3" />}
                              <span>{bill.paymentStatus || bill.status}</span>
                            </span>

                            <button
                              onClick={() => setSelectedInvoice(bill)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 flex items-center space-x-1 transition-all"
                            >
                              <Printer className="h-3.5 w-3.5 text-cyan-400" />
                              <span>Invoice</span>
                            </button>

                            {!isPaid && !isCancelled && (
                              <>
                                <button
                                  onClick={() => setSelectedInvoice(bill)}
                                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
                                >
                                  Collect
                                </button>
                                <button
                                  onClick={() => handleCancelInvoice(bill.id)}
                                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition-all"
                                  title="Cancel Invoice"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE CUSTOM INVOICE MODAL */}
      {showCreateInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Receipt className="h-5 w-5 text-purple-400" />
                <span>Create Hospital Invoice</span>
              </h3>
              <button onClick={() => setShowCreateInvoiceModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {createBillError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                {createBillError}
              </div>
            )}

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Patient *</label>
                <select
                  required
                  value={createBillPatientId}
                  onChange={(e) => setCreateBillPatientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((pat) => (
                    <option key={pat.id} value={pat.id}>{pat.name} ({pat.phone})</option>
                  ))}
                </select>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-semibold">Billable Line Items *</label>
                  <button
                    type="button"
                    onClick={() => setCreateBillItems([...createBillItems, { description: "", category: "OTHER", quantity: 1, unitPrice: 0 }])}
                    className="text-purple-400 hover:text-purple-300 text-[11px] font-bold flex items-center space-x-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {createBillItems.map((item, idx) => (
                    <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <input
                          type="text"
                          required
                          placeholder="Description..."
                          value={item.description}
                          onChange={(e) => {
                            const updated = [...createBillItems];
                            updated[idx].description = e.target.value;
                            setCreateBillItems(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-slate-100 text-xs"
                        />
                      </div>
                      <div className="col-span-3">
                        <select
                          value={item.category}
                          onChange={(e) => {
                            const updated = [...createBillItems];
                            updated[idx].category = e.target.value;
                            setCreateBillItems(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-slate-100 text-xs"
                        >
                          <option value="CONSULTATION">CONSULTATION</option>
                          <option value="PHARMACY">PHARMACY</option>
                          <option value="LABORATORY">LABORATORY</option>
                          <option value="PROCEDURE">PROCEDURE</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...createBillItems];
                            updated[idx].quantity = parseInt(e.target.value) || 1;
                            setCreateBillItems(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-slate-100 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="Price"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const updated = [...createBillItems];
                            updated[idx].unitPrice = parseFloat(e.target.value) || 0;
                            setCreateBillItems(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-slate-100 text-xs"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        {createBillItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setCreateBillItems(createBillItems.filter((_, i) => i !== idx))}
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={createBillTaxRate}
                    onChange={(e) => setCreateBillTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Discount Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={createBillDiscount}
                    onChange={(e) => setCreateBillDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-100"
                  />
                </div>
              </div>

              {/* Calculated Total Box */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="text-slate-200">
                    ${createBillItems.reduce((s, i) => s + (i.quantity * i.unitPrice), 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tax ({createBillTaxRate}%):</span>
                  <span className="text-slate-200">
                    +${((createBillItems.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) * createBillTaxRate) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold border-t border-slate-850 pt-1 text-sm">
                  <span>Grand Total:</span>
                  <span>
                    ${Math.max(0, (createBillItems.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) * (1 + createBillTaxRate / 100)) - createBillDiscount).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateInvoiceModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBillLoading}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg disabled:opacity-50"
                >
                  {createBillLoading ? "Creating Invoice..." : "Issue Official Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE INVOICE MODAL */}
      {selectedInvoice && (
        <InvoiceModal
          bill={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPaymentSuccess={() => {
            fetchData();
            setSelectedInvoice(null);
          }}
          allowPayment={true}
        />
      )}

      {/* SCHEDULE MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-purple-400" />
              <span>Schedule Walk-in / OPD Appointment</span>
            </h3>

            {scheduleError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                {scheduleError}
              </div>
            )}

            <form onSubmit={handleScheduleAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Registered Patient</label>
                <select
                  required
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((pat) => (
                    <option key={pat.id} value={pat.id}>{pat.name} ({pat.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Physician</label>
                <select
                  required
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100"
                >
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.name} ({doc.specialization})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Appointment Date</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split("T")[0]}
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                />
              </div>

              {/* Dynamic Doctor Slots Grid */}
              {selectedDoctorId && slotDate && (
                <div className="space-y-2">
                  <label className="block text-slate-300 font-semibold">
                    Available Consultation Slots {availableSlots.length > 0 && `(${availableSlots.filter(s => s.available).length} Open)`}
                  </label>

                  {slotsLoading ? (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center text-slate-400 text-xs">
                      Loading doctor consultation slots...
                    </div>
                  ) : slotsMessage ? (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs">
                      {slotsMessage}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pr-1">
                      {availableSlots.map((slot, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setSelectedSlotDateTime(slot.slotDateTime)}
                          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all text-center ${
                            selectedSlotDateTime === slot.slotDateTime
                              ? "bg-purple-500 text-white ring-2 ring-purple-300 shadow-md"
                              : slot.available
                              ? "bg-slate-950 border border-slate-800 text-slate-200 hover:border-purple-500/60 hover:bg-slate-850"
                              : "bg-slate-950/40 border border-slate-900 text-slate-600 cursor-not-allowed opacity-50 line-through"
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedSlotDateTime && (
                    <div className="text-[11px] text-purple-400 font-semibold">
                      Selected Slot: {new Date(selectedSlotDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on {slotDate}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Chief Complaint / Reason</label>
                <textarea
                  required
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for scheduling..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleLoading}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-lg"
                >
                  {scheduleLoading ? "Booking..." : "Schedule Visit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
