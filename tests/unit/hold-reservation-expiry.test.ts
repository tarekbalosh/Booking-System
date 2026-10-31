import { describe, expect, it } from "vitest";
import { lockIsActive } from "@/server/services/expiry";
import { HOLD_MINUTES } from "@/lib/constants";
import { intervalsOverlap } from "@/lib/booking/availability";

describe("30-Minute Hold Reservation Logic & Expiration", () => {
  it("enforces a strict 30-minute hold reservation window", () => {
    expect(HOLD_MINUTES).toBe(30);

    const now = new Date("2026-11-02T10:00:00.000Z");
    const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);

    const durationMinutes = (expiresAt.getTime() - now.getTime()) / (60 * 1000);
    expect(durationMinutes).toBe(30);
    expect(expiresAt.toISOString()).toBe("2026-11-02T10:30:00.000Z");
  });

  describe("lockIsActive state evaluation", () => {
    const baseLock = {
      startAt: new Date("2026-11-02T02:00:00.000Z"),
      endAt: new Date("2026-11-02T03:00:00.000Z"),
    };

    it("evaluates a released lock as INACTIVE (freed slot)", () => {
      const now = new Date("2026-11-02T01:00:00.000Z");
      const lock = {
        ...baseLock,
        releasedAt: new Date("2026-11-02T00:55:00.000Z"),
        booking: { status: "REJECTED", expiresAt: new Date("2026-11-02T01:30:00.000Z") },
      };

      expect(lockIsActive(lock, now)).toBe(false);
    });

    it("evaluates an APPROVED booking lock as ACTIVE indefinitely", () => {
      const now = new Date("2026-11-02T15:00:00.000Z");
      const lock = {
        ...baseLock,
        releasedAt: null,
        booking: { status: "APPROVED", expiresAt: new Date("2026-11-02T01:30:00.000Z") },
      };

      expect(lockIsActive(lock, now)).toBe(true);
    });

    it("evaluates a PENDING_APPROVAL booking as ACTIVE when hold has not elapsed (blocks competing booking)", () => {
      // Hold created at 10:00, expires at 10:30. Current time is 10:15
      const now = new Date("2026-11-02T10:15:00.000Z");
      const lock = {
        ...baseLock,
        releasedAt: null,
        booking: {
          status: "PENDING_APPROVAL",
          expiresAt: new Date("2026-11-02T10:30:00.000Z"),
        },
      };

      expect(lockIsActive(lock, now)).toBe(true);
    });

    it("evaluates a PENDING_APPROVAL booking as INACTIVE when 30 minutes have elapsed (releases slot for others)", () => {
      // Hold created at 10:00, expired at 10:30. Current time is 10:31
      const now = new Date("2026-11-02T10:31:00.000Z");
      const lock = {
        ...baseLock,
        releasedAt: null,
        booking: {
          status: "PENDING_APPROVAL",
          expiresAt: new Date("2026-11-02T10:30:00.000Z"),
        },
      };

      expect(lockIsActive(lock, now)).toBe(false);
    });
  });

  describe("Double booking & Concurrency prevention", () => {
    it("detects that a competing request overlapping an active hold is a collision", () => {
      const slotStart = new Date("2026-11-02T02:00:00.000Z");
      const slotEnd = new Date("2026-11-02T03:00:00.000Z");

      // First client hold
      const client1Request = { startAt: slotStart, endAt: slotEnd };
      // Second client simultaneously requesting the same slot
      const client2Request = { startAt: slotStart, endAt: slotEnd };

      const isCollision = intervalsOverlap(
        client1Request.startAt,
        client1Request.endAt,
        client2Request.startAt,
        client2Request.endAt,
      );

      expect(isCollision).toBe(true);
    });

    it("detects that after rejection, the slot is freed for another booking", () => {
      const now = new Date("2026-11-02T01:00:00.000Z");
      // Rejected booking
      const oldLock = {
        releasedAt: now, // Admin rejected, slot lock released
        booking: { status: "REJECTED", expiresAt: new Date("2026-11-02T01:30:00.000Z") },
      };

      expect(lockIsActive(oldLock, now)).toBe(false);
    });
  });
});
