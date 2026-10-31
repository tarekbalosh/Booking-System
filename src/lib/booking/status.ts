import type { BookingStatus } from "@prisma/client";

export type BookingLike = {
  status: BookingStatus;
  expiresAt: Date;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
};

/** Approval is only possible while the request is pending and the hold is live. */
export function canApprove(booking: BookingLike, now: Date): boolean {
  return booking.status === "PENDING_APPROVAL" && booking.expiresAt.getTime() > now.getTime();
}

/** Rejection is allowed while the request is still pending (even if expired). */
export function canReject(booking: BookingLike): boolean {
  return booking.status === "PENDING_APPROVAL";
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
