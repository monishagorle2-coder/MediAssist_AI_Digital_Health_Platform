import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken, requireRoles } from "../middlewares/auth";

const router = Router();

const CreatePrescriptionSchema = z.object({
  appointmentId: z.string().optional(),
  patientId: z.string(),
  diagnosisRecordId: z.string().optional(),
  medicines: z.array(z.object({
    medicineId: z.string().optional(),
    medicineName: z.string(),
    dosage: z.string(),
    frequency: z.string(),
    duration: z.string(),
    quantity: z.number().int().positive().default(10),
  })),
  notes: z.string().optional(),
});

const AddMedicineSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  stock: z.number().int().nonnegative(),
  unit: z.string().min(1),
  minStockLimit: z.number().int().positive().default(10),
  price: z.number().positive(),
});

const UpdateStockSchema = z.object({
  stock: z.number().int().nonnegative(),
});

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
        medicines: typeof validated.medicines === "string"
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
      medicines: typeof p.medicines === "string" ? JSON.parse(p.medicines) : p.medicines
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Dispense Prescription (Pharmacist Only)
router.put("/prescriptions/:id/dispense", authenticateToken as any, requireRoles(["PHARMACIST"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: { patient: true }
    });

    if (!prescription) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    if (prescription.status === "DISPENSED") {
      return res.status(400).json({ error: "Prescription is already dispensed" });
    }

    const medicinesList = typeof prescription.medicines === "string" 
      ? JSON.parse(prescription.medicines) 
      : (prescription.medicines as any[]);

    // Transaction to update status, decrement stock, and add bill charges
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update prescription status
      const updated = await tx.prescription.update({
        where: { id },
        data: { status: "DISPENSED" },
      });

      // 2. Decrement medicine stock and log if low
      const stockAlerts: string[] = [];
      const billingItems: { description: string; cost: number }[] = [];
      let totalCost = 0;

      for (const item of medicinesList) {
        // Find medicine by name or ID
        const med = await tx.medicine.findFirst({
          where: {
            OR: [
              { id: item.medicineId || "" },
              { name: item.medicineName }
            ]
          }
        });

        if (med) {
          const qty = item.quantity || 10;
          const newStock = Math.max(0, med.stock - qty);
          
          await tx.medicine.update({
            where: { id: med.id },
            data: { stock: newStock },
          });

          const itemCost = med.price * qty;
          billingItems.push({
            description: `Medicine: ${med.name} x ${qty}`,
            cost: itemCost
          });
          totalCost += itemCost;

          if (newStock <= med.minStockLimit) {
            stockAlerts.push(med.name);
          }
        }
      }

      // 3. Create or update bill if appointment exists
      if (prescription.appointmentId && billingItems.length > 0) {
        const existingBill = await tx.bill.findUnique({
          where: { appointmentId: prescription.appointmentId }
        });

        if (existingBill) {
          const prevItems = typeof existingBill.items === "string" ? JSON.parse(existingBill.items) : existingBill.items;
          const updatedItems = [...prevItems, ...billingItems];
          const updatedAmount = existingBill.amount + totalCost;
          await tx.bill.update({
            where: { id: existingBill.id },
            data: {
              items: JSON.stringify(updatedItems),
              amount: updatedAmount,
            }
          });
        }
      }

      // 4. Create Audit Log
      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: "DISPENSE_PRESCRIPTION",
          details: `Dispensed prescription ${id} for patient ${prescription.patient.name}. Medicines cost: $${totalCost.toFixed(2)}.`,
        }
      });

      return { updated, stockAlerts };
    });

    res.json({
      message: "Prescription dispensed and stock updated successfully",
      prescription: result.updated,
      alerts: result.stockAlerts.length > 0 ? `Low stock alert for: ${result.stockAlerts.join(", ")}` : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to dispense prescription", details: error.message });
  }
});

// GET Medicine Inventory (Pharmacist, Doctor, Admin)
router.get("/inventory", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const medicines = await prisma.medicine.findMany({
      orderBy: { name: "asc" }
    });
    res.json(medicines);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Add Medicine (Pharmacist, Admin Only)
router.post("/inventory", authenticateToken as any, requireRoles(["PHARMACIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = AddMedicineSchema.parse(req.body);

    const existing = await prisma.medicine.findUnique({
      where: { name: validated.name }
    });
    if (existing) {
      return res.status(400).json({ error: "Medicine with this name already exists" });
    }

    const medicine = await prisma.medicine.create({
      data: validated
    });

    res.status(201).json(medicine);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// PUT Update Stock (Pharmacist, Admin Only)
router.put("/inventory/:id", authenticateToken as any, requireRoles(["PHARMACIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { stock } = UpdateStockSchema.parse(req.body);

    const updated = await prisma.medicine.update({
      where: { id },
      data: { stock }
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// GET Low Stock Alerts (Pharmacist, Admin Only)
router.get("/inventory/alerts", authenticateToken as any, requireRoles(["PHARMACIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const lowStock = await prisma.medicine.findMany({
      where: {
        stock: {
          lte: prisma.medicine.fields.minStockLimit
        }
      }
    });
    res.json(lowStock);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
