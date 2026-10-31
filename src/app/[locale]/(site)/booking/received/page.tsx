import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { getBookingForCustomer } from "@/server/services/bookings";
import { formatDateTime } from "@/lib/timezone";
import { BookingSummary } from "@/components/booking/booking-summary";
import { CopyButton } from "@/components/ui/copy-button";
import { CopyField } from "@/components/ui/copy-field";
import { BookingStorageSync } from "@/components/booking/booking-storage-sync";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ReceivedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string; token?: string }>;
}) {
  const { locale } = await params;
  const { ref, token } = await searchParams;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  const cleanRef = ref?.trim().toUpperCase();
  const booking = cleanRef
    ? await getBookingForCustomer(cleanRef, token).catch(() => null)
    : null;

  if (!booking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{dict.received.notFound}</h1>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href={`/${locale}/booking-status`}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
            >
              {dict.received.viewStatus}
            </Link>
            <Link
              href={`/${locale}/booking`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {dict.received.bookAnother}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <BookingStorageSync reference={booking.publicReference} />
      <header className="text-center">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-xl"
          aria-hidden="true"
        >
          ◷
        </span>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">{dict.received.title}</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
          {dict.received.subtitle}
        </p>
      </header>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sand-50 p-4 border border-sand-200">
          <div>
            <span className="block text-xs font-medium text-slate-500">
              {dict.received.referenceLabel}
            </span>
            <span className="font-mono text-xl font-bold text-slate-900 tracking-wider">
              {booking.publicReference}
            </span>
          </div>
          <CopyButton
            text={booking.publicReference}
            copyLabel={dict.common.copy}
            copiedLabel={dict.common.copied}
            className="px-3 py-1.5 text-sm"
          />
        </div>

        {booking.status === "PENDING_APPROVAL" && (
          <p className="mb-6 text-sm text-slate-700">
            {dict.received.holdsUntil}{" "}
            <strong>{formatDateTime(booking.expiresAt, booking.timezone, locale)}</strong>.{" "}
            <span className="text-slate-500">{dict.received.expiresNote}</span>
          </p>
        )}

        <BookingSummary booking={booking} dict={dict} locale={locale} />

        <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {dict.received.saveReference}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {dict.received.saveReferenceNote}
            </p>
          </div>
          <CopyField
            value={booking.publicReference}
            label={dict.received.referenceLabel}
            copyLabel={dict.common.copy}
            copiedLabel={dict.common.copied}
          />
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={`/${locale}/booking-status?ref=${encodeURIComponent(booking.publicReference)}`}
              className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 transition"
            >
              {dict.received.viewStatus}
            </Link>
            <Link
              href={`/${locale}/booking`}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {dict.received.bookAnother}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
