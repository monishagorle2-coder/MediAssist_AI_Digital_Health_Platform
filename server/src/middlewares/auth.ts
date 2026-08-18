import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../db";

const JWT_SECRET = process.env.JWT_SECRET || "mediassist_super_secret_jwt_key_12345";

export type UserRole = "PATIENT" | "DOCTOR" | "RECEPTIONIST" | "PHARMACIST" | "LAB_TECHNICIAN" | "ADMIN";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    patientId?: string;
    doctorId?: string;
  };
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || typeof authHeader !== "string") {
    return res.status(401).json({ error: "Access token is missing or malformed" });
  }

  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer" || !parts[1]) {
    return res.status(401).json({ error: "Invalid authorization format. Expected 'Bearer <token>'" });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({ error: "Invalid token payload structure" });
    }

    // Verify user active state in database
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, isActive: true, role: true },
    });

    if (!dbUser) {
      return res.status(401).json({ error: "User account no longer exists" });
    }

    if (dbUser.isActive === false) {
      return res.status(403).json({ error: "Account has been deactivated. Please contact hospital administration." });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      patientId: decoded.patientId,
      doctorId: decoded.doctorId,
    };

    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Authentication token has expired. Please log in again." });
    }
    return res.status(401).json({ error: "Invalid or corrupt authentication token." });
  }
}

export function requireRoles(roles: Array<UserRole>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized: Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Insufficient role permissions" });
    }

    next();
  };
}
