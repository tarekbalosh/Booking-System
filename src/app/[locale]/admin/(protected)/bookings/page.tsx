import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db/prisma";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { BOOKING_STATUSES, parseBookingStatus } from "@/lib/booking/status";
import { formatDateTime, addDaysToKey, zonedDateTimeToUtc } from "@/lib/timezone";
import { getBusinessSettings, DEFAULT_SETTINGS } from "@/lib/booking/settings";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    service?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  await requireAdminPage(locale, "bookings:view");
  const dict = getDictionary(locale);
  const db = getDb();

  let timezone = DEFAULT_SETTINGS.timezone;
  try {
    timezone = (await getBusinessSettings()).timezone;
  } catch {
    timezone = DEFAULT_SETTINGS.timezone;
  }

  const status = parseBookingStatus(query.status);
  const serviceId = z.uuid().safeParse(query.service).success ? query.service : undefined;
  const search = query.q?.trim().slice(0, 100);
  const page = Math.max(1, Number(query.page) || 1);
  const fromKey = query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : undefined;
  const toKey = query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : undefined;

  const where: Prisma.BookingWhereInput = {};
  if (status) where.status = status;
  if (serviceId) where.serviceId = serviceId;
  if (search) {
    where.OR = [
      { publicReference: { contains: search.toUpperCase() } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search.toLowerCase(), mode: "insensitive" } },
    ];
  }
  if (fromKey || toKey) {
    where.startAt = {
      ...(fromKey ? { gte: zonedDateTimeToUtc(fromKey, "00:00", timezone) } : {}),
      ...(toKey
        ? { lt: zonedDateTimeToUtc(addDaysToKey(toKey, 1), "00:00", timezone) }
        : {}),
    };
  }

  const [bookings, total, services] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: { startAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { service: true, method: true },
    }),
    db.booking.count({ where }),
    db.consultationService.findMany({ orderBy: { titleEn: "asc" } }).catch(() => []),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const statusOptions = BOOKING_STATUSES.map((value) => ({
    value,
    label: dict.status[
      value === "PENDING_APPROVAL"
        ? "pending"
        : value === "APPROVED"
          ? "approved"
          : value === "REJECTED"
            ? "rejected"
            : value === "EXPIRED"
              ? "expired"
              : "cancelled"
    ],
  }));

  const buildPageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    if (query.service) params.set("service", query.service);
    if (query.q) params.set("q", query.q);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    params.set("page", String(nextPage));
    return `/${locale}/admin/bookings?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.admin.bookingsTitle}</h1>
          <p className="mt-1 text-sm text-slate-600">{total}</p>
        </div>
        <Link
          href={`/${locale}/admin/calendar`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-400"
        >
          {dict.nav.calendar}
        </Link>
      </header>

      <form
        method="get"
        action={`/${locale}/admin/bookings`}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="lg:col-span-2">
          <label htmlFor="q" className="block text-xs font-medium text-slate-600">
            {dict.common.search}
          </label>
          <input
            id="q"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder={dict.admin.searchPlaceholder}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-slate-600">
            {dict.common.status}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={query.status ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            <option value="">{dict.common.all}</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="service" className="block text-xs font-medium text-slate-600">
            {dict.admin.service}
          </label>
          <select
            id="service"
            name="service"
            defaultValue={query.service ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            <option value="">{dict.common.all}</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {locale === "ar" ? service.titleAr : service.titleEn}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="block text-xs font-medium text-slate-600">
            {dict.admin.fromDate}
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={query.from ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs font-medium text-slate-600">
            {dict.admin.toDate}
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={query.to ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
          />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <button
            type="submit"
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            {dict.admin.applyFilters}
          </button>
          <Link
            href={`/${locale}/admin/bookings`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            {dict.admin.clearFilters}
          </Link>
        </div>
      </form>

      {bookings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          {dict.admin.noBookings}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-sand-50 text-start text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start">{dict.admin.reference}</th>
                <th className="px-4 py-3 text-start">{dict.admin.customer}</th>
                <th className="px-4 py-3 text-start">{dict.admin.service}</th>
                <th className="px-4 py-3 text-start">{dict.admin.appointment}</th>
                <th className="px-4 py-3 text-start">{dict.common.status}</th>
                <th className="px-4 py-3 text-start">{dict.common.details}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-sand-50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                    {booking.publicReference}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{booking.customerName}</p>
                    <p className="text-xs text-slate-500">{booking.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {locale === "ar" ? booking.service.titleAr : booking.service.titleEn}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {formatDateTime(booking.startAt, booking.timezone, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={booking.status} dict={dict} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/admin/bookings/${booking.id}`}
                      className="text-sm font-semibold text-brand-700 hover:text-brand-900"
                    >
                      {dict.common.view}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link href={buildPageHref(page - 1)} className="text-brand-700">
              ← {dict.common.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-500">{page} / {pageCount}</span>
          {page < pageCount ? (
            <Link href={buildPageHref(page + 1)} className="text-brand-700">
              {dict.common.next} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
