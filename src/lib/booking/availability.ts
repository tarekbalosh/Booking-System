import {
  addDaysToKey,
  dateKeyInTimeZone,
  daysBetweenKeys,
  minutesToTime,
  parseTimeToMinutes,
  weekdayOfDateKey,
  zonedDateTimeToUtc,
  type DateKey,
} from "@/lib/timezone";

export type AvailabilityRuleInput = {
  weekday: number;
  startTime: string;
  endTime: string;
  active: boolean;
};

export type AvailabilityExceptionInput = {
  date: DateKey;
  startTime: string | null;
  endTime: string | null;
  type: "CLOSED" | "OPEN";
};

export type BookedInterval = {
  startAt: Date;
  endAt: Date;
};

export type DayAvailabilityInput = {
  dateKey: DateKey;
  now: Date;
  timezone: string;
  rules: AvailabilityRuleInput[];
  exceptions: AvailabilityExceptionInput[];
  bookedIntervals: BookedInterval[];
  durationMinutes: number;
  bufferMinutes: number;
  dailyMaxBookings: number;
  bookingWindowDays: number;
};

export type Slot = {
  start: Date;
  end: Date;
  /** Wall-clock start in the business timezone, e.g. "10:00". */
  timeLabel: string;
};

export type DayAvailability = {
  dateKey: DateKey;
  slots: Slot[];
  isClosed: boolean;
  dailyLimitReached: boolean;
};

type MinuteWindow = { start: number; end: number };

const DAY_MINUTES = 24 * 60;

function normalizeWindow(window: MinuteWindow): MinuteWindow | null {
  const start = Math.max(0, window.start);
  const end = Math.min(DAY_MINUTES, window.end);
  return end > start ? { start, end } : null;
}

function mergeWindows(windows: MinuteWindow[]): MinuteWindow[] {
  const sorted = windows
    .map(normalizeWindow)
    .filter((window): window is MinuteWindow => window !== null)
    .sort((a, b) => a.start - b.start);

  const merged: MinuteWindow[] = [];
  for (const window of sorted) {
    const last = merged[merged.length - 1];
    if (last && window.start <= last.end) {
      last.end = Math.max(last.end, window.end);
    } else {
      merged.push({ ...window });
    }
  }
  return merged;
}

function subtractWindow(windows: MinuteWindow[], remove: MinuteWindow): MinuteWindow[] {
  const result: MinuteWindow[] = [];
  for (const window of windows) {
    if (remove.end <= window.start || remove.start >= window.end) {
      result.push(window);
      continue;
    }
    if (remove.start > window.start) {
      result.push({ start: window.start, end: remove.start });
    }
    if (remove.end < window.end) {
      result.push({ start: remove.end, end: window.end });
    }
  }
  return result;
}

/** Open windows (minutes after midnight, timezone-local) for one calendar date. */
export function getDayWindows(
  dateKey: DateKey,
  rules: AvailabilityRuleInput[],
  exceptions: AvailabilityExceptionInput[],
): { windows: MinuteWindow[]; isClosedDay: boolean } {
  const weekday = weekdayOfDateKey(dateKey);
  const dayRules = rules.filter((rule) => rule.active && rule.weekday === weekday);

  let windows: MinuteWindow[] = [];
  for (const rule of dayRules) {
    const start = parseTimeToMinutes(rule.startTime);
    const end = parseTimeToMinutes(rule.endTime);
    if (start === null || end === null || end <= start) continue;
    windows.push({ start, end });
  }
  windows = mergeWindows(windows);

  const dayExceptions = exceptions.filter((exception) => exception.date === dateKey);
  let fullyClosed = false;

  for (const exception of dayExceptions) {
    const start = exception.startTime ? parseTimeToMinutes(exception.startTime) : null;
    const end = exception.endTime ? parseTimeToMinutes(exception.endTime) : null;
    const hasRange = start !== null && end !== null && end > start;

    if (exception.type === "CLOSED") {
      if (!hasRange) {
        fullyClosed = true;
      } else {
        windows = subtractWindow(windows, { start, end });
      }
    } else if (hasRange) {
      windows = mergeWindows([...windows, { start, end }]);
    }
  }

  if (fullyClosed) {
    return { windows: [], isClosedDay: true };
  }

  return { windows: mergeWindows(windows), isClosedDay: false };
}

/** True when the date is today or within the configured booking window. */
export function isWithinBookingWindow(
  dateKey: DateKey,
  now: Date,
  timezone: string,
  bookingWindowDays: number,
): boolean {
  const today = dateKeyInTimeZone(now, timezone);
  const offset = daysBetweenKeys(today, dateKey);
  return offset >= 0 && offset < bookingWindowDays;
}

export function getBookingWindowKeys(
  now: Date,
  timezone: string,
  bookingWindowDays: number,
): DateKey[] {
  const today = dateKeyInTimeZone(now, timezone);
  return Array.from({ length: Math.max(0, bookingWindowDays) }, (_, index) =>
    addDaysToKey(today, index),
  );
}

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function countBookingsOnDate(
  bookedIntervals: BookedInterval[],
  dateKey: DateKey,
  timezone: string,
): number {
  return bookedIntervals.filter(
    (interval) => dateKeyInTimeZone(interval.startAt, timezone) === dateKey,
  ).length;
}

/**
 * Pure availability calculation used by both the public API and the server
 * actions. It never trusts the client and always re-runs for the selected day.
 */
export function getDayAvailability(input: DayAvailabilityInput): DayAvailability {
  const {
    dateKey,
    now,
    timezone,
    rules,
    exceptions,
    bookedIntervals,
    durationMinutes,
    bufferMinutes,
    dailyMaxBookings,
    bookingWindowDays,
  } = input;

  if (
    durationMinutes <= 0 ||
    bufferMinutes < 0 ||
    dailyMaxBookings <= 0 ||
    !isWithinBookingWindow(dateKey, now, timezone, bookingWindowDays)
  ) {
    return { dateKey, slots: [], isClosed: true, dailyLimitReached: false };
  }

  const { windows, isClosedDay } = getDayWindows(dateKey, rules, exceptions);
  if (isClosedDay || windows.length === 0) {
    return { dateKey, slots: [], isClosed: true, dailyLimitReached: false };
  }

  const bookedToday = bookedIntervals.filter(
    (interval) => dateKeyInTimeZone(interval.startAt, timezone) === dateKey,
  );
  if (bookedToday.length >= dailyMaxBookings) {
    return { dateKey, slots: [], isClosed: false, dailyLimitReached: true };
  }

  const step = durationMinutes + bufferMinutes;
  const seen = new Set<number>();
  const slots: Slot[] = [];

  for (const window of windows) {
    for (let start = window.start; start + durationMinutes <= window.end; start += step) {
      if (seen.has(start)) continue;
      seen.add(start);

      const timeLabel = minutesToTime(start);
      const startAt = zonedDateTimeToUtc(dateKey, timeLabel, timezone);
      const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

      if (startAt.getTime() <= now.getTime()) continue;

      const conflicts = bookedToday.some((interval) =>
        intervalsOverlap(startAt, endAt, interval.startAt, interval.endAt),
      );
      if (conflicts) continue;

      slots.push({ start: startAt, end: endAt, timeLabel });
    }
  }

  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return {
    dateKey,
    slots,
    isClosed: slots.length === 0,
    dailyLimitReached: false,
  };
}

/** Checks that a requested instant is exactly one of the server-generated slots. */
export function isRequestedSlotValid(params: {
  dateKey: DateKey;
  requestedStart: Date;
  durationMinutes: number;
  now: Date;
  timezone: string;
  rules: AvailabilityRuleInput[];
  exceptions: AvailabilityExceptionInput[];
  bookedIntervals: BookedInterval[];
  bufferMinutes: number;
  dailyMaxBookings: number;
  bookingWindowDays: number;
}): { valid: boolean; slot?: Slot } {
  const availability = getDayAvailability({
    dateKey: params.dateKey,
    now: params.now,
    timezone: params.timezone,
    rules: params.rules,
    exceptions: params.exceptions,
    bookedIntervals: params.bookedIntervals,
    durationMinutes: params.durationMinutes,
    bufferMinutes: params.bufferMinutes,
    dailyMaxBookings: params.dailyMaxBookings,
    bookingWindowDays: params.bookingWindowDays,
  });

  const slot = availability.slots.find(
    (candidate) => candidate.start.getTime() === params.requestedStart.getTime(),
  );
  return slot ? { valid: true, slot } : { valid: false };
}
