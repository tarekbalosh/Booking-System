import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/prisma";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/timezone";

import { Prisma } from "@prisma/client";

type UpcomingBooking = Prisma.BookingGetPayload<{
  include: { service: true; method: true };
}>;
type RecentBooking = Prisma.BookingGetPayload<{
  include: { service: true };
}>;

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  if (!isLocale(locale)) notFound();
  await requireAdminPage(locale, "dashboard:view");
  const dict = getDictionary(locale);
  const db = getDb();
  const now = new Date();

  let data:
    | {
        pending: number;
        approved: number;
        closed: number;
        upcoming: UpcomingBooking[];
        recent: RecentBooking[];
      }
    | null = null;

  try {
    const [grouped, upcoming, recent] = await Promise.all([
      db.booking.groupBy({ by: ["status"], _count: { _all: true } }),
      db.booking.findMany({
        where: { status: "APPROVED", startAt: { gte: now } },
        orderBy: { startAt: "asc" },
        take: 5,
        include: { service: true, method: true },
      }),
      db.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { service: true },
      }),
    ]);
    const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
    data = {
      pending: counts.PENDING_APPROVAL ?? 0,
      approved: counts.APPROVED ?? 0,
      closed: (counts.EXPIRED ?? 0) + (counts.REJECTED ?? 0) + (counts.CANCELLED ?? 0),
      upcoming,
      recent,
    };
  } catch {
    data = null;
  }

  const stats = [
    {
      label: dict.admin.pending,
      value: data?.pending,
      href: `/${locale}/admin/bookings?status=PENDING_APPROVAL`,
      className: "border-amber-200 bg-amber-50 text-amber-900",
    },
    {
      label: dict.admin.approved,
      value: data?.approved,
      href: `/${locale}/admin/bookings?status=APPROVED`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    {
      label: dict.admin.closed,
      value: data?.closed,
      href: `/${locale}/admin/bookings?status=EXPIRED`,
      className: "border-slate-200 bg-white text-slate-800",
    },
    {
      label: dict.admin.upcoming,
      value: data?.upcoming.length,
      href: `/${locale}/admin/calendar`,
      className: "border-brand-200 bg-brand-50 text-brand-900",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{dict.common.dashboard}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {formatDateTime(now, "Asia/Kuala_Lumpur", locale, {
            dateStyle: "full",
            timeStyle: "short",
          })}
        </p>
      </header>

      {error === "forbidden" && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {dict.admin.forbidden}
        </p>
      )}

      {!data ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {dict.common.error}
        </p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={dict.common.dashboard}>
            {stats.map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className={`rounded-xl border p-5 shadow-sm transition hover:-translate-y-0.5 ${stat.className}`}
              >
                <p className="text-xs font-medium opacity-80">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold">{stat.value ?? 0}</p>
              </Link>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{dict.admin.upcoming}</h2>
                <Link href={`/${locale}/admin/bookings?status=APPROVED`} className="text-xs font-medium text-brand-700">
                  {dict.admin.viewAll}
                </Link>
              </div>
              {data.upcoming.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">{dict.admin.noData}</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {data.upcoming.map((booking) => (
                    <li key={booking.id} className="py-3">
                      <Link
                        href={`/${locale}/admin/bookings/${booking.id}`}
                        className="flex items-start justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{booking.customerName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {locale === "ar" ? booking.service.titleAr : booking.service.titleEn} ·{" "}
                            {formatDateTime(booking.startAt, booking.timezone, locale)}
                          </p>
                        </div>
                        <span className="font-mono text-xs text-slate-500">{booking.publicReference}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{dict.admin.recentActivity}</h2>
                <Link href={`/${locale}/admin/bookings`} className="text-xs font-medium text-brand-700">
                  {dict.admin.viewAll}
                </Link>
              </div>
              {data.recent.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">{dict.admin.noData}</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {data.recent.map((booking) => (
                    <li key={booking.id} className="py-3">
                      <Link
                        href={`/${locale}/admin/bookings/${booking.id}`}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{booking.customerName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatDateTime(booking.createdAt, booking.timezone, locale)}
                          </p>
                        </div>
                        <StatusBadge status={booking.status} dict={dict} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
