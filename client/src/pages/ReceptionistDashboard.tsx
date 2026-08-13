import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { Appointment, Patient, Doctor, Bill } from "../types";
import { Calendar, UserPlus, CreditCard, Plus, CheckCircle2 } from "lucide-react";

interface ReceptionistDashboardProps {
  activeTab: string;
}

export const ReceptionistDashboard: React.FC<ReceptionistDashboardProps> = ({ activeTab }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);

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
  const [slotTime, setSlotTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === "schedule") {
        const appRes = await api.get("/appointments");
        setAppointments(appRes.data);

        const patRes = await api.get("/hospital/patients");
        setPatients(patRes.data);

        const docRes = await api.get("/hospital/doctors");
        setDoctors(docRes.data);
      } else if (activeTab === "billing") {
        const billRes = await api.get("/hospital/bills");
        setBills(billRes.data);
      } else if (activeTab === "register") {
        const patRes = await api.get("/hospital/patients");
        setPatients(patRes.data);
      }
    } catch (err) {
      console.error("Failed to load receptionist data", err);
    }
  };

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegSuccess("");
    try {
      await api.post("/hospital/patients", regData);
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

  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleLoading(true);
    try {
      const slotDateTime = new Date(`${slotDate}T${slotTime}:00`).toISOString();
      await api.post("/appointments", {
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        slotDateTime,
        reason,
      });

      setShowScheduleModal(false);
      setReason("");
      fetchData();
      alert("Appointment scheduled successfully!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to schedule appointment.");
    } finally {
      setScheduleLoading(false);
    }
  };

  const handlePayBill = async (billId: string) => {
    try {
      await api.put(`/hospital/bills/${billId}/pay`);
      fetchData();
      alert("Payment processed and receipt generated!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to process bill payment.");
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
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Consultations ({appointments.length})</h3>

            <div className="divide-y divide-slate-800/80">
              {appointments.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No scheduled visits.</div>
              ) : (
                appointments.map((app) => (
                  <div key={app.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-100 text-sm">{app.patient?.name || "Patient"}</div>
                      <div className="text-slate-400">Doctor: <span className="text-purple-400 font-medium">{app.doctor?.name}</span> • Reason: {app.reason}</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-slate-300 font-semibold bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                        {new Date(app.slotDateTime).toLocaleString()}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        app.status === "CONFIRMED" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}>
                        {app.status}
                      </span>
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
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-purple-400" />
              <span>Hospital Billing & Revenue Desk</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Process patient payments for consultations and dispensed pharmacy medications.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="divide-y divide-slate-800/80">
              {bills.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No active hospital bills.</div>
              ) : (
                bills.map((bill: any) => (
                  <div key={bill.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-100 text-sm">{bill.patient?.name || "Patient"}</span>
                        <span className="text-slate-500">#{bill.id.slice(0, 8)}</span>
                      </div>

                      {/* Items breakdown */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(bill.items || []).map((item: any, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-950 rounded text-slate-400 text-[11px] border border-slate-800">
                            {item.description}: ${item.cost?.toFixed(2)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Amount</span>
                        <span className="text-base font-extrabold text-cyan-400">${bill.amount.toFixed(2)}</span>
                      </div>

                      {bill.status === "PAID" ? (
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 flex items-center space-x-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>PAID</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handlePayBill(bill.id)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
                        >
                          Collect Payment
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

      {/* SCHEDULE MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-purple-400" />
              <span>Schedule Patient Visit</span>
            </h3>

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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Time Slot</label>
                  <select
                    value={slotTime}
                    onChange={(e) => setSlotTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
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
