import "server-only";
import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db/prisma";

export type Tx = Prisma.TransactionClient;

type ExpiredRow = { id: string };

/**
 * Releases holds whose 30-minute window elapsed and marks their bookings
 * EXPIRED. Uses row-level locks (SKIP LOCKED) so it can never race an approval:
 * either approval locks the row first, or this cleanup does.
 *
 * Returns the number of bookings expired.
 */
export async function expireStaleHolds(
  tx: Tx,
  now: Date = new Date(),
  limit = 100,
): Promise<number> {
  const rows = await tx.$queryRaw<ExpiredRow[]>`
    SELECT id FROM "Booking"
    WHERE status = 'PENDING_APPROVAL'::"BookingStatus"
      AND "expiresAt" <= ${now}
    ORDER BY "expiresAt" ASC
    FOR UPDATE SKIP LOCKED
    LIMIT ${limit}
  `;

  if (rows.length === 0) return 0;
  const ids = rows.map((row) => row.id);

  await tx.slotLock.updateMany({
    where: { bookingId: { in: ids }, releasedAt: null },
    data: { releasedAt: now },
  });

  await tx.booking.updateMany({
    where: { id: { in: ids }, status: "PENDING_APPROVAL" },
    data: { status: "EXPIRED" },
  });

  await tx.bookingStatusHistory.createMany({
    data: ids.map((bookingId) => ({
      bookingId,
      fromStatus: "PENDING_APPROVAL" as const,
      toStatus: "EXPIRED" as const,
      note: "Hold expired automatically",
    })),
  });

  return ids.length;
}

/** Public entry point used by the cron endpoint and CLI script. */
export async function expireStaleHoldsNow(): Promise<number> {
  const db = getDb();
  let total = 0;
  // Loop in case more than one batch is waiting. Bounded to avoid runaway jobs.
  for (let batch = 0; batch < 5; batch += 1) {
    const count = await db.$transaction((tx) => expireStaleHolds(tx, new Date(), 100));
    total += count;
    if (count < 100) break;
  }
  return total;
}

/**
 * Approved bookings stay locked; pending ones only block while their hold is
 * live. Used when rendering availability without mutating state.
 */
export function lockIsActive(
  lock: { releasedAt: Date | null; booking?: { status: string; expiresAt: Date } | null },
  now: Date,
): boolean {
  if (lock.releasedAt) return false;
  const booking = lock.booking;
  if (!booking) return true;
  if (booking.status === "PENDING_APPROVAL") {
    return booking.expiresAt.getTime() > now.getTime();
  }
  return booking.status === "APPROVED";
}
