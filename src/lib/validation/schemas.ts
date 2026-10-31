import { z } from "zod";
import { isValidDateKey, isValidTimeZone } from "@/lib/timezone";

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Please enter a valid email address.").max(254));

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s().-]{5,24}$/, "Please enter a valid phone number.");

export const dateKeySchema = z
  .string()
  .refine((value) => isValidDateKey(value), "Please select a valid date.");

export const createBookingSchema = z
  .object({
    serviceId: z.uuid(),
    methodId: z.uuid(),
    startAt: z
      .string()
      .min(1)
      .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid appointment time."),
    customerName: trimmed(2, 120),
    customerEmail: emailSchema,
    customerPhone: phoneSchema,
    consultationTopic: trimmed(3, 500),
    consent: z.literal(true, "You must accept the privacy policy and booking terms."),
    locale: z.enum(["ar", "en"]).default("ar"),
  })
  .strict();

export type CreateBookingPayload = z.infer<typeof createBookingSchema>;

export const statusLookupSchema = z.object({
  reference: z.string().trim().min(6).max(32),
  token: z.string().trim().min(20).max(200),
});

export const serviceSchema = z.object({
  id: z.uuid().optional(),
  titleAr: trimmed(2, 120),
  titleEn: trimmed(2, 120),
  descriptionAr: trimmed(10, 3000),
  descriptionEn: trimmed(10, 3000),
  price: z.coerce.number().min(0).max(9_999_999),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.string().regex(/^[A-Z]{3}$/, "Use a three-letter currency code, e.g. MYR.")),
  durationMinutes: z.coerce.number().int().min(15).max(480),
  active: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const methodSchema = z.object({
  id: z.uuid().optional(),
  nameAr: trimmed(2, 80),
  nameEn: trimmed(2, 80),
  instructionsAr: z.string().trim().max(1000).default(""),
  instructionsEn: z.string().trim().max(1000).default(""),
  active: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const availabilityRuleSchema = z
  .object({
    id: z.uuid().optional(),
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(timePattern, "Use HH:mm format."),
    endTime: z.string().regex(timePattern, "Use HH:mm format."),
    active: z.coerce.boolean().default(true),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export const availabilityExceptionSchema = z
  .object({
    dateKey: dateKeySchema,
    type: z.enum(["CLOSED", "OPEN"]),
    startTime: z.string().regex(timePattern).optional().or(z.literal("")),
    endTime: z.string().regex(timePattern).optional().or(z.literal("")),
    reason: z.string().trim().max(300).optional(),
  })
  .refine(
    (value) => {
      const hasStart = Boolean(value.startTime);
      const hasEnd = Boolean(value.endTime);
      return hasStart === hasEnd;
    },
    { message: "Provide both times or neither.", path: ["startTime"] },
  )
  .refine(
    (value) =>
      !value.startTime || !value.endTime || value.startTime < value.endTime,
    { message: "End time must be after start time.", path: ["endTime"] },
  );

const timezoneSchema = trimmed(3, 64).refine(isValidTimeZone, "Unknown timezone.");

export const scheduleSettingsSchema = z.object({
  timezone: timezoneSchema,
  slotDurationMinutes: z.coerce.number().int().min(15).max(480),
  bufferMinutes: z.coerce.number().int().min(0).max(240),
  dailyMaxBookings: z.coerce.number().int().min(1).max(50),
  bookingWindowDays: z.coerce.number().int().min(1).max(365),
});

export const brandSettingsSchema = z.object({
  brandNameAr: trimmed(2, 80),
  brandNameEn: trimmed(2, 80),
  providerNameAr: z.string().trim().max(120).default(""),
  providerNameEn: z.string().trim().max(120).default(""),
  timezone: timezoneSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const adminUserCreateSchema = z.object({
  name: trimmed(2, 120),
  email: emailSchema,
  role: z.enum(["OWNER", "ADMIN", "STAFF"]),
  password: z.string().min(3).max(128),
});

export const adminUserUpdateSchema = z.object({
  id: z.uuid(),
  name: trimmed(2, 120),
  role: z.enum(["OWNER", "ADMIN", "STAFF"]),
  active: z.coerce.boolean(),
  password: z.string().max(128).optional().or(z.literal("")),
});

export const bookingDecisionSchema = z.object({
  bookingId: z.uuid(),
  note: z.string().trim().max(1000).optional(),
});

export const bookingNotesSchema = z.object({
  bookingId: z.uuid(),
  adminNotes: z.string().trim().max(2000),
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(" ");
}
