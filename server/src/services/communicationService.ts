import prisma from "../db";
import { notificationService } from "./notificationService";

// Provider Interfaces
export interface EmailProvider {
  sendEmail(to: string, subject: string, bodyText: string, bodyHtml?: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface SmsProvider {
  sendSms(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// In-Memory Mock Email Provider
export class MockEmailProvider implements EmailProvider {
  public sentEmails: Array<{ to: string; subject: string; bodyText: string; sentAt: Date }> = [];
  public shouldFail: boolean = false;

  async sendEmail(to: string, subject: string, bodyText: string, bodyHtml?: string) {
    if (this.shouldFail) {
      return { success: false, error: "Mock SMTP Connection Timeout" };
    }
    const messageId = `email-mock-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    this.sentEmails.push({ to, subject, bodyText, sentAt: new Date() });
    return { success: true, messageId };
  }
}

// In-Memory Mock SMS Provider
export class MockSmsProvider implements SmsProvider {
  public sentSms: Array<{ to: string; message: string; sentAt: Date }> = [];
  public shouldFail: boolean = false;

  async sendSms(to: string, message: string) {
    if (this.shouldFail) {
      return { success: false, error: "Mock SMS Gateway 503 Service Unavailable" };
    }
    const messageId = `sms-mock-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    this.sentSms.push({ to, message, sentAt: new Date() });
    return { success: true, messageId };
  }
}

// Singleton instances
export const emailProvider = new MockEmailProvider();
export const smsProvider = new MockSmsProvider();

export type CommunicationCategory = "APPOINTMENT" | "LAB" | "BILLING" | "CLINICAL" | "SYSTEM";

export interface SendCommunicationOptions {
  userId?: string;
  patientId?: string;
  category: CommunicationCategory;
  type: string; // e.g. "APPOINTMENT_CONFIRMATION", "LAB_REPORT_READY", etc.
  title: string;
  message: string;
  recipientEmail?: string;
  recipientPhone?: string;
  link?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
  relatedEntityId?: string;
  ipAddress?: string;
}

export class CommunicationService {
  /**
   * Dispatches communications across in-app, email, and SMS channels while respecting patient preferences.
   * Fully non-blocking and retry-safe: failure in external delivery will not break caller database transactions.
   */
  public static async dispatch(options: SendCommunicationOptions): Promise<{
    inAppSent: boolean;
    emailSent: boolean;
    smsSent: boolean;
    isDuplicate: boolean;
  }> {
    const result = {
      inAppSent: false,
      emailSent: false,
      smsSent: false,
      isDuplicate: false,
    };

    try {
      // 1. Idempotency check
      if (options.idempotencyKey) {
        const existingLog = await prisma.communicationLog.findFirst({
          where: {
            OR: [
              { idempotencyKey: options.idempotencyKey },
              { idempotencyKey: `${options.idempotencyKey}-IN_APP` },
              { idempotencyKey: `${options.idempotencyKey}-EMAIL` },
              { idempotencyKey: `${options.idempotencyKey}-SMS` },
            ],
          },
        });
        if (existingLog) {
          result.isDuplicate = true;
          return result;
        }
      }

      // 2. Fetch User & Notification Preferences
      let targetUserId = options.userId;
      let recipientEmail = options.recipientEmail;
      let recipientPhone = options.recipientPhone;

      if (!targetUserId && options.patientId) {
        const patient = await prisma.patient.findUnique({
          where: { id: options.patientId },
          include: { user: true },
        });
        if (patient) {
          targetUserId = patient.userId;
          recipientEmail = recipientEmail || patient.user?.email;
          recipientPhone = recipientPhone || patient.phone;
        }
      }

      let preferences = null;
      if (targetUserId) {
        preferences = await prisma.notificationPreference.findUnique({
          where: { userId: targetUserId },
        });

        // If no preference record exists yet, create default
        if (!preferences) {
          preferences = await prisma.notificationPreference.create({
            data: {
              userId: targetUserId,
              appointmentReminders: true,
              labResults: true,
              billingAlerts: true,
              clinicalUpdates: true,
              emailEnabled: true,
              smsEnabled: true,
              inAppEnabled: true,
            },
          });
        }
      }

      // Check category-specific opt-in
      const isCategoryEnabled = (cat: CommunicationCategory, prefs: any) => {
        if (!prefs) return true;
        switch (cat) {
          case "APPOINTMENT":
            return prefs.appointmentReminders;
          case "LAB":
            return prefs.labResults;
          case "BILLING":
            return prefs.billingAlerts;
          case "CLINICAL":
            return prefs.clinicalUpdates;
          default:
            return true;
        }
      };

      const categoryAllowed = isCategoryEnabled(options.category, preferences);

      // 3. IN-APP Notification Channel
      const inAppAllowed = !preferences || (preferences.inAppEnabled && categoryAllowed);
      if (targetUserId && inAppAllowed) {
        try {
          await notificationService.createAndSendNotification({
            userId: targetUserId,
            title: options.title,
            message: options.message,
            type: options.category,
            link: options.link,
            metadata: options.metadata,
          });

          await prisma.communicationLog.create({
            data: {
              userId: targetUserId,
              type: options.type,
              channel: "IN_APP",
              recipient: targetUserId,
              title: options.title,
              content: options.message,
              status: "SENT",
              idempotencyKey: options.idempotencyKey ? `${options.idempotencyKey}-IN_APP` : undefined,
              relatedEntityId: options.relatedEntityId,
            },
          });

          result.inAppSent = true;
        } catch (e: any) {
          console.error("Failed to create in-app notification:", e.message);
        }
      }

      // 4. EMAIL Channel
      const emailAllowed = preferences ? (preferences.emailEnabled && categoryAllowed) : true;
      if (recipientEmail && emailAllowed) {
        try {
          const emailRes = await emailProvider.sendEmail(
            recipientEmail,
            `[MediAssist] ${options.title}`,
            options.message,
            `<div style="font-family: sans-serif; padding: 20px;"><h2>${options.title}</h2><p>${options.message}</p></div>`
          );

          await prisma.communicationLog.create({
            data: {
              userId: targetUserId,
              type: options.type,
              channel: "EMAIL",
              recipient: recipientEmail,
              title: options.title,
              content: options.message,
              status: emailRes.success ? "SENT" : "FAILED",
              failureReason: emailRes.error,
              idempotencyKey: options.idempotencyKey ? `${options.idempotencyKey}-EMAIL` : undefined,
              relatedEntityId: options.relatedEntityId,
            },
          });

          result.emailSent = emailRes.success;
        } catch (e: any) {
          console.error("Email dispatch failed:", e.message);
        }
      } else if (recipientEmail && !emailAllowed) {
        await prisma.communicationLog.create({
          data: {
            userId: targetUserId,
            type: options.type,
            channel: "EMAIL",
            recipient: recipientEmail,
            title: options.title,
            content: options.message,
            status: "SKIPPED_PREFERENCE",
            failureReason: "User opted out of email for this category",
            idempotencyKey: options.idempotencyKey ? `${options.idempotencyKey}-EMAIL` : undefined,
            relatedEntityId: options.relatedEntityId,
          },
        });
      }

      // 5. SMS Channel
      const smsAllowed = preferences ? (preferences.smsEnabled && categoryAllowed) : true;
      if (recipientPhone && smsAllowed) {
        try {
          const smsRes = await smsProvider.sendSms(
            recipientPhone,
            `[MediAssist] ${options.title}: ${options.message}`
          );

          await prisma.communicationLog.create({
            data: {
              userId: targetUserId,
              type: options.type,
              channel: "SMS",
              recipient: recipientPhone,
              title: options.title,
              content: options.message,
              status: smsRes.success ? "SENT" : "FAILED",
              failureReason: smsRes.error,
              idempotencyKey: options.idempotencyKey ? `${options.idempotencyKey}-SMS` : undefined,
              relatedEntityId: options.relatedEntityId,
            },
          });

          result.smsSent = smsRes.success;
        } catch (e: any) {
          console.error("SMS dispatch failed:", e.message);
        }
      } else if (recipientPhone && !smsAllowed) {
        await prisma.communicationLog.create({
          data: {
            userId: targetUserId,
            type: options.type,
            channel: "SMS",
            recipient: recipientPhone,
            title: options.title,
            content: options.message,
            status: "SKIPPED_PREFERENCE",
            failureReason: "User opted out of SMS for this category",
            idempotencyKey: options.idempotencyKey ? `${options.idempotencyKey}-SMS` : undefined,
            relatedEntityId: options.relatedEntityId,
          },
        });
      }

      // 6. Security Audit Log for important events
      await prisma.auditLog.create({
        data: {
          userId: targetUserId,
          action: "COMMUNICATION_DISPATCHED",
          details: `Dispatched communication '${options.type}' for recipient ${recipientEmail || recipientPhone || targetUserId} (Category: ${options.category})`,
          ipAddress: options.ipAddress || null,
        },
      });

    } catch (error: any) {
      console.error("CommunicationService.dispatch encountered unexpected error:", error.message);
    }

    return result;
  }
}
