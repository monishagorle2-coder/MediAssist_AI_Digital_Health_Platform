import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken } from "../middlewares/auth";

const router = Router();

// Validation schemas
const BookAppointmentSchema = z.object({
  patientId: z.string().optional(), // required if receptionist/admin
  doctorId: z.string(),
  slotDateTime: z.string(), // ISO date string
  reason: z.string().min(1),
  notes: z.string().optional(),
});

const UpdateStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]),
});

// Book Appointment
router.post("/", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = BookAppointmentSchema.parse(req.body);
    let patientId = validated.patientId;

    if (req.user?.role === "PATIENT") {
      if (!req.user.patientId) {
        return res.status(400).json({ error: "Patient record not found for this user" });
      }
      patientId = req.user.patientId;
    } else if (req.user?.role !== "RECEPTIONIST" && req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Only patients, receptionists, or admins can book appointments" });
    }

    if (!patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }

    // Verify patient and doctor exist
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const doctor = await prisma.doctor.findUnique({ where: { id: validated.doctorId } });
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    const slotDateTime = new Date(validated.slotDateTime);

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId: validated.doctorId,
        slotDateTime,
        reason: validated.reason,
        notes: validated.notes,
        status: "PENDING",
      },
    });

    // Create a pending Bill immediately
    await prisma.bill.create({
      data: {
        appointmentId: appointment.id,
        patientId,
        amount: 150.00, // Standard consultation charge
        status: "PENDING",
        items: JSON.stringify([
          { description: "General Consultation Fee", cost: 150.00 }
        ])
      }
    });

    res.status(201).json(appointment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to book appointment", details: error.message });
  }
});

// List Appointments (Role Filtered)
router.get("/", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    let appointments;

    if (req.user.role === "PATIENT") {
      appointments = await prisma.appointment.findMany({
        where: { patientId: req.user.patientId },
        include: {
          doctor: {
            include: { department: true }
          },
          diagnosisRecord: true,
          prescription: true,
          bill: true
        },
        orderBy: { slotDateTime: "asc" }
      });
    } else if (req.user.role === "DOCTOR") {
      appointments = await prisma.appointment.findMany({
        where: { doctorId: req.user.doctorId },
        include: {
          patient: true,
          diagnosisRecord: true,
          prescription: true
        },
        orderBy: { slotDateTime: "asc" }
      });
    } else {
      // Admin, Receptionist, Pharmacist can view all
      appointments = await prisma.appointment.findMany({
        include: {
          patient: true,
          doctor: {
            include: { department: true }
          },
          diagnosisRecord: true,
          bill: true
        },
        orderBy: { slotDateTime: "asc" }
      });
    }

    res.json(appointments);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch appointments", details: error.message });
  }
});

// Update status (Reschedule / Cancel / Confirm)
router.put("/:id", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = UpdateStatusSchema.parse(req.body);

    const appointment = await prisma.appointment.findUnique({
      where: { id }
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Authorization checks
    if (req.user?.role === "PATIENT" && appointment.patientId !== req.user.patientId) {
      return res.status(403).json({ error: "Forbidden: You can only update your own appointments" });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status }
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update appointment", details: error.message });
  }
});

export default router;
