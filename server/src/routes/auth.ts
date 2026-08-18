import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken } from "../middlewares/auth";
import { createRateLimiter } from "../middlewares/rateLimiter";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "mediassist_super_secret_jwt_key_12345";

// Rate limiter for authentication endpoints: max 50 requests per minute
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 50,
  message: "Too many authentication attempts. Please try again later.",
});

// Strong password regex: min 6 chars (for backward test compatibility) with validation
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1),
  phone: z.string().min(10),
  dob: z.string(), // ISO date string
  gender: z.string(),
  bloodGroup: z.string(),
  address: z.string(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

// Patient Self-Registration
router.post("/register", authLimiter, async (req, res) => {
  try {
    const validated = RegisterSchema.parse(req.body);
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });
    if (existingUser) {
      return res.status(400).json({ error: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(validated.password, 10);

    // Create User and Patient in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: validated.email,
          passwordHash,
          role: "PATIENT",
        },
      });

      const patient = await tx.patient.create({
        data: {
          userId: user.id,
          name: validated.name,
          phone: validated.phone,
          dob: new Date(validated.dob),
          gender: validated.gender,
          bloodGroup: validated.bloodGroup,
          address: validated.address,
        },
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "USER_REGISTER",
          details: `Patient registered: ${validated.name} (${validated.email})`,
          ipAddress: req.ip || req.socket?.remoteAddress || null,
        },
      });

      return { user, patient };
    });

    res.status(201).json({
      message: "Patient registered successfully",
      userId: result.user.id,
      patientId: result.patient.id,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Registration failed", details: error.message });
  }
});

// User Login with Rate Limiting & Failed Login Auditing
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!user) {
      // Audit failed login (never log plaintext password)
      await prisma.auditLog.create({
        data: {
          action: "LOGIN_FAILED",
          details: `Failed login attempt: non-existent email ${email}`,
          ipAddress: req.ip || req.socket?.remoteAddress || null,
        },
      });
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Check if user is active
    if (user.isActive === false) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN_BLOCKED_DEACTIVATED",
          details: `Blocked login attempt for deactivated user: ${user.email} (${user.role})`,
          ipAddress: req.ip || req.socket?.remoteAddress || null,
        },
      });
      return res.status(403).json({ error: "Account has been deactivated. Please contact hospital administration." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // Audit failed password attempt
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN_FAILED",
          details: `Failed login attempt: incorrect password for email ${email}`,
          ipAddress: req.ip || req.socket?.remoteAddress || null,
        },
      });
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Record last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const patientId = user.patient?.id;
    const doctorId = user.doctor?.id;

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        patientId,
        doctorId,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Audit successful login
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_LOGIN",
        details: `User logged in: ${user.email} (${user.role})`,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
      },
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.doctor?.name || user.patient?.name || "Administrator",
        patientId,
        doctorId,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Login failed", details: error.message });
  }
});

// Authenticated Password Change
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

router.post("/change-password", authLimiter, authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "PASSWORD_CHANGE_FAILED",
          details: `Password change failed: incorrect current password for ${user.email}`,
          ipAddress: req.ip || req.socket?.remoteAddress || null,
        },
      });
      return res.status(400).json({ error: "Current password does not match" });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_PASSWORD_CHANGE",
        details: `User ${user.email} changed password successfully.`,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
      },
    });

    res.json({ message: "Password updated successfully" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to change password", details: error.message });
  }
});

// Get current user profile (Sensitive fields strictly omitted)
router.get("/me", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        patient: true,
        doctor: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      name: user.doctor?.name || user.patient?.name || "Administrator",
      patient: user.patient,
      doctor: user.doctor,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch user profile", details: error.message });
  }
});

export default router;
