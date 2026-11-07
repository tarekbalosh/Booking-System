import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db/prisma";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getAdminExtra } from "@/lib/i18n/admin-extra";
import { isLocale } from "@/lib/i18n/config";
import { BOOKING_STATUSES, parseBookingStatus } from "@/lib/booking/status";
import { formatDateTime, addDaysToKey, zonedDateTimeToUtc } from "@/lib/timezone";
import { getBusinessSettings, DEFAULT_SETTINGS } from "@/lib/booking/settings";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentBadge } from "@/components/ui/payment-badge";
import { hasPermission } from "@/lib/auth/permissions";
import { canApprove, canCancel, canReject } from "@/lib/booking/status";
import { Icon } from "@/components/admin/icons";
import { CopyRef } from "@/components/admin/copy-ref";
import { RowActions } from "@/components/admin/row-actions";

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
    method?: string;
    sort?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
    error?: string;
  }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const admin = await requireAdminPage(locale, "bookings:view");
  const dict = getDictionary(locale);
  const x = getAdminExtra(locale);
  const db = getDb();

  let timezone = DEFAULT_SETTINGS.timezone;
  try {
    timezone = (await getBusinessSettings()).timezone;
  } catch {
    timezone = DEFAULT_SETTINGS.timezone;
  }

  const status = parseBookingStatus(query.status);
  const serviceId = z.uuid().safeParse(query.service).success ? query.service : undefined;
  const methodId = z.uuid().safeParse(query.method).success ? query.method : undefined;
  const sort = query.sort === "oldest" || query.sort === "appointment" ? query.sort : "newest";
  const search = query.q?.trim().slice(0, 100);
  const page = Math.max(1, Number(query.page) || 1);
  const fromKey = query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : undefined;
  const toKey = query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : undefined;

  const where: Prisma.BookingWhereInput = {};
  if (status) where.status = status;
  if (serviceId) where.serviceId = serviceId;
  if (methodId) where.methodId = methodId;
  if (search) {
    where.OR = [
      { publicReference: { contains: search.toUpperCase() } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search.toLowerCase(), mode: "insensitive" } },
      { customerPhone: { contains: search.replace(/\s+/g, "") } },
      { customerPhone: { contains: search } },
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

  const orderBy: Prisma.BookingOrderByWithRelationInput =
    sort === "oldest" ? { createdAt: "asc" } : sort === "appointment" ? { startAt: "desc" } : { createdAt: "desc" };

  const [bookings, total, services, methods] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { service: true, method: true },
    }),
    db.booking.count({ where }),
    db.consultationService.findMany({ orderBy: { titleEn: "asc" } }).catch(() => []),
    db.consultationMethod.findMany({ orderBy: { nameEn: "asc" } }).catch(() => []),
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
    if (query.method) params.set("method", query.method);
    if (query.sort) params.set("sort", query.sort);
    if (query.q) params.set("q", query.q);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    params.set("page", String(nextPage));
    return `/${locale}/admin/bookings?${params.toString()}`;
  };

  const canDecide = hasPermission(admin.role, "bookings:decide");
  const now = new Date();
  const hasFilters = Boolean(
    query.status || query.service || query.method || query.q || query.from || query.to || query.sort,
  );
  const dateOpts = {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    numberingSystem: "latn",
  } as Intl.DateTimeFormatOptions;
  const timeOpts = {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    numberingSystem: "latn",
  } as Intl.DateTimeFormatOptions;
  const createdOpts = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    numberingSystem: "latn",
  } as Intl.DateTimeFormatOptions;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, page * PAGE_SIZE);

  const field =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20";
  const label = "mb-1 block text-xs font-medium text-slate-500";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {dict.admin.bookingsTitle}
            </h1>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-semibold text-brand-800 ring-1 ring-inset ring-brand-600/20">
              {total}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{x.bookingsSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${locale}/admin/customers`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
          >
            <Icon name="customers" width={16} height={16} />
            {x.quickCustomers}
          </Link>
          <Link
            href={`/${locale}/admin/history`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
          >
            <Icon name="history" width={16} height={16} />
            {x.quickHistory}
          </Link>
          <Link
            href={`/${locale}/admin/calendar`}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.98]"
          >
            <Icon name="calendar" width={16} height={16} />
            {dict.nav.calendar}
          </Link>
        </div>
      </header>

      {query.error === "invalid" && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {dict.admin.actionFailed}
        </p>
      )}

      <form
        method="get"
        action={`/${locale}/admin/bookings`}
        aria-label={x.filtersTitle}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="q" className={label}>
              {dict.common.search}
            </label>
            <div className="relative">
              <Icon
                name="search"
                width={16}
                height={16}
                className="pointer-events-none absolute inset-y-0 start-3 my-auto text-slate-400"
              />
              <input
                id="q"
                name="q"
                defaultValue={query.q ?? ""}
                placeholder={x.searchBookings}
                className={`${field} ps-9`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="status" className={label}>
              {dict.common.status}
            </label>
            <select id="status" name="status" defaultValue={query.status ?? ""} className={field}>
              <option value="">{dict.common.all}</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="service" className={label}>
              {dict.admin.service}
            </label>
            <select id="service" name="service" defaultValue={query.service ?? ""} className={field}>
              <option value="">{dict.common.all}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {locale === "ar" ? service.titleAr : service.titleEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="method" className={label}>
              {x.method}
            </label>
            <select id="method" name="method" defaultValue={query.method ?? ""} className={field}>
              <option value="">{dict.common.all}</option>
              {methods.map((method) => (
                <option key={method.id} value={method.id}>
                  {locale === "ar" ? method.nameAr : method.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sort" className={label}>
              {x.sort}
            </label>
            <select id="sort" name="sort" defaultValue={sort} className={field}>
              <option value="newest">{x.sortNewest}</option>
              <option value="oldest">{x.sortOldest}</option>
              <option value="appointment">{x.sortAppointment}</option>
            </select>
          </div>
          <div>
            <label htmlFor="from" className={label}>
              {dict.admin.fromDate}
            </label>
            <input id="from" name="from" type="date" defaultValue={query.from ?? ""} className={field} />
          </div>
          <div>
            <label htmlFor="to" className={label}>
              {dict.admin.toDate}
            </label>
            <input id="to" name="to" type="date" defaultValue={query.to ?? ""} className={field} />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-4 xl:justify-end">
            <button
              type="submit"
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.98] xl:flex-none"
            >
              <Icon name="search" width={16} height={16} />
              {dict.admin.applyFilters}
            </button>
            <Link
              href={`/${locale}/admin/bookings`}
              aria-disabled={!hasFilters}
              className={`inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition active:scale-[0.98] ${
                hasFilters
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  : "border-slate-100 bg-slate-50 text-slate-400"
              }`}
            >
              {x.resetFilters}
            </Link>
          </div>
        </div>
      </form>

      {bookings.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
            <Icon name="inbox" width={24} height={24} />
          </span>
          <p className="mt-4 text-base font-semibold text-slate-900">{x.emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-500">{hasFilters ? x.emptyHint : dict.admin.noBookings}</p>
          {hasFilters && (
            <Link
              href={`/${locale}/admin/bookings`}
              className="mt-4 inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {x.resetFilters}
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[calc(100vh-18rem)] min-h-[320px] overflow-auto" tabIndex={0} role="region" aria-label={dict.admin.bookingsTitle}>
            <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-xs font-semibold text-slate-500">
                  {[
                    dict.admin.reference,
                    dict.admin.customer,
                    dict.common.phone,
                    dict.admin.service,
                    x.method,
                    dict.admin.appointment,
                    dict.common.status,
                    x.payment,
                    x.created,
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-start"
                    >
                      {heading}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="sticky top-0 z-10 w-14 border-b border-slate-200 bg-slate-50 px-4 py-3 text-start"
                  >
                    <span className="sr-only">{x.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const approve = canDecide && canApprove(booking, now);
                  const reject = canDecide && canReject(booking);
                  const cancel = canDecide && canCancel(booking);
                  const movable = cancel && booking.startAt.getTime() > now.getTime();
                  const detailsHref = `/${locale}/admin/bookings/${booking.id}`;
                  const initials = booking.customerName
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part.charAt(0))
                    .join("")
                    .toUpperCase();
                  const cell = "border-b border-slate-100 px-4 py-3 align-middle group-last:border-b-0";
                  return (
                    <tr key={booking.id} className="group transition-colors hover:bg-slate-50/80">
                      <td className={`${cell} whitespace-nowrap`}>
                        <CopyRef
                          value={booking.publicReference}
                          copyLabel={x.copyRef}
                          copiedLabel={x.copiedRef}
                        />
                      </td>
                      <td className={cell}>
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-800 ring-1 ring-inset ring-brand-600/10"
                          >
                            {initials || "?"}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/${locale}/admin/customers/${encodeURIComponent(booking.customerEmail.toLowerCase())}`}
                              className="block max-w-[200px] truncate font-semibold text-slate-900 hover:text-brand-700"
                              title={booking.customerName}
                            >
                              {booking.customerName}
                            </Link>
                            <span
                              className="ltr-token block max-w-[200px] truncate text-xs text-slate-500"
                              title={booking.customerEmail}
                            >
                              {booking.customerEmail}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={`${cell} whitespace-nowrap text-slate-700`}>
                        <span className="ltr-token tabular-nums">{booking.customerPhone}</span>
                      </td>
                      <td className={`${cell} text-slate-700`}>
                        <span
                          className="block max-w-[180px] truncate"
                          title={locale === "ar" ? booking.service.titleAr : booking.service.titleEn}
                        >
                          {locale === "ar" ? booking.service.titleAr : booking.service.titleEn}
                        </span>
                      </td>
                      <td className={`${cell} whitespace-nowrap text-slate-700`}>
                        <span className="inline-flex items-center gap-2">
                          <Icon
                            name={methodIcon(booking.method.nameEn, booking.method.nameAr)}
                            width={16}
                            height={16}
                            className="text-slate-400"
                          />
                          {locale === "ar" ? booking.method.nameAr : booking.method.nameEn}
                        </span>
                      </td>
                      <td className={`${cell} whitespace-nowrap`}>
                        <p className="font-semibold text-slate-900">
                          {formatDateTime(booking.startAt, booking.timezone, locale, dateOpts)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          <span className="ltr-token tabular-nums">
                            {formatDateTime(booking.startAt, booking.timezone, locale, timeOpts)}
                            {" – "}
                            {formatDateTime(booking.endAt, booking.timezone, locale, timeOpts)}
                          </span>
                        </p>
                      </td>
                      <td className={`${cell} whitespace-nowrap`}>
                        <StatusBadge status={booking.status} dict={dict} />
                      </td>
                      <td className={`${cell} whitespace-nowrap`}>
                        <PaymentBadge status={booking.paymentStatus} dict={dict} />
                      </td>
                      <td className={`${cell} whitespace-nowrap text-xs text-slate-500`}>
                        {formatDateTime(booking.createdAt, booking.timezone, locale, createdOpts)}
                      </td>
                      <td className={`${cell} whitespace-nowrap`}>
                        <RowActions
                          bookingId={booking.id}
                          locale={locale}
                          detailsHref={detailsHref}
                          rescheduleHref={movable ? `${detailsHref}#reschedule` : null}
                          canApprove={approve}
                          canReject={reject}
                          canCancel={cancel}
                          labels={{
                            actions: x.actions,
                            view: x.viewDetails,
                            approve: dict.admin.approve,
                            reject: dict.admin.reject,
                            cancel: dict.admin.cancelBooking,
                            reschedule: x.rescheduleAction,
                            approveConfirm: dict.admin.approveConfirm,
                            rejectConfirm: dict.admin.rejectConfirm,
                            cancelConfirm: dict.admin.cancelConfirm,
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm">
            <p className="text-slate-500">
              {x.showing}{" "}
              <span className="font-semibold text-slate-900 tabular-nums">
                {rangeStart}–{rangeEnd}
              </span>{" "}
              {x.of} <span className="font-semibold text-slate-900 tabular-nums">{total}</span>
            </p>
            {pageCount > 1 && (
              <nav className="flex items-center gap-2" aria-label="Pagination">
                {page > 1 ? (
                  <Link
                    href={buildPageHref(page - 1)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                  >
                    <Icon name="chevron" width={14} height={14} className="rotate-180 rtl:rotate-0" />
                    {dict.common.previous}
                  </Link>
                ) : (
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-100 px-3 text-slate-300">
                    <Icon name="chevron" width={14} height={14} className="rotate-180 rtl:rotate-0" />
                    {dict.common.previous}
                  </span>
                )}
                <span className="px-1 text-slate-500 tabular-nums">
                  {page} / {pageCount}
                </span>
                {page < pageCount ? (
                  <Link
                    href={buildPageHref(page + 1)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                  >
                    {dict.common.next}
                    <Icon name="chevron" width={14} height={14} className="rtl:rotate-180" />
                  </Link>
                ) : (
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-100 px-3 text-slate-300">
                    {dict.common.next}
                    <Icon name="chevron" width={14} height={14} className="rtl:rotate-180" />
                  </span>
                )}
              </nav>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Picks a small icon from the method's name; falls back to a neutral one. */
function methodIcon(nameEn: string, nameAr: string): string {
  const text = `${nameEn} ${nameAr}`.toLowerCase();
  if (/video|zoom|meet|teams|فيديو|مرئي/.test(text)) return "video";
  if (/whatsapp|chat|message|واتس|محادثة|رسائل/.test(text)) return "chat";
  if (/phone|call|voice|هاتف|اتصال|صوت/.test(text)) return "phone";
  if (/person|office|visit|in-person|حضور|مكتب|زيارة/.test(text)) return "pin";
  return "methods";
}
