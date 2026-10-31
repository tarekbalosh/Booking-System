import type { BookingStatus } from "@prisma/client";

export type BookingLike = {
  status: BookingStatus;
  expiresAt: Date;
  startAt?: Date;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
};

/**
 * An admin can approve a booking if it is pending or expired, as long as
 * the consultation time is in the future.
 */
export function canApprove(booking: BookingLike, now: Date): boolean {
  if (booking.startAt && booking.startAt.getTime() <= now.getTime()) {
    return false;
  }
  return booking.status === "PENDING_APPROVAL" || booking.status === "EXPIRED";
}

/** Rejection is allowed while the request is pending or expired. */
export function canReject(booking: BookingLike): boolean {
  return booking.status === "PENDING_APPROVAL" || booking.status === "EXPIRED";
}

export function canCancel(booking: BookingLike): boolean {
  return booking.status === "APPROVED" || booking.status === "PENDING_APPROVAL";
}

export function isHoldExpired(booking: BookingLike, now: Date): boolean {
  return booking.status === "PENDING_APPROVAL" && booking.expiresAt.getTime() <= now.getTime();
}

export const BOOKING_STATUSES: BookingStatus[] = [
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
];

/** Technical status key used in URLs/filters. */
export function parseBookingStatus(value: string | undefined): BookingStatus | undefined {
  if (!value) return undefined;
  return BOOKING_STATUSES.find((status) => status === value);
}
