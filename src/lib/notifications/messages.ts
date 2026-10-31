import { formatDateTime } from "@/lib/timezone";

export type NotificationBooking = {
  id: string;
  publicReference: string;
  customerName: string;
  customerPhone: string;
  consultationTopic: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  locale: string;
  priceSnapshot: { toString(): string } | string | number;
  currencySnapshot: string;
  service: { titleAr: string; titleEn: string };
  method: { nameAr: string; nameEn: string; instructionsAr?: string | null; instructionsEn?: string | null };
};

export type NotificationType =
  | "NEW_BOOKING_ADMIN"
  | "CUSTOMER_APPROVED"
  | "CUSTOMER_REJECTED";

function shortTopic(topic: string): string {
  return topic.length > 140 ? `${topic.slice(0, 137)}...` : topic;
}

export function buildNotificationBody(
  type: NotificationType,
  booking: NotificationBooking,
  recipientLocale: "ar" | "en",
): string {
  const locale = recipientLocale;
  const dateTime = formatDateTime(booking.startAt, booking.timezone, locale);
  const service = locale === "ar" ? booking.service.titleAr : booking.service.titleEn;
  const method = locale === "ar" ? booking.method.nameAr : booking.method.nameEn;

  if (type === "NEW_BOOKING_ADMIN") {
    return [
      "طلب استشارة جديد / New consultation request",
      `المرجع / Reference: ${booking.publicReference}`,
      `الخدمة / Service: ${booking.service.titleAr} / ${booking.service.titleEn}`,
      `الموعد / Time: ${dateTime} (${booking.timezone})`,
      `الطريقة / Method: ${booking.method.nameAr} / ${booking.method.nameEn}`,
      `الموضوع / Topic: ${shortTopic(booking.consultationTopic)}`,
      "يرجى المراجعة من لوحة الإدارة / Review in the admin dashboard.",
    ].join("\n");
  }

  const price = `${booking.priceSnapshot.toString()} ${booking.currencySnapshot}`;

  if (type === "CUSTOMER_APPROVED") {
    if (locale === "ar") {
      return [
        `مرحبًا ${booking.customerName}،`,
        `تمت الموافقة على طلب الاستشارة الخاص بك.`,
        `المرجع: ${booking.publicReference}`,
        `الخدمة: ${service}`,
        `الموعد: ${dateTime} (${booking.timezone})`,
        `الطريقة: ${method}`,
        `السعر: ${price}`,
        "سنتواصل معك لتأكيد تفاصيل الدفع والخطوات التالية قبل الجلسة.",
        booking.method.instructionsAr?.trim() ? `تعليمات: ${booking.method.instructionsAr.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [
      `Hello ${booking.customerName},`,
      "Your consultation request has been approved.",
      `Reference: ${booking.publicReference}`,
      `Service: ${service}`,
      `Time: ${dateTime} (${booking.timezone})`,
      `Method: ${method}`,
      `Price: ${price}`,
      "We will contact you to confirm payment details and next steps before the session.",
      booking.method.instructionsEn?.trim() ? `Instructions: ${booking.method.instructionsEn.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (locale === "ar") {
    return [
      `مرحبًا ${booking.customerName}،`,
      `نعتذر، لم نتمكن من تأكيد طلب الاستشارة بالمرجع ${booking.publicReference}.`,
      `الموعد المطلوب: ${dateTime}`,
      "تم تحرير الموعد ويمكنك اختيار وقت آخر من الموقع.",
    ].join("\n");
  }
  return [
    `Hello ${booking.customerName},`,
    `We are sorry, but your consultation request ${booking.publicReference} could not be confirmed.`,
    `Requested time: ${dateTime}`,
    "The slot has been released and you can choose another time on the website.",
  ].join("\n");
}
