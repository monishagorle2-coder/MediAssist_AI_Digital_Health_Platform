import React, { useState, useEffect } from "react";
import api from "../services/api";
import { ClinicalDocumentModal } from "./ClinicalDocumentModal";
import { 
  Calendar, 
  Activity, 
  FileText, 
  Pill, 
  FlaskConical, 
  Receipt, 
  Printer, 
  ShieldAlert, 
  HeartPulse
} from "lucide-react";

interface MedicalTimelineViewProps {
  patientId: string;
}

export const MedicalTimelineView: React.FC<MedicalTimelineViewProps> = ({ patientId }) => {
  const [timelineData, setTimelineData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  // Document modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDocType, setModalDocType] = useState<"DIAGNOSIS" | "PRESCRIPTION" | "LAB_REPORT" | "TIMELINE">("TIMELINE");
  const [modalDocData, setModalDocData] = useState<any>(null);

  useEffect(() => {
    fetchTimeline();
  }, [patientId]);

  const fetchTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/medical-records/timeline/${patientId}`);
      setTimelineData(res.data);
    } catch (err: any) {
      console.error("Failed to load medical timeline:", err);
      setError(err.response?.data?.error || "Failed to load medical timeline");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDocument = async (category: string, metadata: any) => {
    try {
      if (category === "DIAGNOSIS" && metadata.diagnosisRecordId) {
        const res = await api.get(`/medical-records/diagnosis/${metadata.diagnosisRecordId}/report`);
        setModalDocType("DIAGNOSIS");
        setModalDocData(res.data);
        setModalOpen(true);
      } else if (category === "PRESCRIPTION" && metadata.prescriptionId) {
        const res = await api.get(`/medical-records/prescription/${metadata.prescriptionId}/report`);
        setModalDocType("PRESCRIPTION");
        setModalDocData(res.data);
        setModalOpen(true);
      } else if ((category === "LAB_ORDER" || category === "LAB_RESULT") && metadata.labOrderId) {
        const res = await api.get(`/medical-records/lab/${metadata.labOrderId}/report`);
        setModalDocType("LAB_REPORT");
        setModalDocData(res.data);
        setModalOpen(true);
      }
    } catch (err: any) {
      console.error("Failed to fetch document report:", err);
      alert(err.response?.data?.error || "Failed to load document report");
    }
  };

  const handlePrintFullTimeline = () => {
    setModalDocType("TIMELINE");
    setModalDocData(timelineData);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 space-y-3">
        <Activity className="h-8 w-8 animate-spin mx-auto text-cyan-400" />
        <p className="text-sm font-semibold">Generating unified longitudinal EHR timeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm flex items-center space-x-3">
        <ShieldAlert className="h-6 w-6 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!timelineData) return null;

  const { patient, summaryStats, timeline } = timelineData;

  const filteredTimeline = activeCategory === "ALL"
    ? timeline
    : timeline.filter((e: any) => {
        if (activeCategory === "LAB") return e.category === "LAB_ORDER" || e.category === "LAB_RESULT";
        return e.category === activeCategory;
      });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "APPOINTMENT":
        return <Calendar className="h-4 w-4 text-cyan-400" />;
      case "VITALS":
        return <HeartPulse className="h-4 w-4 text-rose-400" />;
      case "DIAGNOSIS":
        return <FileText className="h-4 w-4 text-teal-400" />;
      case "PRESCRIPTION":
        return <Pill className="h-4 w-4 text-amber-400" />;
      case "LAB_ORDER":
      case "LAB_RESULT":
        return <FlaskConical className="h-4 w-4 text-emerald-400" />;
      case "BILLING":
        return <Receipt className="h-4 w-4 text-indigo-400" />;
      default:
        return <Activity className="h-4 w-4 text-slate-400" />;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "APPOINTMENT":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "VITALS":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "DIAGNOSIS":
        return "bg-teal-500/10 text-teal-400 border-teal-500/20";
      case "PRESCRIPTION":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "LAB_ORDER":
      case "LAB_RESULT":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "BILLING":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Summary Cards */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Longitudinal EHR Medical Timeline</h2>
                <p className="text-xs text-slate-400">
                  Unified clinical record for <span className="font-semibold text-slate-200">{patient.name}</span> ({patient.bloodGroup || "Blood Group Unset"} | {patient.gender})
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handlePrintFullTimeline}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print Complete EHR Summary</span>
          </button>
        </div>

        {/* 4 Stat Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <span className="text-[11px] text-slate-400 font-medium">Hospital Visits</span>
            <p className="text-xl font-black text-cyan-400 mt-1">{summaryStats.totalAppointments}</p>
          </div>
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <span className="text-[11px] text-slate-400 font-medium">Clinical Diagnoses</span>
            <p className="text-xl font-black text-teal-400 mt-1">{summaryStats.totalDiagnoses}</p>
          </div>
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <span className="text-[11px] text-slate-400 font-medium">Prescriptions</span>
            <p className="text-xl font-black text-amber-400 mt-1">{summaryStats.totalPrescriptions}</p>
          </div>
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <span className="text-[11px] text-slate-400 font-medium">Lab Investigations</span>
            <p className="text-xl font-black text-emerald-400 mt-1">{summaryStats.completedLabReports} / {summaryStats.totalLabTests}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: "ALL", label: "All Events" },
          { id: "APPOINTMENT", label: "Visits & Consultations" },
          { id: "VITALS", label: "Vitals History" },
          { id: "DIAGNOSIS", label: "Diagnoses" },
          { id: "PRESCRIPTION", label: "Prescriptions" },
          { id: "LAB", label: "Laboratory Reports" },
          { id: "BILLING", label: "Billing & Receipts" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap border cursor-pointer ${
              activeCategory === tab.id
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm"
                : "bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline Stream */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
        {filteredTimeline.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-xs">
            No clinical records found matching the selected filter.
          </div>
        ) : (
          filteredTimeline.map((evt: any) => (
            <div key={evt.id} className="relative group">
              
              {/* Dot on timeline vertical line */}
              <div className="absolute -left-[27px] top-4 h-4 w-4 rounded-full bg-slate-950 border-2 border-cyan-500 flex items-center justify-center shadow-md">
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </div>

              {/* Event Card */}
              <div className="p-5 bg-slate-900/90 hover:bg-slate-850 border border-slate-800 rounded-2xl shadow-md transition-all space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-lg border flex items-center space-x-1 ${getCategoryBadgeClass(evt.category)}`}>
                      {getCategoryIcon(evt.category)}
                      <span>{evt.typeLabel || evt.category}</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {/* Document View Action */}
                  {(evt.category === "DIAGNOSIS" || evt.category === "PRESCRIPTION" || evt.category === "LAB_ORDER" || evt.category === "LAB_RESULT") && (
                    <button
                      onClick={() => handleOpenDocument(evt.category, evt.metadata)}
                      className="px-3 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/30 transition-all flex items-center space-x-1 self-start sm:self-auto cursor-pointer"
                    >
                      <Printer className="h-3 w-3" />
                      <span>View & Print Document</span>
                    </button>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">{evt.title}</h3>
                  {evt.subtitle && <p className="text-xs text-slate-400 mt-0.5">{evt.subtitle}</p>}
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs text-slate-300 leading-relaxed font-mono">
                  {evt.summary}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Clinical Document Modal */}
      <ClinicalDocumentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        documentType={modalDocType}
        data={modalDocData}
      />
    </div>
  );
};
