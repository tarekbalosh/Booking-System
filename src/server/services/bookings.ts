import "server-only";
import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db/prisma";
import { HOLD_MINUTES } from "@/lib/constants";
import { addDaysToKey, dateKeyInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import {
  getDayAvailability,
  isWithinBookingWindow,
  type AvailabilityExceptionInput,
  type AvailabilityRuleInput,
  type BookedInterval,
} from "@/lib/booking/availability";
import {
  generateAccessToken,
  generatePublicReference,
  hashAccessToken,
  safeTokenEquals,
} from "@/lib/booking/reference";
import { canCancel, canReject } from "@/lib/booking/status";
import { getBusinessSettings } from "@/lib/booking/settings";
import {
  createBookingSchema,
  type CreateBookingPayload,
} from "@/lib/validation/schemas";
import { expireStaleHolds, type Tx } from "@/server/services/expiry";
import {
  notifyAdminsOfNewBooking,
  notifyCustomerOfDecision,
} from "@/lib/notifications/service";
import type { CurrentAdmin } from "@/lib/auth/session";

export type BookingErrorCode =
  | "INVALID_INPUT"
  | "SERVICE_UNAVAILABLE"
  | "METHOD_UNAVAILABLE"
  | "SLOT_UNAVAILABLE"
  | "CONFIGURATION"
  | "DATABASE";

export type CreateBookingResult =
  | {
      ok: true;
      bookingId: string;
      reference: string;
      accessToken: string;
      expiresAt: Date;
    }
  | { ok: false; code: BookingErrorCode; message: string };

function isExclusionViolation(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("23P01") || message.includes("SlotLock_no_overlap")) {
    return true;
  }
  if (typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "");
    return code === "23P01" || code === "P2004";
  }
  return false;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toRuleInput(rule: {
  weekday: number;
  startTime: string;
  endTime: string;
  active: boolean;
}): AvailabilityRuleInput {
  return {
    weekday: rule.weekday,
    startTime: rule.startTime,
    endTime: rule.endTime,
    active: rule.active,
  };
}

function toExceptionInput(exception: {
  date: Date;
  startTime: string | null;
  endTime: string | null;
  type: "CLOSED" | "OPEN";
}): AvailabilityExceptionInput {
  return {
    date: exception.date.toISOString().slice(0, 10),
    startTime: exception.startTime,
    endTime: exception.endTime,
    type: exception.type,
  };
}

async function loadRulesAndExceptions(dateKey: string) {
  const db = getDb();
  const [rules, exceptions] = await Promise.all([
    db.availabilityRule.findMany({ where: { active: true } }),
    db.availabilityException.findMany({
      where: { date: new Date(`${dateKey}T00:00:00Z`) },
    }),
  ]);
  return {
    rules: rules.map(toRuleInput),
    exceptions: exceptions.map(toExceptionInput),
  };
}

async function activeLocksForDay(
  tx: Tx | ReturnType<typeof getDb>,
  dateKey: string,
  timezone: string,
): Promise<BookedInterval[]> {
  const dayStart = zonedDateTimeToUtc(dateKey, "00:00", timezone);
  const dayEnd = zonedDateTimeToUtc(addDaysToKey(dateKey, 1), "00:00", timezone);
  const locks = await tx.slotLock.findMany({
    where: {
      releasedAt: null,
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    select: { startAt: true, endAt: true },
  });
  return locks;
}

export type PublicSlot = {
  startAt: string;
  endAt: string;
  timeLabel: string;
};

export async function getPublicAvailability(
  serviceId: string,
  dateKey: string,
): Promise<
  | {
      ok: true;
      timezone: string;
      slots: PublicSlot[];
      isClosed: boolean;
      dailyLimitReached: boolean;
    }
  | { ok: false; code: BookingErrorCode; message: string }
> {
  const db = getDb();
  const service = await db.consultationService.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) {
    return { ok: false, code: "SERVICE_UNAVAILABLE", message: "Service is not available." };
  }

  const settings = await getBusinessSettings();
  const now = new Date();

  if (!isWithinBookingWindow(dateKey, now, settings.timezone, settings.bookingWindowDays)) {
    return { ok: true, timezone: settings.timezone, slots: [], isClosed: true, dailyLimitReached: false };
  }

  // Expired holds are released before availability is calculated so an
  // abandoned request never hides a slot longer than its 30-minute hold.
  await db
    .$transaction((tx) => expireStaleHolds(tx, now, 50))
    .catch(() => undefined);

  const [{ rules, exceptions }, bookedIntervals] = await Promise.all([
    loadRulesAndExceptions(dateKey),
    activeLocksForDay(db, dateKey, settings.timezone),
  ]);

  const availability = getDayAvailability({
    dateKey,
    now,
    timezone: settings.timezone,
    rules,
    exceptions,
    bookedIntervals,
    durationMinutes: service.durationMinutes,
    bufferMinutes: settings.bufferMinutes,
    dailyMaxBookings: settings.dailyMaxBookings,
    bookingWindowDays: settings.bookingWindowDays,
  });

  return {
    ok: true,
    timezone: settings.timezone,
    isClosed: availability.isClosed,
    dailyLimitReached: availability.dailyLimitReached,
    slots: availability.slots.map((slot) => ({
      startAt: slot.start.toISOString(),
      endAt: slot.end.toISOString(),
      timeLabel: slot.timeLabel,
    })),
  };
}

export async function createBookingRequest(
  rawPayload: unknown,
): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Invalid booking details.",
    };
  }
  const payload: CreateBookingPayload = parsed.data;
  const requestedStart = new Date(payload.startAt);
  if (Number.isNaN(requestedStart.getTime())) {
    return { ok: false, code: "INVALID_INPUT", message: "Invalid appointment time." };
  }

  const db = getDb();
  const [service, method, settings] = await Promise.all([
    db.consultationService.findUnique({ where: { id: payload.serviceId } }),
    db.consultationMethod.findUnique({ where: { id: payload.methodId } }),
    getBusinessSettings(),
  ]);

  if (!service || !service.active) {
    return { ok: false, code: "SERVICE_UNAVAILABLE", message: "This service is not available." };
  }
  if (!method || !method.active) {
    return {
      ok: false,
      code: "METHOD_UNAVAILABLE",
      message: "This consultation method is not available.",
    };
  }

  const dateKey = dateKeyInTimeZone(requestedStart, settings.timezone);
  if (!isWithinBookingWindow(dateKey, new Date(), settings.timezone, settings.bookingWindowDays)) {
    return {
      ok: false,
      code: "SLOT_UNAVAILABLE",
      message: "The selected time is outside the booking window.",
    };
  }

  const { rules, exceptions } = await loadRulesAndExceptions(dateKey);

  const reference = generatePublicReference();
  const accessToken = generateAccessToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000);

  try {
    const booking = await db.$transaction(
      async (tx) => {
        // Serializes concurrent attempts for the same calendar day so the
        // daily cap cannot be exceeded by a race between different slots.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dateKey}))`;

        await expireStaleHolds(tx, now, 100);

        const bookedIntervals = await activeLocksForDay(tx, dateKey, settings.timezone);
        const availability = getDayAvailability({
          dateKey,
          now,
          timezone: settings.timezone,
          rules,
          exceptions,
          bookedIntervals,
          durationMinutes: service.durationMinutes,
          bufferMinutes: settings.bufferMinutes,
          dailyMaxBookings: settings.dailyMaxBookings,
          bookingWindowDays: settings.bookingWindowDays,
        });

        const slot = availability.slots.find(
          (candidate) => candidate.start.getTime() === requestedStart.getTime(),
        );
        if (!slot) {
          throw new SlotUnavailableError();
        }

        const created = await tx.booking.create({
          data: {
            publicReference: reference,
            accessTokenHash: hashAccessToken(accessToken),
            customerName: payload.customerName,
            customerEmail: payload.customerEmail,
            customerPhone: payload.customerPhone,
            consultationTopic: payload.consultationTopic,
            serviceId: service.id,
            methodId: method.id,
            startAt: slot.start,
            endAt: slot.end,
            timezone: settings.timezone,
            locale: payload.locale,
            status: "PENDING_APPROVAL",
            paymentStatus: "UNPAID",
            priceSnapshot: service.price,
            currencySnapshot: service.currency,
            expiresAt,
            slotLock: {
              create: { startAt: slot.start, endAt: slot.end },
            },
            statusHistory: {
              create: { toStatus: "PENDING_APPROVAL", note: "Booking requested" },
            },
          },
          include: { service: true, method: true },
        });

        return created;
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    // Never roll back a valid booking because a notification failed.
    await notifyAdminsOfNewBooking(booking).catch(() => undefined);

    return {
      ok: true,
      bookingId: booking.id,
      reference: booking.publicReference,
      accessToken,
      expiresAt: booking.expiresAt,
    };
  } catch (error) {
    if (error instanceof SlotUnavailableError || isExclusionViolation(error)) {
      return {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message: "This time was just taken. Please choose another slot.",
      };
    }
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        code: "DATABASE",
        message: "We could not create the booking. Please try again.",
      };
    }
    // Do not log payloads or secrets. The message is safe and generic.
    console.error("Booking creation failed", error instanceof Error ? error.name : "unknown");
    return {
      ok: false,
      code: "DATABASE",
      message: "We could not create the booking. Please try again.",
    };
  }
}

class SlotUnavailableError extends Error {
  constructor() {
    super("Slot unavailable");
    this.name = "SlotUnavailableError";
  }
}

type DecisionResult =
  | { ok: true; bookingId: string; reference: string }
  | {
      ok: false;
      code: "NOT_FOUND" | "INVALID_STATE" | "EXPIRED" | "ALREADY_DONE" | "SLOT_TAKEN" | "DATABASE";
      message: string;
    };

export async function approveBookingRequest(
  bookingId: string,
  admin: CurrentAdmin,
  note?: string,
): Promise<DecisionResult> {
  const db = getDb();
  const now = new Date();

  try {
    const booking = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId}::uuid FOR UPDATE`;
      const current = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { slotLock: true, service: true, method: true },
      });
      if (!current) throw new DecisionError("NOT_FOUND");
      if (current.status === "APPROVED") throw new DecisionError("ALREADY_DONE");
      if (current.status !== "PENDING_APPROVAL" && current.status !== "EXPIRED") {
        throw new DecisionError("INVALID_STATE");
      }
      if (current.startAt.getTime() <= now.getTime()) {
        throw new DecisionError("INVALID_STATE");
      }

      // Check if another active booking currently holds this slot
      const conflictingLock = await tx.slotLock.findFirst({
        where: {
          releasedAt: null,
          bookingId: { not: current.id },
          startAt: { lt: current.endAt },
          endAt: { gt: current.startAt },
        },
      });
      if (conflictingLock) {
        throw new DecisionError("SLOT_TAKEN");
      }

      if (current.slotLock) {
        await tx.slotLock.update({
          where: { id: current.slotLock.id },
          data: { releasedAt: null },
        });
      } else {
        await tx.slotLock.create({
          data: {
            bookingId: current.id,
            startAt: current.startAt,
            endAt: current.endAt,
          },
        });
      }

      const wasExpired =
        current.status === "EXPIRED" || current.expiresAt.getTime() <= now.getTime();

      const updated = await tx.booking.update({
        where: { id: current.id },
        data: {
          status: "APPROVED",
          approvedAt: now,
        },
        include: { service: true, method: true },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: current.id,
          fromStatus: current.status,
          toStatus: "APPROVED",
          adminId: admin.id,
          note: note ?? (wasExpired ? "تمت الموافقة بقرار إداري بعد انتهاء المهلة المؤقتة" : null),
        },
      });

      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: wasExpired
            ? "booking.approved_administrative_override"
            : "booking.approved",
          entityType: "Booking",
          entityId: current.id,
          metadata: { reference: current.publicReference, wasExpired },
        },
      });

      return updated;
    }, { maxWait: 15_000, timeout: 30_000 });

    await notifyCustomerOfDecision(booking, "APPROVED").catch(() => undefined);
    return { ok: true, bookingId: booking.id, reference: booking.publicReference };
  } catch (error) {
    if (error instanceof DecisionError) {
      return {
        ok: false,
        code: error.code,
        message: decisionMessage(error.code),
      };
    }
    console.error("Approve failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, code: "DATABASE", message: "Could not update the booking." };
  }
}

export async function rejectBookingRequest(
  bookingId: string,
  admin: CurrentAdmin,
  note?: string,
): Promise<DecisionResult> {
  const db = getDb();
  const now = new Date();

  try {
    const booking = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId}::uuid FOR UPDATE`;
      const current = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { slotLock: true, service: true, method: true },
      });
      if (!current) throw new DecisionError("NOT_FOUND");
      if (current.status === "REJECTED") throw new DecisionError("ALREADY_DONE");
      if (!canReject(current)) throw new DecisionError("INVALID_STATE");

      await tx.slotLock.updateMany({
        where: { bookingId: current.id, releasedAt: null },
        data: { releasedAt: now },
      });

      const updated = await tx.booking.update({
        where: { id: current.id },
        data: { status: "REJECTED", rejectedAt: now },
        include: { service: true, method: true },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: current.id,
          fromStatus: current.status,
          toStatus: "REJECTED",
          adminId: admin.id,
          note: note ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "booking.rejected",
          entityType: "Booking",
          entityId: current.id,
          metadata: { reference: current.publicReference },
        },
      });

      return updated;
    }, { maxWait: 15_000, timeout: 30_000 });

    await notifyCustomerOfDecision(booking, "REJECTED").catch(() => undefined);
    return { ok: true, bookingId: booking.id, reference: booking.publicReference };
  } catch (error) {
    if (error instanceof DecisionError) {
      return { ok: false, code: error.code, message: decisionMessage(error.code) };
    }
    console.error("Reject failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, code: "DATABASE", message: "Could not update the booking." };
  }
}

export async function cancelBookingRequest(
  bookingId: string,
  admin: CurrentAdmin,
  note?: string,
): Promise<DecisionResult> {
  const db = getDb();
  const now = new Date();
  try {
    const booking = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId}::uuid FOR UPDATE`;
      const current = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { slotLock: true },
      });
      if (!current) throw new DecisionError("NOT_FOUND");
      if (current.status === "CANCELLED") throw new DecisionError("ALREADY_DONE");
      if (!canCancel(current)) throw new DecisionError("INVALID_STATE");

      await tx.slotLock.updateMany({
        where: { bookingId: current.id, releasedAt: null },
        data: { releasedAt: now },
      });

      await tx.booking.update({
        where: { id: current.id },
        data: { status: "CANCELLED" },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: current.id,
          fromStatus: current.status,
          toStatus: "CANCELLED",
          adminId: admin.id,
          note: note ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "booking.cancelled",
          entityType: "Booking",
          entityId: current.id,
          metadata: { reference: current.publicReference },
        },
      });

      return current;
    }, { maxWait: 15_000, timeout: 30_000 });

    return { ok: true, bookingId: booking.id, reference: booking.publicReference };
  } catch (error) {
    if (error instanceof DecisionError) {
      return { ok: false, code: error.code, message: decisionMessage(error.code) };
    }
    console.error("Cancel failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, code: "DATABASE", message: "Could not update the booking." };
  }
}

export async function updateBookingNotes(
  bookingId: string,
  admin: CurrentAdmin,
  adminNotes: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getDb();
  const existing = await db.booking.findUnique({ where: { id: bookingId } });
  if (!existing) return { ok: false, message: "Booking not found." };

  await db.$transaction([
    db.booking.update({ where: { id: bookingId }, data: { adminNotes } }),
    db.auditLog.create({
      data: {
        adminId: admin.id,
        action: "booking.notes_updated",
        entityType: "Booking",
        entityId: bookingId,
      },
    }),
  ]);
  return { ok: true };
}

class DecisionError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "INVALID_STATE"
      | "EXPIRED"
      | "ALREADY_DONE"
      | "SLOT_TAKEN",
  ) {
    super(code);
    this.name = "DecisionError";
  }
}

function decisionMessage(code: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "Booking not found.";
    case "EXPIRED":
      return "The 30-minute hold has expired. The slot was released.";
    case "ALREADY_DONE":
      return "This action has already been completed.";
    case "SLOT_TAKEN":
      return "This slot has already been taken by another booking.";
    default:
      return "This booking can no longer be changed.";
  }
}

export async function getBookingForCustomer(reference: string, token?: string) {
  const cleanRef = reference.trim().toUpperCase();
  const db = getDb();
  const booking = await db.booking.findUnique({
    where: { publicReference: cleanRef },
    include: { service: true, method: true },
  });
  if (!booking) return null;
  if (token && !safeTokenEquals(token, booking.accessTokenHash)) return null;
  return booking;
}

