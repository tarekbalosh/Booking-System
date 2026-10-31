import { describe, expect, it } from "vitest";
import {
  getDayWindows,
  getDayAvailability,
  isWithinBookingWindow,
  intervalsOverlap,
  type AvailabilityRuleInput,
  type AvailabilityExceptionInput,
} from "@/lib/booking/availability";
import {
  zonedDateTimeToUtc,
  dateKeyInTimeZone,
  weekdayOfDateKey,
} from "@/lib/timezone";

const TIMEZONE = "Asia/Kuala_Lumpur";

// Default schedule: Mon, Tue, Wed, Thu, Sat (10:00 - 16:00)
// 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const DEFAULT_RULES: AvailabilityRuleInput[] = [
  { weekday: 1, startTime: "10:00", endTime: "16:00", active: true },
  { weekday: 2, startTime: "10:00", endTime: "16:00", active: true },
  { weekday: 3, startTime: "10:00", endTime: "16:00", active: true },
  { weekday: 4, startTime: "10:00", endTime: "16:00", active: true },
  { weekday: 6, startTime: "10:00", endTime: "16:00", active: true },
];

describe("Timezone conversions (UTC <-> Asia/Kuala_Lumpur)", () => {
  it("converts 10:00 Kuala Lumpur wall-clock time to UTC correctly (+8h offset)", () => {
    // 2026-11-02 10:00 KL time (+08:00) -> 2026-11-02 02:00:00 UTC
    const utcDate = zonedDateTimeToUtc("2026-11-02", "10:00", TIMEZONE);
    expect(utcDate.toISOString()).toBe("2026-11-02T02:00:00.000Z");

    // Converting back produces the exact calendar date in KL
    const klDateKey = dateKeyInTimeZone(utcDate, TIMEZONE);
    expect(klDateKey).toBe("2026-11-02");
  });

  it("handles day crossover across midnight UTC correctly", () => {
    // 04:00 KL time is 20:00 UTC previous day
    const utcDate = zonedDateTimeToUtc("2026-11-02", "04:00", TIMEZONE);
    expect(utcDate.toISOString()).toBe("2026-11-01T20:00:00.000Z");
    expect(dateKeyInTimeZone(utcDate, TIMEZONE)).toBe("2026-11-02");
  });
});

describe("Schedule & Working days (Mon, Tue, Wed, Thu, Sat)", () => {
  it("allows standard working days: Monday, Tuesday, Wednesday, Thursday, Saturday", () => {
    // 2026-11-02 is Monday (weekday 1)
    expect(weekdayOfDateKey("2026-11-02")).toBe(1);
    const monWindows = getDayWindows("2026-11-02", DEFAULT_RULES, []);
    expect(monWindows.isClosedDay).toBe(false);
    expect(monWindows.windows).toHaveLength(1);
    expect(monWindows.windows[0]).toEqual({ start: 600, end: 960 }); // 10:00 (600m) to 16:00 (960m)

    // 2026-11-07 is Saturday (weekday 6)
    expect(weekdayOfDateKey("2026-11-07")).toBe(6);
    const satWindows = getDayWindows("2026-11-07", DEFAULT_RULES, []);
    expect(satWindows.isClosedDay).toBe(false);
    expect(satWindows.windows).toHaveLength(1);
  });

  it("rejects non-working days: Friday and Sunday", () => {
    // 2026-11-06 is Friday (weekday 5)
    expect(weekdayOfDateKey("2026-11-06")).toBe(5);
    const friWindows = getDayWindows("2026-11-06", DEFAULT_RULES, []);
    expect(friWindows.windows).toHaveLength(0);

    // 2026-11-08 is Sunday (weekday 0)
    expect(weekdayOfDateKey("2026-11-08")).toBe(0);
    const sunWindows = getDayWindows("2026-11-08", DEFAULT_RULES, []);
    expect(sunWindows.windows).toHaveLength(0);
  });
});

describe("Working hours bounds (10:00 - 16:00) & Slot Generation", () => {
  it("generates exactly 6 slots of 60 minutes between 10:00 and 16:00 with 0 buffer", () => {
    // Fixed now: Monday morning 2026-11-02 08:00 KL time (00:00 UTC)
    const now = new Date("2026-11-02T00:00:00.000Z");
    const dateKey = "2026-11-02";

    const availability = getDayAvailability({
      dateKey,
      now,
      timezone: TIMEZONE,
      rules: DEFAULT_RULES,
      exceptions: [],
      bookedIntervals: [],
      durationMinutes: 60,
      bufferMinutes: 0,
      dailyMaxBookings: 6,
      bookingWindowDays: 30,
    });

    expect(availability.isClosed).toBe(false);
    expect(availability.dailyLimitReached).toBe(false);
    expect(availability.slots).toHaveLength(6);

    const labels = availability.slots.map((s) => s.timeLabel);
    expect(labels).toEqual([
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
    ]);

    // The very last slot begins at 15:00 and finishes exactly at 16:00
    const lastSlot = availability.slots[5]!;
    expect(lastSlot.timeLabel).toBe("15:00");
    const lastSlotEndUtc = lastSlot.end.toISOString();
    // 16:00 KL time = 08:00 UTC
    expect(lastSlotEndUtc).toBe("2026-11-02T08:00:00.000Z");
  });

  it("does not generate any slot that exceeds 16:00 closing time", () => {
    const now = new Date("2026-11-02T00:00:00.000Z");
    // Service of 90 minutes
    const availability = getDayAvailability({
      dateKey: "2026-11-02",
      now,
      timezone: TIMEZONE,
      rules: DEFAULT_RULES,
      exceptions: [],
      bookedIntervals: [],
      durationMinutes: 90,
      bufferMinutes: 0,
      dailyMaxBookings: 6,
      bookingWindowDays: 30,
    });

    // 10:00 -> 11:30, 11:30 -> 13:00, 13:00 -> 14:30, 14:30 -> 16:00 = 4 slots
    expect(availability.slots).toHaveLength(4);
    const lastSlot = availability.slots[3]!;
    expect(lastSlot.timeLabel).toBe("14:30");
    expect(lastSlot.end.toISOString()).toBe("2026-11-02T08:00:00.000Z"); // Exactly 16:00 KL
  });

  it("omits slots that have already passed earlier today", () => {
    // Current time is 12:30 KL time on 2026-11-02 (04:30 UTC)
    const now = new Date("2026-11-02T04:30:00.000Z");
    const availability = getDayAvailability({
      dateKey: "2026-11-02",
      now,
      timezone: TIMEZONE,
      rules: DEFAULT_RULES,
      exceptions: [],
      bookedIntervals: [],
      durationMinutes: 60,
      bufferMinutes: 0,
      dailyMaxBookings: 6,
      bookingWindowDays: 30,
    });

    // Slots at 10:00, 11:00, 12:00 have passed. Remaining: 13:00, 14:00, 15:00
    const labels = availability.slots.map((s) => s.timeLabel);
    expect(labels).toEqual(["13:00", "14:00", "15:00"]);
  });
});

describe("Daily limit & Booking window (30 days)", () => {
  it("enforces daily maximum booking limit (6 bookings per day)", () => {
    const now = new Date("2026-11-02T00:00:00.000Z");
    // Simulate 6 already booked intervals
    const bookedIntervals = [
      { startAt: zonedDateTimeToUtc("2026-11-02", "10:00", TIMEZONE), endAt: zonedDateTimeToUtc("2026-11-02", "11:00", TIMEZONE) },
      { startAt: zonedDateTimeToUtc("2026-11-02", "11:00", TIMEZONE), endAt: zonedDateTimeToUtc("2026-11-02", "12:00", TIMEZONE) },
      { startAt: zonedDateTimeToUtc("2026-11-02", "12:00", TIMEZONE), endAt: zonedDateTimeToUtc("2026-11-02", "13:00", TIMEZONE) },
      { startAt: zonedDateTimeToUtc("2026-11-02", "13:00", TIMEZONE), endAt: zonedDateTimeToUtc("2026-11-02", "14:00", TIMEZONE) },
      { startAt: zonedDateTimeToUtc("2026-11-02", "14:00", TIMEZONE), endAt: zonedDateTimeToUtc("2026-11-02", "15:00", TIMEZONE) },
      { startAt: zonedDateTimeToUtc("2026-11-02", "15:00", TIMEZONE), endAt: zonedDateTimeToUtc("2026-11-02", "16:00", TIMEZONE) },
    ];

    const availability = getDayAvailability({
      dateKey: "2026-11-02",
      now,
      timezone: TIMEZONE,
      rules: DEFAULT_RULES,
      exceptions: [],
      bookedIntervals,
      durationMinutes: 60,
      bufferMinutes: 0,
      dailyMaxBookings: 6,
      bookingWindowDays: 30,
    });

    expect(availability.dailyLimitReached).toBe(true);
    expect(availability.slots).toHaveLength(0);
  });

  it("strictly validates the 30-day future booking window", () => {
    const now = new Date("2026-11-01T02:00:00.000Z"); // 2026-11-01 in KL

    // Today is within window
    expect(isWithinBookingWindow("2026-11-01", now, TIMEZONE, 30)).toBe(true);
    // Day 29 is within window
    expect(isWithinBookingWindow("2026-11-30", now, TIMEZONE, 30)).toBe(true);
    // Day 30 is out of 30-day window (offset == 30)
    expect(isWithinBookingWindow("2026-12-01", now, TIMEZONE, 30)).toBe(false);

    // Yesterday is past and rejected
    expect(isWithinBookingWindow("2026-10-31", now, TIMEZONE, 30)).toBe(false);
  });
});

describe("Availability Exceptions & Overlap checking", () => {
  it("fully closes a day when a full-day CLOSED exception is present", () => {
    const exceptions: AvailabilityExceptionInput[] = [
      { date: "2026-11-02", type: "CLOSED", startTime: null, endTime: null },
    ];
    const windows = getDayWindows("2026-11-02", DEFAULT_RULES, exceptions);
    expect(windows.isClosedDay).toBe(true);
    expect(windows.windows).toHaveLength(0);
  });

  it("partially closes a time range when partial CLOSED exception is present", () => {
    const exceptions: AvailabilityExceptionInput[] = [
      { date: "2026-11-02", type: "CLOSED", startTime: "12:00", endTime: "14:00" },
    ];
    const windows = getDayWindows("2026-11-02", DEFAULT_RULES, exceptions);
    expect(windows.isClosedDay).toBe(false);
    expect(windows.windows).toEqual([
      { start: 600, end: 720 },  // 10:00 to 12:00
      { start: 840, end: 960 },  // 14:00 to 16:00
    ]);
  });

  it("detects interval overlaps accurately", () => {
    const aStart = new Date("2026-11-02T02:00:00Z");
    const aEnd = new Date("2026-11-02T03:00:00Z");

    // Identical times overlap
    expect(intervalsOverlap(aStart, aEnd, aStart, aEnd)).toBe(true);
    // Partial overlap
    expect(
      intervalsOverlap(
        aStart,
        aEnd,
        new Date("2026-11-02T02:30:00Z"),
        new Date("2026-11-02T03:30:00Z"),
      ),
    ).toBe(true);
    // Adjacent times do NOT overlap
    expect(
      intervalsOverlap(
        aStart,
        aEnd,
        new Date("2026-11-02T03:00:00Z"),
        new Date("2026-11-02T04:00:00Z"),
      ),
    ).toBe(false);
  });
});
