import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import authRoutes from "./routes/auth";
import appointmentRoutes from "./routes/appointments";
import diagnosisRoutes from "./routes/diagnosis";
import aiRoutes from "./routes/ai";
import pharmacyRoutes from "./routes/pharmacy";
import hospitalRoutes from "./routes/hospital";
import labRoutes from "./routes/lab";
import billingRoutes from "./routes/billing";
import notificationRoutes from "./routes/notifications";
import medicalRecordsRoutes from "./routes/medicalRecords";
import adminRoutes from "./routes/admin";
import communicationRoutes from "./routes/communications";

const app = express();
const PORT = process.env.PORT || 5000;

const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : isProduction
  ? []
  : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000", "http://localhost:5000"];

// 1. Disable server fingerprinting
app.disable("x-powered-by");

// 2. HTTP Security Headers Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// 3. CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!isProduction) {
        if (
          allowedOrigins.includes(origin) ||
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:")
        ) {
          return callback(null, true);
        }
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin '${origin}' not allowed by policy.`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 4. Request Body Size Limiting
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 5. Routes
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/diagnosis", diagnosisRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/lab", labRoutes);
app.use("/api/bills", billingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/communications", communicationRoutes);
app.use("/api/medical-records", medicalRecordsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", hospitalRoutes); // Mounts general hospital, departments, patients, admin stats

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// 6. Global 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// 7. Global Error Handler (Hides stack traces in production)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";

  console.error(`[Unhandled Error] ${req.method} ${req.path}:`, err.message || err);

  res.status(statusCode).json({
    error: isProd ? "An internal server error occurred" : err.message || "An unexpected error occurred",
    ...(isProd ? {} : { stack: err.stack }),
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`MediAssist Server running on port ${PORT}`);
});
