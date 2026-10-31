"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/lib/auth/session";
import { getDb } from "@/lib/db/prisma";
import {
  bookingDecisionSchema,
  bookingNotesSchema,
} from "@/lib/validation/schemas";
import {
  approveBookingRequest,
  cancelBookingRequest,
  rejectBookingRequest,
  updateBookingNotes,
} from "@/server/services/bookings";
import { retryNotification } from "@/lib/notifications/service";
import { auditData } from "@/server/audit";

function localeFrom(formData: FormData): "ar" | "en" {
  return formData.get("locale") === "en" ? "en" : "ar";
}

function decisionRedirect(
  locale: "ar" | "en",
  bookingId: string,
  result: "approved" | "rejected" | "cancelled" | "expired" | "already" | "failed" | "taken",
): string {
  return `/${locale}/admin/bookings/${bookingId}?result=${result}`;
}

export async function approveBookingAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("bookings:decide");
  const locale = localeFrom(formData);
  const parsed = bookingDecisionSchema.safeParse({
    bookingId: formData.get("bookingId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) redirect(`/${locale}/admin/bookings?error=invalid`);

  const result = await approveBookingRequest(parsed.data.bookingId, admin, parsed.data.note);
  revalidatePath(`/${locale}/admin/bookings`);
  revalidatePath(`/${locale}/admin/bookings/${parsed.data.bookingId}`);
  revalidatePath(`/${locale}/admin`);

  if (result.ok) {
    redirect(decisionRedirect(locale, parsed.data.bookingId, "approved"));
  }
  const code =
    result.code === "EXPIRED"
      ? "expired"
      : result.code === "ALREADY_DONE"
        ? "already"
        : result.code === "SLOT_TAKEN"
          ? "taken"
          : "failed";
  redirect(decisionRedirect(locale, parsed.data.bookingId, code));
}

export async function rejectBookingAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("bookings:decide");
  const locale = localeFrom(formData);
  const parsed = bookingDecisionSchema.safeParse({
    bookingId: formData.get("bookingId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) redirect(`/${locale}/admin/bookings?error=invalid`);

  const result = await rejectBookingRequest(parsed.data.bookingId, admin, parsed.data.note);
  revalidatePath(`/${locale}/admin/bookings`);
  revalidatePath(`/${locale}/admin/bookings/${parsed.data.bookingId}`);
  revalidatePath(`/${locale}/admin`);

  if (result.ok) {
    redirect(decisionRedirect(locale, parsed.data.bookingId, "rejected"));
  }
  const code = result.code === "ALREADY_DONE" ? "already" : "failed";
  redirect(decisionRedirect(locale, parsed.data.bookingId, code));
}

export async function cancelBookingAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("bookings:decide");
  const locale = localeFrom(formData);
  const parsed = bookingDecisionSchema.safeParse({
    bookingId: formData.get("bookingId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) redirect(`/${locale}/admin/bookings?error=invalid`);

  const result = await cancelBookingRequest(parsed.data.bookingId, admin, parsed.data.note);
  revalidatePath(`/${locale}/admin/bookings`);
  revalidatePath(`/${locale}/admin/bookings/${parsed.data.bookingId}`);
  revalidatePath(`/${locale}/admin`);

  if (result.ok) {
    redirect(decisionRedirect(locale, parsed.data.bookingId, "cancelled"));
  }
  const code = result.code === "ALREADY_DONE" ? "already" : "failed";
  redirect(decisionRedirect(locale, parsed.data.bookingId, code));
}

export async function saveBookingNotesAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("bookings:notes");
  const locale = localeFrom(formData);
  const parsed = bookingNotesSchema.safeParse({
    bookingId: formData.get("bookingId"),
    adminNotes: formData.get("adminNotes") ?? "",
  });
  if (!parsed.success) redirect(`/${locale}/admin/bookings?error=invalid`);

  await updateBookingNotes(parsed.data.bookingId, admin, parsed.data.adminNotes);
  revalidatePath(`/${locale}/admin/bookings/${parsed.data.bookingId}`);
  redirect(`/${locale}/admin/bookings/${parsed.data.bookingId}?notes=saved`);
}

export async function retryNotificationAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("notifications:retry");
  const locale = localeFrom(formData);
  const id = String(formData.get("notificationId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect(`/${locale}/admin/notifications?retry=invalid`);
  }

  const result = await retryNotification(id);
  const db = getDb();
  await db.auditLog.create({
    data: auditData({
      adminId: admin.id,
      action: "notification.retry",
      entityType: "NotificationLog",
      entityId: id,
      metadata: { result: result.ok ? "sent" : result.code },
    }),
  });
  revalidatePath(`/${locale}/admin/notifications`);
  redirect(`/${locale}/admin/notifications?retry=${result.ok ? "sent" : result.code.toLowerCase()}`);
}
