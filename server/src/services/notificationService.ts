import { Response } from "express";
import prisma from "../db";

export interface SSEClient {
  id: string;
  userId: string;
  role: string;
  res: Response;
}

class NotificationService {
  private clients: Map<string, SSEClient> = new Map();
  private keepAliveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat() {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = setInterval(() => {
      this.clients.forEach((client) => {
        try {
          client.res.write(":keepalive\n\n");
        } catch (err) {
          this.removeClient(client.id);
        }
      });
    }, 25000);
  }

  public addClient(userId: string, role: string, res: Response): string {
    const clientId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Configure SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    });

    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }

    const client: SSEClient = {
      id: clientId,
      userId,
      role,
      res,
    };

    this.clients.set(clientId, client);

    // Send initial connection handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", clientId, userId, role, timestamp: new Date() })}\n\n`);

    res.on("close", () => {
      this.removeClient(clientId);
    });

    return clientId;
  }

  public removeClient(clientId: string) {
    if (this.clients.has(clientId)) {
      const client = this.clients.get(clientId);
      try {
        client?.res.end();
      } catch (e) {
        // ignore
      }
      this.clients.delete(clientId);
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Persist notification in DB and stream in real-time to active user SSE clients.
   */
  public async createAndSendNotification(params: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    link?: string;
    metadata?: any;
  }) {
    const notif = await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type || "SYSTEM",
        link: params.link || null,
        metadata: params.metadata ? (typeof params.metadata === "string" ? params.metadata : JSON.stringify(params.metadata)) : null,
      },
    });

    // Stream SSE to all active connections of this user
    this.clients.forEach((client) => {
      if (client.userId === params.userId) {
        try {
          client.res.write(`event: notification\ndata: ${JSON.stringify(notif)}\n\n`);
        } catch (err) {
          this.removeClient(client.id);
        }
      }
    });

    return notif;
  }

  /**
   * Persist notifications for all users with a specific role and stream in real-time.
   */
  public async notifyRole(
    role: string,
    params: {
      title: string;
      message: string;
      type?: string;
      link?: string;
      metadata?: any;
    }
  ) {
    const users = await prisma.user.findMany({
      where: { role },
      select: { id: true },
    });

    const notifications = await Promise.all(
      users.map((u) =>
        this.createAndSendNotification({
          userId: u.id,
          title: params.title,
          message: params.message,
          type: params.type,
          link: params.link,
          metadata: params.metadata,
        })
      )
    );

    return notifications;
  }

  /**
   * Stream live hospital event to targeted users/roles for instant dashboard updates.
   */
  public broadcastHospitalEvent(
    target: { userIds?: string[]; roles?: string[] },
    eventName: string,
    payload: any
  ) {
    const payloadStr = JSON.stringify({
      event: eventName,
      timestamp: new Date().toISOString(),
      ...payload,
    });

    this.clients.forEach((client) => {
      const matchUser = target.userIds && target.userIds.includes(client.userId);
      const matchRole = target.roles && target.roles.includes(client.role);

      // If no filter specified, broadcast to all; otherwise check match
      const shouldSend = (!target.userIds && !target.roles) || matchUser || matchRole;

      if (shouldSend) {
        try {
          client.res.write(`event: hospital_event\ndata: ${payloadStr}\n\n`);
        } catch (err) {
          this.removeClient(client.id);
        }
      }
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
