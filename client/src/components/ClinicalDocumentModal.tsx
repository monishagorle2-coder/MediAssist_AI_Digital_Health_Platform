import React from "react";
import { 
  Printer, 
  X, 
  Activity, 
  CheckCircle2, 
  User, 
  Shield 
} from "lucide-react";

export interface ClinicalDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: "DIAGNOSIS" | "PRESCRIPTION" | "LAB_REPORT" | "TIMELINE";
  data: any;
}

export const ClinicalDocumentModal: React.FC<ClinicalDocumentModalProps> = ({
  isOpen,
  onClose,
  documentType,
  data,
}) => {
  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const hospital = data.hospital || {
    name: "MediAssist Multi-Specialty Hospital & Research Center",
    tagline: "Excellence in Clinical Diagnostics & Patient Care",
    address: "100 Medical Center Boulevard, Healthcare District, Metro City, 560001",
    phone: "+1 (800) 555-MEDI / +1 (800) 555-CARE",
    accreditation: "NABH / JCI Accredited | Reg: MED-IND-2026-9811",
  };

  const patient = data.patient || {};
  const doctor = data.doctor || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        
        {/* Modal Top Actions (Hidden on Print) */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              {documentType.replace("_", " ")}
            </span>
            <span className="text-xs text-slate-400">
              {data.reportNumber || data.rxNumber || data.orderNumber || "EHR Document"}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Paper Area */}
        <div className="p-8 overflow-y-auto bg-white text-slate-900 print:p-0 print:m-0 print:overflow-visible">
          
          {/* Header & Hospital Letterhead */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white">
                    <Activity className="h-5 w-5" />
                  </div>
                  <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase">
                    {hospital.name}
                  </h1>
                </div>
                <p className="text-xs text-slate-600 font-medium mt-1">{hospital.tagline}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{hospital.address} | Tel: {hospital.phone}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded">
                  {hospital.accreditation}
                </span>
                <p className="text-[11px] text-slate-500 font-mono mt-1">
                  Doc Ref: {data.reportNumber || data.rxNumber || data.orderNumber || `EHR-${Date.now().toString().slice(-6)}`}
                </p>
                <p className="text-[11px] text-slate-500">
                  Date: {new Date(data.generatedAt || data.prescriptionDate || data.completedAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Document Title Banner */}
          <div className="text-center py-2 bg-slate-100 border border-slate-300 rounded-lg mb-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
              {documentType === "DIAGNOSIS" && "Official Clinical Diagnosis & Assessment Report"}
              {documentType === "PRESCRIPTION" && "Hospital Medical Prescription (Rx)"}
              {documentType === "LAB_REPORT" && "Diagnostic Pathology & Laboratory Report"}
              {documentType === "TIMELINE" && "Comprehensive Longitudinal Patient EHR Summary"}
            </h2>
          </div>

          {/* Patient Demographics Box */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-6 text-xs">
            <div>
              <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                <User className="h-3.5 w-3.5 text-cyan-600" />
                <span>Patient Information</span>
              </div>
              <div className="mt-1.5 space-y-0.5 text-slate-700">
                <p><span className="font-semibold text-slate-900">Name:</span> {patient.name || "N/A"}</p>
                <p><span className="font-semibold text-slate-900">Phone / Email:</span> {patient.phone || "N/A"} {patient.email ? `(${patient.email})` : ""}</p>
                <p><span className="font-semibold text-slate-900">Gender / Age:</span> {patient.gender || "N/A"}, {patient.dob ? `${new Date().getFullYear() - new Date(patient.dob).getFullYear()} yrs` : "N/A"}</p>
                <p><span className="font-semibold text-slate-900">Blood Group:</span> {patient.bloodGroup || "N/A"}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                <Shield className="h-3.5 w-3.5 text-cyan-600" />
                <span>Clinical / Attending Details</span>
              </div>
              <div className="mt-1.5 space-y-0.5 text-slate-700">
                {doctor.name && <p><span className="font-semibold text-slate-900">Physician:</span> {doctor.name}</p>}
                {doctor.department && <p><span className="font-semibold text-slate-900">Department:</span> {doctor.department}</p>}
                {doctor.specialization && <p><span className="font-semibold text-slate-900">Specialization:</span> {doctor.specialization}</p>}
                {patient.allergies && <p><span className="font-semibold text-rose-700">Allergies:</span> {patient.allergies}</p>}
              </div>
            </div>
          </div>

          {/* DOCUMENT SPECIFIC BODY CONTENT */}

          {/* 1. DIAGNOSIS REPORT BODY */}
          {documentType === "DIAGNOSIS" && (
            <div className="space-y-6 text-xs text-slate-800">
              
              {/* Vitals If Available */}
              {data.vitals && (
                <div>
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2 border-b pb-1">
                    Recorded Physiological Vitals
                  </h3>
                  <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium">Blood Pressure</p>
                      <p className="font-bold text-slate-900 text-sm">{data.vitals.bloodPressure || "120/80"} <span className="text-[10px] font-normal">mmHg</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium">Pulse Rate</p>
                      <p className="font-bold text-slate-900 text-sm">{data.vitals.pulse || "72"} <span className="text-[10px] font-normal">bpm</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium">Body Temperature</p>
                      <p className="font-bold text-slate-900 text-sm">{data.vitals.temperature || "98.6"} <span className="text-[10px] font-normal">°F</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium">Oxygen Saturation</p>
                      <p className="font-bold text-slate-900 text-sm">{data.vitals.spo2 || "98"} <span className="text-[10px] font-normal">%</span></p>
                    </div>
                  </div>
                </div>
              )}

              {/* Chief Complaints */}
              <div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1 border-b pb-1">
                  Chief Complaints & Symptoms
                </h3>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 leading-relaxed font-mono">
                  {data.clinicalFindings?.chiefComplaints || data.symptoms || "Patient presented for general clinical consultation."}
                </p>
              </div>

              {/* Confirmed Diagnosis Box */}
              <div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1 border-b pb-1">
                  Confirmed Clinical Diagnosis
                </h3>
                <div className="p-4 bg-cyan-50 border-2 border-cyan-600 rounded-xl flex items-start space-x-3">
                  <CheckCircle2 className="h-5 w-5 text-cyan-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-cyan-950 uppercase tracking-tight">
                      {data.clinicalFindings?.finalDiagnosis || data.finalDiagnosis || "Clinical Assessment In Progress"}
                    </h4>
                    <p className="text-[11px] text-cyan-800 mt-1">
                      Validated and signed by {data.clinicalFindings?.confirmedBy || doctor.name || "Attending Consultant"} on {new Date(data.clinicalFindings?.confirmedAt || data.confirmedAt || Date.now()).toLocaleString()}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. PRESCRIPTION BODY */}
          {documentType === "PRESCRIPTION" && (
            <div className="space-y-6 text-xs text-slate-800">
              
              {data.diagnosisIndication && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="font-bold text-slate-900">Clinical Indication:</span> {data.diagnosisIndication}
                </div>
              )}

              {/* Medicine Table */}
              <div>
                <div className="flex items-center justify-between mb-2 border-b pb-1">
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Prescribed Medications (Rx)
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500">
                    Status: {data.status || "CONFIRMED"}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                        <th className="p-2.5 w-10 text-center">#</th>
                        <th className="p-2.5">Medication & Form</th>
                        <th className="p-2.5">Dosage</th>
                        <th className="p-2.5">Frequency</th>
                        <th className="p-2.5">Duration</th>
                        <th className="p-2.5">Instructions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {data.medicines && data.medicines.map((m: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="p-2.5">
                            <p className="font-bold text-slate-900">{m.medicineName}</p>
                            {m.genericName && <p className="text-[10px] text-slate-500">{m.genericName}</p>}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800">{m.dosage}</td>
                          <td className="p-2.5 font-semibold text-slate-800">{m.frequency}</td>
                          <td className="p-2.5 text-slate-700">{m.duration}</td>
                          <td className="p-2.5 text-slate-600">{m.instructions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">
                  Physician Instructions & Dietary Advice
                </h3>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 leading-relaxed font-mono">
                  {data.clinicalNotes || "Take medications after food. Avoid skipping doses. Drink plenty of water."}
                </p>
              </div>

              {/* Dispensation Stamp */}
              {data.dispensingStatus && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between text-emerald-900">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="font-bold text-xs">{data.dispensingStatus.dispensedNotice}</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase">Hospital Pharmacy Checked</span>
                </div>
              )}
            </div>
          )}

          {/* 3. LAB REPORT BODY */}
          {documentType === "LAB_REPORT" && (
            <div className="space-y-6 text-xs text-slate-800">
              
              {/* Specimen and Test Meta */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Test Investigation</span>
                  <span className="font-bold text-slate-900">{data.test?.name} ({data.test?.code})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Sample Type</span>
                  <span className="font-bold text-slate-900">{data.test?.sampleType || "Blood / Serum"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Collection Timestamp</span>
                  <span className="font-bold text-slate-900">
                    {data.sampleCollectedAt ? new Date(data.sampleCollectedAt).toLocaleString() : "Collected at OPD Lab"}
                  </span>
                </div>
              </div>

              {/* Parameter Table */}
              <div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2 border-b pb-1">
                  Observed Diagnostic Parameters
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                        <th className="p-2.5">Investigation Parameter</th>
                        <th className="p-2.5">Observed Value</th>
                        <th className="p-2.5">Units</th>
                        <th className="p-2.5">Biological Reference Range</th>
                        <th className="p-2.5 text-center">Status / Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {data.result?.parameters && data.result.parameters.map((p: any, idx: number) => {
                        const isAbnormal = p.flag === "HIGH" || p.flag === "LOW" || p.flag === "ABNORMAL";
                        return (
                          <tr key={idx} className={isAbnormal ? "bg-amber-50/50" : "hover:bg-slate-50"}>
                            <td className="p-2.5 font-bold text-slate-900">{p.parameter}</td>
                            <td className="p-2.5 font-black text-slate-950 text-sm">{p.value}</td>
                            <td className="p-2.5 text-slate-600">{p.unit}</td>
                            <td className="p-2.5 text-slate-700 font-mono text-[11px]">{p.referenceRange}</td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                p.flag === "NORMAL"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-rose-100 text-rose-800 border-rose-300"
                              }`}>
                                {p.flag}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lab Summary & Pathologist Remarks */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <h4 className="font-bold text-slate-900 text-xs">Pathologist Interpretation & Summary:</h4>
                <p className="text-slate-700 leading-relaxed font-mono text-[11px]">
                  {data.result?.summary || "Findings within expected clinical tolerance."}
                </p>
                {data.result?.remarks && (
                  <p className="text-slate-500 text-[10px] border-t border-slate-200 pt-1 mt-1">
                    Remarks: {data.result.remarks}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 4. TIMELINE SUMMARY BODY */}
          {documentType === "TIMELINE" && (
            <div className="space-y-6 text-xs text-slate-800">
              
              {/* Summary stats */}
              {data.summaryStats && (
                <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold">Total Visits</p>
                    <p className="font-bold text-slate-900 text-sm">{data.summaryStats.totalAppointments}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold">Diagnoses</p>
                    <p className="font-bold text-slate-900 text-sm">{data.summaryStats.totalDiagnoses}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold">Prescriptions</p>
                    <p className="font-bold text-slate-900 text-sm">{data.summaryStats.totalPrescriptions}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold">Lab Tests</p>
                    <p className="font-bold text-slate-900 text-sm">{data.summaryStats.totalLabTests}</p>
                  </div>
                </div>
              )}

              {/* Timeline chronological list */}
              <div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2 border-b pb-1">
                  Chronological Medical History
                </h3>
                <div className="space-y-3">
                  {data.timeline && data.timeline.map((evt: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-slate-200 text-slate-800">
                            {evt.category}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{evt.title}</span>
                        </div>
                        <p className="text-slate-600 text-[11px]">{evt.subtitle}</p>
                        <p className="text-slate-700 text-[11px] font-mono">{evt.summary}</p>
                      </div>
                      <div className="text-right text-[10px] text-slate-500 whitespace-nowrap">
                        {new Date(evt.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer & Signature Section */}
          <div className="mt-8 pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs text-slate-600">
            <div>
              <p className="font-bold text-slate-900">Hospital Legal Disclaimer:</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                {data.disclaimer || "This official hospital medical document is confidential and intended solely for clinical healthcare management."}
              </p>
            </div>

            <div className="text-right flex flex-col justify-end items-end">
              <div className="w-48 border-b border-slate-900 pb-1 mb-1 text-center font-serif text-slate-900 font-bold">
                {documentType === "LAB_REPORT"
                  ? (data.result?.approvedBy || "Consultant Pathologist, MD")
                  : (doctor.name || "Authorized Clinician / Medical Officer")}
              </div>
              <p className="text-[10px] font-semibold text-slate-700">Authorized Signature & Medical Stamp</p>
              <p className="text-[9px] text-slate-400">Electronically verified via MediAssist HSM</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
