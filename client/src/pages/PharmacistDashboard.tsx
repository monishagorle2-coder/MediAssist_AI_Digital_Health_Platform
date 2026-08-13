import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { Prescription, Medicine } from "../types";
import { Pill, FileSpreadsheet, AlertTriangle, Plus } from "lucide-react";

interface PharmacistDashboardProps {
  activeTab: string;
}

export const PharmacistDashboard: React.FC<PharmacistDashboardProps> = ({ activeTab }) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [inventory, setInventory] = useState<Medicine[]>([]);
  const [dispenseLoading, setDispenseLoading] = useState<string | null>(null);

  // Add Medicine Modal
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [newMed, setNewMed] = useState({
    name: "",
    category: "Analgesic",
    stock: 50,
    unit: "tablets",
    minStockLimit: 15,
    price: 5.0,
  });
  const [addMedLoading, setAddMedLoading] = useState(false);

  // Stock Edit Modal
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [updatedStock, setUpdatedStock] = useState(0);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === "prescriptions") {
        const presRes = await api.get("/pharmacy/prescriptions");
        setPrescriptions(presRes.data);
      } else if (activeTab === "inventory") {
        const invRes = await api.get("/pharmacy/inventory");
        setInventory(invRes.data);
      }
    } catch (err) {
      console.error("Failed to load pharmacy data", err);
    }
  };

  const handleDispense = async (id: string) => {
    setDispenseLoading(id);
    try {
      const res = await api.put(`/pharmacy/prescriptions/${id}/dispense`);
      alert(`Prescription dispensed! Stock updated automatically. ${res.data.alerts || ""}`);
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
      await api.post("/pharmacy/inventory", newMed);
      setShowAddMedModal(false);
      setNewMed({
        name: "",
        category: "Analgesic",
        stock: 50,
        unit: "tablets",
        minStockLimit: 15,
        price: 5.0,
      });
      fetchData();
      alert("New medicine added to pharmacy master inventory!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to add medicine.");
    } finally {
      setAddMedLoading(false);
    }
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMed) return;
    try {
      await api.put(`/pharmacy/inventory/${editingMed.id}`, { stock: updatedStock });
      setEditingMed(null);
      fetchData();
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
              <span>Pharmacy Prescription Queue</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Fulfill electronic prescriptions issued by clinic physicians and decrement inventory stock.
            </p>
          </div>

          <div className="space-y-4">
            {prescriptions.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                No active doctor prescriptions pending in queue.
              </div>
            ) : (
              prescriptions.map((pres: any) => (
                <div key={pres.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <span className="font-bold text-slate-100 text-sm">Patient: {pres.patient?.name}</span>
                      <div className="text-xs text-slate-400">Prescribing Physician: <span className="text-cyan-400 font-medium">{pres.doctor?.name}</span></div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                        pres.status === "DISPENSED" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}>
                        {pres.status}
                      </span>

                      {pres.status === "PENDING" && (
                        <button
                          onClick={() => handleDispense(pres.id)}
                          disabled={dispenseLoading === pres.id}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50"
                        >
                          {dispenseLoading === pres.id ? "Dispensing & Deducting Stock..." : "Dispense Medications"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Medicines List */}
                  <div className="divide-y divide-slate-800/60">
                    {(pres.medicines || []).map((med: any, idx: number) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-200">{med.medicineName}</span>
                          <span className="text-slate-400 ml-2">({med.dosage} • {med.frequency} • {med.duration})</span>
                        </div>
                        <span className="px-2.5 py-0.5 bg-slate-950 text-cyan-400 font-bold rounded text-[11px] border border-slate-800">
                          Qty: {med.quantity || 10}
                        </span>
                      </div>
                    ))}
                  </div>
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
                <span>Pharmacy Master Inventory</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage stock levels, minimum stock thresholds, unit costs, and restock alerts.
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

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Medicine Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Stock Qty</th>
                    <th className="px-4 py-3">Min Limit</th>
                    <th className="px-4 py-3">Unit Price</th>
                    <th className="px-4 py-3">Status Alert</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {inventory.map((med) => {
                    const isLowStock = med.stock <= med.minStockLimit;
                    return (
                      <tr key={med.id} className="hover:bg-slate-850/60 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-slate-100">{med.name}</td>
                        <td className="px-4 py-3 text-slate-400">{med.category}</td>
                        <td className="px-4 py-3 font-extrabold text-slate-200">
                          {med.stock} <span className="text-[10px] text-slate-500 font-normal">{med.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{med.minStockLimit}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-400">${med.price.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {isLowStock ? (
                            <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold rounded-full flex items-center space-x-1 w-fit">
                              <AlertTriangle className="h-3 w-3 animate-pulse" />
                              <span>LOW STOCK</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-full w-fit">
                              IN STOCK
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setEditingMed(med);
                              setUpdatedStock(med.stock);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700"
                          >
                            Update Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD MEDICINE MODAL */}
      {showAddMedModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <Pill className="h-5 w-5 text-amber-400" />
              <span>Add Medication Master</span>
            </h3>

            <form onSubmit={handleAddMedicine} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Medicine Name</label>
                <input
                  type="text"
                  required
                  value={newMed.name}
                  onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                  placeholder="e.g. Ciprofloxacin"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
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
                  <label className="block text-slate-300 font-semibold mb-1">Unit</label>
                  <input
                    type="text"
                    required
                    value={newMed.unit}
                    onChange={(e) => setNewMed({ ...newMed, unit: e.target.value })}
                    placeholder="tablets"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Initial Stock</label>
                  <input
                    type="number"
                    required
                    value={newMed.stock}
                    onChange={(e) => setNewMed({ ...newMed, stock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Min Alert Qty</label>
                  <input
                    type="number"
                    required
                    value={newMed.minStockLimit}
                    onChange={(e) => setNewMed({ ...newMed, minStockLimit: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newMed.price}
                    onChange={(e) => setNewMed({ ...newMed, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
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
                  {addMedLoading ? "Saving..." : "Add Medicine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STOCK MODAL */}
      {editingMed && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">Update Stock: {editingMed.name}</h3>

            <form onSubmit={handleUpdateStock} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">New Available Inventory Qty</label>
                <input
                  type="number"
                  required
                  value={updatedStock}
                  onChange={(e) => setUpdatedStock(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 font-bold"
                />
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingMed(null)}
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
