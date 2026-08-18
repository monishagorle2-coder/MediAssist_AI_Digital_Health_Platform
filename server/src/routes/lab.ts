import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken, requireRoles } from "../middlewares/auth";
import { generateInvoiceNumber } from "./billing";
import { notificationService } from "../services/notificationService";
import { CommunicationService } from "../services/communicationService";

const router = Router();

// Validation Schemas
const CreateLabTestSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  sampleType: z.string().min(1),
  price: z.number().positive(),
  tatHours: z.number().int().positive().default(24),
  referenceRange: z.string().optional(),
  unit: z.string().optional(),
  isActive: z.boolean().default(true),
});

const UpdateLabTestSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  sampleType: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  tatHours: z.number().int().positive().optional(),
  referenceRange: z.string().optional(),
  unit: z.string().optional(),
  isActive: z.boolean().optional(),
});

const CreateLabOrderSchema = z.object({
  patientId: z.string(),
  labTestId: z.string(),
  appointmentId: z.string().optional(),
  diagnosisRecordId: z.string().optional(),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).default("ROUTINE"),
  clinicalNotes: z.string().optional(),
});

const ParameterResultSchema = z.object({
  parameter: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().default(""),
  referenceRange: z.string().default(""),
  flag: z.enum(["NORMAL", "HIGH", "LOW", "ABNORMAL"]).default("NORMAL"),
});

const RecordLabResultSchema = z.object({
  parameterResults: z.array(ParameterResultSchema).min(1, "At least one parameter result is required"),
  summary: z.string().min(1, "Clinical summary/interpretation is required"),
  remarks: z.string().optional(),
  approvedBy: z.string().optional(),
});

// Helper: Seed default lab catalog if empty
const seedDefaultCatalogIfEmpty = async () => {
  const count = await prisma.labTest.count();
  if (count === 0) {
    const defaultCatalog = [
      {
        name: "Complete Blood Count (CBC)",
        code: "CBC",
        category: "Hematology",
        description: "Full evaluation of red blood cells, white blood cells, and platelets.",
        sampleType: "Whole Blood (EDTA)",
        price: 35.0,
        tatHours: 6,
        referenceRange: "WBC: 4.5-11.0 x10^3/uL, RBC: 4.3-5.9 x10^6/uL, Hemoglobin: 13.5-17.5 g/dL, Platelets: 150-450 x10^3/uL",
        unit: "Multi-parameter",
      },
      {
        name: "Comprehensive Metabolic Panel (CMP / LFT)",
        code: "CMP-LFT",
        category: "Biochemistry",
        description: "Assessment of liver function enzymes, bilirubin, albumin, and total protein.",
        sampleType: "Serum",
        price: 45.0,
        tatHours: 12,
        referenceRange: "ALT: 7-56 U/L, AST: 10-40 U/L, Bilirubin: 0.1-1.2 mg/dL, Albumin: 3.5-5.0 g/dL",
        unit: "U/L, mg/dL",
      },
      {
        name: "Renal Function Panel (KFT / RFT)",
        code: "KFT-RFT",
        category: "Biochemistry",
        description: "Kidney function assessment including Creatinine, Blood Urea Nitrogen (BUN), and eGFR.",
        sampleType: "Serum",
        price: 40.0,
        tatHours: 8,
        referenceRange: "Creatinine: 0.7-1.3 mg/dL, BUN: 7-20 mg/dL, eGFR: >90 mL/min/1.73m2",
        unit: "mg/dL",
      },
      {
        name: "Lipid Profile",
        code: "LIPID",
        category: "Biochemistry",
        description: "Cardiovascular risk lipid assessment including Total Cholesterol, HDL, LDL, and Triglycerides.",
        sampleType: "Serum (Fasting)",
        price: 50.0,
        tatHours: 12,
        referenceRange: "Total Chol: <200 mg/dL, HDL: >40 mg/dL, LDL: <100 mg/dL, Triglycerides: <150 mg/dL",
        unit: "mg/dL",
      },
      {
        name: "Glycated Hemoglobin (HbA1c)",
        code: "HBA1C",
        category: "Biochemistry",
        description: "Three-month average plasma glucose concentration assessment for Diabetes management.",
        sampleType: "Whole Blood",
        price: 30.0,
        tatHours: 6,
        referenceRange: "Normal: <5.7%, Pre-diabetic: 5.7-6.4%, Diabetic: >=6.5%",
        unit: "%",
      },
      {
        name: "Thyroid Stimulating Hormone (TSH)",
        code: "TSH",
        category: "Endocrinology",
        description: "Primary screening test for thyroid disorders (hypothyroidism/hyperthyroidism).",
        sampleType: "Serum",
        price: 35.0,
        tatHours: 12,
        referenceRange: "0.4 - 4.0 mIU/L",
        unit: "mIU/L",
      },
      {
        name: "Urinalysis Routine & Microscopic",
        code: "URINE-RM",
        category: "Pathology",
        description: "Physical, chemical, and microscopic examination of urine sample.",
        sampleType: "Urine (Clean Catch)",
        price: 25.0,
        tatHours: 4,
        referenceRange: "pH: 4.5-8.0, Protein: Negative, Glucose: Negative, Ketones: Negative, Leukocytes: Negative",
        unit: "Qualitative",
      },
      {
        name: "C-Reactive Protein (CRP)",
        code: "CRP",
        category: "Immunology",
        description: "Systemic inflammation and acute infection marker.",
        sampleType: "Serum",
        price: 28.0,
        tatHours: 6,
        referenceRange: "< 3.0 mg/L",
        unit: "mg/L",
      },
    ];

    for (const t of defaultCatalog) {
      await prisma.labTest.create({ data: t });
    }
  }
};

// ----------------------------------------------------
// 1. LAB TEST CATALOG APIS
// ----------------------------------------------------

// GET Lab Tests Catalog
router.get("/tests", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await seedDefaultCatalogIfEmpty();
    const category = req.query.category as string | undefined;

    const where: any = { isActive: true };
    if (category && category !== "ALL") {
      where.category = category;
    }

    const tests = await prisma.labTest.findMany({
      where,
      orderBy: { name: "asc" },
    });

    res.json(tests);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch lab test catalog", details: error.message });
  }
});

// POST Add Lab Test to Catalog (Lab Tech or Admin)
router.post("/tests", authenticateToken as any, requireRoles(["LAB_TECHNICIAN", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = CreateLabTestSchema.parse(req.body);

    const existing = await prisma.labTest.findFirst({
      where: {
        OR: [{ name: validated.name }, { code: validated.code }],
      },
    });

    if (existing) {
      return res.status(400).json({ error: "Lab test with this name or code already exists in catalog" });
    }

    const test = await prisma.labTest.create({
      data: validated,
    });

    res.status(201).json(test);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    res.status(500).json({ error: "Failed to add lab test", details: error.message });
  }
});

// PUT Edit Lab Test in Catalog (Lab Tech or Admin)
router.put("/tests/:id", authenticateToken as any, requireRoles(["LAB_TECHNICIAN", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = UpdateLabTestSchema.parse(req.body);

    const test = await prisma.labTest.findUnique({ where: { id } });
    if (!test) return res.status(404).json({ error: "Lab test not found" });

    const updated = await prisma.labTest.update({
      where: { id },
      data: validated,
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    res.status(500).json({ error: "Failed to update lab test", details: error.message });
  }
});

// ----------------------------------------------------
// 2. LAB ORDERS WORKFLOW APIS
// ----------------------------------------------------

// POST Create Lab Order (Doctor, Admin)
router.post("/orders", authenticateToken as any, requireRoles(["DOCTOR", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = CreateLabOrderSchema.parse(req.body);
    let doctorId = req.user?.doctorId;

    if (req.user?.role === "ADMIN" && !doctorId) {
      // If admin, find first doctor or fallback
      const firstDoc = await prisma.doctor.findFirst();
      doctorId = firstDoc?.id;
    }

    if (!doctorId) {
      return res.status(400).json({ error: "Doctor profile not found for this user" });
    }

    // Verify patient and test exist
    const patient = await prisma.patient.findUnique({ where: { id: validated.patientId }, include: { user: true } });
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const labTest = await prisma.labTest.findUnique({ where: { id: validated.labTestId } });
    if (!labTest || !labTest.isActive) return res.status(404).json({ error: "Active lab test not found in catalog" });

    // Generate unique order number (e.g. LAB-20260817-0042)
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `LAB-${dateStr}-${randomSuffix}`;

    // Transaction to create order and attach billing charge
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.labOrder.create({
        data: {
          orderNumber,
          patientId: validated.patientId,
          doctorId,
          appointmentId: validated.appointmentId || null,
          diagnosisRecordId: validated.diagnosisRecordId || null,
          labTestId: validated.labTestId,
          priority: validated.priority,
          clinicalNotes: validated.clinicalNotes,
          status: "ORDERED",
        },
        include: {
          patient: true,
          doctor: { include: { department: true } },
          labTest: true,
          appointment: true,
        },
      });

      // Append or create bill item if appointment exists
      if (validated.appointmentId) {
        let existingBill = await tx.bill.findUnique({
          where: { appointmentId: validated.appointmentId },
        });

        if (!existingBill) {
          const invoiceNumber = await generateInvoiceNumber(tx);
          existingBill = await tx.bill.create({
            data: {
              invoiceNumber,
              appointmentId: validated.appointmentId,
              patientId: validated.patientId,
              amount: labTest.price,
              subtotal: labTest.price,
              taxRate: 0,
              taxAmount: 0,
              discountAmount: 0,
              totalAmount: labTest.price,
              status: "PENDING",
              paymentStatus: "PENDING",
              items: JSON.stringify([{ description: `Diagnostic Test: ${labTest.name} (${labTest.code})`, cost: labTest.price }]),
            },
          });
        }

        if (existingBill) {
          // Add BillItem
          await tx.billItem.create({
            data: {
              billId: existingBill.id,
              description: `Diagnostic Investigation: ${labTest.name} (${labTest.code})`,
              category: "LABORATORY",
              quantity: 1,
              unitPrice: labTest.price,
              amount: labTest.price,
            },
          });

          const prevItems = typeof existingBill.items === "string" ? JSON.parse(existingBill.items) : existingBill.items || [];
          const updatedItems = [
            ...prevItems,
            { description: `Diagnostic Test: ${labTest.name} (${labTest.code})`, cost: labTest.price },
          ];
          const updatedSubtotal = (existingBill.subtotal ?? existingBill.amount) + labTest.price;
          const updatedTotal = (existingBill.totalAmount ?? existingBill.amount) + labTest.price;

          await tx.bill.update({
            where: { id: existingBill.id },
            data: {
              items: JSON.stringify(updatedItems),
              subtotal: updatedSubtotal,
              totalAmount: updatedTotal,
              amount: updatedTotal,
            },
          });
        }
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: "ORDER_LAB_TEST",
          details: `Ordered lab test ${labTest.name} (${orderNumber}) for patient ${patient.name} [Priority: ${validated.priority}]`,
        },
      });

      return createdOrder;
    });

    // Notify Patient
    if (patient.userId) {
      await notificationService.createAndSendNotification({
        userId: patient.userId,
        title: "Diagnostic Test Ordered",
        message: `Dr. has ordered a ${labTest.name} (${order.orderNumber}) for your clinical evaluation.`,
        type: "LABORATORY",
        link: "/lab-reports",
        metadata: { orderId: order.id, testCode: labTest.code },
      });
    }

    // Broadcast Real-time event
    notificationService.broadcastHospitalEvent(
      {
        roles: ["LAB_TECHNICIAN", "ADMIN"],
        userIds: [patient.userId, order.doctor?.userId].filter(Boolean) as string[],
      },
      "LAB_ORDER_CREATED",
      { orderId: order.id, orderNumber: order.orderNumber, patientId: patient.id, testName: labTest.name }
    );

    res.status(201).json(order);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    res.status(500).json({ error: "Failed to create lab order", details: error.message });
  }
});

// GET List Lab Orders (Role-Scoped)
router.get("/orders", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const statusQuery = req.query.status as string | undefined;
    const priorityQuery = req.query.priority as string | undefined;
    const patientIdQuery = req.query.patientId as string | undefined;

    const where: any = {};

    if (role === "PATIENT") {
      where.patientId = req.user?.patientId;
    } else if (role === "DOCTOR") {
      if (patientIdQuery) {
        where.patientId = patientIdQuery;
      } else {
        where.doctorId = req.user?.doctorId;
      }
    } else {
      // LAB_TECHNICIAN, ADMIN, RECEPTIONIST
      if (patientIdQuery) where.patientId = patientIdQuery;
    }

    if (statusQuery && statusQuery !== "ALL") {
      where.status = statusQuery;
    }

    if (priorityQuery && priorityQuery !== "ALL") {
      where.priority = priorityQuery;
    }

    const orders = await prisma.labOrder.findMany({
      where,
      include: {
        patient: true,
        doctor: { include: { department: true } },
        labTest: true,
        labResult: true,
        appointment: true,
      },
      orderBy: [
        { createdAt: "desc" },
      ],
    });

    const priorityWeight: Record<string, number> = { STAT: 1, URGENT: 2, ROUTINE: 3 };
    const statusWeight: Record<string, number> = {
      ORDERED: 1,
      SAMPLE_COLLECTED: 2,
      PROCESSING: 3,
      COMPLETED: 4,
      CANCELLED: 5,
    };

    const formattedOrders = orders.map((o) => ({
      ...o,
      labResult: o.labResult
        ? {
            ...o.labResult,
            parameterResults:
              typeof o.labResult.parameterResults === "string"
                ? JSON.parse(o.labResult.parameterResults)
                : o.labResult.parameterResults,
          }
        : null,
    }));

    // Deterministic sort: 1. Status Weight, 2. Priority Weight, 3. CreatedAt
    formattedOrders.sort((a, b) => {
      const sA = statusWeight[a.status] || 99;
      const sB = statusWeight[b.status] || 99;
      if (sA !== sB) return sA - sB;

      const pA = priorityWeight[a.priority] || 99;
      const pB = priorityWeight[b.priority] || 99;
      if (pA !== pB) return pA - pB;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.json(formattedOrders);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch lab orders", details: error.message });
  }
});

// GET Lab Order Details
router.get("/orders/:id", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { include: { department: true } },
        labTest: true,
        labResult: true,
        appointment: true,
      },
    });

    if (!order) return res.status(404).json({ error: "Lab order not found" });

    // Strict Security Ownership Verification
    if (req.user?.role === "PATIENT" && order.patientId !== req.user.patientId) {
      return res.status(403).json({ error: "Forbidden: You can only view your own lab orders" });
    }

    const formatted = {
      ...order,
      labResult: order.labResult
        ? {
            ...order.labResult,
            parameterResults:
              typeof order.labResult.parameterResults === "string"
                ? JSON.parse(order.labResult.parameterResults)
                : order.labResult.parameterResults,
          }
        : null,
    };

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch lab order details", details: error.message });
  }
});

// PUT Mark Sample Collected (Lab Tech, Admin)
router.put("/orders/:id/sample", authenticateToken as any, requireRoles(["LAB_TECHNICIAN", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: { labTest: true, patient: true, doctor: true },
    });

    if (!order) return res.status(404).json({ error: "Lab order not found" });

    if (order.status === "CANCELLED") {
      return res.status(400).json({ error: "Cannot collect sample for a cancelled lab order" });
    }

    if (order.status !== "ORDERED") {
      return res.status(400).json({
        error: `Sample has already been collected (current status: ${order.status})`,
      });
    }

    const collectorName = req.user?.email || "Laboratory Technician";

    const updated = await prisma.$transaction(async (tx) => {
      const resOrder = await tx.labOrder.update({
        where: { id },
        data: {
          status: "SAMPLE_COLLECTED",
          sampleCollectedAt: new Date(),
          sampleCollectedBy: collectorName,
        },
        include: { patient: true, doctor: true, labTest: true },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: "COLLECT_LAB_SAMPLE",
          details: `Collected ${order.labTest.sampleType} sample for ${order.orderNumber} (${order.patient.name})`,
        },
      });

      return resOrder;
    });

    // Notify Patient
    if (order.patient?.userId) {
      await notificationService.createAndSendNotification({
        userId: order.patient.userId,
        title: "Specimen Sample Collected",
        message: `Your ${order.labTest.sampleType} specimen for ${order.labTest.name} has been received by the diagnostic laboratory.`,
        type: "LABORATORY",
        link: "/lab-reports",
        metadata: { orderId: id },
      });
    }

    // Broadcast Real-time event
    notificationService.broadcastHospitalEvent(
      {
        roles: ["LAB_TECHNICIAN", "ADMIN"],
        userIds: [order.patient?.userId, order.doctor?.userId].filter(Boolean) as string[],
      },
      "LAB_SAMPLE_COLLECTED",
      { orderId: id, status: "SAMPLE_COLLECTED" }
    );

    // Multi-channel Communication Dispatch
    await CommunicationService.dispatch({
      userId: order.patient?.userId,
      patientId: order.patientId,
      category: "LAB",
      type: "LAB_SAMPLE_COLLECTED",
      title: "Specimen Sample Collected",
      message: `Your ${order.labTest.name} specimen (${order.labTest.sampleType}) has been collected and accessioned for laboratory processing.`,
      recipientEmail: (order.patient as any)?.user?.email,
      recipientPhone: order.patient?.phone,
      relatedEntityId: id,
      idempotencyKey: `LAB-SAMPLE-${id}`,
      ipAddress: req.ip || req.socket?.remoteAddress || undefined,
    });

    res.json({ message: "Specimen sample collected and logged", order: updated });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update sample status", details: error.message });
  }
});

// POST Enter Lab Results & Complete Report (Lab Tech, Admin)
router.post("/orders/:id/results", authenticateToken as any, requireRoles(["LAB_TECHNICIAN", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = RecordLabResultSchema.parse(req.body);

    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: { labTest: true, patient: { include: { user: true } }, doctor: true },
    });

    if (!order) return res.status(404).json({ error: "Lab order not found" });

    if (order.status === "CANCELLED") {
      return res.status(400).json({ error: "Cannot enter results for a cancelled lab order" });
    }

    if (order.status === "ORDERED") {
      return res.status(400).json({
        error: "Cannot complete results: Specimen sample must be collected first.",
      });
    }

    if (order.status === "COMPLETED") {
      return res.status(400).json({
        error: "Lab order is already completed and finalized.",
      });
    }

    const technicianName = req.user?.email || "Lab Analyst";
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create or update Lab Result
      const labResult = await tx.labResult.upsert({
        where: { labOrderId: id },
        create: {
          labOrderId: id,
          parameterResults: JSON.stringify(validated.parameterResults),
          summary: validated.summary,
          remarks: validated.remarks || null,
          testedBy: technicianName,
          approvedBy: validated.approvedBy || "Pathologist On Duty",
          resultDate: now,
        },
        update: {
          parameterResults: JSON.stringify(validated.parameterResults),
          summary: validated.summary,
          remarks: validated.remarks || null,
          testedBy: technicianName,
          approvedBy: validated.approvedBy || "Pathologist On Duty",
          resultDate: now,
        },
      });

      // 2. Mark order as COMPLETED
      const updatedOrder = await tx.labOrder.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: now,
        },
        include: { patient: true, doctor: true, labTest: true },
      });

      // 3. Audit Log
      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: "COMPLETE_LAB_RESULT",
          details: `Finalized laboratory results for ${order.orderNumber} (${order.labTest.name}) for patient ${order.patient.name}`,
        },
      });

      return { order: updatedOrder, labResult };
    });

    // 4. Notifications & Real-Time Broadcast
    if (order.doctor?.userId) {
      await notificationService.createAndSendNotification({
        userId: order.doctor.userId,
        title: "Lab Results Ready",
        message: `Lab results for ${order.labTest.name} (${order.orderNumber}) for patient ${order.patient.name} are now finalized.`,
        type: "LABORATORY",
        link: "/laboratory",
        metadata: { orderId: id },
      });
    }

    if (order.patient?.userId) {
      await notificationService.createAndSendNotification({
        userId: order.patient.userId,
        title: "Diagnostic Report Published",
        message: `Your diagnostic report for ${order.labTest.name} is available in your medical records.`,
        type: "LABORATORY",
        link: "/lab-reports",
        metadata: { orderId: id },
      });
    }

    notificationService.broadcastHospitalEvent(
      {
        roles: ["LAB_TECHNICIAN", "ADMIN"],
        userIds: [order.doctor?.userId, order.patient?.userId].filter(Boolean) as string[],
      },
      "LAB_REPORT_COMPLETED",
      { orderId: id, orderNumber: order.orderNumber, status: "COMPLETED" }
    );

    // Multi-channel Communication Dispatch for Patient
    await CommunicationService.dispatch({
      userId: order.patient?.userId,
      patientId: order.patientId,
      category: "LAB",
      type: "LAB_REPORT_READY",
      title: "Diagnostic Report Published",
      message: `Your diagnostic laboratory report for ${order.labTest.name} (${order.orderNumber}) is finalized and ready for review in your medical records.`,
      recipientEmail: (order.patient as any)?.user?.email,
      recipientPhone: order.patient?.phone,
      relatedEntityId: id,
      idempotencyKey: `LAB-REPORT-${id}`,
      ipAddress: req.ip || req.socket?.remoteAddress || undefined,
    });

    // Multi-channel Communication Dispatch for Doctor
    if (order.doctor?.userId) {
      await CommunicationService.dispatch({
        userId: order.doctor.userId,
        category: "LAB",
        type: "LAB_REPORT_READY",
        title: "Lab Results Finalized",
        message: `Diagnostic results for patient ${order.patient.name} (${order.labTest.name}) have been finalized by the pathologist.`,
        recipientEmail: (order.doctor as any)?.user?.email || order.doctor.email,
        relatedEntityId: id,
        idempotencyKey: `LAB-DOC-${id}`,
        ipAddress: req.ip || req.socket?.remoteAddress || undefined,
      });
    }

    res.status(201).json({
      message: "Lab report results entered and published successfully",
      order: result.order,
      labResult: {
        ...result.labResult,
        parameterResults: validated.parameterResults,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    res.status(500).json({ error: "Failed to record lab results", details: error.message });
  }
});

// GET Patient Report History / EHR Lab History (Patient self, Doctor, Lab Tech, Admin)
router.get("/patients/:patientId/reports", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId } = req.params;

    // Strict Security
    if (req.user?.role === "PATIENT" && req.user.patientId !== patientId) {
      return res.status(403).json({ error: "Forbidden: You can only view your own laboratory reports" });
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const completedOrders = await prisma.labOrder.findMany({
      where: {
        patientId,
        status: "COMPLETED",
      },
      include: {
        labTest: true,
        labResult: true,
        doctor: { include: { department: true } },
        appointment: true,
      },
      orderBy: { completedAt: "desc" },
    });

    const formatted = completedOrders.map((o) => ({
      ...o,
      labResult: o.labResult
        ? {
            ...o.labResult,
            parameterResults:
              typeof o.labResult.parameterResults === "string"
                ? JSON.parse(o.labResult.parameterResults)
                : o.labResult.parameterResults,
          }
        : null,
    }));

    res.json({
      patientId: patient.id,
      patientName: patient.name,
      totalCompletedReports: formatted.length,
      reports: formatted,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch patient lab history", details: error.message });
  }
});

// GET Lab Operational Summary (Lab Tech, Admin)
router.get("/summary", authenticateToken as any, requireRoles(["LAB_TECHNICIAN", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = await prisma.labOrder.findMany();

    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.status === "ORDERED").length;
    const samplesCollected = orders.filter((o) => o.status === "SAMPLE_COLLECTED").length;
    const completedOrders = orders.filter((o) => o.status === "COMPLETED").length;
    const statOrders = orders.filter((o) => o.priority === "STAT" && o.status !== "COMPLETED").length;

    res.json({
      totalOrders,
      pendingOrders,
      samplesCollected,
      completedOrders,
      statOrders,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch lab summary", details: error.message });
  }
});

// GET /api/lab/orders/:id/report (Formal printable lab report document)
router.get("/orders/:id/report", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const patientId = req.user?.patientId;

    const order = await prisma.labOrder.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: {
        patient: true,
        doctor: { include: { department: true } },
        labTest: true,
        labResult: true,
        appointment: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Laboratory order not found" });
    }

    if (userRole === "PATIENT" && order.patientId !== patientId) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this diagnostic report" });
    }

    let parsedParameters: any[] = [];
    if (order.labResult) {
      try {
        parsedParameters =
          typeof order.labResult.parameterResults === "string"
            ? JSON.parse(order.labResult.parameterResults)
            : order.labResult.parameterResults;
      } catch (e) {
        parsedParameters = [];
      }
    }

    res.json({
      hospital: {
        name: "MediAssist Multi-Specialty Hospital & Research Center",
        address: "100 Medical Center Boulevard, Healthcare District, Metro City, 560001",
        phone: "+1 (800) 555-MEDI",
        accreditation: "NABH / JCI Accredited",
      },
      documentType: "LABORATORY_DIAGNOSTIC_REPORT",
      orderNumber: order.orderNumber,
      accessionId: `ACC-${order.id.slice(-6).toUpperCase()}`,
      status: order.status,
      priority: order.priority,
      createdAt: order.createdAt,
      sampleCollectedAt: order.sampleCollectedAt,
      sampleCollectedBy: order.sampleCollectedBy,
      completedAt: order.completedAt,
      patient: {
        id: order.patient.id,
        name: order.patient.name,
        phone: order.patient.phone,
        dob: order.patient.dob,
        gender: order.patient.gender,
        bloodGroup: order.patient.bloodGroup,
      },
      doctor: order.doctor
        ? {
            name: `Dr. ${order.doctor.name}`,
            specialization: order.doctor.specialization,
            department: order.doctor.department?.name || "Clinical Pathology",
          }
        : null,
      test: {
        id: order.labTest.id,
        name: order.labTest.name,
        code: order.labTest.code,
        category: order.labTest.category,
        sampleType: order.labTest.sampleType,
        tatHours: order.labTest.tatHours,
        referenceRange: order.labTest.referenceRange,
        unit: order.labTest.unit,
      },
      result: order.labResult
        ? {
            parameters: parsedParameters.map((p: any) => ({
              parameter: p.parameter || order.labTest.name,
              value: p.value || "N/A",
              unit: p.unit || order.labTest.unit || "",
              referenceRange: p.referenceRange || order.labTest.referenceRange || "",
              flag: p.flag || "NORMAL",
            })),
            summary: order.labResult.summary,
            remarks: order.labResult.remarks || "No supplementary clinical pathology remarks.",
            testedBy: order.labResult.testedBy || order.sampleCollectedBy || "Laboratory Analyst",
            approvedBy: order.labResult.approvedBy || "Consultant Pathologist, MD",
            resultDate: order.labResult.resultDate,
          }
        : null,
      disclaimer: "These laboratory results relate specifically to the specimen submitted. Diagnostic interpretations should be correlated clinically with patient history.",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate laboratory report document", details: error.message });
  }
});

export default router;
