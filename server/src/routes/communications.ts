import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken, requireRoles } from "../middlewares/auth";
import { CommunicationService } from "../services/communicationService";

const router = Router();

const UpdatePreferencesSchema = z.object({
  appointmentReminders: z.boolean().optional(),
  labResults: z.boolean().optional(),
  billingAlerts: z.boolean().optional(),
  clinicalUpdates: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
});

const SendReminderSchema = z.object({
  appointmentId: z.string().min(1),
  customMessage: z.string().optional(),
});

// ====================================================================
// 1. GET NOTIFICATION PREFERENCES
// ====================================================================
router.get("/preferences", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: {
          userId,
          appointmentReminders: true,
          labResults: true,
          billingAlerts: true,
          clinicalUpdates: true,
          emailEnabled: true,
          smsEnabled: true,
          inAppEnabled: true,
        },
      });
    }

    res.json(prefs);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch notification preferences", details: error.message });
  }
});

// ====================================================================
// 2. UPDATE NOTIFICATION PREFERENCES
// ====================================================================
router.put("/preferences", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const validated = UpdatePreferencesSchema.parse(req.body);

    const updated = await prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        appointmentReminders: validated.appointmentReminders ?? true,
        labResults: validated.labResults ?? true,
        billingAlerts: validated.billingAlerts ?? true,
        clinicalUpdates: validated.clinicalUpdates ?? true,
        emailEnabled: validated.emailEnabled ?? true,
        smsEnabled: validated.smsEnabled ?? true,
        inAppEnabled: validated.inAppEnabled ?? true,
      },
      update: {
        ...validated,
      },
    });

    // Write Audit Log
    await prisma.auditLog.create({
      data: {
        userId,
        action: "COMMUNICATION_PREFERENCES_UPDATED",
        details: `Updated notification preferences for user ${req.user?.email}`,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
      },
    });

    res.json({ message: "Notification preferences updated successfully", preferences: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update preferences", details: error.message });
  }
});

// ====================================================================
// 3. GET COMMUNICATION DELIVERY HISTORY (Role Filtered)
// ====================================================================
router.get("/history", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const targetUserId = req.query.userId as string | undefined;

    let whereClause: any = {};

    if (userRole === "ADMIN") {
      if (targetUserId) whereClause.userId = targetUserId;
    } else {
      whereClause.userId = userId;
    }

    const history = await prisma.communicationLog.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch communication history", details: error.message });
  }
});

// ====================================================================
// 4. SEND APPOINTMENT REMINDER (Doctor / Receptionist / Admin)
// ====================================================================
router.post("/reminders/send", authenticateToken as any, requireRoles(["DOCTOR", "RECEPTIONIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { appointmentId, customMessage } = SendReminderSchema.parse(req.body);

    const app = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { department: true } },
      },
    });

    if (!app) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const timeStr = new Date(app.slotDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = new Date(app.slotDateTime).toLocaleDateString();
    const reminderText = customMessage || `Friendly reminder: You have an upcoming consultation with Dr. ${app.doctor.name} (${app.doctor.department?.name}) on ${dateStr} at ${timeStr}.`;

    const dispatchResult = await CommunicationService.dispatch({
      userId: app.patient.userId,
      patientId: app.patientId,
      category: "APPOINTMENT",
      type: "APPOINTMENT_REMINDER",
      title: "Upcoming Appointment Reminder",
      message: reminderText,
      recipientEmail: app.patient.user?.email,
      recipientPhone: app.patient.phone,
      relatedEntityId: app.id,
      idempotencyKey: `REMINDER-${app.id}-${new Date().toISOString().split("T")[0]}`,
      ipAddress: req.ip || req.socket?.remoteAddress || undefined,
    });

    res.json({
      message: "Appointment reminder dispatched successfully",
      dispatchResult,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to dispatch reminder", details: error.message });
  }
});

export default router;
