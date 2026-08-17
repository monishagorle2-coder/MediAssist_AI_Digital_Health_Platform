import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { Appointment, Medicine, Vitals, LabOrder, LabTest } from "../types";
import { Stethoscope, Activity, Pill, CheckCircle2, Sparkles, ChevronRight, HeartPulse, X, AlertTriangle, FlaskConical, FileText, Plus } from "lucide-react";

interface DoctorDashboardProps {
  activeTab: string;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ activeTab }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [medicinesInventory, setMedicinesInventory] = useState<Medicine[]>([]);

  // Lab & Diagnostics State
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [labCatalog, setLabCatalog] = useState<LabTest[]>([]);
  const [showOrderLabModal, setShowOrderLabModal] = useState(false);
  const [orderLabPatientId, setOrderLabPatientId] = useState("");
  const [orderLabTestId, setOrderLabTestId] = useState("");
  const [orderLabPriority, setOrderLabPriority] = useState<"ROUTINE" | "URGENT" | "STAT">("ROUTINE");
  const [orderLabNotes, setOrderLabNotes] = useState("");
  const [orderLabLoading, setOrderLabLoading] = useState(false);
  const [viewDoctorReport, setViewDoctorReport] = useState<LabOrder | null>(null);
  const [patientLabReports, setPatientLabReports] = useState<LabOrder[]>([]);
  const [showPatientLabHistoryModal, setShowPatientLabHistoryModal] = useState(false);

  // Patient Clinical Vitals State
  const [patientVitals, setPatientVitals] = useState<Vitals[]>([]);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressure: "120/80",
    pulse: "72",
    temperature: "98.6",
    spo2: "98",
    weight: "70",
    height: "175",
  });
  const [saveVitalsLoading, setSaveVitalsLoading] = useState(false);
  const [vitalsError, setVitalsError] = useState("");

  // AI Decision Support State
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [symptomsInput, setSymptomsInput] = useState("");

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [finalDiagnosisText, setFinalDiagnosisText] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Prescription Form State
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionMedicines, setPrescriptionMedicines] = useState<Array<{ medicineId: string; medicineName: string; dosage: string; frequency: string; duration: string; quantity: number }>>([
    { medicineId: "", medicineName: "", dosage: "500mg", frequency: "Twice daily", duration: "5 days", quantity: 10 }
  ]);
  const [prescriptionNotes, setPrescriptionNotes] = useState("");
  const [prescLoading, setPrescLoading] = useState(false);

  useEffect(() => {
    fetchAppointments();
    fetchInventory();
    fetchLabCatalog();
    if (activeTab === "diagnostics") {
      fetchDoctorLabOrders();
    }
  }, [activeTab]);

  const fetchDoctorLabOrders = async () => {
    try {
      const res = await api.get("/lab/orders");
      setLabOrders(res.data);
    } catch (err) {
      console.error("Failed to fetch doctor lab orders", err);
    }
  };

  const fetchLabCatalog = async () => {
    try {
      const res = await api.get("/lab/tests");
      setLabCatalog(res.data);
      if (res.data.length > 0 && !orderLabTestId) {
        setOrderLabTestId(res.data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch lab test catalog", err);
    }
  };

  const fetchPatientLabReports = async (patientId: string) => {
    try {
      const res = await api.get(`/lab/patients/${patientId}/reports`);
      setPatientLabReports(res.data.reports || []);
      setShowPatientLabHistoryModal(true);
    } catch (err) {
      console.error("Failed to fetch patient lab reports", err);
      alert("Failed to load patient diagnostic history.");
    }
  };

  const handleCreateLabOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const patientId = orderLabPatientId || selectedApp?.patientId;
    if (!patientId || !orderLabTestId) {
      alert("Please select both a patient and diagnostic test.");
      return;
    }

    setOrderLabLoading(true);
    try {
      await api.post("/lab/orders", {
        patientId,
        labTestId: orderLabTestId,
        appointmentId: selectedApp?.id || undefined,
        diagnosisRecordId: activeRecordId || undefined,
        priority: orderLabPriority,
        clinicalNotes: orderLabNotes || undefined,
      });

      alert("Diagnostic test order created and accessioned to laboratory!");
      setShowOrderLabModal(false);
      setOrderLabNotes("");
      fetchDoctorLabOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create lab order.");
    } finally {
      setOrderLabLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await api.get("/appointments");
      setAppointments(res.data);
      if (res.data.length > 0 && !selectedApp) {
        selectAppointment(res.data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch doctor appointments", err);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await api.get("/pharmacy/inventory");
      setMedicinesInventory(res.data);
    } catch (err) {
      console.error("Failed to fetch pharmacy inventory", err);
    }
  };

  const fetchPatientVitals = async (patientId: string) => {
    try {
      const res = await api.get(`/patients/${patientId}/vitals`);
      setPatientVitals(res.data);
    } catch (err) {
      console.error("Failed to fetch patient vitals", err);
    }
  };

  const selectAppointment = (app: Appointment) => {
    setSelectedApp(app);
    setSymptomsInput(app.reason);
    setAiSuggestions(null);
    if (app.patientId) {
      fetchPatientVitals(app.patientId);
    }
  };

  const handleRecordVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setSaveVitalsLoading(true);
    setVitalsError("");

    try {
      await api.post(`/patients/${selectedApp.patientId}/vitals`, {
        appointmentId: selectedApp.id,
        bloodPressure: vitalsForm.bloodPressure || null,
        pulse: vitalsForm.pulse ? parseInt(vitalsForm.pulse) : null,
        temperature: vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : null,
        spo2: vitalsForm.spo2 ? parseInt(vitalsForm.spo2) : null,
        weight: vitalsForm.weight ? parseFloat(vitalsForm.weight) : null,
        height: vitalsForm.height ? parseFloat(vitalsForm.height) : null,
      });

      setShowVitalsModal(false);
      fetchPatientVitals(selectedApp.patientId);
    } catch (err: any) {
      setVitalsError(err.response?.data?.error || "Failed to record vitals");
    } finally {
      setSaveVitalsLoading(false);
    }
  };

  const runAiDecisionSupport = async () => {
    if (!selectedApp || !symptomsInput.trim()) return;
    setAiLoading(true);
    try {
      // 1. Call AI proxy service to get differential diagnosis & recommendations
      const aiRes = await api.post("/ai/suggestions", {
        symptoms: symptomsInput,
        history: selectedApp.notes || "None"
      });
      setAiSuggestions(aiRes.data);

      // 2. Automatically record pending diagnosis entry for this appointment
      const diagRes = await api.post("/diagnosis", {
        appointmentId: selectedApp.id,
        patientId: selectedApp.patientId,
        symptoms: symptomsInput,
        aiSuggestions: aiRes.data,
      });

      setActiveRecordId(diagRes.data.id);
      if (aiRes.data.differentialDiagnosis && aiRes.data.differentialDiagnosis.length > 0) {
        setFinalDiagnosisText(aiRes.data.differentialDiagnosis[0].disease);
      }
    } catch (err) {
      console.error("Failed to run AI support", err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleStartConsultation = async () => {
    if (!selectedApp) return;
    try {
      const res = await api.put(`/appointments/${selectedApp.id}/start-consultation`);
      const updated = res.data.appointment;
      setSelectedApp((prev) => prev ? { ...prev, ...updated } : updated);
      fetchAppointments();
      alert("Consultation started with patient!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to start consultation.");
    }
  };

  const handleCompleteConsultation = async () => {
    if (!selectedApp) return;
    try {
      const res = await api.put(`/appointments/${selectedApp.id}/complete-consultation`);
      const updated = res.data.appointment;
      setSelectedApp((prev) => prev ? { ...prev, ...updated } : updated);
      fetchAppointments();
      alert("Consultation completed successfully! Patient report & prescriptions finalized.");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to complete consultation.");
    }
  };

  const handleConfirmDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecordId || !finalDiagnosisText.trim()) return;

    setConfirmLoading(true);
    try {
      await api.put(`/diagnosis/${activeRecordId}/confirm`, {
        finalDiagnosis: finalDiagnosisText,
      });

      setShowConfirmModal(false);
      fetchAppointments();
      alert(`Diagnosis '${finalDiagnosisText}' successfully confirmed! Patient report is now published.`);
    } catch (err) {
      console.error("Failed to confirm diagnosis", err);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCreatePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    setPrescLoading(true);
    try {
      await api.post("/pharmacy/prescriptions", {
        appointmentId: selectedApp.id,
        patientId: selectedApp.patientId,
        diagnosisRecordId: activeRecordId || undefined,
        medicines: prescriptionMedicines.map(m => ({
          ...m,
          medicineName: m.medicineName || (medicinesInventory.find(inv => inv.id === m.medicineId)?.name || "Medication")
        })),
        notes: prescriptionNotes,
      });

      setShowPrescriptionModal(false);
      alert("Prescription issued and sent to Pharmacy queue!");
    } catch (err) {
      console.error("Failed to issue prescription", err);
    } finally {
      setPrescLoading(false);
    }
  };

  const addMedicineRow = () => {
    setPrescriptionMedicines(prev => [
      ...prev,
      { medicineId: "", medicineName: "", dosage: "1 tablet", frequency: "Twice daily", duration: "5 days", quantity: 10 }
    ]);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Stethoscope className="h-5 w-5 text-cyan-400" />
            <span>Physician Clinical Workspace</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Clinical Decision Support for evidence-based diagnosis and treatment.
          </p>
        </div>
      </div>

      {/* DIAGNOSTICS & LAB ORDERS TAB */}
      {activeTab === "diagnostics" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <FlaskConical className="h-5 w-5 text-emerald-400" />
                <span>Laboratory Diagnostic Orders & Reports</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Order laboratory investigations, monitor accessioned specimens, and review finalized pathologist reports.
              </p>
            </div>

            <button
              onClick={() => {
                if (selectedApp) setOrderLabPatientId(selectedApp.patientId);
                setShowOrderLabModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg flex items-center space-x-2 transition-all w-fit"
            >
              <Plus className="h-4 w-4" />
              <span>Order Diagnostic Test</span>
            </button>
          </div>

          {/* Orders Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Order Number</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Investigation Panel</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ordered At</th>
                    <th className="px-4 py-3 text-right">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {labOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No laboratory orders placed yet.
                      </td>
                    </tr>
                  ) : (
                    labOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-850/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-100">{o.orderNumber}</td>
                        <td className="px-4 py-3 font-bold text-slate-200">{o.patient?.name}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-200">{o.labTest?.name}</div>
                          <div className="text-[10px] text-slate-500">{o.labTest?.sampleType}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase ${
                            o.priority === "STAT"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse"
                              : o.priority === "URGENT"
                              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}>
                            {o.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border inline-flex items-center space-x-1 ${
                            o.status === "COMPLETED"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : o.status === "SAMPLE_COLLECTED"
                              ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                              : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          }`}>
                            <span>{o.status.replace("_", " ")}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(o.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {o.status === "COMPLETED" ? (
                            <button
                              onClick={() => setViewDoctorReport(o)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-semibold text-xs border border-slate-700 transition-all flex items-center space-x-1 ml-auto"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>View Report</span>
                            </button>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">In Progress</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Queue on Left, Decision Support on Right */}
      {(activeTab === "queue" || activeTab === "ai-decision-support") && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Consultation Queue (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Stethoscope className="h-4 w-4 text-cyan-400" />
                  <span>Today's Consultation Queue</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Ordered by live check-in token & arrival
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold border border-cyan-500/30">
                {appointments.length} Total
              </span>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {appointments.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No appointments scheduled for today.
                </div>
              ) : (
                appointments.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => selectAppointment(app)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      selectedApp?.id === app.id
                        ? "bg-slate-850 border-cyan-500 shadow-md ring-1 ring-cyan-500/50"
                        : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        {app.tokenNumber ? (
                          <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 font-extrabold text-[11px] rounded-lg border border-cyan-500/30">
                            Token #{app.tokenNumber}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-900 text-slate-500 text-[10px] rounded border border-slate-800">
                            Not Checked In
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-200">{app.patient?.name || "Patient"}</span>
                      </div>

                      <div className="text-[11px] text-slate-400">{app.reason}</div>

                      <div className="flex items-center space-x-2 text-[10px]">
                        <span className="text-slate-400">
                          {new Date(app.slotDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={`px-2 py-0.2 rounded-full font-bold text-[9px] border ${
                          app.queueStatus === "IN_CONSULTATION"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                            : app.queueStatus === "CHECKED_IN"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                            : app.queueStatus === "COMPLETED"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-slate-900 text-slate-400 border-slate-800"
                        }`}>
                          {app.queueStatus || "WAITING"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: AI Decision Support & Clinical Panel (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedApp ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              
              {/* Selected Patient Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800 gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Active Patient Case</span>
                  <h3 className="text-base font-bold text-slate-100 mt-0.5">{selectedApp.patient?.name}</h3>
                  <div className="text-xs text-slate-400 mt-1">
                    DOB: {selectedApp.patient?.dob ? new Date(selectedApp.patient.dob).toLocaleDateString() : "N/A"} • Gender: {selectedApp.patient?.gender} • Blood Group: <span className="text-rose-400 font-bold">{selectedApp.patient?.bloodGroup}</span>
                  </div>
                  {(selectedApp.patient?.allergies || selectedApp.patient?.chronicConditions) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {selectedApp.patient.allergies && (
                        <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800/80 text-rose-300 text-[10px] font-semibold flex items-center space-x-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Allergies: {selectedApp.patient.allergies}</span>
                        </span>
                      )}
                      {selectedApp.patient.chronicConditions && (
                        <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800/80 text-amber-300 text-[10px] font-semibold">
                          Chronic: {selectedApp.patient.chronicConditions}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Start / Complete Consultation Lifecycle Controls */}
                  {selectedApp.queueStatus === "CHECKED_IN" && (
                    <button
                      onClick={handleStartConsultation}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg flex items-center space-x-1.5 transition-all"
                    >
                      <Stethoscope className="h-4 w-4" />
                      <span>Start Consultation</span>
                    </button>
                  )}

                  {selectedApp.queueStatus === "IN_CONSULTATION" && (
                    <button
                      onClick={handleCompleteConsultation}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white text-xs font-bold shadow-lg flex items-center space-x-1.5 transition-all animate-pulse"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Complete Consultation</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowVitalsModal(true)}
                    className="px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                  >
                    <Activity className="h-4 w-4" />
                    <span>Record Vitals</span>
                  </button>

                  <button
                    onClick={() => {
                      setOrderLabPatientId(selectedApp.patientId);
                      setShowOrderLabModal(true);
                    }}
                    className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                  >
                    <FlaskConical className="h-4 w-4" />
                    <span>Order Lab Test</span>
                  </button>

                  <button
                    onClick={() => fetchPatientLabReports(selectedApp.patientId)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Lab History</span>
                  </button>

                  <button
                    onClick={() => setShowPrescriptionModal(true)}
                    className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                  >
                    <Pill className="h-4 w-4" />
                    <span>Issue Rx</span>
                  </button>

                  <button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={!aiSuggestions}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold shadow-lg flex items-center space-x-1.5 transition-all disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirm Diagnosis</span>
                  </button>
                </div>
              </div>

              {/* Patient Vitals Summary Card */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <HeartPulse className="h-4 w-4 text-rose-400" />
                    <span>Clinical Vitals & Biometrics</span>
                  </div>
                  {patientVitals.length > 0 && (
                    <span className="text-[10px] text-slate-500">
                      Recorded: {new Date(patientVitals[0].createdAt).toLocaleDateString()} {new Date(patientVitals[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {patientVitals.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">BP</span>
                      <span className="font-mono font-bold text-slate-100 text-sm">{patientVitals[0].bloodPressure || "--"}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">Pulse</span>
                      <span className="font-bold text-emerald-400 text-sm">{patientVitals[0].pulse ? `${patientVitals[0].pulse} bpm` : "--"}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">Temp</span>
                      <span className="font-bold text-amber-400 text-sm">{patientVitals[0].temperature ? `${patientVitals[0].temperature}°F` : "--"}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">SpO2</span>
                      <span className="font-bold text-cyan-400 text-sm">{patientVitals[0].spo2 ? `${patientVitals[0].spo2}%` : "--"}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">Weight</span>
                      <span className="font-bold text-slate-200 text-sm">{patientVitals[0].weight ? `${patientVitals[0].weight} kg` : "--"}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">Height</span>
                      <span className="font-bold text-slate-200 text-sm">{patientVitals[0].height ? `${patientVitals[0].height} cm` : "--"}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">BMI</span>
                      <span className="font-bold text-purple-400 text-sm">{patientVitals[0].bmi ? patientVitals[0].bmi.toFixed(1) : "--"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-slate-500 py-1">
                    <span>No vitals recorded for this patient yet.</span>
                    <button
                      onClick={() => setShowVitalsModal(true)}
                      className="text-cyan-400 hover:text-cyan-300 font-semibold underline text-xs"
                    >
                      + Record Check-in Vitals
                    </button>
                  </div>
                )}
              </div>

              {/* Symptoms Input and Run AI Button */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Patient Presented Symptoms & Clinical History
                </label>
                <textarea
                  rows={3}
                  value={symptomsInput}
                  onChange={(e) => setSymptomsInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                
                <button
                  onClick={runAiDecisionSupport}
                  disabled={aiLoading || !symptomsInput.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 text-cyan-200 animate-spin" />
                  <span>{aiLoading ? "Analyzing Clinical Knowledge Graph..." : "Generate AI Differential Diagnosis"}</span>
                </button>
              </div>

              {/* AI Clinical Recommendations Display */}
              {aiSuggestions && (
                <div className="space-y-5 pt-4 border-t border-slate-800">
                  <div className="flex items-center space-x-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    <Activity className="h-4 w-4" />
                    <span>AI Differential Diagnosis & Support</span>
                  </div>

                  {/* Differential Diagnosis Cards */}
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Evaluated Differentials</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(aiSuggestions.differentialDiagnosis || []).map((diag: any, idx: number) => (
                        <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-100 text-sm">{diag.disease}</span>
                            <span className="px-2 py-0.5 bg-cyan-950 text-cyan-400 text-[10px] font-bold rounded border border-cyan-800">
                              {(diag.confidence * 100).toFixed(0)}% Match
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug">{diag.reasoning}</p>
                          <div className="text-[10px] text-amber-400 font-semibold uppercase">Urgency: {diag.urgency}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Lab Tests */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase block">Recommended Diagnostic Tests</span>
                    <div className="flex flex-wrap gap-2">
                      {(aiSuggestions.recommendedTests || []).map((test: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 bg-slate-900 text-slate-200 text-xs font-medium rounded-lg border border-slate-800">
                          {test}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* AI Clinical Summary */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 text-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase block">Clinical Evidence Summary</span>
                    <p className="text-slate-300 leading-relaxed">{aiSuggestions.clinicalSummary}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-xs">
              Select a patient from the queue to review clinical history and trigger AI Decision Support.
            </div>
          )}
        </div>
      </div>
      )}

      {/* DIAGNOSIS CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span>Confirm Official Diagnosis</span>
            </h3>
            
            <p className="text-xs text-slate-400">
              Review and confirm final diagnosis. Once confirmed, this report will become available on the patient's portal and an immutable audit log entry will be created.
            </p>

            <form onSubmit={handleConfirmDiagnosis} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Final Confirmed Diagnosis</label>
                <input
                  type="text"
                  required
                  value={finalDiagnosisText}
                  onChange={(e) => setFinalDiagnosisText(e.target.value)}
                  placeholder="e.g. Acute Gastroenteritis"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmLoading || !finalDiagnosisText.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg"
                >
                  {confirmLoading ? "Publishing Report..." : "Confirm & Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ISSUE PRESCRIPTION MODAL */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <Pill className="h-5 w-5 text-amber-400" />
              <span>Issue Hospital Prescription</span>
            </h3>

            <form onSubmit={handleCreatePrescription} className="space-y-4 text-xs">
              
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {prescriptionMedicines.map((m, idx) => (
                  <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 text-[10px]">Medicine</label>
                        <select
                          value={m.medicineId}
                          onChange={(e) => {
                            const selectedMed = medicinesInventory.find(inv => inv.id === e.target.value);
                            const updated = [...prescriptionMedicines];
                            updated[idx].medicineId = e.target.value;
                            updated[idx].medicineName = selectedMed?.name || "";
                            setPrescriptionMedicines(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200"
                        >
                          <option value="">-- Choose Medicine --</option>
                          {medicinesInventory.map(med => (
                            <option key={med.id} value={med.id}>{med.name} (Stock: {med.stock})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 text-[10px]">Dosage</label>
                        <input
                          type="text"
                          value={m.dosage}
                          onChange={(e) => {
                            const updated = [...prescriptionMedicines];
                            updated[idx].dosage = e.target.value;
                            setPrescriptionMedicines(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-slate-400 text-[10px]">Frequency</label>
                        <input
                          type="text"
                          value={m.frequency}
                          onChange={(e) => {
                            const updated = [...prescriptionMedicines];
                            updated[idx].frequency = e.target.value;
                            setPrescriptionMedicines(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[10px]">Duration</label>
                        <input
                          type="text"
                          value={m.duration}
                          onChange={(e) => {
                            const updated = [...prescriptionMedicines];
                            updated[idx].duration = e.target.value;
                            setPrescriptionMedicines(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[10px]">Qty</label>
                        <input
                          type="number"
                          value={m.quantity}
                          onChange={(e) => {
                            const updated = [...prescriptionMedicines];
                            updated[idx].quantity = parseInt(e.target.value) || 1;
                            setPrescriptionMedicines(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addMedicineRow}
                className="w-full py-2 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                + Add Another Medicine
              </button>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Prescription Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={prescriptionNotes}
                  onChange={(e) => setPrescriptionNotes(e.target.value)}
                  placeholder="Take after meals..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPrescriptionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={prescLoading}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-lg"
                >
                  {prescLoading ? "Transmitting Rx..." : "Send to Pharmacy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD CLINICAL VITALS MODAL */}
      {showVitalsModal && selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <HeartPulse className="h-5 w-5 text-rose-400" />
                <span>Record Clinical Vitals</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowVitalsModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Record current biometrics for patient <strong className="text-slate-200">{selectedApp.patient?.name}</strong>.
            </p>

            {vitalsError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {vitalsError}
              </div>
            )}

            <form onSubmit={handleRecordVitals} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Blood Pressure (mmHg)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 120/80"
                    value={vitalsForm.bloodPressure}
                    onChange={(e) => setVitalsForm(prev => ({ ...prev, bloodPressure: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 font-mono font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Pulse (bpm)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 72"
                    value={vitalsForm.pulse}
                    onChange={(e) => setVitalsForm(prev => ({ ...prev, pulse: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Temperature (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 98.6"
                    value={vitalsForm.temperature}
                    onChange={(e) => setVitalsForm(prev => ({ ...prev, temperature: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">SpO2 Oxygen (%)</label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    required
                    placeholder="e.g. 98"
                    value={vitalsForm.spo2}
                    onChange={(e) => setVitalsForm(prev => ({ ...prev, spo2: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 70.5"
                    value={vitalsForm.weight}
                    onChange={(e) => setVitalsForm(prev => ({ ...prev, weight: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 175"
                    value={vitalsForm.height}
                    onChange={(e) => setVitalsForm(prev => ({ ...prev, height: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Real-time Calculated BMI Preview */}
              {parseFloat(vitalsForm.weight) > 0 && parseFloat(vitalsForm.height) > 0 && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">Calculated BMI</span>
                  <span className="font-bold text-purple-400 text-sm">
                    {(parseFloat(vitalsForm.weight) / Math.pow(parseFloat(vitalsForm.height) > 3 ? parseFloat(vitalsForm.height) / 100 : parseFloat(vitalsForm.height), 2)).toFixed(1)} kg/m²
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVitalsModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveVitalsLoading}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg"
                >
                  {saveVitalsLoading ? "Saving Vitals..." : "Save Vitals"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ORDER LAB INVESTIGATION MODAL */}
      {showOrderLabModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <FlaskConical className="h-5 w-5 text-emerald-400" />
                <span>Order Laboratory Investigation</span>
              </h3>
              <button onClick={() => setShowOrderLabModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLabOrder} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Patient</label>
                <select
                  value={orderLabPatientId}
                  onChange={(e) => setOrderLabPatientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                >
                  {appointments.map((a) => (
                    <option key={a.patientId} value={a.patientId}>
                      {a.patient?.name} (Token #{a.tokenNumber || "N/A"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Diagnostic Investigation Test *</label>
                <select
                  required
                  value={orderLabTestId}
                  onChange={(e) => setOrderLabTestId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                >
                  {labCatalog.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code}) - {t.category} (${t.price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Clinical Priority</label>
                <select
                  value={orderLabPriority}
                  onChange={(e) => setOrderLabPriority(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                >
                  <option value="ROUTINE">ROUTINE (Standard TAT)</option>
                  <option value="URGENT">URGENT (Expedited)</option>
                  <option value="STAT">STAT (Emergency / Immediate Processing)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Clinical Indication / Special Instructions</label>
                <textarea
                  rows={2}
                  value={orderLabNotes}
                  onChange={(e) => setOrderLabNotes(e.target.value)}
                  placeholder="e.g. Fasting sample requested. Patient presenting with fatigue."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOrderLabModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={orderLabLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg disabled:opacity-50"
                >
                  {orderLabLoading ? "Creating Order..." : "Place Lab Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DOCTOR LAB REPORT MODAL */}
      {viewDoctorReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FlaskConical className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">{viewDoctorReport.labTest?.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Order #{viewDoctorReport.orderNumber} • Status: FINAL REPORT
                  </p>
                </div>
              </div>
              <button onClick={() => setViewDoctorReport(null)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs">
              <div>
                <span className="text-slate-500 block">Patient Name:</span>
                <span className="font-bold text-slate-100">{viewDoctorReport.patient?.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Completion Timestamp:</span>
                <span className="font-semibold text-slate-300">
                  {viewDoctorReport.completedAt ? new Date(viewDoctorReport.completedAt).toLocaleString() : "N/A"}
                </span>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Parameter</th>
                    <th className="px-4 py-2.5">Observed Value</th>
                    <th className="px-4 py-2.5">Unit</th>
                    <th className="px-4 py-2.5">Reference Range</th>
                    <th className="px-4 py-2.5">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(viewDoctorReport.labResult?.parameterResults || []).map((p: any, idx: number) => (
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

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-1 text-xs">
              <span className="font-bold text-emerald-400 block">Pathologist Impression:</span>
              <p className="text-slate-200">{viewDoctorReport.labResult?.summary}</p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setViewDoctorReport(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PATIENT HISTORIC LAB REPORTS MODAL */}
      {showPatientLabHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <FileText className="h-5 w-5 text-cyan-400" />
                <span>Patient Laboratory History & Completed Reports</span>
              </h3>
              <button onClick={() => setShowPatientLabHistoryModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {patientLabReports.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No completed laboratory reports found on file for this patient.
                </div>
              ) : (
                patientLabReports.map((rep) => (
                  <div key={rep.id} className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm">{rep.labTest?.name}</h4>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {rep.orderNumber} • Completed: {rep.completedAt ? new Date(rep.completedAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setViewDoctorReport(rep);
                          setShowPatientLabHistoryModal(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-xs border border-slate-700"
                      >
                        Inspect Report
                      </button>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-lg text-xs text-slate-300">
                      <span className="text-slate-400 font-semibold">Summary: </span>{rep.labResult?.summary}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

