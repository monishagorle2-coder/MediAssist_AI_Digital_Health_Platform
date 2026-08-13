import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { Appointment, DiagnosisRecord, Prescription, Doctor } from "../types";
import { Calendar, FileText, Pill, Bot, Plus, CheckCircle2, AlertCircle, Send, Stethoscope } from "lucide-react";

interface PatientDashboardProps {
  activeTab: string;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ activeTab }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reports, setReports] = useState<DiagnosisRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Booking Modal State
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("10:00");
  const [reason, setReason] = useState("");
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

        const docRes = await api.get("/hospital/doctors");
        setDoctors(docRes.data);
      } else if (activeTab === "reports") {
        const repRes = await api.get("/diagnosis");
        setReports(repRes.data);
      } else if (activeTab === "prescriptions") {
        const presRes = await api.get("/pharmacy/prescriptions");
        setPrescriptions(presRes.data);
      }
    } catch (err) {
      console.error("Failed to load patient data", err);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError("");
    setBookingLoading(true);

    try {
      const slotDateTime = new Date(`${slotDate}T${slotTime}:00`).toISOString();
      await api.post("/appointments", {
        doctorId: selectedDoctorId,
        slotDateTime,
        reason,
      });

      setShowBookModal(false);
      setReason("");
      setSelectedDoctorId("");
      fetchData();
    } catch (err: any) {
      setBookingError(err.response?.data?.error || "Failed to book appointment.");
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
      const res = await api.post("/ai/symptom-navigator", { symptoms: userText });
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: res.data.patientGuidance || res.data.message || "Thank you for sharing. Please consult your physician for a medical evaluation.",
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
                <div key={app.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
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
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                      app.status === "CONFIRMED" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    }`}>
                      {app.status}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Time Slot</label>
                  <select
                    value={slotTime}
                    onChange={(e) => setSlotTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="09:00">09:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="14:00">02:00 PM</option>
                    <option value="15:00">03:00 PM</option>
                  </select>
                </div>
              </div>

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

    </div>
  );
};
