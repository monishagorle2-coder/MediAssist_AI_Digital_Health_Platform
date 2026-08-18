import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken, requireRoles } from "../middlewares/auth";
import { notificationService } from "../services/notificationService";
import { CommunicationService } from "../services/communicationService";

const router = Router();

// Helper to generate unique invoice number: INV-YYYYMMDD-XXXX
export async function generateInvoiceNumber(tx?: any): Promise<string> {
  const db = tx || prisma;
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");

  for (let attempt = 0; attempt < 10; attempt++) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `INV-${dateStr}-${randomSuffix}`;
    const existing = await db.bill.findUnique({ where: { invoiceNumber: candidate } });
    if (!existing) {
      return candidate;
    }
  }
  return `INV-${dateStr}-${Date.now().toString().slice(-6)}`;
}

// Zod Schemas
const BillItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  category: z.enum(["CONSULTATION", "PHARMACY", "LABORATORY", "PROCEDURE", "OTHER"]).default("OTHER"),
  quantity: z.number().int().positive("Quantity must be greater than 0").default(1),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
});

const CreateBillSchema = z.object({
  patientId: z.string().min(1, "patientId is required"),
  appointmentId: z.string().optional().nullable(),
  taxRate: z.number().min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%").optional().default(0),
  discountAmount: z.number().min(0, "Discount cannot be negative").optional().default(0),
  notes: z.string().optional().nullable(),
  items: z.array(BillItemSchema).min(1, "At least one billing line item is required"),
});

const PayBillSchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD", "UPI", "INSURANCE"]),
  transactionReference: z.string().optional().nullable(),
  paidAmount: z.number().positive().optional(),
});

// Helper to calculate bill totals safely
export function calculateBillFinancials(
  items: Array<{ quantity: number; unitPrice: number }>,
  taxRate: number = 0,
  discountAmount: number = 0
) {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
  const safeDiscount = Math.min(discountAmount, subtotal + taxAmount);
  const totalAmount = Number(Math.max(0, subtotal + taxAmount - safeDiscount).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxRate,
    taxAmount,
    discountAmount: Number(safeDiscount.toFixed(2)),
    totalAmount,
  };
}

// ----------------------------------------------------
// 1. GET BILLS LIST (Role-Based Filtering & Search)
// ----------------------------------------------------
router.get("/", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const { status, paymentStatus, patientId, search } = req.query as Record<string, string>;

    let whereClause: any = {};

    // RBAC Scope
    if (role === "PATIENT") {
      if (!req.user?.patientId) {
        return res.status(400).json({ error: "Patient profile not found for this user" });
      }
      whereClause.patientId = req.user.patientId;
    } else if (role === "DOCTOR") {
      whereClause.appointment = {
        doctorId: req.user?.doctorId,
      };
    } else if (patientId) {
      whereClause.patientId = patientId;
    }

    // Status Filter
    if (status && status !== "ALL") {
      whereClause.status = status;
    }
    if (paymentStatus && paymentStatus !== "ALL") {
      whereClause.paymentStatus = paymentStatus;
    }

    // Search Query (invoice number or patient name)
    if (search && search.trim()) {
      whereClause.OR = [
        { invoiceNumber: { contains: search.trim(), mode: "insensitive" } },
        { patient: { name: { contains: search.trim(), mode: "insensitive" } } },
      ];
    }

    const bills = await prisma.bill.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
            bloodGroup: true,
            insuranceProvider: true,
            insuranceNumber: true,
          },
        },
        appointment: {
          include: {
            doctor: {
              include: { department: true },
            },
          },
        },
        billItems: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format bills with fallback items parsing for backward compatibility
    const formattedBills = bills.map((b) => {
      let legacyItems = [];
      try {
        legacyItems = typeof b.items === "string" ? JSON.parse(b.items) : b.items || [];
      } catch (e) {
        legacyItems = [];
      }

      const activeItems = b.billItems && b.billItems.length > 0
        ? b.billItems
        : legacyItems.map((it: any) => ({
            id: b.id,
            description: it.description || "Hospital Service",
            category: "OTHER",
            quantity: 1,
            unitPrice: it.cost || b.amount,
            amount: it.cost || b.amount,
          }));

      return {
        ...b,
        subtotal: b.subtotal ?? b.amount,
        totalAmount: b.totalAmount ?? b.amount,
        paymentStatus: b.paymentStatus || b.status,
        items: activeItems,
        billItems: activeItems,
      };
    });

    res.json(formattedBills);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch bills", details: error.message });
  }
});

// ----------------------------------------------------
// 2. GET BILLING STATS & SUMMARY (Receptionist, Admin)
// ----------------------------------------------------
router.get("/summary/stats", authenticateToken as any, requireRoles(["RECEPTIONIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allBills = await prisma.bill.findMany({
      include: { billItems: true },
    });

    const totalInvoices = allBills.length;
    const paidBills = allBills.filter((b) => b.status === "PAID" || b.paymentStatus === "PAID");
    const pendingBills = allBills.filter((b) => b.status === "PENDING" || b.paymentStatus === "PENDING");
    const cancelledBills = allBills.filter((b) => b.status === "CANCELLED" || b.paymentStatus === "CANCELLED");

    const totalRevenue = paidBills.reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0);
    const outstandingAmount = pendingBills.reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0);

    // Today's collections
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayPaid = paidBills.filter((b) => b.paidAt && new Date(b.paidAt) >= startOfToday);
    const todayCollections = todayPaid.reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0);

    // Payment method breakdown
    const paymentMethods: Record<string, number> = {
      CASH: 0,
      CARD: 0,
      UPI: 0,
      INSURANCE: 0,
    };

    paidBills.forEach((b) => {
      const method = (b.paymentMethod || "CASH").toUpperCase();
      if (paymentMethods[method] !== undefined) {
        paymentMethods[method] += (b.totalAmount ?? b.amount);
      } else {
        paymentMethods[method] = (b.totalAmount ?? b.amount);
      }
    });

    res.json({
      totalInvoices,
      paidCount: paidBills.length,
      pendingCount: pendingBills.length,
      cancelledCount: cancelledBills.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      outstandingAmount: Number(outstandingAmount.toFixed(2)),
      todayCollections: Number(todayCollections.toFixed(2)),
      paymentMethods,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate billing stats", details: error.message });
  }
});

// ----------------------------------------------------
// 3. GET PATIENT BILLING SUMMARY
// ----------------------------------------------------
router.get("/patients/:patientId/summary", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId } = req.params;

    // Security: Patient can only check own summary
    if (req.user?.role === "PATIENT" && req.user.patientId !== patientId) {
      return res.status(403).json({ error: "Forbidden: Cannot access other patient's billing data" });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        bills: {
          include: { billItems: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const bills = patient.bills;
    const totalBilled = bills
      .filter((b) => b.status !== "CANCELLED")
      .reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0);

    const totalPaid = bills
      .filter((b) => b.status === "PAID" || b.paymentStatus === "PAID")
      .reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0);

    const outstandingBalance = Number(Math.max(0, totalBilled - totalPaid).toFixed(2));
    const pendingBills = bills.filter((b) => b.status === "PENDING" || b.paymentStatus === "PENDING");

    res.json({
      patientId,
      patientName: patient.name,
      totalBilled: Number(totalBilled.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      outstandingBalance,
      pendingBillsCount: pendingBills.length,
      pendingBills,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch patient billing summary", details: error.message });
  }
});

// ----------------------------------------------------
// 4. GET SINGLE BILL BY ID OR INVOICE NUMBER
// ----------------------------------------------------
router.get("/:id", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const bill = await prisma.bill.findFirst({
      where: {
        OR: [{ id }, { invoiceNumber: id }],
      },
      include: {
        patient: {
          include: { user: { select: { email: true } } },
        },
        appointment: {
          include: {
            doctor: {
              include: { department: true },
            },
          },
        },
        billItems: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!bill) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Security: Patient can only view their own bill
    if (req.user?.role === "PATIENT" && bill.patientId !== req.user.patientId) {
      return res.status(403).json({ error: "Forbidden: Cannot access another patient's invoice" });
    }

    // Format items
    let legacyItems = [];
    try {
      legacyItems = typeof bill.items === "string" ? JSON.parse(bill.items) : bill.items || [];
    } catch (e) {
      legacyItems = [];
    }

    const activeItems = bill.billItems && bill.billItems.length > 0
      ? bill.billItems
      : legacyItems.map((it: any) => ({
          id: bill.id,
          description: it.description || "Hospital Service",
          category: "OTHER",
          quantity: 1,
          unitPrice: it.cost || bill.amount,
          amount: it.cost || bill.amount,
        }));

    res.json({
      ...bill,
      subtotal: bill.subtotal ?? bill.amount,
      totalAmount: bill.totalAmount ?? bill.amount,
      paymentStatus: bill.paymentStatus || bill.status,
      items: activeItems,
      billItems: activeItems,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch invoice", details: error.message });
  }
});

// GET /api/bills/:id/invoice (Formal invoice document)
router.get("/:id/invoice", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const bill = await prisma.bill.findFirst({
      where: {
        OR: [{ id }, { invoiceNumber: id }],
      },
      include: {
        patient: {
          include: { user: { select: { email: true } } },
        },
        appointment: {
          include: {
            doctor: {
              include: { department: true },
            },
          },
        },
        billItems: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!bill) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (req.user?.role === "PATIENT" && bill.patientId !== req.user.patientId) {
      return res.status(403).json({ error: "Forbidden: Cannot access another patient's invoice" });
    }

    let legacyItems = [];
    try {
      legacyItems = typeof bill.items === "string" ? JSON.parse(bill.items) : bill.items || [];
    } catch (e) {
      legacyItems = [];
    }

    const activeItems = bill.billItems && bill.billItems.length > 0
      ? bill.billItems
      : legacyItems.map((it: any) => ({
          id: bill.id,
          description: it.description || "Hospital Service",
          category: "OTHER",
          quantity: 1,
          unitPrice: it.cost || bill.amount,
          amount: it.cost || bill.amount,
        }));

    res.json({
      hospital: {
        name: "MediAssist Multi-Specialty Hospital & Research Center",
        address: "100 Medical Center Boulevard, Healthcare District, Metro City, 560001",
        phone: "+1 (800) 555-MEDI",
        taxId: "GSTIN-29AAAAA0000A1Z5",
      },
      documentType: "HOSPITAL_INVOICE_RECEIPT",
      ...bill,
      subtotal: bill.subtotal ?? bill.amount,
      totalAmount: bill.totalAmount ?? bill.amount,
      paymentStatus: bill.paymentStatus || bill.status,
      items: activeItems,
      billItems: activeItems,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch invoice document", details: error.message });
  }
});

// ----------------------------------------------------
// 5. POST CREATE INVOICE (Receptionist, Admin)
// ----------------------------------------------------
router.post("/", authenticateToken as any, requireRoles(["RECEPTIONIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = CreateBillSchema.parse(req.body);

    const patient = await prisma.patient.findUnique({
      where: { id: validated.patientId },
      include: { user: true },
    });

    if (!patient) return res.status(404).json({ error: "Patient not found" });

    // Calculate financials on server side
    const financials = calculateBillFinancials(
      validated.items,
      validated.taxRate,
      validated.discountAmount
    );

    const invoiceNumber = await generateInvoiceNumber();

    const createdBill = await prisma.$transaction(async (tx) => {
      // 1. Create main Bill
      const bill = await tx.bill.create({
        data: {
          invoiceNumber,
          patientId: validated.patientId,
          appointmentId: validated.appointmentId || null,
          amount: financials.totalAmount,
          subtotal: financials.subtotal,
          taxRate: financials.taxRate,
          taxAmount: financials.taxAmount,
          discountAmount: financials.discountAmount,
          totalAmount: financials.totalAmount,
          status: "PENDING",
          paymentStatus: "PENDING",
          notes: validated.notes || null,
          items: JSON.stringify(
            validated.items.map((i) => ({
              description: i.description,
              cost: Number((i.quantity * i.unitPrice).toFixed(2)),
            }))
          ),
        },
      });

      // 2. Create Bill Items
      for (const item of validated.items) {
        const itemAmount = Number((item.quantity * item.unitPrice).toFixed(2));
        await tx.billItem.create({
          data: {
            billId: bill.id,
            description: item.description,
            category: item.category,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: itemAmount,
          },
        });
      }

      // 3. Write Audit Log
      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: "CREATE_INVOICE",
          details: `Created invoice ${invoiceNumber} for patient ${patient.name}. Total: $${financials.totalAmount.toFixed(2)} (Subtotal: $${financials.subtotal}, Tax: $${financials.taxAmount}, Discount: $${financials.discountAmount})`,
        },
      });

      return tx.bill.findUnique({
        where: { id: bill.id },
        include: {
          patient: true,
          billItems: true,
        },
      });
    });

    // Notify Patient
    if (patient.userId) {
      await notificationService.createAndSendNotification({
        userId: patient.userId,
        title: "Hospital Invoice Issued",
        message: `New hospital invoice #${invoiceNumber} for $${financials.totalAmount.toFixed(2)} has been generated.`,
        type: "BILLING",
        link: "/billing",
        metadata: { billId: createdBill?.id, invoiceNumber },
      });
    }

    // Broadcast Real-time event
    notificationService.broadcastHospitalEvent(
      {
        roles: ["RECEPTIONIST", "ADMIN"],
        userIds: [patient.userId].filter(Boolean) as string[],
      },
      "INVOICE_CREATED",
      { billId: createdBill?.id, invoiceNumber, totalAmount: financials.totalAmount }
    );

    // Multi-channel Communication Dispatch for Patient
    await CommunicationService.dispatch({
      userId: patient.userId,
      patientId: patient.id,
      category: "BILLING",
      type: "INVOICE_GENERATED",
      title: "Hospital Invoice Generated",
      message: `Hospital invoice #${invoiceNumber} for $${financials.totalAmount.toFixed(2)} is ready. You can review and complete payment online.`,
      recipientEmail: (patient as any)?.user?.email,
      recipientPhone: patient.phone,
      relatedEntityId: createdBill?.id,
      idempotencyKey: `INV-${createdBill?.id}`,
      ipAddress: req.ip || req.socket?.remoteAddress || undefined,
    });

    res.status(201).json(createdBill);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    res.status(500).json({ error: "Failed to create invoice", details: error.message });
  }
});

// ----------------------------------------------------
// 6. PUT PAY INVOICE (Patient, Receptionist, Admin)
// ----------------------------------------------------
router.put("/:id/pay", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = PayBillSchema.parse(req.body);

    const bill = await prisma.bill.findFirst({
      where: { OR: [{ id }, { invoiceNumber: id }] },
      include: { patient: { include: { user: true } } },
    });

    if (!bill) return res.status(404).json({ error: "Invoice not found" });

    // Validate Status Transitions
    if (bill.status === "PAID" || bill.paymentStatus === "PAID") {
      return res.status(400).json({ error: "Invoice is already paid in full" });
    }

    if (bill.status === "CANCELLED" || bill.paymentStatus === "CANCELLED") {
      return res.status(400).json({ error: "Cannot pay a cancelled invoice" });
    }

    // Security: Patients can only pay their own bills
    if (req.user?.role === "PATIENT" && bill.patientId !== req.user.patientId) {
      return res.status(403).json({ error: "Forbidden: Cannot pay someone else's bill" });
    }

    const paidAt = new Date();
    const totalAmount = bill.totalAmount ?? bill.amount;

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.bill.update({
        where: { id: bill.id },
        data: {
          status: "PAID",
          paymentStatus: "PAID",
          paidAt,
          paymentMethod: validated.paymentMethod,
          transactionReference: validated.transactionReference || `TXN-${Date.now().toString().slice(-8)}`,
        },
        include: {
          patient: true,
          billItems: true,
          appointment: { include: { doctor: true } },
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: "PAY_INVOICE",
          details: `Invoice ${bill.invoiceNumber || bill.id} paid via ${validated.paymentMethod}. Amount: $${totalAmount.toFixed(2)}. Ref: ${b.transactionReference}`,
        },
      });

      return b;
    });

    // Notify Patient
    if (bill.patient?.user?.id) {
      await notificationService.createAndSendNotification({
        userId: bill.patient.user.id,
        title: "Payment Receipt Confirmed",
        message: `Payment of $${totalAmount.toFixed(2)} received for Invoice #${bill.invoiceNumber || bill.id} via ${validated.paymentMethod}.`,
        type: "BILLING",
        link: "/billing",
        metadata: { billId: bill.id, invoiceNumber: bill.invoiceNumber },
      });
    }

    // Notify Receptionist
    await notificationService.notifyRole("RECEPTIONIST", {
      title: "Invoice Settled",
      message: `Patient ${bill.patient.name} cleared Invoice #${bill.invoiceNumber || bill.id} ($${totalAmount.toFixed(2)} via ${validated.paymentMethod}).`,
      type: "BILLING",
      link: "/billing",
      metadata: { billId: bill.id, invoiceNumber: bill.invoiceNumber },
    });

    // Broadcast Real-time event
    notificationService.broadcastHospitalEvent(
      {
        roles: ["RECEPTIONIST", "ADMIN"],
        userIds: [bill.patient?.user?.id].filter(Boolean) as string[],
      },
      "PAYMENT_RECEIVED",
      { billId: bill.id, invoiceNumber: bill.invoiceNumber, amount: totalAmount }
    );

    // Multi-channel Communication Dispatch for Patient
    await CommunicationService.dispatch({
      userId: bill.patient?.user?.id,
      patientId: bill.patientId,
      category: "BILLING",
      type: "PAYMENT_RECEIVED",
      title: "Payment Receipt Confirmed",
      message: `Payment of $${totalAmount.toFixed(2)} received for Invoice #${bill.invoiceNumber || bill.id} via ${validated.paymentMethod}. Transaction ref: ${updated.transactionReference}.`,
      recipientEmail: bill.patient?.user?.email,
      recipientPhone: bill.patient?.phone,
      relatedEntityId: bill.id,
      idempotencyKey: `PAY-${bill.id}-${updated.transactionReference}`,
      ipAddress: req.ip || req.socket?.remoteAddress || undefined,
    });

    res.json({
      message: "Payment processed successfully",
      bill: updated,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    res.status(500).json({ error: "Failed to process payment", details: error.message });
  }
});

// ----------------------------------------------------
// 7. PUT CANCEL INVOICE (Receptionist, Admin)
// ----------------------------------------------------
router.put("/:id/cancel", authenticateToken as any, requireRoles(["RECEPTIONIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const bill = await prisma.bill.findFirst({
      where: { OR: [{ id }, { invoiceNumber: id }] },
      include: { patient: true },
    });

    if (!bill) return res.status(404).json({ error: "Invoice not found" });

    if (bill.status === "PAID" || bill.paymentStatus === "PAID") {
      return res.status(400).json({ error: "Cannot cancel an already paid invoice. Please process a refund instead." });
    }

    if (bill.status === "CANCELLED" || bill.paymentStatus === "CANCELLED") {
      return res.status(400).json({ error: "Invoice is already cancelled" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.bill.update({
        where: { id: bill.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "CANCELLED",
          notes: reason ? `${bill.notes ? bill.notes + " | " : ""}Cancelled reason: ${reason}` : bill.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: "CANCEL_INVOICE",
          details: `Cancelled invoice ${bill.invoiceNumber || bill.id} for patient ${bill.patient.name}. Reason: ${reason || "Not specified"}`,
        },
      });

      return b;
    });

    // Notify Patient
    if (bill.patient?.userId) {
      await notificationService.createAndSendNotification({
        userId: bill.patient.userId,
        title: "Invoice Cancelled",
        message: `Hospital invoice #${bill.invoiceNumber || bill.id} has been cancelled.${reason ? ` Reason: ${reason}` : ""}`,
        type: "BILLING",
        link: "/billing",
        metadata: { billId: bill.id },
      });
    }

    // Broadcast Real-time event
    notificationService.broadcastHospitalEvent(
      {
        roles: ["RECEPTIONIST", "ADMIN"],
        userIds: [bill.patient?.userId].filter(Boolean) as string[],
      },
      "INVOICE_CANCELLED",
      { billId: bill.id, invoiceNumber: bill.invoiceNumber }
    );

    res.json({
      message: "Invoice cancelled successfully",
      bill: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to cancel invoice", details: error.message });
  }
});

// ----------------------------------------------------
// 8. PUT REFUND INVOICE (Admin Only)
// ----------------------------------------------------
router.put("/:id/refund", authenticateToken as any, requireRoles(["ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const bill = await prisma.bill.findFirst({
      where: { OR: [{ id }, { invoiceNumber: id }] },
      include: { patient: true },
    });

    if (!bill) return res.status(404).json({ error: "Invoice not found" });

    if (bill.status !== "PAID" && bill.paymentStatus !== "PAID") {
      return res.status(400).json({ error: "Only fully paid invoices can be refunded" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.bill.update({
        where: { id: bill.id },
        data: {
          paymentStatus: "REFUNDED",
          notes: reason ? `${bill.notes ? bill.notes + " | " : ""}Refunded reason: ${reason}` : bill.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: "REFUND_INVOICE",
          details: `Admin refunded invoice ${bill.invoiceNumber || bill.id} for patient ${bill.patient.name}. Amount: $${(bill.totalAmount ?? bill.amount).toFixed(2)}. Reason: ${reason || "Refund requested"}`,
        },
      });

      return b;
    });

    // Notify Patient
    if (bill.patient?.userId) {
      await notificationService.createAndSendNotification({
        userId: bill.patient.userId,
        title: "Invoice Refund Processed",
        message: `A refund of $${(bill.totalAmount ?? bill.amount).toFixed(2)} has been processed for Invoice #${bill.invoiceNumber || bill.id}.`,
        type: "BILLING",
        link: "/billing",
        metadata: { billId: bill.id },
      });
    }

    // Notify Receptionist
    await notificationService.notifyRole("RECEPTIONIST", {
      title: "Invoice Refunded",
      message: `Invoice #${bill.invoiceNumber || bill.id} for ${bill.patient.name} has been refunded by administration.`,
      type: "BILLING",
      link: "/billing",
      metadata: { billId: bill.id },
    });

    // Broadcast Real-time event
    notificationService.broadcastHospitalEvent(
      {
        roles: ["RECEPTIONIST", "ADMIN"],
        userIds: [bill.patient?.userId].filter(Boolean) as string[],
      },
      "INVOICE_REFUNDED",
      { billId: bill.id, invoiceNumber: bill.invoiceNumber }
    );

    // Multi-channel Communication Dispatch for Patient
    await CommunicationService.dispatch({
      userId: bill.patient?.userId,
      patientId: bill.patientId,
      category: "BILLING",
      type: "REFUND_PROCESSED",
      title: "Invoice Refund Processed",
      message: `A refund of $${(bill.totalAmount ?? bill.amount).toFixed(2)} has been processed for Invoice #${bill.invoiceNumber || bill.id}.${reason ? ` Reason: ${reason}` : ""}`,
      recipientEmail: (bill.patient as any)?.user?.email,
      recipientPhone: bill.patient?.phone,
      relatedEntityId: bill.id,
      idempotencyKey: `REFUND-${bill.id}`,
      ipAddress: req.ip || req.socket?.remoteAddress || undefined,
    });

    res.json({
      message: "Invoice refunded successfully",
      bill: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to refund invoice", details: error.message });
  }
});

export default router;
