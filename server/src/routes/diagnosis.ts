import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken } from "../middlewares/auth";
import { notificationService } from "../services/notificationService";
import { CommunicationService } from "../services/communicationService";

const router = Router();

const CreateDiagnosisSchema = z.object({
  appointmentId: z.string().optional(),
  patientId: z.string(),
  symptoms: z.string().min(1),
  aiSuggestions: z.any().optional(), // JSON payload from AI Service
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
    aiSuggestions: validated.aiSuggestions
      ? typeof validated.aiSuggestions === "string"
        ? validated.aiSuggestions
        : JSON.stringify(validated.aiSuggestions)
      : JSON.stringify({}),
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
      include: { patient: true, doctor: true }
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

      return updated;
    });

    // Send patient a real-time notification
    if (record.patient.userId) {
      await notificationService.createAndSendNotification({
        userId: record.patient.userId,
        title: "New Diagnosis Report Available",
        message: `Your medical report for diagnosis '${finalDiagnosis}' has been confirmed by your doctor.`,
        type: "DIAGNOSIS",
        link: "/reports",
        metadata: { diagnosisId: id, patientId: record.patientId },
      });
    }

    // Broadcast hospital event
    notificationService.broadcastHospitalEvent(
      {
        roles: ["ADMIN"],
        userIds: [record.patient.userId].filter(Boolean),
      },
      "DIAGNOSIS_CONFIRMED",
      { diagnosisId: id, patientId: record.patientId, finalDiagnosis }
    );

    // Multi-channel Communication Dispatch
    await CommunicationService.dispatch({
      userId: record.patient.userId,
      patientId: record.patientId,
      category: "CLINICAL",
      type: "DIAGNOSIS_CONFIRMED",
      title: "Diagnosis Report Confirmed",
      message: `Your medical diagnosis of '${finalDiagnosis}' has been confirmed by Dr. ${record.doctor.name}. Complete clinical report is published to your records.`,
      recipientEmail: (record.patient as any)?.user?.email,
      recipientPhone: record.patient.phone,
      relatedEntityId: id,
      idempotencyKey: `DIAG-CONFIRM-${id}`,
      ipAddress: req.ip || req.socket?.remoteAddress || undefined,
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

// GET /api/diagnosis/:id/report (Formal printable diagnosis document)
router.get("/:id/report", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const patientId = req.user?.patientId;

    const record: any = await prisma.diagnosisRecord.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { include: { department: true } },
        appointment: {
          include: {
            vitals: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });

    if (!record) {
      return res.status(404).json({ error: "Diagnosis record not found" });
    }

    if (userRole === "PATIENT") {
      if (record.patientId !== patientId) {
        return res.status(403).json({ error: "Forbidden: You are not authorized to view this diagnosis report" });
      }
      if (record.status !== "CONFIRMED") {
        return res.status(403).json({ error: "Access Denied: This diagnosis record is pending clinician confirmation." });
      }
    }

    const latestVitals = record.appointment?.vitals?.[0] || null;

    res.json({
      hospital: {
        name: "MediAssist Multi-Specialty Hospital & Research Center",
        address: "100 Medical Center Boulevard, Healthcare District, Metro City, 560001",
        phone: "+1 (800) 555-MEDI",
        accreditation: "NABH / JCI Accredited",
      },
      documentType: "CLINICAL_DIAGNOSIS_REPORT",
      reportNumber: `DIAG-${record.id.slice(-8).toUpperCase()}`,
      patient: {
        id: record.patient.id,
        name: record.patient.name,
        phone: record.patient.phone,
        dob: record.patient.dob,
        gender: record.patient.gender,
        bloodGroup: record.patient.bloodGroup,
        allergies: record.patient.allergies || "None reported",
      },
      doctor: {
        name: `Dr. ${record.doctor.name}`,
        specialization: record.doctor.specialization,
        department: record.doctor.department?.name || "General Medicine",
        email: record.doctor.email,
      },
      appointment: record.appointment
        ? {
            id: record.appointment.id,
            visitDate: record.appointment.slotDateTime,
            tokenNumber: record.appointment.tokenNumber,
            reason: record.appointment.reason,
          }
        : null,
      clinicalFindings: {
        chiefComplaints: record.symptoms,
        finalDiagnosis: record.finalDiagnosis || "Clinical Assessment In Progress",
        status: record.status,
        confirmedAt: record.confirmedAt || record.createdAt,
        confirmedBy: record.confirmedBy || `Dr. ${record.doctor.name}`,
      },
      vitals: latestVitals,
      disclaimer: "This document is a certified medical assessment record produced and verified by the attending clinician.",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch diagnosis report", details: error.message });
  }
});

export default router;
