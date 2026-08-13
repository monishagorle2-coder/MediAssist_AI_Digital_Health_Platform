import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken } from "../middlewares/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "mediassist_super_secret_jwt_key_12345";

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().min(10),
  dob: z.string(), // ISO date string
  gender: z.string(),
  bloodGroup: z.string(),
  address: z.string(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Patient Self-Registration
router.post("/register", async (req, res) => {
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

// User Login
router.post("/login", async (req, res) => {
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
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

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

    // Audit login
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_LOGIN",
        details: `User logged in: ${user.email} (${user.role})`,
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

// Get current user profile
router.get("/me", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
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
      name: user.doctor?.name || user.patient?.name || "Administrator",
      patient: user.patient,
      doctor: user.doctor,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch user profile", details: error.message });
  }
});

export default router;
