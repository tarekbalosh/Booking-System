import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db/prisma";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getAdminExtra } from "@/lib/i18n/admin-extra";
import { isLocale } from "@/lib/i18n/config";
import { BOOKING_STATUSES, parseBookingStatus } from "@/lib/booking/status";
import { getBusinessSettings, DEFAULT_SETTINGS } from "@/lib/booking/settings";
import { formatDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AdminHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; to?: string; order?: string; page?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  await requireAdminPage(locale, "bookings:view");
  const dict = getDictionary(locale);
  const x = getAdminExtra(locale);
  const base = `/${locale}/admin/history`;
  const db = getDb();

  let timezone = DEFAULT_SETTINGS.timezone;
  try {
    timezone = (await getBusinessSettings()).timezone;
  } catch {
    timezone = DEFAULT_SETTINGS.timezone;
  }

  const search = query.q?.trim().slice(0, 100) || undefined;
  const toStatus = parseBookingStatus(query.to);
  const order = query.order === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(query.page) || 1);

  const where: Prisma.BookingStatusHistoryWhereInput = {};
  if (toStatus) where.toStatus = toStatus;
  if (search) {
    where.booking = {
      OR: [
        { publicReference: { contains: search.toUpperCase() } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  let data: {
    rows: Array<
      Prisma.BookingStatusHistoryGetPayload<{
        include: {
          admin: { select: { name: true } };
          booking: { select: { id: true; publicReference: true; customerName: true } };
        };
      }>
    >;
    total: number;
  } | null = null;
  try {
    const [rows, total] = await Promise.all([
      db.bookingStatusHistory.findMany({
        where,
        orderBy: [{ createdAt: order }, { id: order }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          admin: { select: { name: true } },
          booking: { select: { id: true, publicReference: true, customerName: true } },
        },
      }),
      db.bookingStatusHistory.count({ where }),
    ]);
    data = { rows, total };
  } catch {
    data = null;
  }

  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const pageHref = (next: number) => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (toStatus) p.set("to", toStatus);
    if (order === "asc") p.set("order", "asc");
    p.set("page", String(next));
    return `${base}?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{x.historyTitle}</h1>
        {data && <p className="mt-1 text-sm text-slate-600">{data.total} {x.results}</p>}
      </header>

      <form method="get" action={base} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="block text-xs font-medium text-slate-600">{dict.common.search}</label>
          <input id="q" name="q" defaultValue={search ?? ""} placeholder={dict.admin.searchPlaceholder}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs font-medium text-slate-600">{x.to}</label>
          <select id="to" name="to" defaultValue={toStatus ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
            <option value="">{dict.common.all}</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="order" className="block text-xs font-medium text-slate-600">{x.sort}</label>
          <select id="order" name="order" defaultValue={order} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
            <option value="desc">{x.sortNewest}</option>
            <option value="asc">{x.sortOldest}</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">{dict.admin.applyFilters}</button>
          <Link href={base} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">{dict.admin.clearFilters}</Link>
        </div>
      </form>

      {!data ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{x.errorLoading}</p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">{x.noHistoryRows}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-sand-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start">{x.changedAt}</th>
                <th className="px-4 py-3 text-start">{dict.admin.reference}</th>
                <th className="px-4 py-3 text-start">{x.from}</th>
                <th className="px-4 py-3 text-start">{x.to}</th>
                <th className="px-4 py-3 text-start">{x.changedBy}</th>
                <th className="px-4 py-3 text-start">{x.note}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row) => (
                <tr key={row.id} className="hover:bg-sand-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(row.createdAt, timezone, locale)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/${locale}/admin/bookings/${row.booking.id}`} className="font-mono text-xs font-semibold text-brand-700">
                      {row.booking.publicReference}
                    </Link>
                    <p className="text-xs text-slate-500">{row.booking.customerName}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.fromStatus ?? x.initial}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.toStatus}</td>
                  <td className="px-4 py-3 text-slate-700">{row.admin?.name ?? x.system}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={row.note ?? undefined}>{row.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={pageHref(page - 1)} className="text-brand-700">← {dict.common.previous}</Link> : <span />}
          <span className="text-slate-500">{page} / {pageCount}</span>
          {page < pageCount ? <Link href={pageHref(page + 1)} className="text-brand-700">{dict.common.next} →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

