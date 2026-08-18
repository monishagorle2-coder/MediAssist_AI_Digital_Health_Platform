import { Router, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../db";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth";
import { notificationService } from "../services/notificationService";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "mediassist_super_secret_jwt_key_12345";

// Middleware to support token in query string specifically for EventSource / SSE
const authenticateSSE = (req: any, res: Response, next: any) => {
  const authHeader = req.headers["authorization"];
  let token = authHeader && authHeader.split(" ")[1];

  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token for real-time stream" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: "Forbidden: Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// GET Real-Time SSE Stream
router.get("/stream", authenticateSSE as any, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const role = req.user!.role;

  notificationService.addClient(userId, role, res);
});

// GET Notifications for Current User
router.get("/", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const unreadOnly = req.query.unreadOnly === "true";
    const limit = parseInt(req.query.limit as string) || 50;

    const whereClause: any = { userId };
    if (unreadOnly) {
      whereClause.read = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Unread Count
router.get("/unread-count", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const count = await prisma.notification.count({
      where: { userId, read: false },
    });
    res.json({ unreadCount: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT Mark All Read
router.put("/read-all", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    res.json({ message: "All notifications marked as read", updatedCount: result.count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT Mark Single Notification Read (With Ownership Isolation)
router.put("/:id/read", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const existing = await prisma.notification.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (existing.userId !== userId) {
      return res.status(403).json({ error: "Forbidden: You cannot modify another user's notification" });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE Notification (With Ownership Isolation)
router.delete("/:id", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const existing = await prisma.notification.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (existing.userId !== userId) {
      return res.status(403).json({ error: "Forbidden: You cannot delete another user's notification" });
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json({ message: "Notification deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
