import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { DEFAULT_TIMEZONE, HOLD_MINUTES } from "@/lib/constants";

export { DEFAULT_TIMEZONE, HOLD_MINUTES };

export type DateKey = string; // YYYY-MM-DD

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Calendar date key (YYYY-MM-DD) of an instant in the given timezone. */
export function dateKeyInTimeZone(date: Date, timeZone: string = DEFAULT_TIMEZONE): DateKey {
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd");
}

/** Current calendar date key in the given timezone. */
export function todayKey(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): DateKey {
  return dateKeyInTimeZone(now, timeZone);
}

/** Weekday for a calendar date; 0 = Sunday ... 6 = Saturday. */
export function weekdayOfDateKey(dateKey: DateKey): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)).getUTCDay();
}

/** Whole-day difference between two date keys (to - from). */
export function daysBetweenKeys(from: DateKey, to: DateKey): number {
  const fromUtc = new Date(`${from}T00:00:00Z`).getTime();
  const toUtc = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function addDaysToKey(dateKey: DateKey, days: number): DateKey {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Interpret a wall-clock time in a timezone and return the corresponding UTC
 * instant. All database timestamps are stored in UTC.
 */
export function zonedDateTimeToUtc(dateKey: DateKey, time: string, timeZone: string): Date {
  return fromZonedTime(`${dateKey}T${time}:00`, timeZone);
}

export function utcToZoned(date: Date, timeZone: string): Date {
  return toZonedTime(date, timeZone);
}

export function formatInZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(date);
}

export function formatDateTime(
  date: Date,
  timeZone: string,
  locale: "ar" | "en",
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return formatInZone(date, timeZone, options, locale === "ar" ? "ar-MY" : "en-MY");
}

export function formatDate(
  date: Date,
  timeZone: string,
  locale: "ar" | "en",
  options: Intl.DateTimeFormatOptions = { dateStyle: "full" },
): string {
  return formatInZone(date, timeZone, options, locale === "ar" ? "ar-MY" : "en-MY");
}

/** "HH:mm" -> minutes after midnight. Returns null for invalid input. */
export function parseTimeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
