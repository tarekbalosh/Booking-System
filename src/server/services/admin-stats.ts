import "server-only";
import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db/prisma";
import { addDaysToKey, todayKey } from "@/lib/timezone";

export type Granularity = "day" | "week" | "month" | "year";

export type SeriesPoint = { key: string; bookings: number; revenue: number };

const SERIES_LENGTH: Record<Granularity, number> = { day: 30, week: 12, month: 12, year: 5 };

function weekStart(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7; // Monday = 0
  return addDaysToKey(dateKey, -offset);
}

function shiftMonths(dateKey: string, months: number): string {
  const [year, month] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + months, 1));
  return date.toISOString().slice(0, 10);
}

/** Ordered bucket keys (YYYY-MM-DD of the bucket start) ending at the current bucket. */
export function bucketKeys(granularity: Granularity, timezone: string, now = new Date()): string[] {
  const today = todayKey(timezone, now);
  const length = SERIES_LENGTH[granularity];
  const keys: string[] = [];
  for (let i = length - 1; i >= 0; i -= 1) {
    if (granularity === "day") keys.push(addDaysToKey(today, -i));
    else if (granularity === "week") keys.push(addDaysToKey(weekStart(today), -7 * i));
    else if (granularity === "month") keys.push(shiftMonths(`${today.slice(0, 7)}-01`, -i));
    else keys.push(`${Number(today.slice(0, 4)) - i}-01-01`);
  }
  return keys;
}

export async function getBookingSeries(
  granularity: Granularity,
  timezone: string,
): Promise<{ points: SeriesPoint[]; currency: string | null }> {
  const db = getDb();
  const keys = bucketKeys(granularity, timezone);
  const first = keys[0] ?? todayKey(timezone);
  // Pad by a day each side so timezone offsets never drop edge rows.
  const since = new Date(`${addDaysToKey(first, -1)}T00:00:00Z`);

  const rows = await db.$queryRaw<
    Array<{ bucket: string; currency: string; bookings: number; revenue: number }>
  >(Prisma.sql`
    SELECT to_char(date_trunc(${granularity}, ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}), 'YYYY-MM-DD') AS bucket,
           "currencySnapshot" AS currency,
           COUNT(*)::int AS bookings,
           COALESCE(SUM(CASE WHEN "paymentStatus" = 'PAID' THEN "priceSnapshot" ELSE 0 END), 0)::float AS revenue
    FROM "Booking"
    WHERE "createdAt" >= ${since}
    GROUP BY 1, 2
  `);

  const totalsByCurrency = new Map<string, number>();
  for (const row of rows) {
    totalsByCurrency.set(row.currency, (totalsByCurrency.get(row.currency) ?? 0) + row.revenue);
  }
  const dominant =
    [...totalsByCurrency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const map = new Map<string, SeriesPoint>(keys.map((key) => [key, { key, bookings: 0, revenue: 0 }]));
  for (const row of rows) {
    const point = map.get(row.bucket);
    if (!point) continue;
    point.bookings += row.bookings;
    if (row.currency === dominant) point.revenue += row.revenue;
  }
  return { points: keys.map((key) => map.get(key)!), currency: dominant };
}

export async function getOverviewStats(timezone: string) {
  const db = getDb();
  const now = new Date();

  const [
    statusGroups,
    customerRows,
    revenueGroups,
    pendingValueGroups,
    upcoming,
    serviceGroups,
    methodGroups,
    services,
    methods,
    latestBookings,
    statusChanges,
    adminActivity,
    notifications,
    newCustomers,
  ] = await Promise.all([
    db.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    db.$queryRaw<Array<{ count: number }>>(
      Prisma.sql`SELECT COUNT(DISTINCT lower("customerEmail"))::int AS count FROM "Booking"`,
    ),
    db.booking.groupBy({
      by: ["currencySnapshot"],
      where: { paymentStatus: "PAID" },
      _sum: { priceSnapshot: true },
    }),
    db.booking.groupBy({
      by: ["currencySnapshot"],
      where: { status: "APPROVED", paymentStatus: { not: "PAID" } },
      _sum: { priceSnapshot: true },
    }),
    db.booking.count({ where: { status: "APPROVED", startAt: { gte: now } } }),
    db.booking.groupBy({ by: ["serviceId"], _count: { _all: true }, orderBy: { _count: { serviceId: "desc" } }, take: 5 }),
    db.booking.groupBy({ by: ["methodId"], _count: { _all: true }, orderBy: { _count: { methodId: "desc" } }, take: 5 }),
    db.consultationService.findMany({ select: { id: true, titleAr: true, titleEn: true } }),
    db.consultationMethod.findMany({ select: { id: true, nameAr: true, nameEn: true } }),
    db.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, customerName: true, publicReference: true, status: true, createdAt: true, timezone: true },
    }),
    db.bookingStatusHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        admin: { select: { name: true } },
        booking: { select: { id: true, publicReference: true, customerName: true } },
      },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { admin: { select: { name: true } } },
    }),
    db.notificationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        bookingId: true,
        notificationType: true,
        status: true,
        errorCode: true,
        createdAt: true,
      },
    }),
    db.$queryRaw<Array<{ email: string; name: string; first: Date; total: number }>>(Prisma.sql`
      SELECT lower("customerEmail") AS email,
             (array_agg("customerName" ORDER BY "createdAt" ASC))[1] AS name,
             MIN("createdAt") AS first,
             COUNT(*)::int AS total
      FROM "Booking"
      GROUP BY lower("customerEmail")
      ORDER BY MIN("createdAt") DESC
      LIMIT 6
    `),
  ]);

  const counts: Record<string, number> = Object.fromEntries(
    statusGroups.map((row) => [row.status, row._count._all]),
  );
  const total = statusGroups.reduce((sum, row) => sum + row._count._all, 0);
  void timezone;

  const serviceName = new Map(services.map((s) => [s.id, s]));
  const methodName = new Map(methods.map((m) => [m.id, m]));

  return {
    counts,
    total,
    customers: customerRows[0]?.count ?? 0,
    revenue: revenueGroups.map((r) => ({
      currency: r.currencySnapshot,
      amount: Number(r._sum.priceSnapshot ?? 0),
    })),
    unpaidConfirmed: pendingValueGroups.map((r) => ({
      currency: r.currencySnapshot,
      amount: Number(r._sum.priceSnapshot ?? 0),
    })),
    upcoming,
    popularServices: serviceGroups.map((row) => ({
      titleAr: row.serviceId ? (serviceName.get(row.serviceId)?.titleAr ?? "—") : "أخرى (استشارة مخصصة)",
      titleEn: row.serviceId ? (serviceName.get(row.serviceId)?.titleEn ?? "—") : "Other (Custom request)",
      count: row._count._all,
    })),
    popularMethods: methodGroups.map((row) => ({
      nameAr: methodName.get(row.methodId)?.nameAr ?? "—",
      nameEn: methodName.get(row.methodId)?.nameEn ?? "—",
      count: row._count._all,
    })),
    latestBookings,
    statusChanges,
    adminActivity,
    notifications,
    newCustomers,
  };
}

