import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken, requireRoles } from "../middlewares/auth";

const router = Router();

// Validation Schemas
const CreatePatientSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().min(10),
  dob: z.string(),
  gender: z.string(),
  bloodGroup: z.string(),
  address: z.string(),
});

const CreateDoctorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  specialization: z.string().min(1),
  departmentId: z.string(),
  phone: z.string().min(10),
});

const CreateDepartmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

// GET Departments (Public or Auth)
router.get("/departments", async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        doctors: true
      }
    });
    res.json(departments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Create Department (Admin Only)
router.post("/departments", authenticateToken as any, requireRoles(["ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = CreateDepartmentSchema.parse(req.body);
    const dept = await prisma.department.create({ data: validated });
    res.status(201).json(dept);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// GET Doctors (All authenticated)
router.get("/doctors", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doctors = await prisma.doctor.findMany({
      include: { department: true }
    });
    res.json(doctors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Create Doctor (Admin Only)
router.post("/doctors", authenticateToken as any, requireRoles(["ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = CreateDoctorSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: validated.email } });
    if (existing) return res.status(400).json({ error: "Email already in use" });

    const passwordHash = await bcrypt.hash(validated.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: validated.email,
          passwordHash,
          role: "DOCTOR"
        }
      });

      const doctor = await tx.doctor.create({
        data: {
          userId: user.id,
          name: validated.name,
          specialization: validated.specialization,
          departmentId: validated.departmentId,
          phone: validated.phone,
          email: validated.email
        }
      });

      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: "CREATE_DOCTOR",
          details: `Admin created doctor profile: ${validated.name} (${validated.email})`
        }
      });

      return doctor;
    });

    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// GET Patients (Receptionist, Admin, Doctor)
router.get("/patients", authenticateToken as any, requireRoles(["RECEPTIONIST", "ADMIN", "DOCTOR"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patients = await prisma.patient.findMany({
      orderBy: { name: "asc" }
    });
    res.json(patients);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Register Patient by Receptionist
router.post("/patients", authenticateToken as any, requireRoles(["RECEPTIONIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = CreatePatientSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: validated.email } });
    if (existing) return res.status(400).json({ error: "Patient email already in use" });

    const tempPasswordHash = await bcrypt.hash("Welcome123!", 10); // Standard temporary password

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: validated.email,
          passwordHash: tempPasswordHash,
          role: "PATIENT"
        }
      });

      const patient = await tx.patient.create({
        data: {
          userId: user.id,
          name: validated.name,
          phone: validated.phone,
          dob: new Date(validated.dob),
          gender: validated.gender,
          bloodGroup: validated.bloodGroup,
          address: validated.address
        }
      });

      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: "REGISTER_PATIENT_RECEPTION",
          details: `Receptionist registered patient: ${validated.name} (${validated.email})`
        }
      });

      return patient;
    });

    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// GET Bills (Role Filtered)
router.get("/bills", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role;
    let bills;

    if (role === "PATIENT") {
      bills = await prisma.bill.findMany({
        where: { patientId: req.user?.patientId },
        include: { appointment: { include: { doctor: true } } },
        orderBy: { createdAt: "desc" }
      });
    } else {
      // Admin, Receptionist, Pharmacist
      bills = await prisma.bill.findMany({
        include: { patient: true, appointment: { include: { doctor: true } } },
        orderBy: { createdAt: "desc" }
      });
    }

    const formattedBills = bills.map((b: any) => ({
      ...b,
      items: typeof b.items === "string" ? JSON.parse(b.items) : b.items
    }));

    res.json(formattedBills);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT Pay Bill (Receptionist, Patient, Admin)
router.put("/bills/:id/pay", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: { patient: true }
    });

    if (!bill) return res.status(404).json({ error: "Bill not found" });

    if (bill.status === "PAID") return res.status(400).json({ error: "Bill is already paid" });

    // Authorization: Patients can only pay their own bills
    if (req.user?.role === "PATIENT" && bill.patientId !== req.user.patientId) {
      return res.status(403).json({ error: "Forbidden: Cannot pay someone else's bill" });
    }

    const updated = await prisma.bill.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date()
      }
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: "PAY_BILL",
        details: `Bill ${id} paid for patient ${bill.patient.name}. Amount: $${bill.amount.toFixed(2)}`
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Notifications
router.get("/notifications", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user?.id },
      orderBy: { createdAt: "desc" }
    });
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT Mark Notification Read
router.put("/notifications/:id/read", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Audit Logs (Admin Only)
router.get("/admin/audit-logs", authenticateToken as any, requireRoles(["ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Admin Stats (Admin Only)
router.get("/admin/stats", authenticateToken as any, requireRoles(["ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientCount = await prisma.patient.count();
    const doctorCount = await prisma.doctor.count();
    const appointmentCount = await prisma.appointment.count();
    const pendingDiagnosisCount = await prisma.diagnosisRecord.count({ where: { status: "PENDING" } });
    const confirmedDiagnosisCount = await prisma.diagnosisRecord.count({ where: { status: "CONFIRMED" } });
    
    // Revenue sum
    const paidBills = await prisma.bill.findMany({ where: { status: "PAID" } });
    const totalRevenue = paidBills.reduce((sum, b) => sum + b.amount, 0);

    // Low stock count
    const lowStockCount = await prisma.medicine.count({
      where: {
        stock: {
          lte: prisma.medicine.fields.minStockLimit
        }
      }
    });

    res.json({
      patients: patientCount,
      doctors: doctorCount,
      appointments: appointmentCount,
      pendingDiagnoses: pendingDiagnosisCount,
      confirmedDiagnoses: confirmedDiagnosisCount,
      revenue: totalRevenue,
      lowStockCount
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
