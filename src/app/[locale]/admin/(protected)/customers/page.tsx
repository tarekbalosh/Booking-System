import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getAdminExtra } from "@/lib/i18n/admin-extra";
import { isLocale } from "@/lib/i18n/config";
import { getBusinessSettings, DEFAULT_SETTINGS } from "@/lib/booking/settings";
import { formatDateTime } from "@/lib/timezone";
import {
  CUSTOMER_PAGE_SIZE,
  listCustomers,
  type CustomerSort,
} from "@/server/services/admin-customers";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; min?: string; sort?: string; page?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  await requireAdminPage(locale, "bookings:view");
  const dict = getDictionary(locale);
  const x = getAdminExtra(locale);
  const base = `/${locale}/admin/customers`;

  let timezone = DEFAULT_SETTINGS.timezone;
  try {
    timezone = (await getBusinessSettings()).timezone;
  } catch {
    timezone = DEFAULT_SETTINGS.timezone;
  }

  const search = query.q?.trim().slice(0, 100) || undefined;
  const minBookings = Math.min(100, Math.max(1, Number(query.min) || 1));
  const sort: CustomerSort = query.sort === "bookings" || query.sort === "name" ? query.sort : "recent";
  const page = Math.max(1, Number(query.page) || 1);

  let data: Awaited<ReturnType<typeof listCustomers>> | null = null;
  try {
    data = await listCustomers({ search, minBookings, sort, page });
  } catch {
    data = null;
  }

  const pageCount = data ? Math.max(1, Math.ceil(data.total / CUSTOMER_PAGE_SIZE)) : 1;
  const pageHref = (next: number) => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (minBookings > 1) p.set("min", String(minBookings));
    if (sort !== "recent") p.set("sort", sort);
    p.set("page", String(next));
    return `${base}?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{x.customersTitle}</h1>
        <p className="mt-1 text-sm text-slate-600">{x.customersHint}</p>
      </header>

      <form
        method="get"
        action={base}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="lg:col-span-2">
          <label htmlFor="q" className="block text-xs font-medium text-slate-600">{dict.common.search}</label>
          <input id="q" name="q" defaultValue={search ?? ""} placeholder={x.searchBookings}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="min" className="block text-xs font-medium text-slate-600">{x.minBookings}</label>
          <input id="min" name="min" type="number" min={1} defaultValue={minBookings}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="sort" className="block text-xs font-medium text-slate-600">{x.sort}</label>
          <select id="sort" name="sort" defaultValue={sort}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
            <option value="recent">{x.lastBooking}</option>
            <option value="bookings">{x.totalBookingsCol}</option>
            <option value="name">{dict.common.name}</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
            {dict.admin.applyFilters}
          </button>
          <Link href={base} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            {dict.admin.clearFilters}
          </Link>
        </div>
      </form>

      {!data ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{x.errorLoading}</p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">{x.noCustomers}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-sand-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start">{dict.common.name}</th>
                <th className="px-4 py-3 text-start">{dict.common.email}</th>
                <th className="px-4 py-3 text-start">{dict.common.phone}</th>
                <th className="px-4 py-3 text-start">{x.totalBookingsCol}</th>
                <th className="px-4 py-3 text-start">{x.lastBooking}</th>
                <th className="px-4 py-3 text-start">{dict.common.details}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row) => (
                <tr key={row.email} className="hover:bg-sand-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-700" dir="ltr">{row.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700" dir="ltr">{row.phone}</td>
                  <td className="px-4 py-3 text-slate-700">{row.total}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(row.last, timezone, locale)}</td>
                  <td className="px-4 py-3">
                    <Link href={`${base}/${encodeURIComponent(row.email)}`} className="font-semibold text-brand-700 hover:text-brand-900">
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
          {page > 1 ? <Link href={pageHref(page - 1)} className="text-brand-700">← {dict.common.previous}</Link> : <span />}
          <span className="text-slate-500">{page} / {pageCount}</span>
          {page < pageCount ? <Link href={pageHref(page + 1)} className="text-brand-700">{dict.common.next} →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

