import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { LabOrder, LabTest, ParameterResultItem } from "../types";
import { ClinicalDocumentModal } from "../components/ClinicalDocumentModal";
import { 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Search, 
  FlaskConical, 
  FileText, 
  UserCheck, 
  X,
  Trash2,
  Printer
} from "lucide-react";

interface LaboratoryDashboardProps {
  activeTab: string;
}

export const LaboratoryDashboard: React.FC<LaboratoryDashboardProps> = ({ activeTab }) => {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [catalog, setCatalog] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Summary KPIs
  const [summary, setSummary] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    samplesCollected: 0,
    completedOrders: 0,
    statOrders: 0,
  });

  // Sample Collection Action State
  const [collectingId, setCollectingId] = useState<string | null>(null);

  // Result Entry Modal State
  const [selectedOrderForResults, setSelectedOrderForResults] = useState<LabOrder | null>(null);
  const [parameterRows, setParameterRows] = useState<ParameterResultItem[]>([]);
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [remarks, setRemarks] = useState("");
  const [approvedBy, setApprovedBy] = useState("Dr. Emily Stone, MD (Pathologist)");
  const [submittingResults, setSubmittingResults] = useState(false);

  // View Report Modal State
  const [viewReportOrder, setViewReportOrder] = useState<LabOrder | null>(null);
  const [showPrintDocModal, setShowPrintDocModal] = useState(false);
  const [printDocData, setPrintDocData] = useState<any>(null);

  const openPrintableLabReport = async (orderId: string) => {
    try {
      const res = await api.get(`/medical-records/lab/${orderId}/report`);
      setPrintDocData(res.data);
      setShowPrintDocModal(true);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to load printable lab report");
    }
  };

  // Add Catalog Modal State
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [newTest, setNewTest] = useState({
    name: "",
    code: "",
    category: "Hematology",
    description: "",
    sampleType: "Whole Blood",
    price: 40.0,
    tatHours: 12,
    referenceRange: "",
    unit: "",
  });
  const [addingTest, setAddingTest] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab, statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "queue" || activeTab === "orders") {
        const [ordersRes, sumRes] = await Promise.all([
          api.get(`/lab/orders?status=${statusFilter}`),
          api.get("/lab/summary"),
        ]);
        setOrders(ordersRes.data);
        setSummary(sumRes.data);
      } else if (activeTab === "catalog") {
        const catalogRes = await api.get("/lab/tests");
        setCatalog(catalogRes.data);
      }
    } catch (err) {
      console.error("Failed to load laboratory data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectSample = async (orderId: string) => {
    setCollectingId(orderId);
    try {
      await api.put(`/lab/orders/${orderId}/sample`);
      alert("Specimen sample collected and accessioned into laboratory!");
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to mark sample collection.");
    } finally {
      setCollectingId(null);
    }
  };

  const openResultModal = (order: LabOrder) => {
    setSelectedOrderForResults(order);
    setClinicalSummary("");
    setRemarks("");

    // Initialize default parameter template based on test
    const defaultParams: ParameterResultItem[] = [];
    if (order.labTest?.code === "CBC") {
      defaultParams.push(
        { parameter: "Hemoglobin (Hb)", value: "14.2", unit: "g/dL", referenceRange: "13.5 - 17.5", flag: "NORMAL" },
        { parameter: "Total Leukocyte Count (WBC)", value: "7200", unit: "/cumm", referenceRange: "4000 - 11000", flag: "NORMAL" },
        { parameter: "Platelet Count", value: "240000", unit: "/cumm", referenceRange: "150000 - 450000", flag: "NORMAL" },
        { parameter: "RBC Count", value: "4.8", unit: "mil/cumm", referenceRange: "4.5 - 5.5", flag: "NORMAL" }
      );
    } else if (order.labTest?.code === "CMP-LFT") {
      defaultParams.push(
        { parameter: "ALT (SGPT)", value: "28", unit: "U/L", referenceRange: "7 - 56", flag: "NORMAL" },
        { parameter: "AST (SGOT)", value: "24", unit: "U/L", referenceRange: "10 - 40", flag: "NORMAL" },
        { parameter: "Total Bilirubin", value: "0.8", unit: "mg/dL", referenceRange: "0.2 - 1.2", flag: "NORMAL" },
        { parameter: "Serum Albumin", value: "4.2", unit: "g/dL", referenceRange: "3.5 - 5.0", flag: "NORMAL" }
      );
    } else if (order.labTest?.code === "KFT-RFT") {
      defaultParams.push(
        { parameter: "Serum Creatinine", value: "0.9", unit: "mg/dL", referenceRange: "0.7 - 1.3", flag: "NORMAL" },
        { parameter: "Blood Urea Nitrogen (BUN)", value: "14", unit: "mg/dL", referenceRange: "7 - 20", flag: "NORMAL" },
        { parameter: "Estimated GFR (eGFR)", value: "98", unit: "mL/min/1.73m²", referenceRange: "> 90", flag: "NORMAL" }
      );
    } else if (order.labTest?.code === "LIPID") {
      defaultParams.push(
        { parameter: "Total Cholesterol", value: "185", unit: "mg/dL", referenceRange: "< 200", flag: "NORMAL" },
        { parameter: "HDL Cholesterol", value: "48", unit: "mg/dL", referenceRange: "> 40", flag: "NORMAL" },
        { parameter: "LDL Cholesterol", value: "110", unit: "mg/dL", referenceRange: "< 100", flag: "HIGH" },
        { parameter: "Triglycerides", value: "140", unit: "mg/dL", referenceRange: "< 150", flag: "NORMAL" }
      );
    } else {
      defaultParams.push({
        parameter: order.labTest?.name || "Test Parameter",
        value: "",
        unit: order.labTest?.unit || "",
        referenceRange: order.labTest?.referenceRange || "Normal Range",
        flag: "NORMAL",
      });
    }

    setParameterRows(defaultParams);
  };

  const handleAddParamRow = () => {
    setParameterRows([
      ...parameterRows,
      { parameter: "", value: "", unit: "", referenceRange: "", flag: "NORMAL" },
    ]);
  };

  const handleRemoveParamRow = (index: number) => {
    setParameterRows(parameterRows.filter((_, i) => i !== index));
  };

  const handleParamChange = (index: number, field: keyof ParameterResultItem, val: string) => {
    const updated = [...parameterRows];
    updated[index] = { ...updated[index], [field]: val };
    setParameterRows(updated);
  };

  const handleSaveResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForResults) return;

    if (parameterRows.length === 0 || parameterRows.some((r) => !r.parameter || !r.value)) {
      alert("Please ensure all test parameter names and observed values are provided.");
      return;
    }

    setSubmittingResults(true);
    try {
      await api.post(`/lab/orders/${selectedOrderForResults.id}/results`, {
        parameterResults: parameterRows,
        summary: clinicalSummary || "All parameters evaluated. Diagnostic findings recorded.",
        remarks: remarks || undefined,
        approvedBy,
      });

      alert("Diagnostic laboratory report entered, finalized and published to patient chart!");
      setSelectedOrderForResults(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save lab results.");
    } finally {
      setSubmittingResults(false);
    }
  };

  const handleAddTestToCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingTest(true);
    try {
      await api.post("/lab/tests", newTest);
      setShowAddTestModal(false);
      setNewTest({
        name: "",
        code: "",
        category: "Hematology",
        description: "",
        sampleType: "Whole Blood",
        price: 40.0,
        tatHours: 12,
        referenceRange: "",
        unit: "",
      });
      fetchData();
      alert("New diagnostic test added to hospital catalog successfully!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to add test to catalog.");
    } finally {
      setAddingTest(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.patient?.name.toLowerCase().includes(q) ||
      o.labTest?.name.toLowerCase().includes(q) ||
      o.doctor?.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* QUEUE & ANALYSIS TAB */}
      {(activeTab === "queue" || activeTab === "orders") && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <FlaskConical className="h-5 w-5 text-emerald-400" />
                <span>Laboratory Queue & Diagnostics Console</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Accession incoming test orders, track specimen collection, enter analytical measurements, and publish signed diagnostic reports.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search order #, patient, test..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Orders</span>
              <span className="text-2xl font-extrabold text-slate-100">{summary.totalOrders}</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>Pending Sample</span>
              </span>
              <span className="text-2xl font-extrabold text-amber-400">{summary.pendingOrders}</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block flex items-center space-x-1">
                <FlaskConical className="h-3 w-3" />
                <span>In Laboratory</span>
              </span>
              <span className="text-2xl font-extrabold text-cyan-400">{summary.samplesCollected}</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block flex items-center space-x-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Completed</span>
              </span>
              <span className="text-2xl font-extrabold text-emerald-400">{summary.completedOrders}</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl col-span-2 sm:col-span-1">
              <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block flex items-center space-x-1">
                <AlertTriangle className="h-3 w-3 animate-pulse" />
                <span>STAT / Urgent</span>
              </span>
              <span className="text-2xl font-extrabold text-rose-400">{summary.statOrders}</span>
            </div>
          </div>

          {/* FILTER BUTTONS */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "ALL", label: "All Orders" },
              { id: "ORDERED", label: "Needs Specimen Collection" },
              { id: "SAMPLE_COLLECTED", label: "Ready for Analysis" },
              { id: "COMPLETED", label: "Finalized Reports" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  statusFilter === f.id
                    ? "bg-emerald-600 text-white shadow-md"
                    : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* LAB ORDERS TABLE */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Order # & Priority</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Prescribing Physician</th>
                    <th className="px-4 py-3">Test & Specimen</th>
                    <th className="px-4 py-3">Order Status</th>
                    <th className="px-4 py-3">Timeline</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Loading laboratory orders...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No laboratory orders found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      return (
                        <tr key={order.id} className="hover:bg-slate-850/60 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-mono font-bold text-slate-100 text-xs">
                              {order.orderNumber}
                            </div>
                            <span className={`inline-block mt-1 px-2 py-0.5 text-[9px] font-bold rounded-md uppercase ${
                              order.priority === "STAT"
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse"
                                : order.priority === "URGENT"
                                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}>
                              {order.priority}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-100">{order.patient?.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {order.patient?.gender} • Blood: {order.patient?.bloodGroup}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-medium text-cyan-400">{order.doctor?.name}</div>
                            <div className="text-[10px] text-slate-500">
                              {order.doctor?.department?.name || "General Medicine"}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-200">{order.labTest?.name}</div>
                            <div className="text-[10px] text-emerald-400 flex items-center space-x-1 mt-0.5">
                              <FlaskConical className="h-3 w-3" />
                              <span>Sample: {order.labTest?.sampleType}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border inline-flex items-center space-x-1 ${
                              order.status === "COMPLETED"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : order.status === "SAMPLE_COLLECTED"
                                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                                : order.status === "ORDERED"
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}>
                              {order.status === "COMPLETED" && <CheckCircle2 className="h-3 w-3" />}
                              {order.status === "SAMPLE_COLLECTED" && <FlaskConical className="h-3 w-3" />}
                              {order.status === "ORDERED" && <Clock className="h-3 w-3" />}
                              <span>{order.status.replace("_", " ")}</span>
                            </span>
                          </td>

                          <td className="px-4 py-3 text-[11px]">
                            <div className="text-slate-400">
                              Ordered: {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {order.sampleCollectedAt && (
                              <div className="text-cyan-400/80 text-[10px]">
                                Sample: {new Date(order.sampleCollectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                            {order.completedAt && (
                              <div className="text-emerald-400/80 text-[10px]">
                                Done: {new Date(order.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {order.status === "ORDERED" && (
                                <button
                                  onClick={() => handleCollectSample(order.id)}
                                  disabled={collectingId === order.id}
                                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center space-x-1"
                                >
                                  <FlaskConical className="h-3.5 w-3.5" />
                                  <span>{collectingId === order.id ? "Collecting..." : "Collect Sample"}</span>
                                </button>
                              )}

                              {order.status === "SAMPLE_COLLECTED" && (
                                <button
                                  onClick={() => openResultModal(order)}
                                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1"
                                >
                                  <FileSpreadsheet className="h-3.5 w-3.5" />
                                  <span>Enter Results</span>
                                </button>
                              )}

                              {order.status === "COMPLETED" && (
                                <button
                                  onClick={() => setViewReportOrder(order)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-semibold text-xs border border-slate-700 transition-all flex items-center space-x-1"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  <span>View Report</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DIAGNOSTIC CATALOG TAB */}
      {activeTab === "catalog" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                <span>Hospital Diagnostic Test Catalog</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Maintain standard diagnostic panels, specimen protocols, turnaround time targets, and pricing.
              </p>
            </div>

            <button
              onClick={() => setShowAddTestModal(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg flex items-center space-x-2 transition-all w-fit"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Diagnostic Test</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalog.map((t) => (
              <div key={t.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-md uppercase">
                      {t.category}
                    </span>
                    <h3 className="font-bold text-slate-100 text-sm mt-1.5">{t.name}</h3>
                    <span className="text-xs text-slate-400 font-mono">Code: {t.code}</span>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    ${t.price.toFixed(2)}
                  </span>
                </div>

                {t.description && (
                  <p className="text-xs text-slate-400 line-clamp-2">{t.description}</p>
                )}

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sample Type:</span>
                    <span className="font-semibold text-slate-200">{t.sampleType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Standard TAT:</span>
                    <span className="font-semibold text-slate-200">{t.tatHours} Hours</span>
                  </div>
                  {t.referenceRange && (
                    <div className="pt-1 border-t border-slate-900 text-[11px] text-slate-400">
                      <span className="text-slate-500 font-semibold">Ref: </span>{t.referenceRange}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ENTER RESULTS MODAL */}
      {selectedOrderForResults && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <FlaskConical className="h-5 w-5 text-emerald-400" />
                  <span>Enter Diagnostic Results: {selectedOrderForResults.labTest?.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Order #{selectedOrderForResults.orderNumber} • Patient: <strong className="text-slate-200">{selectedOrderForResults.patient?.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderForResults(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResults} className="space-y-4 text-xs">
              {/* PARAMETER RESULTS MATRIX */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs">Analytical Parameters & Measurements</span>
                  <button
                    type="button"
                    onClick={handleAddParamRow}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold rounded-lg border border-slate-700 flex items-center space-x-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Parameter</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2">Parameter Name</th>
                        <th className="px-3 py-2">Observed Value</th>
                        <th className="px-3 py-2">Unit</th>
                        <th className="px-3 py-2">Reference Range</th>
                        <th className="px-3 py-2">Clinical Flag</th>
                        <th className="px-2 py-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {parameterRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              value={row.parameter}
                              onChange={(e) => handleParamChange(idx, "parameter", e.target.value)}
                              placeholder="e.g. Hemoglobin"
                              className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2 py-1 text-slate-100"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              value={row.value}
                              onChange={(e) => handleParamChange(idx, "value", e.target.value)}
                              placeholder="e.g. 14.5"
                              className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2 py-1 text-slate-100 font-bold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.unit}
                              onChange={(e) => handleParamChange(idx, "unit", e.target.value)}
                              placeholder="g/dL"
                              className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2 py-1 text-slate-300"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.referenceRange}
                              onChange={(e) => handleParamChange(idx, "referenceRange", e.target.value)}
                              placeholder="13.5 - 17.5"
                              className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2 py-1 text-slate-400"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={row.flag}
                              onChange={(e) => handleParamChange(idx, "flag", e.target.value as any)}
                              className={`w-full bg-slate-900 border border-slate-850 rounded-lg px-2 py-1 font-bold ${
                                row.flag === "HIGH" ? "text-rose-400" : row.flag === "LOW" ? "text-amber-400" : row.flag === "ABNORMAL" ? "text-purple-400" : "text-emerald-400"
                              }`}
                            >
                              <option value="NORMAL">NORMAL</option>
                              <option value="HIGH">HIGH (Elevated)</option>
                              <option value="LOW">LOW (Decreased)</option>
                              <option value="ABNORMAL">ABNORMAL</option>
                            </select>
                          </td>
                          <td className="p-2 text-right">
                            {parameterRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveParamRow(idx)}
                                className="text-slate-500 hover:text-rose-400 p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CLINICAL SUMMARY & INTERPRETATION */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Pathologist Clinical Summary / Diagnostic Interpretation *
                </label>
                <textarea
                  required
                  rows={3}
                  value={clinicalSummary}
                  onChange={(e) => setClinicalSummary(e.target.value)}
                  placeholder="e.g. Complete blood count within normal physiological limits. No evidence of cytopenia or leukocytosis."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* REMARKS & APPROVAL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Remarks / Additional Notes</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Sample analyzed on automated hematology analyzer."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Approved & Verified By</label>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              {/* MODAL ACTIONS */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForResults(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResults}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold shadow-lg disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>{submittingResults ? "Publishing Report..." : "Finalize & Publish Report"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW LAB REPORT MODAL */}
      {viewReportOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FlaskConical className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">{viewReportOrder.labTest?.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Report ID: {viewReportOrder.orderNumber} • Status: FINAL
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openPrintableLabReport(viewReportOrder.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Formal Report</span>
                </button>
                <button
                  onClick={() => setViewReportOrder(null)}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* PATIENT & DOCTOR INFO BANNER */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs">
              <div>
                <span className="text-slate-500 block">Patient Name:</span>
                <span className="font-bold text-slate-100">{viewReportOrder.patient?.name}</span>
                <span className="text-slate-400 block text-[11px] mt-0.5">
                  Gender: {viewReportOrder.patient?.gender} • Blood Group: {viewReportOrder.patient?.bloodGroup}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Referring Physician:</span>
                <span className="font-bold text-cyan-400">{viewReportOrder.doctor?.name}</span>
                <span className="text-slate-400 block text-[11px] mt-0.5">
                  Completed: {viewReportOrder.completedAt ? new Date(viewReportOrder.completedAt).toLocaleString() : "N/A"}
                </span>
              </div>
            </div>

            {/* PARAMETERS TABLE */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Investigation Parameter</th>
                    <th className="px-4 py-2.5">Observed Value</th>
                    <th className="px-4 py-2.5">Unit</th>
                    <th className="px-4 py-2.5">Reference Range</th>
                    <th className="px-4 py-2.5">Status Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(viewReportOrder.labResult?.parameterResults || []).map((p: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
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

            {/* INTERPRETATION */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-1.5 text-xs">
              <span className="font-bold text-emerald-400 block">Pathologist Clinical Impression:</span>
              <p className="text-slate-200 leading-relaxed">{viewReportOrder.labResult?.summary}</p>
              {viewReportOrder.labResult?.remarks && (
                <p className="text-slate-400 text-[11px] pt-1 border-t border-slate-900">
                  <strong className="text-slate-300">Remarks: </strong>{viewReportOrder.labResult.remarks}
                </p>
              )}
            </div>

            {/* SIGNATURE FOOTER */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <div>
                <span>Tested By: </span>
                <strong className="text-slate-300">{viewReportOrder.labResult?.testedBy || "Laboratory Analyst"}</strong>
              </div>
              <div>
                <span>Verified By: </span>
                <strong className="text-emerald-400">{viewReportOrder.labResult?.approvedBy || "Pathologist On Duty"}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD TEST CATALOG MODAL */}
      {showAddTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <FlaskConical className="h-5 w-5 text-emerald-400" />
              <span>Add Diagnostic Test to Master Catalog</span>
            </h3>

            <form onSubmit={handleAddTestToCatalog} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Test Name *</label>
                  <input
                    type="text"
                    required
                    value={newTest.name}
                    onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                    placeholder="e.g. Serum Electrolytes"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Test Code *</label>
                  <input
                    type="text"
                    required
                    value={newTest.code}
                    onChange={(e) => setNewTest({ ...newTest, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. LYTES"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category *</label>
                  <select
                    value={newTest.category}
                    onChange={(e) => setNewTest({ ...newTest, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  >
                    <option value="Hematology">Hematology</option>
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Microbiology">Microbiology</option>
                    <option value="Pathology">Pathology</option>
                    <option value="Endocrinology">Endocrinology</option>
                    <option value="Immunology">Immunology</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Sample Type *</label>
                  <input
                    type="text"
                    required
                    value={newTest.sampleType}
                    onChange={(e) => setNewTest({ ...newTest, sampleType: e.target.value })}
                    placeholder="e.g. Serum, Whole Blood"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newTest.description}
                  onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                  placeholder="Clinical significance and description of this diagnostic test."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Turnaround (Hrs)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newTest.tatHours}
                    onChange={(e) => setNewTest({ ...newTest, tatHours: parseInt(e.target.value) || 24 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Unit</label>
                  <input
                    type="text"
                    value={newTest.unit}
                    onChange={(e) => setNewTest({ ...newTest, unit: e.target.value })}
                    placeholder="mg/dL"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min={1}
                    value={newTest.price}
                    onChange={(e) => setNewTest({ ...newTest, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Default Reference Range</label>
                <input
                  type="text"
                  value={newTest.referenceRange}
                  onChange={(e) => setNewTest({ ...newTest, referenceRange: e.target.value })}
                  placeholder="e.g. Na: 135-145 mEq/L, K: 3.5-5.0 mEq/L"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddTestModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTest}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg"
                >
                  {addingTest ? "Saving..." : "Add to Catalog"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORMAL CLINICAL DOCUMENT MODAL */}
      <ClinicalDocumentModal
        isOpen={showPrintDocModal}
        onClose={() => setShowPrintDocModal(false)}
        documentType="LAB_REPORT"
        data={printDocData}
      />

    </div>
  );
};
