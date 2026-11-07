import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db/prisma";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getAdminExtra } from "@/lib/i18n/admin-extra";
import { getPublicAvailability } from "@/server/services/bookings";
import { isValidDateKey } from "@/lib/timezone";
import { isLocale } from "@/lib/i18n/config";
import { canApprove, canCancel, canReject } from "@/lib/booking/status";
import { formatDateTime } from "@/lib/timezone";
import { formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  approveBookingAction,
  cancelBookingAction,
  rejectBookingAction,
  saveBookingNotesAction,
  rescheduleBookingAction,
} from "@/server/actions/admin-bookings";

export const dynamic = "force-dynamic";

const resultMessages = [
  { key: "approved", tone: "success" as const, textKey: "approvedResult" as const },
  { key: "rejected", tone: "warning" as const, textKey: "rejectedResult" as const },
  { key: "cancelled", tone: "warning" as const, textKey: "cancelledResult" as const },
  { key: "expired", tone: "warning" as const, textKey: "expiredResult" as const },
  { key: "already", tone: "warning" as const, textKey: "alreadyDone" as const },
  { key: "taken", tone: "error" as const, textKey: "slotTakenResult" as const },
  { key: "failed", tone: "error" as const, textKey: "actionFailed" as const },
];

const extraResultMessages = [
  { key: "rescheduled", tone: "success" as const, textKey: "rescheduledResult" as const },
  { key: "unavailable", tone: "error" as const, textKey: "rescheduleFailed" as const },
];

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ result?: string; notes?: string; rdate?: string }>;
}) {
  const { locale, id } = await params;
  const { result, notes, rdate } = await searchParams;
  if (!isLocale(locale)) notFound();
  if (!z.uuid().safeParse(id).success) notFound();

  const admin = await requireAdminPage(locale, "bookings:view");
  const dict = getDictionary(locale);
  const x = getAdminExtra(locale);
  const db = getDb();

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      service: true,
      method: true,
      slotLock: true,
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { name: true } } },
      },
      notifications: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!booking) notFound();

  const now = new Date();
  const canDecide = hasPermission(admin.role, "bookings:decide");
  const canWriteNotes = hasPermission(admin.role, "bookings:notes");
  const message = resultMessages.find((item) => item.key === result);
  const extraMessage = extraResultMessages.find((item) => item.key === result);
  const canMove = canDecide && canCancel(booking) && booking.startAt.getTime() > now.getTime();
  const dateKey = rdate && isValidDateKey(rdate) ? rdate : undefined;
  const slotResult =
    canMove && dateKey ? await getPublicAvailability(booking.serviceId, dateKey).catch(() => null) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/${locale}/admin/bookings`}
          className="text-sm font-medium text-brand-700 hover:text-brand-900"
        >
          ← {dict.admin.bookingsTitle}
        </Link>
        <StatusBadge status={booking.status} dict={dict} />
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : message.tone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {dict.admin[message.textKey]}
        </p>
      )}
      {extraMessage && (
        <p
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            extraMessage.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {x[extraMessage.textKey]}
        </p>
      )}
      {notes === "saved" && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {dict.admin.saved}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">{dict.admin.bookingDetails}</h1>
            <p className="mt-1 font-mono text-sm text-slate-500">{booking.publicReference}</p>

            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <Item label={dict.admin.customer}>
                <Link
                  href={`/${locale}/admin/customers/${encodeURIComponent(booking.customerEmail.toLowerCase())}`}
                  className="text-brand-700 underline"
                >
                  {booking.customerName}
                </Link>
              </Item>
              <Item label={dict.common.email}>
                <a href={`mailto:${booking.customerEmail}`} className="text-brand-700 underline">
                  {booking.customerEmail}
                </a>
              </Item>
              <Item label={dict.common.phone}>
                <a href={`tel:${booking.customerPhone}`} className="text-brand-700 underline" dir="ltr">
                  {booking.customerPhone}
                </a>
              </Item>
              <Item label={dict.admin.service}>
                {locale === "ar" ? booking.service.titleAr : booking.service.titleEn}
              </Item>
              <Item label={dict.admin.method}>
                {locale === "ar" ? booking.method.nameAr : booking.method.nameEn}
              </Item>
              <Item label={dict.admin.appointment}>
                {formatDateTime(booking.startAt, booking.timezone, locale, {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </Item>
              <Item label={dict.statusPage.price}>
                {formatPrice(booking.priceSnapshot.toString(), booking.currencySnapshot, locale)}
              </Item>
              <Item label={dict.statusPage.payment}>{dict.payment[paymentKey(booking.paymentStatus)]}</Item>
              <Item label={dict.common.createdAt}>
                {formatDateTime(booking.createdAt, booking.timezone, locale)}
              </Item>
              <Item label={dict.statusPage.holdExpires}>
                {formatDateTime(booking.expiresAt, booking.timezone, locale)}
              </Item>
            </dl>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500">{dict.admin.topic}</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-800">
                {booking.consultationTopic}
              </p>
            </div>
          </div>

          {canWriteNotes && (
            <form
              action={saveBookingNotesAction}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="bookingId" value={booking.id} />
              <label htmlFor="adminNotes" className="block text-sm font-semibold text-slate-800">
                {dict.admin.internalNotes}
              </label>
              <textarea
                id="adminNotes"
                name="adminNotes"
                rows={4}
                maxLength={2000}
                defaultValue={booking.adminNotes ?? ""}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="mt-3">
                <SubmitButton>{dict.admin.saveNotes}</SubmitButton>
              </div>
            </form>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{dict.admin.history}</h2>
            {booking.statusHistory.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{dict.admin.noHistory}</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {booking.statusHistory.map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-4 border-s-2 border-slate-100 ps-4 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">
                        {entry.fromStatus ? `${dict.status[statusKey(entry.fromStatus)]} → ` : ""}
                        {dict.status[statusKey(entry.toStatus)]}
                      </p>
                      {entry.note && <p className="mt-0.5 text-xs text-slate-500">{entry.note}</p>}
                      {entry.admin && <p className="mt-0.5 text-xs text-slate-500">{entry.admin.name}</p>}
                    </div>
                    <time className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(entry.createdAt, booking.timezone, locale)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          {canDecide ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">{dict.common.status}</h2>
              <div className="mt-4 space-y-4">
                {booking.status === "PENDING_APPROVAL" && booking.expiresAt.getTime() <= now.getTime() && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                    {dict.admin.holdNotice}
                  </p>
                )}

                {canApprove(booking, now) && (
                  <form action={approveBookingAction} className="space-y-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input
                      name="note"
                      placeholder={dict.admin.notePlaceholder}
                      maxLength={1000}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <ConfirmSubmit
                      message={dict.admin.approveConfirm}
                      className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      {dict.admin.approve}
                    </ConfirmSubmit>
                  </form>
                )}

                {canReject(booking) && (
                  <form action={rejectBookingAction} className="space-y-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input
                      name="note"
                      placeholder={dict.admin.notePlaceholder}
                      maxLength={1000}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <ConfirmSubmit
                      message={dict.admin.rejectConfirm}
                      className="w-full rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-100"
                    >
                      {dict.admin.reject}
                    </ConfirmSubmit>
                  </form>
                )}

                {canCancel(booking) && (
                  <form action={cancelBookingAction} className="space-y-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <ConfirmSubmit
                      message={dict.admin.cancelConfirm}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {dict.admin.cancelBooking}
                    </ConfirmSubmit>
                  </form>
                )}

                {!canApprove(booking, now) && !canReject(booking) && !canCancel(booking) && (
                  <p className="text-sm text-slate-500">{dict.admin.expired}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              {dict.admin.forbidden}
            </p>
          )}

          {canMove && (
            <div id="reschedule" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">{x.reschedule}</h2>
              <p className="mt-1 text-xs text-slate-500">{x.rescheduleHint}</p>
              <form method="get" className="mt-3 flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="rdate" className="block text-xs font-medium text-slate-600">{x.newDate}</label>
                  <input
                    id="rdate"
                    name="rdate"
                    type="date"
                    defaultValue={dateKey ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  />
                </div>
                <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-400">
                  {dict.common.search}
                </button>
              </form>
              {dateKey && slotResult && slotResult.ok && (
                slotResult.slots.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">{x.rescheduleFailed}</p>
                ) : (
                  <form action={rescheduleBookingAction} className="mt-3 space-y-3">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <fieldset>
                      <legend className="text-xs font-medium text-slate-600">{x.newStart}</legend>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {slotResult.slots.map((slot) => (
                          <label key={slot.startAt} className="cursor-pointer rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50">
                            <input type="radio" name="startAt" value={slot.startAt} required className="sr-only" />
                            {slot.timeLabel}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <ConfirmSubmit
                      message={x.rescheduleConfirm}
                      className="w-full rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
                    >
                      {x.reschedule}
                    </ConfirmSubmit>
                  </form>
                )
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{dict.admin.latestNotifications}</h2>
              <Link href={`/${locale}/admin/notifications`} className="text-xs font-medium text-brand-700">
                {dict.admin.viewAll}
              </Link>
            </div>
            {booking.notifications.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{dict.admin.noNotifications}</p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm">
                {booking.notifications.map((log) => (
                  <li key={log.id} className="rounded-lg border border-slate-100 p-3">
                    <p className="font-medium text-slate-800">{log.notificationType}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {log.status} · {dict.admin.attempts}: {log.attempts}
                      {log.errorCode ? ` · ${log.errorCode}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function statusKey(status: keyof typeof import("@prisma/client").BookingStatus): "pending" | "approved" | "rejected" | "expired" | "cancelled" {
  return status === "PENDING_APPROVAL"
    ? "pending"
    : status === "APPROVED"
      ? "approved"
      : status === "REJECTED"
        ? "rejected"
        : status === "EXPIRED"
          ? "expired"
          : "cancelled";
}

function paymentKey(status: string): "unpaid" | "pending" | "paid" | "refunded" {
  return status === "PAID"
    ? "paid"
    : status === "PENDING"
      ? "pending"
      : status === "REFUNDED"
        ? "refunded"
        : "unpaid";
}
