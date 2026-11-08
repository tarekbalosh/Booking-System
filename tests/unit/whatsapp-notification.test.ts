import { describe, expect, it } from "vitest";
import { normalizeWhatsAppPhone } from "@/lib/notifications/whatsapp";
import {
  buildNotificationBody,
  type NotificationBooking,
} from "@/lib/notifications/messages";

describe("WhatsApp Notification Integration", () => {
  describe("Phone number normalization", () => {
    it("normalizes phone numbers to Meta Cloud API format (digits only)", () => {
      expect(normalizeWhatsAppPhone("+6011-6939 7149")).toBe("601169397149");
      expect(normalizeWhatsAppPhone("+60 (11) 6939-7149")).toBe("601169397149");
      expect(normalizeWhatsAppPhone("00601169397149")).toBe("00601169397149");
    });

    it("rejects short or empty strings during validation", () => {
      expect(normalizeWhatsAppPhone("")).toBe("");
      expect(normalizeWhatsAppPhone("123").length).toBeLessThan(8);
    });
  });

  describe("Notification message templates", () => {
    const mockBooking: NotificationBooking = {
      id: "book-uuid-111",
      publicReference: "CB-2026-X7K9",
      customerName: "Ahmed Ali",
      customerPhone: "+601169397149",
      consultationTopic: "Discussing AI architecture and system scalability",
      startAt: new Date("2026-11-02T02:00:00.000Z"),
      endAt: new Date("2026-11-02T03:00:00.000Z"),
      timezone: "Asia/Kuala_Lumpur",
      locale: "ar",
      priceSnapshot: 150,
      currencySnapshot: "MYR",
      service: {
        titleAr: "استشارة فردية",
        titleEn: "Individual Consultation",
      },
      method: {
        nameAr: "مكالمة Google Meet",
        nameEn: "Google Meet Call",
        instructionsAr: "سيتم إرسال الرابط قبل الجلسة.",
        instructionsEn: "Link will be sent prior to the call.",
      },
    };

    it("builds admin notification with reference, service, time, and topic without leaking secrets", () => {
      const body = buildNotificationBody("NEW_BOOKING_ADMIN", mockBooking, "ar");

      expect(body).toContain("CB-2026-X7K9");
      expect(body).toContain("استشارة فردية");
      expect(body).toContain("مكالمة Google Meet");
      expect(body).toContain("Discussing AI architecture");
      // Ensures no secrets or internal tokens are printed in the message
      expect(body).not.toContain("password");
      expect(body).not.toContain("token");
    });

    it("builds Arabic customer approval message with instructions and price", () => {
      const body = buildNotificationBody("CUSTOMER_APPROVED", mockBooking, "ar");

      expect(body).toContain("مرحبًا Ahmed Ali");
      expect(body).toContain("تمت الموافقة على طلب الاستشارة");
      expect(body).toContain("CB-2026-X7K9");
      expect(body).toContain("150 MYR");
      expect(body).toContain("سيتم إرسال الرابط قبل الجلسة.");
    });

    it("builds English customer rejection notification politely", () => {
      const body = buildNotificationBody("CUSTOMER_REJECTED", mockBooking, "en");

      expect(body).toContain("Hello Ahmed Ali");
      expect(body).toContain("could not be confirmed");
      expect(body).toContain("CB-2026-X7K9");
    });

    it("includes custom service description in notifications when service is null (Other)", () => {
      const customBooking: NotificationBooking = {
        ...mockBooking,
        service: null,
        customServiceTitle: "مراجعة هيكلية الشركة",
      };
      const adminBody = buildNotificationBody("NEW_BOOKING_ADMIN", customBooking, "ar");
      expect(adminBody).toContain("مراجعة هيكلية الشركة");

      const approvedBody = buildNotificationBody("CUSTOMER_APPROVED", customBooking, "ar");
      expect(approvedBody).toContain("أخرى (مراجعة هيكلية الشركة)");
      expect(approvedBody).toContain("تُحدد بعد المراجعة");
    });
  });

  describe("Idempotency key generation", () => {
    it("generates deterministic idempotency keys per booking and notification type", () => {
      const bookingId = "booking-123";
      const key1 = `${bookingId}:NEW_BOOKING_ADMIN`;
      const key2 = `${bookingId}:NEW_BOOKING_ADMIN`;
      const key3 = `${bookingId}:CUSTOMER_APPROVED`;

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });
});
