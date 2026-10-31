import { describe, expect, it } from "vitest";
import {
  createBookingSchema,
  serviceSchema,
  availabilityRuleSchema,
} from "@/lib/validation/schemas";
import { validatePasswordPolicy } from "@/lib/auth/password";

describe("Validation Schemas & Policy Tests", () => {
  describe("createBookingSchema", () => {
    const validBooking = {
      serviceId: "123e4567-e89b-42d3-a456-426614174000",
      methodId: "987fcdeb-51a2-43d7-9876-543210987654",
      startAt: "2026-11-02T02:00:00.000Z",
      customerName: "Ahmed Ali",
      customerEmail: "ahmed@example.com",
      customerPhone: "+60112345678",
      consultationTopic: "Developing a new market entry strategy",
      consent: true,
      locale: "ar",
    };

    it("accepts a completely valid customer booking submission", () => {
      const result = createBookingSchema.safeParse(validBooking);
      expect(result.success).toBe(true);
    });

    it("rejects booking if consultation topic is missing or too short", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        consultationTopic: "ab", // Less than min 3 chars
      });
      expect(result.success).toBe(false);
    });

    it("rejects booking if customer consent is not provided", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        consent: false,
      });
      expect(result.success).toBe(false);
    });

    it("rejects booking with invalid customer email", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        customerEmail: "invalid-email-string",
      });
      expect(result.success).toBe(false);
    });

    it("rejects booking with malformed phone number", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        customerPhone: "abc",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("serviceSchema", () => {
    it("validates pricing, duration, and 3-letter currency code", () => {
      const validService = {
        titleAr: "استشارة فردية",
        titleEn: "Individual Consultation",
        descriptionAr: "وصف مفصل للخدمة باللغة العربية",
        descriptionEn: "Detailed description of the service in English",
        price: 150,
        currency: "MYR",
        durationMinutes: 60,
        active: true,
      };

      const result = serviceSchema.safeParse(validService);
      expect(result.success).toBe(true);
    });

    it("rejects invalid currency format", () => {
      const result = serviceSchema.safeParse({
        titleAr: "استشارة فردية",
        titleEn: "Individual Consultation",
        descriptionAr: "وصف مفصل للخدمة باللغة العربية",
        descriptionEn: "Detailed description of the service in English",
        price: 150,
        currency: "MALAYSIAN_RINGGIT", // Not 3 chars
        durationMinutes: 60,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative price", () => {
      const result = serviceSchema.safeParse({
        titleAr: "استشارة فردية",
        titleEn: "Individual Consultation",
        descriptionAr: "وصف مفصل للخدمة باللغة العربية",
        descriptionEn: "Detailed description of the service in English",
        price: -50,
        currency: "MYR",
        durationMinutes: 60,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("availabilityRuleSchema", () => {
    it("accepts valid rule with startTime earlier than endTime", () => {
      const result = availabilityRuleSchema.safeParse({
        weekday: 1,
        startTime: "10:00",
        endTime: "16:00",
        active: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects rule where endTime is not after startTime", () => {
      const result = availabilityRuleSchema.safeParse({
        weekday: 1,
        startTime: "16:00",
        endTime: "10:00",
        active: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects rule with invalid weekday outside 0-6", () => {
      const result = availabilityRuleSchema.safeParse({
        weekday: 7,
        startTime: "10:00",
        endTime: "16:00",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Admin Password Policy", () => {
    it("accepts strong passwords meeting the policy (>= 12 chars, upper, lower, numbers)", () => {
      expect(validatePasswordPolicy("Consultant@2026Secure!")).toBeNull();
      expect(validatePasswordPolicy("LongAndSecureP4ssword#")).toBeNull();
    });

    it("rejects short passwords (< 3 characters)", () => {
      const error = validatePasswordPolicy("ab");
      expect(error).not.toBeNull();
    });

    it("rejects passwords exceeding 128 characters", () => {
      const overlyLong = "A".repeat(129);
      expect(validatePasswordPolicy(overlyLong)).not.toBeNull();
    });
  });
});
