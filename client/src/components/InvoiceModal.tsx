import React, { useState } from "react";
import api from "../services/api";
import type { Bill, PaymentMethod } from "../types";
import { 
  X, 
  Printer, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  ShieldCheck,
  Receipt
} from "lucide-react";

interface InvoiceModalProps {
  bill: Bill;
  onClose: () => void;
  onPaymentSuccess?: () => void;
  allowPayment?: boolean;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  bill,
  onClose,
  onPaymentSuccess,
  allowPayment = false,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [transactionRef, setTransactionRef] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const isPaid = bill.status === "PAID" || bill.paymentStatus === "PAID";
  const isCancelled = bill.status === "CANCELLED" || bill.paymentStatus === "CANCELLED";

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayLoading(true);
    setPayError("");

    try {
      await api.put(`/bills/${bill.id}/pay`, {
        paymentMethod,
        transactionReference: transactionRef || undefined,
      });

      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
      onClose();
    } catch (err: any) {
      setPayError(err.response?.data?.error || "Failed to process payment");
    } finally {
      setPayLoading(false);
    }
  };

  const items = bill.billItems && bill.billItems.length > 0
    ? bill.billItems
    : (Array.isArray(bill.items) ? bill.items : []).map((it: any) => ({
        description: it.description || "Service",
        category: "OTHER",
        quantity: 1,
        unitPrice: it.cost || bill.amount,
        amount: it.cost || bill.amount,
      }));

  const subtotal = bill.subtotal ?? (items.reduce((s: number, i: any) => s + (i.amount || 0), 0) || bill.amount);
  const taxAmount = bill.taxAmount ?? 0;
  const discountAmount = bill.discountAmount ?? 0;
  const totalAmount = bill.totalAmount ?? bill.amount;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
        
        {/* MODAL CONTROLS BAR (Hidden on Print) */}
        <div className="no-print p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="h-5 w-5 text-cyan-400" />
            <span className="text-sm font-bold text-slate-100">Hospital Tax Invoice & Receipt</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all"
            >
              <Printer className="h-4 w-4 text-cyan-400" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE INVOICE BODY */}
        <div id="printable-invoice" className="p-8 space-y-6 bg-slate-900 text-slate-100">
          
          {/* Hospital Letterhead Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight text-white">MediAssist Healthcare</h1>
                  <p className="text-[11px] text-slate-400">Multi-Specialty Hospital & Diagnostics Network</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                100 Medical Center Blvd, Suite 400 • Phone: (800) 555-MED-CARE • Tax ID: MED-88392-HST
              </p>
            </div>

            <div className="text-left sm:text-right space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Official Invoice</span>
              <div className="text-base font-mono font-extrabold text-cyan-400">
                {bill.invoiceNumber || `INV-${bill.id.slice(0, 8).toUpperCase()}`}
              </div>
              <div className="text-xs text-slate-400">
                Issued: {new Date(bill.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })}
              </div>
              
              <div className="pt-1">
                <span className={`inline-flex items-center space-x-1 px-3 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  isPaid
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : isCancelled
                    ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                }`}>
                  {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  <span>{bill.paymentStatus || bill.status}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Patient & Consultation Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800/80 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Patient Details</span>
              <div className="font-bold text-slate-100 text-sm">{bill.patient?.name || "Patient"}</div>
              <div className="text-slate-400">Phone: {bill.patient?.phone || "N/A"}</div>
              {bill.patient?.bloodGroup && (
                <div className="text-slate-400">Blood Group: <span className="text-slate-200">{bill.patient.bloodGroup}</span></div>
              )}
              {bill.patient?.insuranceProvider && (
                <div className="text-cyan-400 text-[11px] font-medium pt-0.5 flex items-center space-x-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Insured by: {bill.patient.insuranceProvider} (#{bill.patient.insuranceNumber || "N/A"})</span>
                </div>
              )}
            </div>

            <div className="space-y-1 sm:border-l sm:border-slate-850 sm:pl-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Clinical Encounter</span>
              {bill.appointment?.doctor ? (
                <>
                  <div className="font-semibold text-slate-200">{bill.appointment.doctor.name}</div>
                  <div className="text-slate-400">{bill.appointment.doctor.specialization} ({bill.appointment.doctor.department?.name || "General Care"})</div>
                  <div className="text-slate-500 text-[11px]">Encounter: {new Date(bill.appointment.slotDateTime).toLocaleDateString()}</div>
                </>
              ) : (
                <div className="text-slate-400 italic">Direct Hospital Service Encounter</div>
              )}
              {bill.paidAt && (
                <div className="text-emerald-400 text-[11px] pt-1">
                  Paid on: {new Date(bill.paidAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Itemized Services & Supplies Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Description of Service</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                {items.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-850/40">
                    <td className="px-4 py-3 font-semibold text-slate-200">{item.description}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                        {item.category || "OTHER"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-300">{item.quantity || 1}</td>
                    <td className="px-4 py-3 text-right text-slate-300">${(item.unitPrice || item.cost || item.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-100">${(item.amount || item.cost || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown & Payment Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 space-y-2 text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Payment Details</span>
              {isPaid ? (
                <div className="space-y-1">
                  <div className="text-slate-300">Method: <strong className="text-emerald-400 uppercase">{bill.paymentMethod || "CASH"}</strong></div>
                  {bill.transactionReference && (
                    <div className="text-slate-400 font-mono text-[11px]">Txn Ref: {bill.transactionReference}</div>
                  )}
                  <div className="text-emerald-400 font-medium text-[11px] pt-1">
                    ✓ Full payment verified and cleared by Hospital Accounts.
                  </div>
                </div>
              ) : isCancelled ? (
                <div className="text-rose-400 text-xs">
                  Invoice cancelled. No payment due.
                </div>
              ) : (
                <div className="text-amber-400 text-xs space-y-1">
                  <div>Status: Payment Pending</div>
                  <p className="text-[11px] text-slate-400">Payment can be completed online via UPI/Card or at the hospital billing desk.</p>
                </div>
              )}
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-200">${subtotal.toFixed(2)}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Hospital Healthcare Tax ({bill.taxRate || 0}%)</span>
                  <span className="font-semibold text-slate-200">+${taxAmount.toFixed(2)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400 font-medium">
                  <span>Discount Applied</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-800 pt-2 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-100">Total Net Payable</span>
                <span className="text-xl font-black text-cyan-400 font-mono">${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center text-[10px] text-slate-500 border-t border-slate-800/80 pt-4">
            Thank you for choosing MediAssist Healthcare. This is a computer-generated official receipt.
          </div>
        </div>

        {/* PAYMENT PROCESSOR FOOTER (Only when unpaid & allowed) */}
        {!isPaid && !isCancelled && allowPayment && (
          <div className="no-print p-6 bg-slate-950 border-t border-slate-800 space-y-4">
            {!showPaymentForm ? (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Outstanding Balance</span>
                  <span className="text-base font-extrabold text-cyan-400">${totalAmount.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => setShowPaymentForm(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg flex items-center space-x-2 transition-all"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Process Payment</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleProcessPayment} className="space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-200">Collect & Record Payment</span>
                  <button type="button" onClick={() => setShowPaymentForm(false)} className="text-slate-400 hover:text-slate-200 text-[11px]">
                    Cancel
                  </button>
                </div>

                {payError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                    {payError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                    >
                      <option value="CASH">CASH (Counter Payment)</option>
                      <option value="UPI">UPI (Google Pay / PhonePe / QR)</option>
                      <option value="CARD">CREDIT / DEBIT CARD</option>
                      <option value="INSURANCE">INSURANCE / TPA CLAIM</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Transaction Ref / Cheque / Auth Code</label>
                    <input
                      type="text"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="e.g. UPI-984210398 / AUTH-5521"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="submit"
                    disabled={payLoading}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all"
                  >
                    {payLoading ? "Recording Payment..." : `Confirm Payment ($${totalAmount.toFixed(2)})`}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
