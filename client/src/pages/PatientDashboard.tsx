import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { Appointment, DiagnosisRecord, Prescription, Doctor, Patient, Vitals, LabOrder, Bill } from "../types";
import { InvoiceModal } from "../components/InvoiceModal";
import { 
  Calendar, 
  FileText, 
  Pill, 
  Bot, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Stethoscope, 
  User as UserIcon, 
  Activity, 
  Shield, 
  Edit3, 
  Save, 
  X, 
  Phone, 
  AlertTriangle,
  FlaskConical,
  Clock,
  CreditCard,
  Receipt,
  Printer,
  TrendingUp
} from "lucide-react";

interface PatientDashboardProps {
  activeTab: string;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ activeTab }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reports, setReports] = useState<DiagnosisRecord[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedPatientInvoice, setSelectedPatientInvoice] = useState<Bill | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [viewPatientLabReport, setViewPatientLabReport] = useState<LabOrder | null>(null);
  const [labLoading, setLabLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Medical Profile & Vitals State
  const [profile, setProfile] = useState<Patient | null>(null);
  const [vitalsList, setVitalsList] = useState<Vitals[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [vitalsLoading, setVitalsLoading] = useState(false);
  const [editProfileMode, setEditProfileMode] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    name: "",
    phone: "",
    address: "",
    bloodGroup: "O+",
    allergies: "",
    chronicConditions: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    insuranceProvider: "",
    insuranceNumber: "",
  });
  const [saveProfileLoading, setSaveProfileLoading] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Booking Modal State
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [slotDate, setSlotDate] = useState("");
  const [reason, setReason] = useState("");
  const [availableSlots, setAvailableSlots] = useState<Array<{ time: string; slotDateTime: string; available: boolean; reason?: string }>>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsMessage, setSlotsMessage] = useState("");
  const [selectedSlotDateTime, setSelectedSlotDateTime] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");

  // AI Chat State
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "ai"; content: string; disclaimer?: boolean }>>([
    {
      role: "ai",
      content: "Hello! I am your MediAssist Patient Assistant. Describe any wellness questions or non-emergency symptoms you'd like general guidance on.",
      disclaimer: true,
    },
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === "appointments") {
        const appRes = await api.get("/appointments");
        setAppointments(appRes.data);

        const docRes = await api.get("/doctors");
        setDoctors(docRes.data);
      } else if (activeTab === "reports") {
        const [repRes, labRes] = await Promise.all([
          api.get("/diagnosis"),
          api.get("/lab/orders"),
        ]);
        setReports(repRes.data);
        setLabOrders(labRes.data);
      } else if (activeTab === "lab-reports") {
        setLabLoading(true);
        const labRes = await api.get("/lab/orders");
        setLabOrders(labRes.data);
        setLabLoading(false);
      } else if (activeTab === "prescriptions") {
        const presRes = await api.get("/pharmacy/prescriptions");
        setPrescriptions(presRes.data);
      } else if (activeTab === "billing") {
        setBillingLoading(true);
        const billRes = await api.get("/bills");
        setBills(billRes.data);
        setBillingLoading(false);
      } else if (activeTab === "profile") {
        setProfileLoading(true);
        const profRes = await api.get("/patients/me");
        setProfile(profRes.data);
        setProfileFormData({
          name: profRes.data.name || "",
          phone: profRes.data.phone || "",
          address: profRes.data.address || "",
          bloodGroup: profRes.data.bloodGroup || "O+",
          allergies: profRes.data.allergies || "",
          chronicConditions: profRes.data.chronicConditions || "",
          emergencyContactName: profRes.data.emergencyContactName || "",
          emergencyContactPhone: profRes.data.emergencyContactPhone || "",
          insuranceProvider: profRes.data.insuranceProvider || "",
          insuranceNumber: profRes.data.insuranceNumber || "",
        });
        setProfileLoading(false);
      } else if (activeTab === "vitals") {
        setVitalsLoading(true);
        const profRes = await api.get("/patients/me");
        setProfile(profRes.data);
        if (profRes.data?.id) {
          const vitRes = await api.get(`/patients/${profRes.data.id}/vitals`);
          setVitalsList(vitRes.data);
        }
        setVitalsLoading(false);
      }
    } catch (err) {
      console.error("Failed to load patient data", err);
      setProfileLoading(false);
      setVitalsLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveProfileLoading(true);
    setProfileFeedback(null);
    try {
      const res = await api.put("/patients/me", profileFormData);
      setProfile(res.data);
      setEditProfileMode(false);
      setProfileFeedback({ type: "success", message: "Medical profile updated successfully!" });
    } catch (err: any) {
      setProfileFeedback({
        type: "error",
        message: err.response?.data?.error || "Failed to update medical profile. Please check your inputs.",
      });
    } finally {
      setSaveProfileLoading(false);
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

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError("");
    if (!selectedSlotDateTime) {
      setBookingError("Please select an available consultation time slot.");
      return;
    }
    setBookingLoading(true);

    try {
      await api.post("/appointments", {
        doctorId: selectedDoctorId,
        slotDateTime: selectedSlotDateTime,
        reason,
      });

      setShowBookModal(false);
      setReason("");
      setSelectedSlotDateTime("");
      setSelectedDoctorId("");
      setSlotDate("");
      fetchData();
      alert("Appointment confirmed! You can view it in your appointments list.");
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Failed to book appointment.";
      setBookingError(errMsg);
      if (selectedDoctorId && slotDate) {
        fetchDoctorSlots(selectedDoctorId, slotDate);
      }
    } finally {
      setBookingLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || aiLoading) return;

    const userText = chatInput;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userText }]);
    setAiLoading(true);

    try {
      const res = await api.post("/ai/patient-chat", {
        message: userText,
        history: []
      });
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: res.data.response || "Thank you for sharing. Please consult your physician for a medical evaluation.",
          disclaimer: true,
        },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: "I am having trouble connecting to the medical assistant right now. Please talk directly to our clinic desk.",
          disclaimer: true,
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* APPOINTMENTS TAB */}
      {activeTab === "appointments" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-cyan-400" />
                <span>My Appointments</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                View your upcoming doctor consultations or schedule a new visit.
              </p>
            </div>
            <button
              onClick={() => setShowBookModal(true)}
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-lg shadow-cyan-600/20 flex items-center space-x-2 transition-all w-fit"
            >
              <Plus className="h-4 w-4" />
              <span>Book Appointment</span>
            </button>
          </div>

          {/* Appointments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {appointments.length === 0 ? (
              <div className="col-span-2 p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                No appointments booked yet. Click "Book Appointment" to schedule your visit.
              </div>
            ) : (
              appointments.map((app) => (
                <div key={app.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-xl bg-cyan-950 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
                        <Stethoscope className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">{app.doctor?.name || "Assigned Doctor"}</h4>
                        <span className="text-xs text-cyan-400 font-medium">{app.doctor?.specialization || "General Clinic"}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end space-y-1">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                        app.status === "CONFIRMED" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}>
                        {app.status}
                      </span>
                      {app.tokenNumber && (
                        <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 font-extrabold text-[11px] rounded-lg border border-cyan-500/30">
                          Token #{app.tokenNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Live Queue Status Banner */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className={`h-2 w-2 rounded-full ${
                        app.queueStatus === "IN_CONSULTATION"
                          ? "bg-amber-400 animate-ping"
                          : app.queueStatus === "CHECKED_IN"
                          ? "bg-cyan-400 animate-pulse"
                          : app.queueStatus === "COMPLETED"
                          ? "bg-emerald-400"
                          : "bg-slate-500"
                      }`} />
                      <span className="text-slate-400 font-medium">
                        {app.queueStatus === "IN_CONSULTATION"
                          ? "With Doctor • Consultation in Progress"
                          : app.queueStatus === "CHECKED_IN"
                          ? "Checked In • Waiting in Clinic Lobby"
                          : app.queueStatus === "COMPLETED"
                          ? "Consultation Completed"
                          : "Scheduled • Awaiting Check-In at Front Desk"}
                      </span>
                    </div>

                    {app.checkedInAt && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        Checked in: {new Date(app.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div className="pt-1 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Date & Time</span>
                      <span className="text-slate-300 font-medium">{new Date(app.slotDateTime).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Reason</span>
                      <span className="text-slate-300 font-medium truncate block">{app.reason}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CONFIRMED REPORTS TAB (STRICT SECURITY RULE: Patients only see official confirmed reports) */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <FileText className="h-5 w-5 text-emerald-400" />
              <span>Confirmed Medical Reports</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Official diagnosis records verified by your attending physician.
            </p>
          </div>

          <div className="space-y-4">
            {reports.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                No confirmed medical reports available yet. Reports appear here after your doctor confirms the final diagnosis.
              </div>
            ) : (
              reports.map((rep: any) => (
                <div key={rep.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <span className="text-sm font-bold text-slate-100">Official Diagnosis Report</span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      Confirmed on: {rep.confirmedAt ? new Date(rep.confirmedAt).toLocaleDateString() : "N/A"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">Attending Physician</span>
                      <span className="text-slate-200 font-bold text-sm mt-0.5 block">{rep.doctorName || "Dr. Assigned"}</span>
                      <span className="text-cyan-400 font-medium">{rep.departmentName || "General Care"}</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">Confirmed Diagnosis</span>
                      <span className="text-emerald-400 font-bold text-base mt-0.5 block">{rep.finalDiagnosis}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold mb-1">Reported Symptoms</span>
                    <p className="text-xs text-slate-300 leading-relaxed">{rep.symptoms}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* DIAGNOSTIC & LAB REPORTS TAB */}
      {activeTab === "lab-reports" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <FlaskConical className="h-5 w-5 text-cyan-400" />
              <span>My Diagnostic & Laboratory Reports</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Review pathology investigations, specimen accessioning status, and signed diagnostic reports.
            </p>
          </div>

          <div className="space-y-4">
            {labLoading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Loading your diagnostic reports...
              </div>
            ) : labOrders.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                No diagnostic test orders on file. Laboratory orders prescribed by your physician will appear here.
              </div>
            ) : (
              labOrders.map((order) => (
                <div key={order.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-cyan-400">{order.orderNumber}</span>
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase ${
                          order.priority === "STAT"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : order.priority === "URGENT"
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}>
                          {order.priority}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-100 text-base mt-1">{order.labTest?.name}</h4>
                      <div className="text-xs text-slate-400">
                        Ordering Doctor: <span className="text-slate-200 font-medium">{order.doctor?.name}</span> • Category: {order.labTest?.category}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border inline-flex items-center space-x-1 ${
                        order.status === "COMPLETED"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : order.status === "SAMPLE_COLLECTED"
                          ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}>
                        {order.status === "COMPLETED" && <CheckCircle2 className="h-3 w-3" />}
                        {order.status === "SAMPLE_COLLECTED" && <FlaskConical className="h-3 w-3" />}
                        {order.status === "ORDERED" && <Clock className="h-3 w-3" />}
                        <span>{order.status.replace("_", " ")}</span>
                      </span>

                      {order.status === "COMPLETED" && (
                        <button
                          onClick={() => setViewPatientLabReport(order)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg transition-all flex items-center space-x-1.5"
                        >
                          <FileText className="h-4 w-4" />
                          <span>View Official Report</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-850">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Sample Type</span>
                      <span className="text-slate-300 font-semibold">{order.labTest?.sampleType}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Ordered Date</span>
                      <span className="text-slate-300 font-semibold">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Report Status</span>
                      <span className="text-emerald-400 font-semibold">
                        {order.status === "COMPLETED" ? "Published & Verified" : "Specimen In Process"}
                      </span>
                    </div>
                  </div>

                  {order.clinicalNotes && (
                    <div className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-850">
                      <strong className="text-slate-300">Doctor Instructions: </strong>{order.clinicalNotes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* PRESCRIPTIONS TAB */}
      {activeTab === "prescriptions" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Pill className="h-5 w-5 text-cyan-400" />
              <span>My Prescriptions</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Active medications issued by your doctors and dispensed by hospital pharmacy.
            </p>
          </div>

          <div className="space-y-4">
            {prescriptions.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                No active prescriptions found.
              </div>
            ) : (
              prescriptions.map((pres: any) => (
                <div key={pres.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <Pill className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs font-bold text-slate-200">Prescription #{pres.id.slice(0, 8)}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                      pres.status === "DISPENSED" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    }`}>
                      {pres.status}
                    </span>
                  </div>

                  {/* Medicines List */}
                  <div className="divide-y divide-slate-800/60">
                    {(pres.medicines || []).map((med: any, idx: number) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-100 text-sm">{med.medicineName}</span>
                          <div className="text-slate-400 text-[11px] mt-0.5">
                            Dosage: <span className="text-slate-200">{med.dosage}</span> • Frequency: <span className="text-slate-200">{med.frequency}</span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-slate-950 rounded-lg text-cyan-400 text-[11px] font-semibold border border-slate-800">
                          {med.duration}
                        </span>
                      </div>
                    ))}
                  </div>

                  {pres.notes && (
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs text-slate-400">
                      <span className="font-bold text-slate-300">Doctor Notes: </span>{pres.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* BILLING & INVOICES TAB */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Receipt className="h-5 w-5 text-cyan-400" />
              <span>My Hospital Invoices, Bills & Receipts</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Review itemized charges for doctor consultations, pharmacy prescriptions, and diagnostic lab investigations.
            </p>
          </div>

          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Total Incurred</span>
                <Receipt className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono">
                ${bills
                  .filter((b) => b.status !== "CANCELLED" && b.paymentStatus !== "CANCELLED")
                  .reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0)
                  .toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500">{bills.length} total hospital invoices</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Paid & Cleared</span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                ${bills
                  .filter((b) => b.status === "PAID" || b.paymentStatus === "PAID")
                  .reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0)
                  .toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500">
                {bills.filter((b) => b.status === "PAID" || b.paymentStatus === "PAID").length} invoices paid
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Outstanding Due</span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                ${bills
                  .filter((b) => b.status === "PENDING" || b.paymentStatus === "PENDING")
                  .reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0)
                  .toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500">
                {bills.filter((b) => b.status === "PENDING" || b.paymentStatus === "PENDING").length} pending payments
              </span>
            </div>
          </div>

          {/* Invoices List */}
          <div className="space-y-4">
            {billingLoading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading your hospital invoices...</div>
            ) : bills.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                No invoices found on record.
              </div>
            ) : (
              bills.map((bill) => {
                const isPaid = bill.status === "PAID" || bill.paymentStatus === "PAID";
                const isCancelled = bill.status === "CANCELLED" || bill.paymentStatus === "CANCELLED";
                const items = bill.billItems && bill.billItems.length > 0
                  ? bill.billItems
                  : (Array.isArray(bill.items) ? bill.items : []);

                return (
                  <div key={bill.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-cyan-400">
                            {bill.invoiceNumber || `INV-${bill.id.slice(0, 8).toUpperCase()}`}
                          </span>
                          <span className="text-xs text-slate-500">
                            Issued: {new Date(bill.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-100 text-sm mt-0.5">
                          {bill.appointment?.doctor ? `Consultation with ${bill.appointment.doctor.name}` : "Hospital Services & Medications"}
                        </h4>
                      </div>

                      <div className="flex items-center space-x-3">
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
                          onClick={() => setSelectedPatientInvoice(bill)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 flex items-center space-x-1.5 transition-all"
                        >
                          <Printer className="h-3.5 w-3.5 text-cyan-400" />
                          <span>View / Print</span>
                        </button>

                        {!isPaid && !isCancelled && (
                          <button
                            onClick={() => setSelectedPatientInvoice(bill)}
                            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg transition-all flex items-center space-x-1"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Pay Online</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Itemized badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((item: any, idx: number) => (
                        <span key={idx} className="px-2.5 py-1 bg-slate-950 rounded-lg text-slate-300 text-xs border border-slate-850">
                          <strong className="text-slate-400">{item.category || "SERVICE"}:</strong> {item.description} (${(item.amount || item.cost || 0).toFixed(2)})
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-slate-950 p-3 rounded-xl border border-slate-850 gap-2">
                      <div className="text-slate-400">
                        {isPaid && bill.paidAt ? (
                          <span className="text-emerald-400">
                            Paid via <strong className="uppercase">{bill.paymentMethod || "CASH"}</strong> on {new Date(bill.paidAt).toLocaleDateString()}
                            {bill.transactionReference && ` • Ref: ${bill.transactionReference}`}
                          </span>
                        ) : isCancelled ? (
                          <span className="text-rose-400">Invoice was cancelled</span>
                        ) : (
                          <span>Payment required to settle this hospital bill</span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-right">
                        {bill.taxAmount && bill.taxAmount > 0 ? (
                          <span className="text-[11px] text-slate-500">Tax: +${bill.taxAmount.toFixed(2)}</span>
                        ) : null}
                        {bill.discountAmount && bill.discountAmount > 0 ? (
                          <span className="text-[11px] text-emerald-400">Discount: -${bill.discountAmount.toFixed(2)}</span>
                        ) : null}
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Amount</span>
                          <span className="text-base font-extrabold text-cyan-400 font-mono">
                            ${(bill.totalAmount ?? bill.amount).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MY MEDICAL PROFILE TAB */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <UserIcon className="h-5 w-5 text-cyan-400" />
                <span>My Medical Profile</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage your personal demographics, clinical history, emergency contacts, and insurance coverage.
              </p>
            </div>

            {!editProfileMode && (
              <button
                onClick={() => setEditProfileMode(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg transition-all"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          {profileFeedback && (
            <div className={`p-4 rounded-xl text-xs flex items-center space-x-2 ${
              profileFeedback.type === "success" 
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
                : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
            }`}>
              {profileFeedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{profileFeedback.message}</span>
            </div>
          )}

          {profileLoading ? (
            <div className="p-12 text-center text-slate-500 text-xs">Loading medical profile...</div>
          ) : editProfileMode ? (
            /* EDIT PROFILE FORM */
            <form onSubmit={handleUpdateProfile} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Edit3 className="h-4 w-4 text-cyan-400" />
                  <span>Update Medical & Contact Information</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditProfileMode(false)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profileFormData.name}
                    onChange={(e) => setProfileFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={profileFormData.phone}
                    onChange={(e) => setProfileFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Blood Group</label>
                  <select
                    value={profileFormData.bloodGroup}
                    onChange={(e) => setProfileFormData(prev => ({ ...prev, bloodGroup: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Residential Address</label>
                  <input
                    type="text"
                    required
                    value={profileFormData.address}
                    onChange={(e) => setProfileFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Allergies (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Peanuts, Latex"
                    value={profileFormData.allergies}
                    onChange={(e) => setProfileFormData(prev => ({ ...prev, allergies: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Chronic Conditions (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma"
                    value={profileFormData.chronicConditions}
                    onChange={(e) => setProfileFormData(prev => ({ ...prev, chronicConditions: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Doe (Spouse)"
                    value={profileFormData.emergencyContactName}
                    onChange={(e) => setProfileFormData(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Emergency Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +1 555-0199"
                    value={profileFormData.emergencyContactPhone}
                    onChange={(e) => setProfileFormData(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Insurance Provider</label>
                  <input
                    type="text"
                    placeholder="e.g. BlueCross Shield / Aetna"
                    value={profileFormData.insuranceProvider}
                    onChange={(e) => setProfileFormData(prev => ({ ...prev, insuranceProvider: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Insurance Policy #</label>
                  <input
                    type="text"
                    placeholder="e.g. POL-9842104"
                    value={profileFormData.insuranceNumber}
                    onChange={(e) => setProfileFormData(prev => ({ ...prev, insuranceNumber: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditProfileMode(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveProfileLoading}
                  className="flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg"
                >
                  <Save className="h-4 w-4" />
                  <span>{saveProfileLoading ? "Saving..." : "Save Medical Profile"}</span>
                </button>
              </div>
            </form>
          ) : profile ? (
            /* PROFILE DISPLAY CARDS */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Personal Information */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  <UserIcon className="h-4 w-4" />
                  <span>Personal Demographics</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Full Name</span>
                    <span className="font-semibold text-slate-100">{profile.name}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Phone</span>
                    <span className="font-semibold text-slate-100">{profile.phone}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Date of Birth</span>
                    <span className="font-semibold text-slate-100">{new Date(profile.dob).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Gender</span>
                    <span className="font-semibold text-slate-100">{profile.gender}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Blood Group</span>
                    <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800/50 font-bold">{profile.bloodGroup}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Address</span>
                    <span className="font-semibold text-slate-100 text-right max-w-xs">{profile.address}</span>
                  </div>
                </div>
              </div>

              {/* Medical History & Allergies */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Clinical Alerts & History</span>
                </div>
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-1.5 font-semibold">Known Allergies</span>
                    {profile.allergies ? (
                      <div className="flex flex-wrap gap-1.5">
                        {profile.allergies.split(",").map((a, i) => (
                          <span key={i} className="px-2.5 py-1 bg-rose-950/60 border border-rose-800/60 text-rose-300 rounded-lg text-[11px] font-medium">
                            {a.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">No known allergies recorded</span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-slate-400 block mb-1.5 font-semibold">Chronic Medical Conditions</span>
                    {profile.chronicConditions ? (
                      <div className="flex flex-wrap gap-1.5">
                        {profile.chronicConditions.split(",").map((c, i) => (
                          <span key={i} className="px-2.5 py-1 bg-amber-950/60 border border-amber-800/60 text-amber-300 rounded-lg text-[11px] font-medium">
                            {c.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">No chronic conditions recorded</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  <Phone className="h-4 w-4" />
                  <span>Emergency Contact</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Contact Name</span>
                    <span className="font-semibold text-slate-100">{profile.emergencyContactName || "Not provided"}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Emergency Phone</span>
                    <span className="font-semibold text-slate-100">{profile.emergencyContactPhone || "Not provided"}</span>
                  </div>
                </div>
              </div>

              {/* Insurance & Coverage */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
                  <Shield className="h-4 w-4" />
                  <span>Insurance & Policy Coverage</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Insurance Provider</span>
                    <span className="font-semibold text-slate-100">{profile.insuranceProvider || "Self-Pay / Not Registered"}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Policy Number</span>
                    <span className="font-mono text-slate-200">{profile.insuranceNumber || "N/A"}</span>
                  </div>
                </div>
              </div>

            </div>
          ) : null}
        </div>
      )}

      {/* VITALS HISTORY TAB */}
      {activeTab === "vitals" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Activity className="h-5 w-5 text-cyan-400" />
              <span>Clinical Vitals History</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Historical physiological vitals recorded during your clinic check-ins and consultations.
            </p>
          </div>

          {/* Latest Vitals Overview KPI if available */}
          {vitalsList.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Blood Pressure</span>
                <div className="text-xl font-extrabold text-slate-100 mt-1">
                  {vitalsList[0].bloodPressure || "--/--"} <span className="text-xs text-slate-500 font-normal">mmHg</span>
                </div>
                <div className="text-[10px] text-cyan-400 mt-1">Latest Check-in</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Pulse Rate</span>
                <div className="text-xl font-extrabold text-emerald-400 mt-1">
                  {vitalsList[0].pulse || "--"} <span className="text-xs text-slate-500 font-normal">bpm</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Resting Heart Rate</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Blood Oxygen (SpO2)</span>
                <div className="text-xl font-extrabold text-cyan-400 mt-1">
                  {vitalsList[0].spo2 || "--"} <span className="text-xs text-slate-500 font-normal">%</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Oxygen Saturation</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Body Mass Index (BMI)</span>
                <div className="text-xl font-extrabold text-purple-400 mt-1">
                  {vitalsList[0].bmi ? vitalsList[0].bmi.toFixed(1) : "--"}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {vitalsList[0].weight ? `${vitalsList[0].weight} kg` : ""} {vitalsList[0].height ? `• ${vitalsList[0].height} cm` : ""}
                </div>
              </div>
            </div>
          )}

          {/* Vitals History List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Recorded Entries</h3>
              <span className="text-[11px] text-slate-400">{vitalsList.length} records</span>
            </div>

            {vitalsLoading ? (
              <div className="p-12 text-center text-slate-500 text-xs">Loading vitals history...</div>
            ) : vitalsList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No clinical vitals recorded yet. Vitals will appear here following your in-person clinic visits.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">BP (mmHg)</th>
                      <th className="py-3 px-4">Pulse (bpm)</th>
                      <th className="py-3 px-4">Temp (°F)</th>
                      <th className="py-3 px-4">SpO2 (%)</th>
                      <th className="py-3 px-4">Weight (kg)</th>
                      <th className="py-3 px-4">Height (cm)</th>
                      <th className="py-3 px-4">BMI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {vitalsList.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-850/50 transition-all">
                        <td className="py-3 px-4 font-medium text-slate-200">
                          {new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-100">
                          {v.bloodPressure || "--"}
                        </td>
                        <td className="py-3 px-4 text-emerald-400 font-semibold">
                          {v.pulse ? `${v.pulse} bpm` : "--"}
                        </td>
                        <td className="py-3 px-4 text-amber-400 font-semibold">
                          {v.temperature ? `${v.temperature}°F` : "--"}
                        </td>
                        <td className="py-3 px-4 text-cyan-400 font-semibold">
                          {v.spo2 ? `${v.spo2}%` : "--"}
                        </td>
                        <td className="py-3 px-4">{v.weight || "--"}</td>
                        <td className="py-3 px-4">{v.height || "--"}</td>
                        <td className="py-3 px-4">
                          {v.bmi ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              v.bmi < 18.5 
                                ? "bg-cyan-950 text-cyan-400 border border-cyan-800" 
                                : v.bmi < 25 
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800" 
                                : v.bmi < 30 
                                ? "bg-amber-950 text-amber-400 border border-amber-800" 
                                : "bg-rose-950 text-rose-400 border border-rose-800"
                            }`}>
                              {v.bmi.toFixed(1)}
                            </span>
                          ) : (
                            "--"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI SYMPTOM NAVIGATOR / CHATBOT TAB */}
      {activeTab === "ai-assistant" && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px]">
          
          {/* Chat Header */}
          <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">AI Health Navigator</h3>
                <p className="text-[11px] text-slate-400">General wellness & symptom guidance</p>
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-md p-4 rounded-2xl text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-cyan-600 text-white rounded-br-none"
                    : "bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none"
                }`}>
                  <p>{msg.content}</p>

                  {msg.disclaimer && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-start space-x-2 text-[10px] text-amber-400/90 font-medium">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        Notice: This AI provides educational information only and cannot confirm a diagnosis. Always consult your hospital doctor for medical treatment.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-xs text-slate-400 flex items-center space-x-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>MediAssist AI is reviewing...</span>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center space-x-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Describe your health question or symptom..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={aiLoading || !chatInput.trim()}
              className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg transition-all disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* BOOK APPOINTMENT MODAL */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-cyan-400" />
              <span>Book Doctor Consultation</span>
            </h3>

            {bookingError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {bookingError}
              </div>
            )}

            <form onSubmit={handleBookAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Physician</label>
                <select
                  required
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.specialization})
                    </option>
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Dynamic Doctor Slots Grid */}
              {selectedDoctorId && slotDate && (
                <div className="space-y-2">
                  <label className="block text-slate-300 font-semibold">
                    Available Consultation Slots {availableSlots.length > 0 && `(${availableSlots.filter(s => s.available).length} Open)`}
                  </label>

                  {slotsLoading ? (
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                      <div className="h-3 w-3 rounded-full bg-cyan-400 animate-ping" />
                      <span>Checking doctor calendar & available slots...</span>
                    </div>
                  ) : slotsMessage ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{slotsMessage}</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-xs text-center">
                      No slots generated for this date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {availableSlots.map((slot, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setSelectedSlotDateTime(slot.slotDateTime)}
                          className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all text-center ${
                            selectedSlotDateTime === slot.slotDateTime
                              ? "bg-cyan-500 text-slate-950 ring-2 ring-cyan-300 shadow-md"
                              : slot.available
                              ? "bg-slate-950 border border-slate-800 text-slate-200 hover:border-cyan-500/60 hover:bg-slate-850"
                              : "bg-slate-950/40 border border-slate-900 text-slate-600 cursor-not-allowed opacity-50 line-through"
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedSlotDateTime && (
                    <div className="text-[11px] text-cyan-400 font-semibold flex items-center space-x-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Selected Slot: {new Date(selectedSlotDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on {slotDate}</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reason for Visit / Symptoms</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe your symptoms or reason for booking..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg"
                >
                  {bookingLoading ? "Confirming..." : "Book Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PATIENT VIEW LAB REPORT MODAL */}
      {viewPatientLabReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <FlaskConical className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">{viewPatientLabReport.labTest?.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Report ID: {viewPatientLabReport.orderNumber} • Status: SIGNED & FINAL
                  </p>
                </div>
              </div>
              <button onClick={() => setViewPatientLabReport(null)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs">
              <div>
                <span className="text-slate-500 block">Attending / Ordering Doctor:</span>
                <span className="font-bold text-cyan-400">{viewPatientLabReport.doctor?.name}</span>
                <span className="text-slate-400 block text-[11px]">{viewPatientLabReport.doctor?.department?.name || "General Care"}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Report Verified Date:</span>
                <span className="font-semibold text-slate-200">
                  {viewPatientLabReport.completedAt ? new Date(viewPatientLabReport.completedAt).toLocaleString() : "N/A"}
                </span>
                <span className="text-emerald-400 block text-[11px]">Official Hospital Pathologist Verified</span>
              </div>
            </div>

            {/* PARAMETERS TABLE */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Investigation Parameter</th>
                    <th className="px-4 py-2.5">Measured Value</th>
                    <th className="px-4 py-2.5">Unit</th>
                    <th className="px-4 py-2.5">Standard Reference Range</th>
                    <th className="px-4 py-2.5">Result Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(viewPatientLabReport.labResult?.parameterResults || []).map((p: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 font-medium text-slate-200">{p.parameter}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-100">{p.value}</td>
                      <td className="px-4 py-2.5 text-slate-400">{p.unit}</td>
                      <td className="px-4 py-2.5 text-slate-400">{p.referenceRange}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase ${
                          p.flag === "HIGH"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : p.flag === "LOW"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : p.flag === "ABNORMAL"
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        }`}>
                          {p.flag}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CLINICAL SUMMARY */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-1 text-xs">
              <span className="font-bold text-cyan-400 block">Pathologist Clinical Interpretation:</span>
              <p className="text-slate-200 leading-relaxed">{viewPatientLabReport.labResult?.summary}</p>
              {viewPatientLabReport.labResult?.remarks && (
                <p className="text-slate-400 text-[11px] pt-1 border-t border-slate-900">
                  <strong className="text-slate-300">Notes: </strong>{viewPatientLabReport.labResult.remarks}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
              <span>Verified By: <strong className="text-emerald-400">{viewPatientLabReport.labResult?.approvedBy || "Pathologist On Duty"}</strong></span>
              <button
                onClick={() => setViewPatientLabReport(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PATIENT INVOICE & RECEIPT MODAL */}
      {selectedPatientInvoice && (
        <InvoiceModal
          bill={selectedPatientInvoice}
          onClose={() => setSelectedPatientInvoice(null)}
          onPaymentSuccess={() => {
            fetchData();
            setSelectedPatientInvoice(null);
          }}
          allowPayment={true}
        />
      )}

    </div>
  );
};

