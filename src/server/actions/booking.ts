"use server";

import { redirect } from "next/navigation";
import { createBookingRequest } from "@/server/services/bookings";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

export type BookingActionState = { error: string } | null;

export async function createBookingAction(
  _previous: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const localeValue = String(formData.get("locale") ?? "ar");
  const locale = isLocale(localeValue) ? localeValue : "ar";
  const dict = getDictionary(locale);

  const result = await createBookingRequest({
    serviceId: formData.get("serviceId"),
    methodId: formData.get("methodId"),
    startAt: formData.get("startAt"),
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail"),
    customerPhone: formData.get("customerPhone"),
    consultationTopic: formData.get("consultationTopic"),
    consent: formData.get("consent") === "on" || formData.get("consent") === "true",
    locale,
  });

  if (!result.ok) {
    if (result.code === "SLOT_UNAVAILABLE") {
      return { error: dict.booking.conflict };
    }
    if (result.code === "INVALID_INPUT") {
      return { error: dict.booking.fixErrors };
    }
    return { error: dict.booking.genericError };
  }

  redirect(
    `/${locale}/booking/received?ref=${encodeURIComponent(result.reference)}&token=${encodeURIComponent(result.accessToken)}`,
  );
}
