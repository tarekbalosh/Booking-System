import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { getBookingForCustomer } from "@/server/services/bookings";
import { BookingSummary } from "@/components/booking/booking-summary";
import { BookingStorageSync } from "@/components/booking/booking-storage-sync";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function BookingStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  const { ref } = await searchParams;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  // 1. Check URL query ref first; 2. Fallback to last_booking_ref cookie
  const cookieStore = await cookies();
  const cookieRef = cookieStore.get("last_booking_ref")?.value;
  const targetRef = (ref || cookieRef)?.trim().toUpperCase();

  const booking = targetRef
    ? await getBookingForCustomer(targetRef).catch(() => null)
    : null;

  const hasLookupAttempt = Boolean(ref?.trim());

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {/* Sync reference with localStorage and handle client-side fallback if needed */}
      <BookingStorageSync
        reference={booking?.publicReference}
        autoRedirectIfMissing={!booking && !hasLookupAttempt}
      />

      {booking ? (
        // When a booking is available, display the status and details IMMEDIATELY
        <div>
          <header className="text-center sm:text-start">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1 text-xs font-semibold text-brand-800">
              <span className="h-2 w-2 rounded-full bg-brand-600 animate-pulse" />
              {dict.statusPage.activeBadge}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              {dict.statusPage.activeTitle}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {dict.statusPage.activeSubtitle}
            </p>
          </header>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <BookingSummary booking={booking} dict={dict} locale={locale} />

            <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/${locale}/booking`}
                    className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
                  >
                    {dict.statusPage.bookAgain}
                  </Link>
                  <Link
                    href={`/${locale}`}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    {dict.common.home}
                  </Link>
                </div>

                {/* Collapsible search for another booking */}
                <details className="group text-sm">
                  <summary className="cursor-pointer select-none text-xs font-medium text-slate-500 hover:text-brand-700 transition">
                    🔍 {dict.statusPage.checkAnother}
                  </summary>
                  <form
                    method="get"
                    action={`/${locale}/booking-status`}
                    className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row"
                  >
                    <input
                      name="ref"
                      placeholder={dict.statusPage.referencePlaceholder}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs uppercase tracking-wider focus:border-brand-500 focus:outline-none"
                      required
                      minLength={4}
                      maxLength={32}
                      autoComplete="off"
                      dir="ltr"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-lg bg-brand-700 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-800"
                    >
                      {dict.statusPage.lookup}
                    </button>
                  </form>
                </details>
              </div>
            </div>
          </section>
        </div>
      ) : (
        // Fallback view only when no saved booking exists on the client/device
        <div>
          <header className="text-center sm:text-start">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {dict.statusPage.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {dict.statusPage.subtitle}
            </p>
          </header>

          {hasLookupAttempt && (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {dict.statusPage.notFound}
            </p>
          )}

          <form
            method="get"
            action={`/${locale}/booking-status`}
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div>
              <label
                htmlFor="ref"
                className="block text-sm font-semibold text-slate-800"
              >
                {dict.statusPage.referenceLabel}
              </label>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  id="ref"
                  name="ref"
                  defaultValue={ref ?? ""}
                  required
                  minLength={4}
                  maxLength={32}
                  placeholder={dict.statusPage.referencePlaceholder}
                  autoComplete="off"
                  dir="ltr"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
                >
                  {dict.statusPage.lookup}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {dict.statusPage.referenceHint}
              </p>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between">
              <Link
                href={`/${locale}/booking`}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800"
              >
                ← {dict.received.bookAnother}
              </Link>
              <Link
                href={`/${locale}`}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                {dict.common.home}
              </Link>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
