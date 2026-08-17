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

const UpdatePatientProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  address: z.string().optional(),
  bloodGroup: z.string().optional(),
  allergies: z.string().nullable().optional(),
  chronicConditions: z.string().nullable().optional(),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  insuranceProvider: z.string().nullable().optional(),
  insuranceNumber: z.string().nullable().optional(),
});

const RecordVitalsSchema = z.object({
  appointmentId: z.string().optional().nullable(),
  bloodPressure: z.string().optional().nullable(),
  pulse: z.number().int().positive().optional().nullable(),
  temperature: z.number().positive().optional().nullable(),
  spo2: z.number().int().min(50).max(100).optional().nullable(),
  weight: z.number().positive().optional().nullable(),
  height: z.number().positive().optional().nullable(),
});

// GET Patient Profile (Patient Only)
router.get("/patients/me", authenticateToken as any, requireRoles(["PATIENT"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(400).json({ error: "Patient record not found for this user" });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: { select: { email: true, role: true, createdAt: true } },
        vitals: { orderBy: { createdAt: "desc" }, take: 10 }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: "Patient profile not found" });
    }

    res.json(patient);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch patient profile", details: error.message });
  }
});

// PUT Update Patient Profile (Patient Only)
router.put("/patients/me", authenticateToken as any, requireRoles(["PATIENT"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(400).json({ error: "Patient record not found for this user" });
    }

    const validated = UpdatePatientProfileSchema.parse(req.body);

    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: validated
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update profile", details: error.message });
  }
});

// POST Record Clinical Vitals (Doctor, Receptionist, Admin Only)
router.post("/patients/:id/vitals", authenticateToken as any, requireRoles(["DOCTOR", "RECEPTIONIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = RecordVitalsSchema.parse(req.body);

    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // Auto-calculate BMI if both height and weight are provided
    let calculatedBmi: number | null = null;
    if (validated.weight && validated.height) {
      const heightInMeters = validated.height > 3.0 ? validated.height / 100 : validated.height;
      if (heightInMeters > 0) {
        calculatedBmi = Math.round((validated.weight / (heightInMeters * heightInMeters)) * 10) / 10;
      }
    }

    const vitals = await prisma.vitals.create({
      data: {
        patientId: id,
        appointmentId: validated.appointmentId || null,
        bloodPressure: validated.bloodPressure || null,
        pulse: validated.pulse || null,
        temperature: validated.temperature || null,
        spo2: validated.spo2 || null,
        weight: validated.weight || null,
        height: validated.height || null,
        bmi: calculatedBmi,
        recordedBy: req.user?.id || "Clinical Staff",
      }
    });

    res.status(201).json(vitals);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to record vitals", details: error.message });
  }
});

// GET Patient Vitals History (Role Filtered & Ownership Enforced)
router.get("/patients/:id/vitals", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const role = req.user?.role;
    const patientId = req.user?.patientId;

    // Authorization: Patients can only view their own vitals
    if (role === "PATIENT" && patientId !== id) {
      return res.status(403).json({ error: "Forbidden: You cannot access other patients' vitals" });
    }

    const vitals = await prisma.vitals.findMany({
      where: { patientId: id },
      orderBy: { createdAt: "desc" }
    });

    res.json(vitals);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch vitals", details: error.message });
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
    const paidBills = await prisma.bill.findMany({
      where: {
        OR: [
          { status: "PAID" },
          { paymentStatus: "PAID" },
        ],
      },
    });
    const totalRevenue = paidBills.reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0);

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
