import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { Appointment, Medicine } from "../types";
import { Stethoscope, Activity, Pill, CheckCircle2, Sparkles, ChevronRight } from "lucide-react";

interface DoctorDashboardProps {
  activeTab: string;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ activeTab }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [medicinesInventory, setMedicinesInventory] = useState<Medicine[]>([]);

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
  }, [activeTab]);

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

  const selectAppointment = (app: Appointment) => {
    setSelectedApp(app);
    setSymptomsInput(app.reason);
    setAiSuggestions(null);
  };

  const runAiDecisionSupport = async () => {
    if (!selectedApp || !symptomsInput.trim()) return;
    setAiLoading(true);
    try {
      // 1. Call AI proxy service to get differential diagnosis & recommendations
      const aiRes = await api.post("/ai/clinical-support", { symptoms: symptomsInput });
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

      {/* Main Grid: Queue on Left, Decision Support on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Patient Queue (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Today's Consultations ({appointments.length})
            </h3>
            
            <div className="space-y-2.5">
              {appointments.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">No consultations in queue</div>
              ) : (
                appointments.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => selectAppointment(app)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      selectedApp?.id === app.id
                        ? "bg-cyan-950/70 border-cyan-500/50 shadow-md shadow-cyan-900/20"
                        : "bg-slate-950/60 border-slate-850 hover:bg-slate-850"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-200">{app.patient?.name || "Patient"}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{app.reason}</div>
                      <div className="text-[10px] text-cyan-400 mt-1">{new Date(app.slotDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600" />
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
                </div>

                <div className="flex items-center space-x-2">
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

    </div>
  );
};
