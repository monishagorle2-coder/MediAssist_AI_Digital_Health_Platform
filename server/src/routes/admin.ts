import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken, requireRoles } from "../middlewares/auth";

const router = Router();

// All routes in this router require ADMIN authentication
router.use(authenticateToken as any);
router.use(requireRoles(["ADMIN"]));

// Helper: parse date filter range
function parseDateRange(query: any) {
  const { range, startDate, endDate } = query;
  const now = new Date();
  let start: Date | undefined;
  let end: Date = new Date();

  if (range === "today") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  } else if (range === "7d") {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === "30d") {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (range === "month") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  } else if (startDate) {
    start = new Date(startDate);
    if (endDate) end = new Date(endDate);
  }

  return { start, end };
}

// ====================================================================
// 1. ADMIN USER MANAGEMENT
// ====================================================================

// GET /api/admin/users - List all users with filtering and search
router.get("/users", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, role, status, page = "1", limit = "50" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (role && role !== "ALL") {
      where.role = role as string;
    }

    if (status === "ACTIVE") {
      where.isActive = true;
    } else if (status === "INACTIVE") {
      where.isActive = false;
    }

    if (search) {
      const searchStr = (search as string).trim();
      where.OR = [
        { email: { contains: searchStr, mode: "insensitive" } },
        { doctor: { name: { contains: searchStr, mode: "insensitive" } } },
        { patient: { name: { contains: searchStr, mode: "insensitive" } } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          patient: {
            select: {
              id: true,
              name: true,
              phone: true,
              gender: true,
              bloodGroup: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              specialization: true,
              phone: true,
              department: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
    ]);

    const formattedUsers = users.map((u) => {
      const displayName = u.doctor?.name || u.patient?.name || (u.role === "ADMIN" ? "System Administrator" : u.email.split("@")[0]);
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        name: displayName,
        phone: u.doctor?.phone || u.patient?.phone || "N/A",
        details: u.doctor
          ? `${u.doctor.specialization} (${u.doctor.department?.name || "General"})`
          : u.patient
          ? `${u.patient.gender}, Blood: ${u.patient.bloodGroup}`
          : "Hospital Staff / Admin",
        patient: u.patient,
        doctor: u.doctor,
      };
    });

    res.json({
      users: formattedUsers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch user directory", details: error.message });
  }
});

// PUT /api/admin/users/:id/status - Activate / Deactivate user
const ToggleStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().optional(),
});

router.put("/users/:id/status", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive, reason } = ToggleStatusSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id },
      include: { doctor: true, patient: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Protect against admin deactivating their own account
    if (user.id === req.user?.id && !isActive) {
      return res.status(400).json({ error: "Administrators cannot deactivate their own account" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        updatedAt: true,
      },
    });

    const action = isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED";
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action,
        details: `Admin ${req.user?.email} ${isActive ? "activated" : "deactivated"} user ${user.email} (${user.role}). Reason: ${reason || "Administrative Action"}`,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
      },
    });

    res.json({
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      user: updated,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update user status", details: error.message });
  }
});

// PUT /api/admin/users/:id/profile - Edit staff / user profile
const EditStaffProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  departmentId: z.string().optional(),
  address: z.string().optional(),
});

router.put("/users/:id/profile", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = EditStaffProfileSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id },
      include: { doctor: true, patient: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.$transaction(async (tx) => {
      if (user.doctor) {
        await tx.doctor.update({
          where: { userId: id },
          data: {
            name: validated.name,
            phone: validated.phone || user.doctor.phone,
            specialization: validated.specialization || user.doctor.specialization,
            departmentId: validated.departmentId || user.doctor.departmentId,
          },
        });
      } else if (user.patient) {
        await tx.patient.update({
          where: { userId: id },
          data: {
            name: validated.name,
            phone: validated.phone || user.patient.phone,
            address: validated.address || user.patient.address,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: "STAFF_PROFILE_UPDATED",
          details: `Admin ${req.user?.email} updated profile for user ${user.email} (${user.role}): Name=${validated.name}`,
          ipAddress: req.ip || req.socket?.remoteAddress || null,
        },
      });
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id },
      include: { doctor: { include: { department: true } }, patient: true },
    });

    res.json({
      message: "User profile updated successfully",
      user: updatedUser,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update staff profile", details: error.message });
  }
});

// POST /api/admin/users/:id/reset-password - Admin password reset workflow
const AdminResetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  notifyUser: z.boolean().optional(),
});

router.post("/users/:id/reset-password", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = AdminResetPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: "USER_PASSWORD_RESET_BY_ADMIN",
        details: `Admin ${req.user?.email} reset password for user ${user.email} (${user.role})`,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
      },
    });

    res.json({ message: `Password for ${user.email} has been successfully reset.` });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to reset user password", details: error.message });
  }
});

// ====================================================================
// 2. HOSPITAL & DEPARTMENT ANALYTICS
// ====================================================================

// GET /api/admin/analytics/overview - KPI Summary with date-range filter
router.get("/analytics/overview", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start, end } = parseDateRange(req.query);

    const appDateFilter: any = {};
    const billDateFilter: any = {};
    const patientDateFilter: any = {};

    if (start) {
      appDateFilter.slotDateTime = { gte: start, lte: end };
      billDateFilter.createdAt = { gte: start, lte: end };
      patientDateFilter.createdAt = { gte: start, lte: end };
    }

    const [
      totalPatients,
      periodPatients,
      totalDoctors,
      activeStaffCount,
      totalAppointments,
      completedConsultations,
      bills,
      totalLabOrders,
      lowStockMedicines,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.patient.count({ where: patientDateFilter }),
      prisma.doctor.count(),
      prisma.user.count({ where: { isActive: true, role: { in: ["DOCTOR", "RECEPTIONIST", "PHARMACIST", "LAB_TECHNICIAN", "ADMIN"] } } }),
      prisma.appointment.count({ where: appDateFilter }),
      prisma.appointment.count({ where: { ...appDateFilter, queueStatus: "COMPLETED" } }),
      prisma.bill.findMany({ where: billDateFilter }),
      prisma.labOrder.count({ where: start ? { createdAt: { gte: start, lte: end } } : {} }),
      prisma.medicine.count({ where: { stock: { lte: 10 } } }),
    ]);

    const paidBills = bills.filter((b) => b.status === "PAID" || b.paymentStatus === "PAID");
    const totalRevenue = paidBills.reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0);

    const pendingBills = bills.filter((b) => b.status === "PENDING" || b.paymentStatus === "PENDING");
    const pendingDue = pendingBills.reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0);

    res.json({
      kpi: {
        totalPatients,
        periodPatients,
        totalDoctors,
        activeStaffCount,
        totalAppointments,
        completedConsultations,
        totalRevenue,
        pendingDue,
        totalLabOrders,
        lowStockMedicines,
      },
      filter: {
        range: req.query.range || "all",
        start: start ? start.toISOString() : null,
        end: end ? end.toISOString() : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate analytics overview", details: error.message });
  }
});

// GET /api/admin/analytics/departments - Department breakdown & performance
router.get("/analytics/departments", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start, end } = parseDateRange(req.query);

    const departments = await prisma.department.findMany({
      include: {
        doctors: {
          include: {
            appointments: {
              where: start ? { slotDateTime: { gte: start, lte: end } } : {},
              include: {
                bill: true,
                diagnosisRecord: true,
              },
            },
          },
        },
      },
    });

    const departmentStats = departments.map((dept) => {
      let totalAppointments = 0;
      let completedConsultations = 0;
      let departmentRevenue = 0;
      const patientIdSet = new Set<string>();

      for (const doc of dept.doctors) {
        for (const app of doc.appointments) {
          totalAppointments++;
          patientIdSet.add(app.patientId);

          if (app.queueStatus === "COMPLETED" || app.status === "CONFIRMED") {
            completedConsultations++;
          }

          if (app.bill && (app.bill.status === "PAID" || app.bill.paymentStatus === "PAID")) {
            departmentRevenue += (app.bill.totalAmount ?? app.bill.amount);
          }
        }
      }

      return {
        id: dept.id,
        name: dept.name,
        description: dept.description,
        doctorCount: dept.doctors.length,
        uniquePatients: patientIdSet.size,
        totalAppointments,
        completedConsultations,
        revenue: departmentRevenue,
      };
    });

    res.json({
      departments: departmentStats,
      totalDepartments: departments.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch department analytics", details: error.message });
  }
});

// GET /api/admin/analytics/trends - Longitudinal revenue & patient visit trends
router.get("/analytics/trends", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [appointments, bills, queueStatusDistribution] = await Promise.all([
      prisma.appointment.findMany({
        where: { slotDateTime: { gte: sinceDate } },
        select: { slotDateTime: true, queueStatus: true },
        orderBy: { slotDateTime: "asc" },
      }),
      prisma.bill.findMany({
        where: { createdAt: { gte: sinceDate } },
        select: { createdAt: true, status: true, paymentStatus: true, totalAmount: true, amount: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.appointment.groupBy({
        by: ["queueStatus"],
        _count: { id: true },
      }),
    ]);

    // Aggregate by Date (YYYY-MM-DD)
    const trendMap = new Map<string, { date: string; appointments: number; revenue: number }>();

    for (let i = 0; i < days; i++) {
      const d = new Date(sinceDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateKey = d.toISOString().split("T")[0];
      trendMap.set(dateKey, { date: dateKey, appointments: 0, revenue: 0 });
    }

    for (const app of appointments) {
      const dateKey = app.slotDateTime.toISOString().split("T")[0];
      if (trendMap.has(dateKey)) {
        trendMap.get(dateKey)!.appointments++;
      }
    }

    for (const bill of bills) {
      if (bill.status === "PAID" || bill.paymentStatus === "PAID") {
        const dateKey = bill.createdAt.toISOString().split("T")[0];
        if (trendMap.has(dateKey)) {
          trendMap.get(dateKey)!.revenue += (bill.totalAmount ?? bill.amount);
        }
      }
    }

    const trends = Array.from(trendMap.values());

    const statusCounts = {
      WAITING: 0,
      CHECKED_IN: 0,
      IN_CONSULTATION: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      NO_SHOW: 0,
    };

    for (const item of queueStatusDistribution) {
      if (item.queueStatus in statusCounts) {
        (statusCounts as any)[item.queueStatus] = item._count.id;
      }
    }

    res.json({
      days,
      trends,
      statusDistribution: statusCounts,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch analytics trends", details: error.message });
  }
});

// ====================================================================
// 3. AUDIT LOG MANAGEMENT
// ====================================================================

// GET /api/admin/audit-logs - Filterable and searchable audit trail
router.get("/audit-logs", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, role, userId, search, startDate, endDate, page = "1", limit = "50" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (action && action !== "ALL") {
      where.action = action as string;
    }

    if (userId) {
      where.userId = userId as string;
    }

    if (role && role !== "ALL") {
      where.user = { role: role as string };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    if (search) {
      const searchStr = (search as string).trim();
      where.OR = [
        { details: { contains: searchStr, mode: "insensitive" } },
        { action: { contains: searchStr, mode: "insensitive" } },
        { user: { email: { contains: searchStr, mode: "insensitive" } } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              doctor: { select: { name: true } },
              patient: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
    ]);

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      action: log.action,
      details: log.details,
      ipAddress: log.ipAddress || "Internal / Local",
      actor: log.user
        ? {
            id: log.user.id,
            email: log.user.email,
            role: log.user.role,
            name: log.user.doctor?.name || log.user.patient?.name || (log.user.role === "ADMIN" ? "Admin" : log.user.email),
          }
        : { email: "System", role: "SYSTEM", name: "System Process" },
    }));

    res.json({
      logs: formattedLogs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch audit logs", details: error.message });
  }
});

// ====================================================================
// 4. REPORT EXPORT (CSV)
// ====================================================================

// Helper: Escape CSV fields
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// GET /api/admin/reports/users/csv - CSV User Directory
router.get("/reports/users/csv", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        doctor: { include: { department: true } },
        patient: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = ["User ID", "Name", "Email", "Role", "Status", "Phone", "Details", "Last Login", "Registered Date"];
    const rows = users.map((u) => {
      const name = u.doctor?.name || u.patient?.name || (u.role === "ADMIN" ? "Administrator" : u.email.split("@")[0]);
      const phone = u.doctor?.phone || u.patient?.phone || "N/A";
      const details = u.doctor
        ? `${u.doctor.specialization} - ${u.doctor.department?.name}`
        : u.patient
        ? `Gender: ${u.patient.gender}, Blood: ${u.patient.bloodGroup}`
        : "Hospital Staff";

      return [
        escapeCsv(u.id),
        escapeCsv(name),
        escapeCsv(u.email),
        escapeCsv(u.role),
        escapeCsv(u.isActive ? "ACTIVE" : "INACTIVE"),
        escapeCsv(phone),
        escapeCsv(details),
        escapeCsv(u.lastLoginAt ? u.lastLoginAt.toISOString() : "Never"),
        escapeCsv(u.createdAt.toISOString()),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="mediassist_users_directory.csv"');
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to export user CSV", details: error.message });
  }
});

// GET /api/admin/reports/departments/csv - CSV Department Analytics
router.get("/reports/departments/csv", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        doctors: {
          include: {
            appointments: {
              include: { bill: true },
            },
          },
        },
      },
    });

    const headers = ["Department ID", "Department Name", "Description", "Doctor Count", "Unique Patients", "Total Appointments", "Total Revenue ($)"];
    const rows = departments.map((d) => {
      let totalAppointments = 0;
      let revenue = 0;
      const patientIdSet = new Set<string>();

      for (const doc of d.doctors) {
        for (const app of doc.appointments) {
          totalAppointments++;
          patientIdSet.add(app.patientId);
          if (app.bill && (app.bill.status === "PAID" || app.bill.paymentStatus === "PAID")) {
            revenue += (app.bill.totalAmount ?? app.bill.amount);
          }
        }
      }

      return [
        escapeCsv(d.id),
        escapeCsv(d.name),
        escapeCsv(d.description),
        escapeCsv(d.doctors.length),
        escapeCsv(patientIdSet.size),
        escapeCsv(totalAppointments),
        escapeCsv(revenue.toFixed(2)),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="mediassist_department_analytics.csv"');
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to export department CSV", details: error.message });
  }
});

// GET /api/admin/reports/audit-logs/csv - CSV Audit Trail
router.get("/reports/audit-logs/csv", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        user: { select: { email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    const headers = ["Log ID", "Timestamp", "Actor Email", "Actor Role", "Action", "Details", "IP Address"];
    const rows = logs.map((l) => [
      escapeCsv(l.id),
      escapeCsv(l.createdAt.toISOString()),
      escapeCsv(l.user?.email || "SYSTEM"),
      escapeCsv(l.user?.role || "SYSTEM"),
      escapeCsv(l.action),
      escapeCsv(l.details),
      escapeCsv(l.ipAddress || "Internal"),
    ].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="mediassist_audit_logs.csv"');
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to export audit logs CSV", details: error.message });
  }
});

// GET /api/admin/reports/revenue/csv - CSV Revenue and Billing Breakdown
router.get("/reports/revenue/csv", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bills = await prisma.bill.findMany({
      include: {
        patient: { select: { name: true, phone: true } },
        appointment: { include: { doctor: true } },
        billItems: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = ["Invoice Number", "Patient Name", "Doctor Name", "Subtotal ($)", "Tax ($)", "Discount ($)", "Total Amount ($)", "Payment Status", "Payment Method", "Transaction Ref", "Issued Date", "Paid Date"];
    const rows = bills.map((b) => [
      escapeCsv(b.invoiceNumber || b.id.slice(0, 8)),
      escapeCsv(b.patient?.name || "N/A"),
      escapeCsv(b.appointment?.doctor?.name || "Hospital Service"),
      escapeCsv((b.subtotal ?? b.amount).toFixed(2)),
      escapeCsv((b.taxAmount ?? 0).toFixed(2)),
      escapeCsv((b.discountAmount ?? 0).toFixed(2)),
      escapeCsv((b.totalAmount ?? b.amount).toFixed(2)),
      escapeCsv(b.paymentStatus || b.status),
      escapeCsv(b.paymentMethod || "CASH"),
      escapeCsv(b.transactionReference || "N/A"),
      escapeCsv(b.createdAt.toISOString()),
      escapeCsv(b.paidAt ? b.paidAt.toISOString() : "Unpaid"),
    ].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="mediassist_revenue_report.csv"');
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to export revenue CSV", details: error.message });
  }
});

export default router;
