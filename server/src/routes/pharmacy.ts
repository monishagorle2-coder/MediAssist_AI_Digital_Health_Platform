import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken, requireRoles } from "../middlewares/auth";
import { generateInvoiceNumber } from "./billing";

const router = Router();

const CreatePrescriptionSchema = z.object({
  appointmentId: z.string().optional(),
  patientId: z.string(),
  diagnosisRecordId: z.string().optional(),
  medicines: z.array(
    z.object({
      medicineId: z.string().optional(),
      medicineName: z.string(),
      dosage: z.string(),
      frequency: z.string(),
      duration: z.string(),
      quantity: z.number().int().positive().default(10),
    })
  ),
  notes: z.string().optional(),
});

const AddMedicineSchema = z.object({
  name: z.string().min(1),
  genericName: z.string().optional(),
  category: z.string().min(1),
  manufacturer: z.string().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional().refine(
    (val) => !val || !isNaN(new Date(val).getTime()),
    { message: "Invalid expiry date format" }
  ),
  stock: z.number().int().nonnegative(),
  unit: z.string().min(1),
  minStockLimit: z.number().int().positive().default(10),
  price: z.number().positive(),
});

const UpdateMedicineSchema = z.object({
  name: z.string().min(1).optional(),
  genericName: z.string().optional(),
  category: z.string().min(1).optional(),
  manufacturer: z.string().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional().nullable().refine(
    (val) => !val || !isNaN(new Date(val).getTime()),
    { message: "Invalid expiry date format" }
  ),
  stock: z.number().int().nonnegative().optional(),
  unit: z.string().min(1).optional(),
  minStockLimit: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
});

const UpdateStockSchema = z.object({
  stock: z.number().int().nonnegative(),
});

// Helper: Enrich medicine with expiry and stock status
const enrichMedicine = (med: any) => {
  const now = new Date();
  let isExpired = false;
  let isNearExpiry = false;
  let daysUntilExpiry: number | undefined = undefined;

  if (med.expiryDate) {
    const exp = new Date(med.expiryDate);
    const diffTime = exp.getTime() - now.getTime();
    daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffTime < 0) {
      isExpired = true;
    } else if (daysUntilExpiry <= 30) {
      isNearExpiry = true;
    }
  }

  const isLowStock = med.stock <= med.minStockLimit;

  return {
    ...med,
    isExpired,
    isNearExpiry,
    isLowStock,
    daysUntilExpiry,
  };
};

// Create Prescription (Doctor Only)
router.post("/prescriptions", authenticateToken as any, requireRoles(["DOCTOR"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = CreatePrescriptionSchema.parse(req.body);
    const doctorId = req.user?.doctorId;

    if (!doctorId) {
      return res.status(400).json({ error: "Doctor profile not found for this user" });
    }

    const prescription = await prisma.prescription.create({
      data: {
        appointmentId: validated.appointmentId || null,
        patientId: validated.patientId,
        doctorId,
        diagnosisRecordId: validated.diagnosisRecordId || null,
        medicines:
          typeof validated.medicines === "string"
            ? validated.medicines
            : JSON.stringify(validated.medicines),
        notes: validated.notes,
        status: "PENDING",
      },
    });

    res.status(201).json(prescription);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// Get prescriptions (Role filtered)
router.get("/prescriptions", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role;
    let prescriptions;

    if (role === "PATIENT") {
      prescriptions = await prisma.prescription.findMany({
        where: { patientId: req.user?.patientId },
        include: {
          doctor: { include: { department: true } },
          diagnosisRecord: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } else if (role === "DOCTOR") {
      prescriptions = await prisma.prescription.findMany({
        where: { doctorId: req.user?.doctorId },
        include: { patient: true, diagnosisRecord: true },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Pharmacist, Admin, Receptionist
      prescriptions = await prisma.prescription.findMany({
        include: {
          patient: true,
          doctor: { include: { department: true } },
          diagnosisRecord: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    const formatted = prescriptions.map((p: any) => ({
      ...p,
      medicines: typeof p.medicines === "string" ? JSON.parse(p.medicines) : p.medicines,
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Dispense Prescription with Expiry & Stock Validation (Pharmacist Only)
router.put("/prescriptions/:id/dispense", authenticateToken as any, requireRoles(["PHARMACIST"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: { patient: true },
    });

    if (!prescription) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    if (prescription.status === "DISPENSED") {
      return res.status(400).json({ error: "Prescription is already dispensed" });
    }

    const medicinesList =
      typeof prescription.medicines === "string"
        ? JSON.parse(prescription.medicines)
        : (prescription.medicines as any[]);

    const now = new Date();

    // Transaction with atomic stock deduction and strict validation
    const result = await prisma.$transaction(async (tx) => {
      const stockAlerts: string[] = [];
      const billingItems: { description: string; cost: number }[] = [];
      let totalCost = 0;

      for (const item of medicinesList) {
        // Concurrency-safe row-level lock on each medicine
        const medCandidates = await tx.medicine.findMany({
          where: {
            OR: [{ id: item.medicineId || "" }, { name: item.medicineName }],
          },
        });

        if (medCandidates.length === 0) {
          throw new Error(`Medicine '${item.medicineName}' not found in pharmacy inventory`);
        }

        const med = medCandidates[0];

        // Row lock
        await tx.$executeRaw`SELECT id FROM "Medicine" WHERE id = ${med.id} FOR UPDATE`;

        // Refetch latest locked row
        const lockedMed = await tx.medicine.findUnique({ where: { id: med.id } });
        if (!lockedMed) {
          throw new Error(`Medicine '${item.medicineName}' not found in pharmacy inventory`);
        }

        const qty = item.quantity || 10;

        // 1. Expiry Validation
        if (lockedMed.expiryDate && new Date(lockedMed.expiryDate) < now) {
          const expStr = new Date(lockedMed.expiryDate).toISOString().split("T")[0];
          throw new Error(
            `Cannot dispense: Medicine '${lockedMed.name}' (Batch: ${lockedMed.batchNumber || "N/A"}) has EXPIRED on ${expStr}`
          );
        }

        // 2. Insufficient Stock Validation
        if (lockedMed.stock < qty) {
          throw new Error(
            `Cannot dispense: Insufficient stock for '${lockedMed.name}'. Requested: ${qty}, Available: ${lockedMed.stock}`
          );
        }

        // 3. Atomic Decrement
        const newStock = lockedMed.stock - qty;
        await tx.medicine.update({
          where: { id: lockedMed.id },
          data: { stock: newStock },
        });

        const itemCost = lockedMed.price * qty;
        billingItems.push({
          description: `Medicine: ${lockedMed.name} x ${qty}`,
          cost: itemCost,
        });
        totalCost += itemCost;

        if (newStock <= lockedMed.minStockLimit) {
          stockAlerts.push(`${lockedMed.name} (remaining: ${newStock} ${lockedMed.unit})`);
        }
      }

      // 4. Update prescription status
      const updatedPrescription = await tx.prescription.update({
        where: { id },
        data: { status: "DISPENSED" },
      });

      // 5. Update or add bill items
      if (prescription.appointmentId && billingItems.length > 0) {
        let existingBill = await tx.bill.findUnique({
          where: { appointmentId: prescription.appointmentId },
        });

        if (!existingBill) {
          const invoiceNumber = await generateInvoiceNumber(tx);
          existingBill = await tx.bill.create({
            data: {
              invoiceNumber,
              appointmentId: prescription.appointmentId,
              patientId: prescription.patientId,
              amount: totalCost,
              subtotal: totalCost,
              taxRate: 0,
              taxAmount: 0,
              discountAmount: 0,
              totalAmount: totalCost,
              status: "PENDING",
              paymentStatus: "PENDING",
              items: JSON.stringify(billingItems),
            },
          });
        }

        if (existingBill) {
          // Add BillItem records
          for (const item of billingItems) {
            await tx.billItem.create({
              data: {
                billId: existingBill.id,
                description: item.description,
                category: "PHARMACY",
                quantity: 1,
                unitPrice: item.cost,
                amount: item.cost,
              },
            });
          }

          const prevItems =
            typeof existingBill.items === "string"
              ? JSON.parse(existingBill.items)
              : existingBill.items || [];
          const updatedItems = [...prevItems, ...billingItems];
          const updatedSubtotal = (existingBill.subtotal ?? existingBill.amount) + totalCost;
          const updatedTotal = (existingBill.totalAmount ?? existingBill.amount) + totalCost;

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

      // 6. Audit Log
      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: "DISPENSE_PRESCRIPTION",
          details: `Dispensed prescription ${id} for patient ${prescription.patient.name}. Medicines total: $${totalCost.toFixed(2)}.`,
        },
      });

      return { updated: updatedPrescription, stockAlerts, totalCost };
    });

    res.json({
      message: "Prescription dispensed and stock updated successfully",
      prescription: result.updated,
      totalCost: result.totalCost,
      alerts:
        result.stockAlerts.length > 0
          ? `Low stock alert for: ${result.stockAlerts.join(", ")}`
          : null,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to dispense prescription" });
  }
});

// GET Medicine Inventory Summary Stats (Pharmacist, Doctor, Admin)
router.get("/inventory/summary", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const medicines = await prisma.medicine.findMany();
    const enriched = medicines.map(enrichMedicine);

    const totalMedicines = enriched.length;
    const lowStockCount = enriched.filter((m) => m.isLowStock && !m.isExpired).length;
    const nearExpiryCount = enriched.filter((m) => m.isNearExpiry && !m.isExpired).length;
    const expiredCount = enriched.filter((m) => m.isExpired).length;
    const inStockCount = enriched.filter((m) => !m.isLowStock && !m.isExpired).length;

    res.json({
      totalMedicines,
      lowStockCount,
      nearExpiryCount,
      expiredCount,
      inStockCount,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Medicine Inventory with Filtering (Pharmacist, Doctor, Admin)
router.get("/inventory", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter = req.query.filter as string | undefined;

    const medicines = await prisma.medicine.findMany({
      orderBy: { name: "asc" },
    });

    let enriched = medicines.map(enrichMedicine);

    if (filter === "LOW_STOCK") {
      enriched = enriched.filter((m) => m.isLowStock);
    } else if (filter === "NEAR_EXPIRY") {
      enriched = enriched.filter((m) => m.isNearExpiry);
    } else if (filter === "EXPIRED") {
      enriched = enriched.filter((m) => m.isExpired);
    } else if (filter === "IN_STOCK") {
      enriched = enriched.filter((m) => !m.isLowStock && !m.isExpired);
    }

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Add Medicine (Pharmacist, Admin Only)
router.post("/inventory", authenticateToken as any, requireRoles(["PHARMACIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = AddMedicineSchema.parse(req.body);

    const existing = await prisma.medicine.findUnique({
      where: { name: validated.name },
    });
    if (existing) {
      return res.status(400).json({ error: "Medicine with this name already exists in inventory" });
    }

    const expiryDate = validated.expiryDate ? new Date(validated.expiryDate) : null;

    const medicine = await prisma.medicine.create({
      data: {
        name: validated.name,
        genericName: validated.genericName || null,
        category: validated.category,
        manufacturer: validated.manufacturer || null,
        batchNumber: validated.batchNumber || null,
        expiryDate,
        stock: validated.stock,
        unit: validated.unit,
        minStockLimit: validated.minStockLimit,
        price: validated.price,
      },
    });

    res.status(201).json(enrichMedicine(medicine));
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// PUT Edit Full Medicine Details (Pharmacist, Admin Only)
router.put("/inventory/:id", authenticateToken as any, requireRoles(["PHARMACIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = UpdateMedicineSchema.parse(req.body);

    const existing = await prisma.medicine.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Medicine not found" });
    }

    const dataToUpdate: any = { ...validated };
    if (validated.expiryDate !== undefined) {
      dataToUpdate.expiryDate = validated.expiryDate ? new Date(validated.expiryDate) : null;
    }

    const updated = await prisma.medicine.update({
      where: { id },
      data: dataToUpdate,
    });

    res.json(enrichMedicine(updated));
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// PUT Update Stock Only (Pharmacist, Admin Only)
router.put("/inventory/:id/stock", authenticateToken as any, requireRoles(["PHARMACIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { stock } = UpdateStockSchema.parse(req.body);

    const updated = await prisma.medicine.update({
      where: { id },
      data: { stock },
    });

    res.json(enrichMedicine(updated));
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// GET Low Stock & Expiry Alerts (Pharmacist, Admin Only)
router.get("/inventory/alerts", authenticateToken as any, requireRoles(["PHARMACIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const medicines = await prisma.medicine.findMany();
    const enriched = medicines.map(enrichMedicine);

    const alerts = enriched.filter((m) => m.isLowStock || m.isNearExpiry || m.isExpired);

    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
