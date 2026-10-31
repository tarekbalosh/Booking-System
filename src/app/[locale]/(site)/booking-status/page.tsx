import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { getBookingForCustomer } from "@/server/services/bookings";
import { BookingSummary } from "@/components/booking/booking-summary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function BookingStatusPage({
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

  const hasLookup = Boolean(ref && token);
  const booking = hasLookup
    ? await getBookingForCustomer(ref!, token!).catch(() => null)
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">{dict.statusPage.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{dict.statusPage.subtitle}</p>
      </header>

      <form
        method="get"
        action={`/${locale}/booking-status`}
        className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div>
          <label htmlFor="ref" className="block text-sm font-semibold text-slate-800">
            {dict.statusPage.referenceLabel}
          </label>
          <input
            id="ref"
            name="ref"
            defaultValue={ref ?? ""}
            required
            minLength={6}
            maxLength={32}
            autoComplete="off"
            dir="ltr"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm"
          />
        </div>
        <div>
          <label htmlFor="token" className="block text-sm font-semibold text-slate-800">
            {dict.statusPage.tokenLabel}
          </label>
          <input
            id="token"
            name="token"
            type="password"
            defaultValue={token ?? ""}
            required
            minLength={20}
            autoComplete="off"
            dir="ltr"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm"
          />
          <p className="mt-1.5 text-xs text-slate-500">{dict.statusPage.tokenHint}</p>
        </div>
        <button
          type="submit"
          className="w-fit rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          {dict.statusPage.lookup}
        </button>
      </form>

      {hasLookup && !booking && (
        <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {dict.statusPage.notFound}
        </p>
      )}

      {booking && (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <BookingSummary booking={booking} dict={dict} locale={locale} />
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
            <Link
              href={`/${locale}/booking`}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
            >
              {dict.statusPage.bookAgain}
            </Link>
            <Link
              href={`/${locale}`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {dict.common.home}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
