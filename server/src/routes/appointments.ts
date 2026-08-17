import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken, requireRoles } from "../middlewares/auth";
import { generateInvoiceNumber } from "./billing";

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

const DoctorScheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  slotDuration: z.number().int().min(5).max(120).default(15),
  isAvailable: z.boolean().default(true),
});

const UpdateDoctorScheduleSchema = z.object({
  schedules: z.array(DoctorScheduleItemSchema),
});

// Helper: parse HH:mm to minutes from midnight
const parseTimeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

// Helper: format minutes from midnight to HH:mm
const formatMinutesToTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

// Helper: Get doctor schedule for a specific day of week
const getDoctorDaySchedule = async (doctorId: string, dayOfWeek: number) => {
  const customSchedule = await prisma.doctorSchedule.findUnique({
    where: {
      doctorId_dayOfWeek: {
        doctorId,
        dayOfWeek,
      },
    },
  });

  if (customSchedule) {
    return {
      isWorkingDay: customSchedule.isAvailable,
      startTime: customSchedule.startTime,
      endTime: customSchedule.endTime,
      slotDuration: customSchedule.slotDuration,
    };
  }

  // Default Standard Hospital Consultation Hours: Monday (1) - Friday (5), 09:00 - 17:00, 15 min slots
  const isDefaultWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5;
  return {
    isWorkingDay: isDefaultWorkingDay,
    startTime: "09:00",
    endTime: "17:00",
    slotDuration: 15,
  };
};

// GET Doctor Weekly Availability Schedule
router.get("/doctors/:id/availability", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: { doctorSchedules: true, department: true },
    });

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const weeklySchedule = [];

    for (let day = 0; day < 7; day++) {
      const schedule = await getDoctorDaySchedule(id, day);
      weeklySchedule.push({
        dayOfWeek: day,
        dayName: dayNames[day],
        ...schedule,
      });
    }

    res.json({
      doctorId: doctor.id,
      doctorName: doctor.name,
      specialization: doctor.specialization,
      department: doctor.department?.name,
      weeklySchedule,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch doctor availability", details: error.message });
  }
});

// GET Bookable Available Slots for Doctor on a specific date
router.get("/doctors/:id/slots", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const dateQuery = req.query.date as string;

    if (!dateQuery || !/^\d{4}-\d{2}-\d{2}$/.test(dateQuery)) {
      return res.status(400).json({ error: "Query parameter 'date' in format YYYY-MM-DD is required" });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: { department: true },
    });

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // Parse day of week from date
    const [year, month, day] = dateQuery.split("-").map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = targetDate.getUTCDay();

    const schedule = await getDoctorDaySchedule(id, dayOfWeek);

    if (!schedule.isWorkingDay) {
      return res.json({
        doctorId: doctor.id,
        doctorName: doctor.name,
        date: dateQuery,
        isWorkingDay: false,
        slotDuration: schedule.slotDuration,
        message: "Doctor does not have consultation hours on this day.",
        slots: [],
      });
    }

    const startMinutes = parseTimeToMinutes(schedule.startTime);
    const endMinutes = parseTimeToMinutes(schedule.endTime);
    const duration = schedule.slotDuration;

    // Fetch existing active (non-cancelled) appointments for this doctor on this day
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: id,
        status: { not: "CANCELLED" },
        slotDateTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
        slotDateTime: true,
        status: true,
      },
    });

    // Generate slots
    const generatedSlots = [];
    for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
      const timeStr = formatMinutesToTime(m);
      const [slotHours, slotMins] = timeStr.split(":").map(Number);
      const slotDateTime = new Date(Date.UTC(year, month - 1, day, slotHours, slotMins, 0));

      const slotStartMs = slotDateTime.getTime();
      const slotEndMs = slotStartMs + duration * 60 * 1000;

      // Check conflict with any existing active appointment
      const conflict = existingAppointments.find((app) => {
        const appStartMs = new Date(app.slotDateTime).getTime();
        const appEndMs = appStartMs + duration * 60 * 1000;
        return Math.max(slotStartMs, appStartMs) < Math.min(slotEndMs, appEndMs);
      });

      generatedSlots.push({
        time: timeStr,
        slotDateTime: slotDateTime.toISOString(),
        available: !conflict,
        reason: conflict ? "Booked" : undefined,
      });
    }

    res.json({
      doctorId: doctor.id,
      doctorName: doctor.name,
      date: dateQuery,
      isWorkingDay: true,
      slotDuration: duration,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      slots: generatedSlots,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch appointment slots", details: error.message });
  }
});

// PUT Update Doctor Schedule (Doctor for self, or Admin)
router.put("/doctors/:id/schedule", authenticateToken as any, requireRoles(["DOCTOR", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.role === "DOCTOR" && req.user.doctorId !== id) {
      return res.status(403).json({ error: "Forbidden: You can only update your own schedule" });
    }

    const { schedules } = UpdateDoctorScheduleSchema.parse(req.body);

    const doctor = await prisma.doctor.findUnique({ where: { id } });
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // Upsert each schedule
    const results = await prisma.$transaction(
      schedules.map((s) =>
        prisma.doctorSchedule.upsert({
          where: {
            doctorId_dayOfWeek: {
              doctorId: id,
              dayOfWeek: s.dayOfWeek,
            },
          },
          update: {
            startTime: s.startTime,
            endTime: s.endTime,
            slotDuration: s.slotDuration,
            isAvailable: s.isAvailable,
          },
          create: {
            doctorId: id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            slotDuration: s.slotDuration,
            isAvailable: s.isAvailable,
          },
        })
      )
    );

    res.json({ message: "Doctor schedule updated successfully", schedules: results });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update doctor schedule", details: error.message });
  }
});

// GET Today's Consultation Queue (Role-Filtered & Deterministic Sorting)
router.get("/queue/today", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const doctorIdQuery = req.query.doctorId as string | undefined;
    const statusQuery = req.query.status as string | undefined;

    // RBAC Filter
    let whereClause: any = {
      slotDateTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (req.user?.role === "PATIENT") {
      whereClause.patientId = req.user.patientId;
    } else if (req.user?.role === "DOCTOR") {
      whereClause.doctorId = req.user.doctorId;
    } else if (doctorIdQuery) {
      whereClause.doctorId = doctorIdQuery;
    }

    if (statusQuery && statusQuery !== "ALL") {
      whereClause.queueStatus = statusQuery;
    } else {
      // Exclude cancelled by default unless explicitly asked
      whereClause.queueStatus = { not: "CANCELLED" };
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: true,
        doctor: { include: { department: true } },
        vitals: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [
        { slotDateTime: "asc" },
      ],
    });

    const statusWeight: Record<string, number> = {
      IN_CONSULTATION: 1,
      CHECKED_IN: 2,
      WAITING: 3,
      COMPLETED: 4,
      NO_SHOW: 5,
      CANCELLED: 6,
    };

    // Calculate waiting minutes and sort deterministically
    const formattedQueue = appointments.map((app) => {
      let waitingMinutes = 0;
      if (app.checkedInAt) {
        const endTimeMs = app.consultationStartedAt ? new Date(app.consultationStartedAt).getTime() : now.getTime();
        waitingMinutes = Math.max(0, Math.floor((endTimeMs - new Date(app.checkedInAt).getTime()) / 60000));
      }

      return {
        id: app.id,
        tokenNumber: app.tokenNumber,
        queueStatus: app.queueStatus,
        patientId: app.patientId,
        patientName: app.patient?.name || "Patient",
        patientPhone: app.patient?.phone,
        patientGender: app.patient?.gender,
        patientBloodGroup: app.patient?.bloodGroup,
        doctorId: app.doctorId,
        doctorName: app.doctor?.name,
        specialization: app.doctor?.specialization,
        department: app.doctor?.department?.name,
        slotDateTime: app.slotDateTime,
        reason: app.reason,
        notes: app.notes,
        checkedInAt: app.checkedInAt,
        consultationStartedAt: app.consultationStartedAt,
        consultationCompletedAt: app.consultationCompletedAt,
        waitingMinutes,
        latestVitals: app.vitals[0] || null,
      };
    });

    // Deterministic Queue Order: 1. Status Weight, 2. Token / Check-in Time, 3. Slot Time
    formattedQueue.sort((a, b) => {
      const weightA = statusWeight[a.queueStatus] || 99;
      const weightB = statusWeight[b.queueStatus] || 99;
      if (weightA !== weightB) return weightA - weightB;

      if (a.tokenNumber && b.tokenNumber) return a.tokenNumber - b.tokenNumber;
      if (a.tokenNumber && !b.tokenNumber) return -1;
      if (!a.tokenNumber && b.tokenNumber) return 1;

      return new Date(a.slotDateTime).getTime() - new Date(b.slotDateTime).getTime();
    });

    const activeWaitingCount = formattedQueue.filter((q) => q.queueStatus === "CHECKED_IN").length;
    const inConsultationCount = formattedQueue.filter((q) => q.queueStatus === "IN_CONSULTATION").length;
    const completedCount = formattedQueue.filter((q) => q.queueStatus === "COMPLETED").length;

    res.json({
      date: now.toISOString().split("T")[0],
      totalQueueCount: formattedQueue.length,
      activeWaitingCount,
      inConsultationCount,
      completedCount,
      queue: formattedQueue,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch today's consultation queue", details: error.message });
  }
});

// POST Check-In Patient (Receptionist/Admin Only)
router.post("/:id/check-in", authenticateToken as any, requireRoles(["RECEPTIONIST", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { patient: true, doctor: true },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (appointment.status === "CANCELLED" || appointment.queueStatus === "CANCELLED") {
      return res.status(400).json({ error: "Cannot check in a cancelled appointment." });
    }

    if (appointment.queueStatus === "CHECKED_IN" || appointment.queueStatus === "IN_CONSULTATION" || appointment.queueStatus === "COMPLETED") {
      return res.status(400).json({
        error: `Appointment is already checked in (Token #${appointment.tokenNumber || 1}). Current status: ${appointment.queueStatus}.`,
        tokenNumber: appointment.tokenNumber,
      });
    }

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    // Atomic Token Generation within Transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Row-level lock on Doctor record for the transaction duration to guarantee sequential token generation
      await tx.$executeRaw`SELECT id FROM "Doctor" WHERE id = ${appointment.doctorId} FOR UPDATE`;

      // Find highest token assigned to this doctor today
      const lastTokenApp = await tx.appointment.findFirst({
        where: {
          doctorId: appointment.doctorId,
          tokenNumber: { not: null },
          checkedInAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: { tokenNumber: "desc" },
      });

      const nextToken = (lastTokenApp?.tokenNumber || 0) + 1;

      const appUpdated = await tx.appointment.update({
        where: { id },
        data: {
          queueStatus: "CHECKED_IN",
          tokenNumber: nextToken,
          checkedInAt: now,
          status: "CONFIRMED",
        },
        include: {
          patient: true,
          doctor: { include: { department: true } },
          vitals: true,
        },
      });

      // Notification for Doctor
      if (appointment.doctor?.userId) {
        await tx.notification.create({
          data: {
            userId: appointment.doctor.userId,
            title: "Patient Checked In",
            message: `${appointment.patient.name} has checked in with Token #${nextToken}.`,
          },
        });
      }

      return appUpdated;
    });

    res.json({
      message: `Patient checked in successfully with Token #${updated.tokenNumber}`,
      appointment: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to process check-in", details: error.message });
  }
});

// PUT Start Consultation (Doctor for self, or Admin)
router.put("/:id/start-consultation", authenticateToken as any, requireRoles(["DOCTOR", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true, patient: true },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (req.user?.role === "DOCTOR" && appointment.doctorId !== req.user.doctorId) {
      return res.status(403).json({ error: "Forbidden: You can only start consultations for your own patients" });
    }

    if (appointment.queueStatus === "IN_CONSULTATION") {
      return res.json({ message: "Consultation is already in progress", appointment });
    }

    if (appointment.queueStatus !== "CHECKED_IN") {
      return res.status(400).json({
        error: `Cannot start consultation. Appointment must be in CHECKED_IN state first (current status: ${appointment.queueStatus}).`,
      });
    }

    const now = new Date();
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        queueStatus: "IN_CONSULTATION",
        consultationStartedAt: now,
      },
      include: {
        patient: true,
        doctor: { include: { department: true } },
        vitals: true,
      },
    });

    // Notify Patient
    if (appointment.patient?.userId) {
      await prisma.notification.create({
        data: {
          userId: appointment.patient.userId,
          title: "Consultation Started",
          message: `Your consultation with ${appointment.doctor.name} has started.`,
        },
      });
    }

    res.json({
      message: "Consultation started successfully",
      appointment: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to start consultation", details: error.message });
  }
});

// PUT Complete Consultation (Doctor for self, or Admin)
router.put("/:id/complete-consultation", authenticateToken as any, requireRoles(["DOCTOR", "ADMIN"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true, patient: true },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (req.user?.role === "DOCTOR" && appointment.doctorId !== req.user.doctorId) {
      return res.status(403).json({ error: "Forbidden: You can only complete consultations for your own patients" });
    }

    if (appointment.queueStatus !== "IN_CONSULTATION") {
      return res.status(400).json({
        error: `Cannot complete consultation. Consultation must be IN_CONSULTATION first (current status: ${appointment.queueStatus}).`,
      });
    }

    const now = new Date();
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        queueStatus: "COMPLETED",
        consultationCompletedAt: now,
        status: "CONFIRMED",
      },
      include: {
        patient: true,
        doctor: { include: { department: true } },
        diagnosisRecord: true,
        prescription: true,
      },
    });

    // Notify Patient
    if (appointment.patient?.userId) {
      await prisma.notification.create({
        data: {
          userId: appointment.patient.userId,
          title: "Consultation Completed",
          message: `Your consultation with ${appointment.doctor.name} is complete. You can access your diagnosis report and prescriptions online.`,
        },
      });
    }

    res.json({
      message: "Consultation completed successfully",
      appointment: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to complete consultation", details: error.message });
  }
});

// Book Appointment with Double-Booking Conflict Prevention
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
    if (isNaN(slotDateTime.getTime())) {
      return res.status(400).json({ error: "Invalid slotDateTime timestamp" });
    }

    // 1. Verify working day and working hours
    const dayOfWeek = slotDateTime.getUTCDay();
    const schedule = await getDoctorDaySchedule(validated.doctorId, dayOfWeek);

    if (!schedule.isWorkingDay) {
      return res.status(400).json({
        error: "Doctor does not have consultation hours on this day.",
      });
    }

    const slotHours = slotDateTime.getUTCHours();
    const slotMinutes = slotDateTime.getUTCMinutes();
    const slotTimeMinutes = slotHours * 60 + slotMinutes;
    const startMinutes = parseTimeToMinutes(schedule.startTime);
    const endMinutes = parseTimeToMinutes(schedule.endTime);
    const slotDuration = schedule.slotDuration;

    if (slotTimeMinutes < startMinutes || slotTimeMinutes + slotDuration > endMinutes) {
      return res.status(400).json({
        error: `Requested slot is outside doctor's working hours (${schedule.startTime} - ${schedule.endTime}).`,
      });
    }

    // 2. DOUBLE-BOOKING CONFLICT PREVENTION (Active appointments only)
    const targetStartMs = slotDateTime.getTime();
    const targetEndMs = targetStartMs + slotDuration * 60 * 1000;

    // Check overlapping active appointments for the same doctor
    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        doctorId: validated.doctorId,
        status: { not: "CANCELLED" },
        AND: [
          {
            slotDateTime: {
              gte: new Date(targetStartMs - (slotDuration - 1) * 60 * 1000),
              lt: new Date(targetEndMs),
            },
          },
        ],
      },
    });

    if (conflictingAppointment) {
      return res.status(409).json({
        error: "Conflict: Doctor is already booked for this time slot. Please select another slot.",
        conflict: {
          id: conflictingAppointment.id,
          slotDateTime: conflictingAppointment.slotDateTime,
        },
      });
    }

    // 3. Create appointment and billing record
    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId: validated.doctorId,
        slotDateTime,
        reason: validated.reason,
        notes: validated.notes,
        status: "PENDING",
        queueStatus: "WAITING",
      },
      include: {
        doctor: { include: { department: true } },
        patient: true,
      },
    });

    // Create a pending Bill with invoice number and itemized structure
    const invoiceNumber = await generateInvoiceNumber();
    await prisma.bill.create({
       data: {
         invoiceNumber,
         appointmentId: appointment.id,
         patientId,
         amount: 150.0, // Standard consultation charge
         subtotal: 150.0,
         taxRate: 0,
         taxAmount: 0,
         discountAmount: 0,
         totalAmount: 150.0,
         status: "PENDING",
         paymentStatus: "PENDING",
         items: JSON.stringify([{ description: "General Consultation Fee", cost: 150.0 }]),
         billItems: {
           create: [
             {
               description: `Physician Consultation - ${appointment.doctor.name} (${appointment.doctor.department?.name || "General Practice"})`,
               category: "CONSULTATION",
               quantity: 1,
               unitPrice: 150.0,
               amount: 150.0,
             },
           ],
         },
       },
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
            include: { department: true },
          },
          diagnosisRecord: true,
          prescription: true,
          bill: true,
          vitals: true,
        },
        orderBy: { slotDateTime: "asc" },
      });
    } else if (req.user.role === "DOCTOR") {
      appointments = await prisma.appointment.findMany({
        where: { doctorId: req.user.doctorId },
        include: {
          patient: true,
          diagnosisRecord: true,
          prescription: true,
          vitals: true,
        },
        orderBy: { slotDateTime: "asc" },
      });
    } else {
      // Admin, Receptionist, Pharmacist can view all
      appointments = await prisma.appointment.findMany({
        include: {
          patient: true,
          doctor: {
            include: { department: true },
          },
          diagnosisRecord: true,
          bill: true,
          vitals: true,
        },
        orderBy: { slotDateTime: "asc" },
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
      where: { id },
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
      data: {
        status,
        ...(status === "CANCELLED" ? { queueStatus: "CANCELLED" } : {}),
      },
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
