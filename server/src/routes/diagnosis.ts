import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken } from "../middlewares/auth";

const router = Router();

const CreateDiagnosisSchema = z.object({
  appointmentId: z.string().optional(),
  patientId: z.string(),
  symptoms: z.string().min(1),
  aiSuggestions: z.any(), // JSON payload from AI Service
  finalDiagnosis: z.string().optional(),
});

const ConfirmDiagnosisSchema = z.object({
  finalDiagnosis: z.string().min(1),
});

// Create Diagnosis Record (Doctor Only)
router.post("/", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "DOCTOR") {
      return res.status(403).json({ error: "Forbidden: Only doctors can create diagnosis records" });
    }

    const validated = CreateDiagnosisSchema.parse(req.body);
    const doctorId = req.user.doctorId;
    if (!doctorId) {
      return res.status(400).json({ error: "Doctor profile not found for this user" });
    }

    const record = await prisma.diagnosisRecord.create({
      data: {
        appointmentId: validated.appointmentId || null,
        patientId: validated.patientId,
        doctorId,
        symptoms: validated.symptoms,
        aiSuggestions: typeof validated.aiSuggestions === "string" 
          ? validated.aiSuggestions 
          : JSON.stringify(validated.aiSuggestions),
        finalDiagnosis: validated.finalDiagnosis || null,
        status: "PENDING",
      },
    });

    res.status(201).json(record);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create diagnosis record", details: error.message });
  }
});

// Confirm Diagnosis (Doctor Only)
router.put("/:id/confirm", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "DOCTOR") {
      return res.status(403).json({ error: "Forbidden: Only doctors can confirm diagnoses" });
    }

    const { id } = req.params;
    const { finalDiagnosis } = ConfirmDiagnosisSchema.parse(req.body);
    const userId = req.user.id;

    const record = await prisma.diagnosisRecord.findUnique({
      where: { id },
      include: { patient: true }
    });

    if (!record) {
      return res.status(404).json({ error: "Diagnosis record not found" });
    }

    // Update diagnosis record
    const updatedRecord = await prisma.$transaction(async (tx) => {
      const updated = await tx.diagnosisRecord.update({
        where: { id },
        data: {
          finalDiagnosis,
          status: "CONFIRMED",
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: "CONFIRM_DIAGNOSIS",
          details: `Doctor confirmed final diagnosis for patient ${record.patient.name} (${record.patientId}). Diagnosis: ${finalDiagnosis}`,
        },
      });

      // Send patient a notification
      await tx.notification.create({
        data: {
          userId: record.patient.userId,
          title: "New Diagnosis Report Available",
          message: `Your medical report for diagnosis '${finalDiagnosis}' has been confirmed by your doctor.`,
        },
      });

      return updated;
    });

    res.json(updatedRecord);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to confirm diagnosis", details: error.message });
  }
});

// Get Diagnosis Record (Strict Role Enforcement)
router.get("/:id", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const patientId = req.user?.patientId;

    const record = await prisma.diagnosisRecord.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: {
          include: { department: true }
        }
      }
    });

    if (!record) {
      return res.status(404).json({ error: "Diagnosis record not found" });
    }

    // CRITICAL SECURITY ENFORCEMENT:
    // Patients can NEVER see PENDING diagnosis records.
    // Patients can only see CONFIRMED records that belong to them.
    if (userRole === "PATIENT") {
      if (record.patientId !== patientId) {
        return res.status(403).json({ error: "Forbidden: You are not authorized to view this record" });
      }
      if (record.status !== "CONFIRMED") {
        return res.status(403).json({ error: "Access Denied: This diagnosis record is pending confirmation by a clinician." });
      }
      
      // Filter out AI suggestions (differential diagnosis with confidence) from response
      const patientResponse = {
        id: record.id,
        appointmentId: record.appointmentId,
        patientId: record.patientId,
        patientName: record.patient.name,
        doctorName: record.doctor.name,
        departmentName: record.doctor.department.name,
        symptoms: record.symptoms,
        finalDiagnosis: record.finalDiagnosis,
        status: record.status,
        confirmedAt: record.confirmedAt,
      };
      
      return res.json(patientResponse);
    }

    // Doctors, Admins, etc. can see the full record including AI suggestions
    const formattedRecord = {
      ...record,
      aiSuggestions: typeof record.aiSuggestions === "string" ? JSON.parse(record.aiSuggestions) : record.aiSuggestions
    };
    res.json(formattedRecord);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch diagnosis record", details: error.message });
  }
});

// List Diagnosis Records (Role Filtered)
router.get("/", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const patientId = req.user?.patientId;
    const doctorId = req.user?.doctorId;

    let records;

    if (userRole === "PATIENT") {
      // Patients only get CONFIRMED records belonging to them
      records = await prisma.diagnosisRecord.findMany({
        where: {
          patientId,
          status: "CONFIRMED"
        },
        include: {
          doctor: {
            include: { department: true }
          }
        },
        orderBy: { confirmedAt: "desc" }
      });
      
      // Map to omit AI suggestions
      records = records.map(r => ({
        id: r.id,
        appointmentId: r.appointmentId,
        patientId: r.patientId,
        doctorName: r.doctor.name,
        departmentName: r.doctor.department.name,
        symptoms: r.symptoms,
        finalDiagnosis: r.finalDiagnosis,
        status: r.status,
        confirmedAt: r.confirmedAt,
      }));
    } else if (userRole === "DOCTOR") {
      // Doctors get all records they created
      records = await prisma.diagnosisRecord.findMany({
        where: { doctorId },
        include: { patient: true },
        orderBy: { createdAt: "desc" }
      });
    } else {
      // Receptionist/Admin/Pharmacist get all records
      records = await prisma.diagnosisRecord.findMany({
        include: { patient: true, doctor: true },
        orderBy: { createdAt: "desc" }
      });
    }

    const formattedRecords = records.map((r: any) => ({
      ...r,
      aiSuggestions: typeof r.aiSuggestions === "string" ? JSON.parse(r.aiSuggestions) : r.aiSuggestions
    }));

    res.json(formattedRecords);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch diagnosis records", details: error.message });
  }
});

export default router;
