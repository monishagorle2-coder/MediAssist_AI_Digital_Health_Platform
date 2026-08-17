import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { Prescription, Medicine } from "../types";
import { Pill, FileSpreadsheet, AlertTriangle, Plus, ShieldAlert, CheckCircle2, Clock, Edit3 } from "lucide-react";

interface PharmacistDashboardProps {
  activeTab: string;
}

export const PharmacistDashboard: React.FC<PharmacistDashboardProps> = ({ activeTab }) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [inventory, setInventory] = useState<Medicine[]>([]);
  const [dispenseLoading, setDispenseLoading] = useState<string | null>(null);
  const [inventoryFilter, setInventoryFilter] = useState<string>("ALL");

  // Summary counts
  const [summary, setSummary] = useState({
    totalMedicines: 0,
    lowStockCount: 0,
    nearExpiryCount: 0,
    expiredCount: 0,
  });

  // Add Medicine Modal
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [newMed, setNewMed] = useState({
    name: "",
    genericName: "",
    category: "Analgesic",
    manufacturer: "",
    batchNumber: "",
    expiryDate: "",
    stock: 100,
    unit: "tablets",
    minStockLimit: 15,
    price: 5.0,
  });
  const [addMedLoading, setAddMedLoading] = useState(false);

  // Edit Medicine Modal
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    genericName: "",
    category: "",
    manufacturer: "",
    batchNumber: "",
    expiryDate: "",
    stock: 0,
    unit: "tablets",
    minStockLimit: 15,
    price: 0,
  });
  const [editMedLoading, setEditMedLoading] = useState(false);

  // Quick Stock Adjustment Modal
  const [stockEditMed, setStockEditMed] = useState<Medicine | null>(null);
  const [updatedStock, setUpdatedStock] = useState(0);

  useEffect(() => {
    fetchData();
  }, [activeTab, inventoryFilter]);

  const fetchData = async () => {
    try {
      if (activeTab === "prescriptions") {
        const presRes = await api.get("/pharmacy/prescriptions");
        setPrescriptions(presRes.data);
      } else if (activeTab === "inventory") {
        const [invRes, sumRes] = await Promise.all([
          api.get(`/pharmacy/inventory?filter=${inventoryFilter}`),
          api.get("/pharmacy/inventory/summary"),
        ]);
        setInventory(invRes.data);
        setSummary(sumRes.data);
      }
    } catch (err) {
      console.error("Failed to load pharmacy data", err);
    }
  };

  const handleDispense = async (id: string) => {
    setDispenseLoading(id);
    try {
      const res = await api.put(`/pharmacy/prescriptions/${id}/dispense`);
      alert(`Prescription dispensed successfully! Stock deducted and bill updated. ${res.data.alerts ? `(${res.data.alerts})` : ""}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to dispense prescription.");
    } finally {
      setDispenseLoading(null);
    }
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMedLoading(true);
    try {
      await api.post("/pharmacy/inventory", {
        ...newMed,
        expiryDate: newMed.expiryDate || undefined,
      });
      setShowAddMedModal(false);
      setNewMed({
        name: "",
        genericName: "",
        category: "Analgesic",
        manufacturer: "",
        batchNumber: "",
        expiryDate: "",
        stock: 100,
        unit: "tablets",
        minStockLimit: 15,
        price: 5.0,
      });
      fetchData();
      alert("New medicine added to pharmacy inventory successfully!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to add medicine.");
    } finally {
      setAddMedLoading(false);
    }
  };

  const openEditModal = (med: Medicine) => {
    setEditingMed(med);
    setEditFormData({
      name: med.name,
      genericName: med.genericName || "",
      category: med.category,
      manufacturer: med.manufacturer || "",
      batchNumber: med.batchNumber || "",
      expiryDate: med.expiryDate ? new Date(med.expiryDate).toISOString().split("T")[0] : "",
      stock: med.stock,
      unit: med.unit,
      minStockLimit: med.minStockLimit,
      price: med.price,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMed) return;
    setEditMedLoading(true);
    try {
      await api.put(`/pharmacy/inventory/${editingMed.id}`, {
        ...editFormData,
        expiryDate: editFormData.expiryDate || null,
      });
      setEditingMed(null);
      fetchData();
      alert("Medicine details and expiry updated successfully!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update medicine.");
    } finally {
      setEditMedLoading(false);
    }
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockEditMed) return;
    try {
      await api.put(`/pharmacy/inventory/${stockEditMed.id}/stock`, { stock: updatedStock });
      setStockEditMed(null);
      fetchData();
      alert("Inventory stock updated successfully!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update stock.");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* FULFILL PRESCRIPTIONS TAB */}
      {activeTab === "prescriptions" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Pill className="h-5 w-5 text-amber-400" />
              <span>Pharmacy Prescription Fulfillment Queue</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Fulfill electronic doctor prescriptions with automated stock validation, expiry verification, and real-time inventory deduction.
            </p>
          </div>

          <div className="space-y-4">
            {prescriptions.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                No doctor prescriptions pending in queue.
              </div>
            ) : (
              prescriptions.map((pres: any) => (
                <div key={pres.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <span className="font-bold text-slate-100 text-sm">Patient: {pres.patient?.name}</span>
                      <div className="text-xs text-slate-400">
                        Prescribing Physician: <span className="text-cyan-400 font-medium">{pres.doctor?.name}</span>
                        {pres.doctor?.department && <span> • {pres.doctor.department.name}</span>}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                        pres.status === "DISPENSED" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}>
                        {pres.status}
                      </span>

                      {pres.status === "PENDING" && (
                        <button
                          onClick={() => handleDispense(pres.id)}
                          disabled={dispenseLoading === pres.id}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50 flex items-center space-x-1.5"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>{dispenseLoading === pres.id ? "Validating & Dispensing..." : "Dispense Medications"}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Medicines List */}
                  <div className="divide-y divide-slate-800/60">
                    {(pres.medicines || []).map((med: any, idx: number) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-200">{med.medicineName}</span>
                          <span className="text-slate-400 ml-2">({med.dosage} • {med.frequency} • {med.duration})</span>
                        </div>
                        <span className="px-2.5 py-1 bg-slate-950 text-cyan-400 font-bold rounded-lg text-[11px] border border-slate-800">
                          Prescribed: {med.quantity || 10} Units
                        </span>
                      </div>
                    ))}
                  </div>

                  {pres.notes && (
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-xs text-slate-400">
                      <span className="font-semibold text-slate-300">Doctor Instructions: </span>{pres.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MEDICINE INVENTORY TAB */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <FileSpreadsheet className="h-5 w-5 text-amber-400" />
                <span>Pharmacy Master Inventory & Expiry Control</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Monitor batch numbers, expiry dates, low-stock thresholds, and restock alerts across the hospital pharmacy.
              </p>
            </div>

            <button
              onClick={() => setShowAddMedModal(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-lg flex items-center space-x-2 transition-all w-fit"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Medication</span>
            </button>
          </div>

          {/* SUMMARY STATS KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Catalog</span>
              <span className="text-2xl font-extrabold text-slate-100">{summary.totalMedicines}</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block flex items-center space-x-1">
                <AlertTriangle className="h-3 w-3" />
                <span>Low Stock</span>
              </span>
              <span className="text-2xl font-extrabold text-amber-400">{summary.lowStockCount}</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>Near Expiry (&le; 30d)</span>
              </span>
              <span className="text-2xl font-extrabold text-orange-400">{summary.nearExpiryCount}</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block flex items-center space-x-1">
                <ShieldAlert className="h-3 w-3" />
                <span>Expired</span>
              </span>
              <span className="text-2xl font-extrabold text-rose-400">{summary.expiredCount}</span>
            </div>
          </div>

          {/* FILTER BUTTONS */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "ALL", label: "All Items" },
              { id: "IN_STOCK", label: "In Stock" },
              { id: "LOW_STOCK", label: "Low Stock" },
              { id: "NEAR_EXPIRY", label: "Near Expiry" },
              { id: "EXPIRED", label: "Expired" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setInventoryFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  inventoryFilter === f.id
                    ? "bg-amber-600 text-white shadow-md"
                    : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* INVENTORY TABLE */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Medicine & Generic</th>
                    <th className="px-4 py-3">Manufacturer / Batch</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Expiry Date</th>
                    <th className="px-4 py-3">Stock / Min Limit</th>
                    <th className="px-4 py-3">Unit Price</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {inventory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No medications found for this filter.
                      </td>
                    </tr>
                  ) : (
                    inventory.map((med) => {
                      return (
                        <tr key={med.id} className="hover:bg-slate-850/60 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-100 text-sm">{med.name}</div>
                            {med.genericName && (
                              <div className="text-[11px] text-slate-400">{med.genericName}</div>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="text-slate-300 font-medium">{med.manufacturer || "--"}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Batch: {med.batchNumber || "N/A"}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-400">{med.category}</td>

                          <td className="px-4 py-3">
                            {med.expiryDate ? (
                              <div>
                                <div className="font-semibold text-slate-200">
                                  {new Date(med.expiryDate).toLocaleDateString()}
                                </div>
                                {med.isExpired ? (
                                  <span className="text-[10px] text-rose-400 font-bold block">
                                    EXPIRED ({Math.abs(med.daysUntilExpiry || 0)}d ago)
                                  </span>
                                ) : med.isNearExpiry ? (
                                  <span className="text-[10px] text-orange-400 font-bold block">
                                    Expires in {med.daysUntilExpiry}d
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-emerald-400 block">
                                    {med.daysUntilExpiry}d remaining
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500">No Expiry Set</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-extrabold text-slate-200">
                              {med.stock} <span className="text-[10px] text-slate-500 font-normal">{med.unit}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Min Alert: {med.minStockLimit}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-semibold text-emerald-400">
                            ${med.price.toFixed(2)}
                          </td>

                          <td className="px-4 py-3">
                            {med.isExpired ? (
                              <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold rounded-full flex items-center space-x-1 w-fit">
                                <ShieldAlert className="h-3 w-3" />
                                <span>EXPIRED</span>
                              </span>
                            ) : med.isLowStock ? (
                              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded-full flex items-center space-x-1 w-fit">
                                <AlertTriangle className="h-3 w-3 animate-pulse" />
                                <span>LOW STOCK</span>
                              </span>
                            ) : med.isNearExpiry ? (
                              <span className="px-2.5 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold rounded-full flex items-center space-x-1 w-fit">
                                <Clock className="h-3 w-3" />
                                <span>NEAR EXPIRY</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-full w-fit">
                                IN STOCK
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => openEditModal(med)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                                title="Edit Medicine Details"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setStockEditMed(med);
                                  setUpdatedStock(med.stock);
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700"
                              >
                                Adjust Stock
                              </button>
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

      {/* ADD MEDICINE MODAL */}
      {showAddMedModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <Pill className="h-5 w-5 text-amber-400" />
              <span>Add New Medicine to Catalog</span>
            </h3>

            <form onSubmit={handleAddMedicine} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Brand / Trade Name</label>
                  <input
                    type="text"
                    required
                    value={newMed.name}
                    onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                    placeholder="e.g. Augmentin 625 Duo"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Generic / Scientific Name</label>
                  <input
                    type="text"
                    value={newMed.genericName}
                    onChange={(e) => setNewMed({ ...newMed, genericName: e.target.value })}
                    placeholder="Amoxicillin + Clavulanic Acid"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Therapeutic Category</label>
                  <input
                    type="text"
                    required
                    value={newMed.category}
                    onChange={(e) => setNewMed({ ...newMed, category: e.target.value })}
                    placeholder="Antibiotic"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={newMed.manufacturer}
                    onChange={(e) => setNewMed({ ...newMed, manufacturer: e.target.value })}
                    placeholder="GlaxoSmithKline"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Batch / Lot Number</label>
                  <input
                    type="text"
                    value={newMed.batchNumber}
                    onChange={(e) => setNewMed({ ...newMed, batchNumber: e.target.value })}
                    placeholder="AUG-2026-B1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={newMed.expiryDate}
                    onChange={(e) => setNewMed({ ...newMed, expiryDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Initial Stock</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newMed.stock}
                    onChange={(e) => setNewMed({ ...newMed, stock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Unit</label>
                  <input
                    type="text"
                    required
                    value={newMed.unit}
                    onChange={(e) => setNewMed({ ...newMed, unit: e.target.value })}
                    placeholder="tablets"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Min Threshold</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newMed.minStockLimit}
                    onChange={(e) => setNewMed({ ...newMed, minStockLimit: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min={0.01}
                    value={newMed.price}
                    onChange={(e) => setNewMed({ ...newMed, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMedLoading}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-lg"
                >
                  {addMedLoading ? "Saving..." : "Add Medication"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MEDICINE DETAILS MODAL */}
      {editingMed && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <Edit3 className="h-5 w-5 text-cyan-400" />
              <span>Edit Medicine & Expiry: {editingMed.name}</span>
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Brand Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Generic Name</label>
                  <input
                    type="text"
                    value={editFormData.genericName}
                    onChange={(e) => setEditFormData({ ...editFormData, genericName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={editFormData.manufacturer}
                    onChange={(e) => setEditFormData({ ...editFormData, manufacturer: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={editFormData.batchNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, batchNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={editFormData.expiryDate}
                    onChange={(e) => setEditFormData({ ...editFormData, expiryDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Stock</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editFormData.stock}
                    onChange={(e) => setEditFormData({ ...editFormData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Unit</label>
                  <input
                    type="text"
                    required
                    value={editFormData.unit}
                    onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Min Threshold</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editFormData.minStockLimit}
                    onChange={(e) => setEditFormData({ ...editFormData, minStockLimit: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min={0.01}
                    value={editFormData.price}
                    onChange={(e) => setEditFormData({ ...editFormData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingMed(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editMedLoading}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg"
                >
                  {editMedLoading ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK STOCK ADJUST MODAL */}
      {stockEditMed && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">Adjust Stock: {stockEditMed.name}</h3>

            <form onSubmit={handleUpdateStock} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">New Inventory Quantity ({stockEditMed.unit})</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={updatedStock}
                  onChange={(e) => setUpdatedStock(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 font-bold"
                />
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setStockEditMed(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg"
                >
                  Save Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
