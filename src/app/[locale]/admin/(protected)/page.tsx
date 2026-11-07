import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getAdminExtra } from "@/lib/i18n/admin-extra";
import { isLocale } from "@/lib/i18n/config";
import { getBusinessSettings, DEFAULT_SETTINGS } from "@/lib/booking/settings";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarChart, DistributionBar, RankedBars } from "@/components/admin/charts";
import { formatDateTime } from "@/lib/timezone";
import {
  getBookingSeries,
  getOverviewStats,
  type Granularity,
} from "@/server/services/admin-stats";

export const dynamic = "force-dynamic";

const RANGES: Granularity[] = ["day", "week", "month", "year"];

function money(amount: number, currency: string, locale: "ar" | "en"): string {
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-MY" : "en-MY", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; range?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  await requireAdminPage(locale, "dashboard:view");
  const dict = getDictionary(locale);
  const x = getAdminExtra(locale);
  const base = `/${locale}/admin`;
  const now = new Date();
  const range: Granularity = RANGES.find((value) => value === query.range) ?? "day";

  let timezone = DEFAULT_SETTINGS.timezone;
  try {
    timezone = (await getBusinessSettings()).timezone;
  } catch {
    timezone = DEFAULT_SETTINGS.timezone;
  }

  let stats: Awaited<ReturnType<typeof getOverviewStats>> | null = null;
  let series: Awaited<ReturnType<typeof getBookingSeries>> | null = null;
  try {
    [stats, series] = await Promise.all([getOverviewStats(timezone), getBookingSeries(range, timezone)]);
  } catch {
    stats = null;
    series = null;
  }

  const rangeLabels: Record<Granularity, string> = {
    day: x.daily,
    week: x.weekly,
    month: x.monthly,
    year: x.yearly,
  };
  const formatKey = (key: string) => {
    const date = new Date(`${key}T00:00:00Z`);
    const opts: Intl.DateTimeFormatOptions =
      range === "year"
        ? { year: "numeric", timeZone: "UTC" }
        : range === "month"
          ? { month: "short", year: "2-digit", timeZone: "UTC" }
          : { month: "short", day: "numeric", timeZone: "UTC" };
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-MY" : "en-MY", opts).format(date);
  };

  const c = stats?.counts ?? {};
  const cards = stats
    ? [
        { label: x.totalBookings, value: stats.total, href: `${base}/bookings`, tone: "border-slate-200 bg-white text-slate-900" },
        { label: x.pendingBookings, value: c.PENDING_APPROVAL ?? 0, href: `${base}/bookings?status=PENDING_APPROVAL`, tone: "border-amber-200 bg-amber-50 text-amber-900" },
        { label: x.confirmedBookings, value: c.APPROVED ?? 0, href: `${base}/bookings?status=APPROVED`, tone: "border-emerald-200 bg-emerald-50 text-emerald-900" },
        { label: x.cancelledBookings, value: c.CANCELLED ?? 0, href: `${base}/bookings?status=CANCELLED`, tone: "border-slate-200 bg-slate-50 text-slate-800" },
        { label: x.totalCustomers, value: stats.customers, href: `${base}/customers`, tone: "border-sky-200 bg-sky-50 text-sky-900" },
        { label: x.upcomingConsultations, value: stats.upcoming, href: `${base}/calendar`, tone: "border-brand-200 bg-brand-50 text-brand-900" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{x.navOverview}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {formatDateTime(now, timezone, locale, { dateStyle: "full", timeStyle: "short" })}
        </p>
      </header>

      {query.error === "forbidden" && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {dict.admin.forbidden}
        </p>
      )}

      {!stats || !series ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {x.errorLoading}
        </p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={x.navOverview}>
            {cards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className={`rounded-xl border p-5 shadow-sm transition hover:-translate-y-0.5 ${card.tone}`}
              >
                <p className="text-xs font-medium opacity-80">{card.label}</p>
                <p className="mt-2 text-3xl font-bold">{card.value}</p>
              </Link>
            ))}
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 text-violet-900 shadow-sm">
              <p className="text-xs font-medium opacity-80">{x.paidRevenue}</p>
              {stats.revenue.length === 0 ? (
                <p className="mt-2 text-3xl font-bold">0</p>
              ) : (
                stats.revenue.map((r) => (
                  <p key={r.currency} className="mt-2 text-2xl font-bold">
                    {money(r.amount, r.currency, locale)}
                  </p>
                ))
              )}
              {stats.unpaidConfirmed.length > 0 && (
                <p className="mt-1 text-xs opacity-80">
                  {x.expectedRevenue}:{" "}
                  {stats.unpaidConfirmed.map((r) => money(r.amount, r.currency, locale)).join(" · ")}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900 shadow-sm">
              <p className="text-xs font-medium opacity-80">
                {x.rejectedBookings} / {x.expiredBookings}
              </p>
              <p className="mt-2 text-3xl font-bold">
                {c.REJECTED ?? 0} / {c.EXPIRED ?? 0}
              </p>
            </div>
          </section>

          <Card
            title={x.bookingsOverTime}
            action={
              <div className="flex gap-1" role="group" aria-label={x.bookingsOverTime}>
                {RANGES.map((value) => (
                  <Link
                    key={value}
                    href={`${base}?range=${value}`}
                    aria-current={value === range ? "true" : undefined}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      value === range
                        ? "bg-brand-700 text-white"
                        : "border border-slate-200 text-slate-600 hover:border-brand-400"
                    }`}
                  >
                    {rangeLabels[value]}
                  </Link>
                ))}
              </div>
            }
          >
            <BarChart points={series.points} field="bookings" label={x.bookingsOverTime} formatKey={formatKey} />
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title={x.statusDistribution}>
              <DistributionBar
                segments={[
                  { label: dict.status.pending, count: c.PENDING_APPROVAL ?? 0, color: "bg-amber-400" },
                  { label: dict.status.approved, count: c.APPROVED ?? 0, color: "bg-emerald-500" },
                  { label: dict.status.rejected, count: c.REJECTED ?? 0, color: "bg-rose-500" },
                  { label: dict.status.expired, count: c.EXPIRED ?? 0, color: "bg-slate-400" },
                  { label: dict.status.cancelled, count: c.CANCELLED ?? 0, color: "bg-slate-600" },
                ]}
              />
            </Card>
            <Card title={x.revenueOverTime}>
              {series.currency && series.points.some((p) => p.revenue > 0) ? (
                <>
                  <BarChart points={series.points} field="revenue" label={x.revenueOverTime} formatKey={formatKey} />
                  <p className="mt-2 text-xs text-slate-500">
                    {series.currency} · {x.revenueNote}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">{x.noRevenue}</p>
              )}
            </Card>
            <Card title={x.popularServices}>
              <RankedBars
                emptyLabel={dict.admin.noData}
                rows={stats.popularServices.map((s) => ({
                  label: locale === "ar" ? s.titleAr : s.titleEn,
                  count: s.count,
                }))}
              />
            </Card>
            <Card title={x.popularMethods}>
              <RankedBars
                emptyLabel={dict.admin.noData}
                rows={stats.popularMethods.map((m) => ({
                  label: locale === "ar" ? m.nameAr : m.nameEn,
                  count: m.count,
                }))}
              />
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card
              title={x.latestBookings}
              action={<Link href={`${base}/bookings`} className="text-xs font-medium text-brand-700">{dict.admin.viewAll}</Link>}
            >
              {stats.latestBookings.length === 0 ? (
                <p className="text-sm text-slate-500">{dict.admin.noData}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {stats.latestBookings.map((b) => (
                    <li key={b.id}>
                      <Link href={`${base}/bookings/${b.id}`} className="flex items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{b.customerName}</p>
                          <p className="text-xs text-slate-500">
                            {b.publicReference} · {formatDateTime(b.createdAt, b.timezone, locale)}
                          </p>
                        </div>
                        <StatusBadge status={b.status} dict={dict} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title={x.newCustomers}
              action={<Link href={`${base}/customers`} className="text-xs font-medium text-brand-700">{dict.admin.viewAll}</Link>}
            >
              {stats.newCustomers.length === 0 ? (
                <p className="text-sm text-slate-500">{dict.admin.noData}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {stats.newCustomers.map((cu) => (
                    <li key={cu.email}>
                      <Link
                        href={`${base}/customers/${encodeURIComponent(cu.email)}`}
                        className="flex items-center justify-between gap-2 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{cu.name}</p>
                          <p className="truncate text-xs text-slate-500">{cu.email}</p>
                        </div>
                        <span className="shrink-0 text-xs text-slate-500">
                          {cu.total} {x.bookings}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title={x.latestStatusChanges}
              action={<Link href={`${base}/history`} className="text-xs font-medium text-brand-700">{dict.admin.viewAll}</Link>}
            >
              {stats.statusChanges.length === 0 ? (
                <p className="text-sm text-slate-500">{x.noHistoryRows}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {stats.statusChanges.map((h) => (
                    <li key={h.id}>
                      <Link href={`${base}/bookings/${h.booking.id}`} className="block py-2.5">
                        <p className="text-sm text-slate-900">
                          {h.booking.customerName} · <span className="font-mono text-xs">{h.booking.publicReference}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {h.fromStatus ?? x.initial} → {h.toStatus} · {x.by} {h.admin?.name ?? x.system} ·{" "}
                          {formatDateTime(h.createdAt, timezone, locale)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title={x.recentAdminActivity}
              action={<Link href={`${base}/audit`} className="text-xs font-medium text-brand-700">{dict.admin.viewAll}</Link>}
            >
              {stats.adminActivity.length === 0 ? (
                <p className="text-sm text-slate-500">{dict.admin.noData}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {stats.adminActivity.map((a) => (
                    <li key={a.id} className="py-2.5">
                      <p className="text-sm text-slate-900">{a.action}</p>
                      <p className="text-xs text-slate-500">
                        {a.admin?.name ?? x.system} · {a.entityType} · {formatDateTime(a.createdAt, timezone, locale)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="xl:col-span-2">
              <Card
                title={x.latestNotifications}
                action={<Link href={`${base}/notifications`} className="text-xs font-medium text-brand-700">{dict.admin.viewAll}</Link>}
              >
                {stats.notifications.length === 0 ? (
                  <p className="text-sm text-slate-500">{dict.admin.noNotifications}</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {stats.notifications.map((n) => (
                      <li key={n.id}>
                        <Link href={`${base}/bookings/${n.bookingId}`} className="flex items-center justify-between gap-2 py-2.5">
                          <div>
                            <p className="text-sm text-slate-900">{n.notificationType}</p>
                            <p className="text-xs text-slate-500">
                              {formatDateTime(n.createdAt, timezone, locale)}
                              {n.errorCode ? ` · ${n.errorCode}` : ""}
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              n.status === "SENT"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                : n.status === "FAILED"
                                  ? "border-rose-300 bg-rose-50 text-rose-900"
                                  : "border-slate-300 bg-slate-100 text-slate-700"
                            }`}
                          >
                            {n.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
