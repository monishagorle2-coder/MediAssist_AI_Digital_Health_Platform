import express from "express";
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

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: "*", // allow all origins for development ease
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/diagnosis", diagnosisRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api", hospitalRoutes); // Mounts general hospital, billing, admin stats

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// Start Server
app.listen(PORT, () => {
  console.log(`MediAssist Server running on port ${PORT}`);
});
