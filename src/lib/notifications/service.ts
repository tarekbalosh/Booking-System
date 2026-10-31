import "server-only";
import { Prisma, type NotificationLog } from "@prisma/client";
import { getDb } from "@/lib/db/prisma";
import { getWhatsAppConfig } from "@/lib/env";
import { MAX_NOTIFICATION_ATTEMPTS } from "@/lib/constants";
import { buildNotificationBody, type NotificationBooking, type NotificationType } from "@/lib/notifications/messages";
import { sendWhatsAppText } from "@/lib/notifications/whatsapp";

type CreateLogResult = { log: NotificationLog; created: boolean };

async function createLog(
  booking: NotificationBooking,
  type: NotificationType,
  recipient: string,
): Promise<CreateLogResult> {
  const db = getDb();
  const configured = getWhatsAppConfig() !== null;
  try {
    const log = await db.notificationLog.create({
      data: {
        bookingId: booking.id,
        channel: "WHATSAPP",
        recipient: recipient || "unconfigured",
        notificationType: type,
        idempotencyKey: `${booking.id}:${type}`,
        status: configured ? "PENDING" : "SKIPPED",
        errorCode: configured ? null : "NOT_CONFIGURED",
      },
    });
    return { log, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.notificationLog.findUnique({
        where: { idempotencyKey: `${booking.id}:${type}` },
      });
      if (existing) return { log: existing, created: false };
    }
    throw error;
  }
}

async function deliver(
  log: NotificationLog,
  booking: NotificationBooking,
  type: NotificationType,
  incrementAttempt: boolean,
): Promise<"SENT" | "FAILED" | "SKIPPED"> {
  const db = getDb();
  const config = getWhatsAppConfig();
  if (!config) {
    await db.notificationLog.update({
      where: { id: log.id },
      data: { status: "SKIPPED", errorCode: "NOT_CONFIGURED" },
    });
    return "SKIPPED";
  }

  const recipientLocale = booking.locale === "en" ? "en" : "ar";
  const body = buildNotificationBody(type, booking, recipientLocale);

  const updated = await db.notificationLog.update({
    where: { id: log.id },
    data: {
      status: "PENDING",
      attempts: incrementAttempt ? { increment: 1 } : undefined,
      errorCode: null,
    },
  });

  const result = await sendWhatsAppText(config, log.recipient, body);

  if (result.ok) {
    await db.notificationLog.update({
      where: { id: log.id },
      data: {
        status: "SENT",
        providerMessageId: result.messageId,
        errorCode: null,
        sentAt: new Date(),
        attempts: updated.attempts,
      },
    });
    return "SENT";
  }

  await db.notificationLog.update({
    where: { id: log.id },
    data: {
      status: "FAILED",
      errorCode: result.errorCode.slice(0, 64),
      attempts: updated.attempts,
    },
  });
  return "FAILED";
}

/** New request -> admin notification. Never throws to the booking flow. */
export async function notifyAdminsOfNewBooking(booking: NotificationBooking): Promise<void> {
  try {
    const config = getWhatsAppConfig();
    const recipient =
      config?.adminPhone ?? process.env.WHATSAPP_ADMIN_PHONE?.trim() ?? "";
    const { log, created } = await createLog(booking, "NEW_BOOKING_ADMIN", recipient);
    if (!created) return;
    if (!config) return;
    await deliver(log, booking, "NEW_BOOKING_ADMIN", true);
  } catch {
    // Booking creation must succeed even when notifications fail.
  }
}

/** Approval/rejection -> customer notification, sent after the DB commit. */
export async function notifyCustomerOfDecision(
  booking: NotificationBooking,
  decision: "APPROVED" | "REJECTED",
): Promise<void> {
  try {
    const type: NotificationType =
      decision === "APPROVED" ? "CUSTOMER_APPROVED" : "CUSTOMER_REJECTED";
    const { log, created } = await createLog(booking, type, booking.customerPhone);
    if (!created) return;
    if (!getWhatsAppConfig()) return;
    await deliver(log, booking, type, true);
  } catch {
    // A decision must never be rolled back because WhatsApp is unavailable.
  }
}

export type RetryResult =
  | { ok: true; status: "SENT" }
  | { ok: false; code: "NOT_FOUND" | "ALREADY_SENT" | "MAX_ATTEMPTS" | "NOT_CONFIGURED" | "NOT_RETRYABLE" };

/** Admin-triggered retry with an atomic claim to prevent duplicate sends. */
export async function retryNotification(logId: string): Promise<RetryResult> {
  const db = getDb();
  const log = await db.notificationLog.findUnique({
    where: { id: logId },
    include: {
      booking: { include: { service: true, method: true } },
    },
  });
  if (!log) return { ok: false, code: "NOT_FOUND" };
  if (log.status === "SENT") return { ok: false, code: "ALREADY_SENT" };
  if (log.attempts >= MAX_NOTIFICATION_ATTEMPTS) return { ok: false, code: "MAX_ATTEMPTS" };
  if (!getWhatsAppConfig()) return { ok: false, code: "NOT_CONFIGURED" };

  const claimed = await db.$executeRaw`
    UPDATE "NotificationLog"
    SET status = 'PENDING'::"NotificationStatus",
        attempts = attempts + 1,
        "errorCode" = NULL,
        "updatedAt" = NOW()
    WHERE id = ${logId}::uuid
      AND status IN ('FAILED'::"NotificationStatus", 'SKIPPED'::"NotificationStatus")
      AND attempts < ${MAX_NOTIFICATION_ATTEMPTS}
  `;
  if (claimed === 0) return { ok: false, code: "NOT_RETRYABLE" };

  const type = log.notificationType as NotificationType;
  if (!["NEW_BOOKING_ADMIN", "CUSTOMER_APPROVED", "CUSTOMER_REJECTED"].includes(type)) {
    return { ok: false, code: "NOT_RETRYABLE" };
  }

  const fresh = await db.notificationLog.findUnique({ where: { id: logId } });
  if (!fresh) return { ok: false, code: "NOT_FOUND" };

  const status = await deliver(fresh, log.booking, type, false);
  return status === "SENT" ? { ok: true, status: "SENT" } : { ok: false, code: "NOT_CONFIGURED" };
}
