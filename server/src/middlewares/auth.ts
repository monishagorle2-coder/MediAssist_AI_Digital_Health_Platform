import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "mediassist_super_secret_jwt_key_12345";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "PATIENT" | "DOCTOR" | "RECEPTIONIST" | "PHARMACIST" | "ADMIN";
    patientId?: string;
    doctorId?: string;
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token is missing" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      patientId: decoded.patientId,
      doctorId: decoded.doctorId,
    };
    next();
  });
}

export function requireRoles(roles: Array<"PATIENT" | "DOCTOR" | "RECEPTIONIST" | "PHARMACIST" | "ADMIN">) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
    }

    next();
  };
}
