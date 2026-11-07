import "server-only";
import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db/prisma";

export const CUSTOMER_PAGE_SIZE = 20;

export type CustomerRow = {
  email: string;
  name: string;
  phone: string;
  total: number;
  first: Date;
  last: Date;
};

export type CustomerSort = "recent" | "bookings" | "name";

/**
 * Customers are derived from Booking rows (no separate model exists), grouped
 * by lower-cased email. Name and phone come from the most recent booking.
 */
export async function listCustomers(params: {
  search?: string;
  minBookings: number;
  sort: CustomerSort;
  page: number;
}): Promise<{ rows: CustomerRow[]; total: number }> {
  const db = getDb();
  const filters: Prisma.Sql[] = [];
  if (params.search) {
    const pattern = `%${params.search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    filters.push(
      Prisma.sql`("customerName" ILIKE ${pattern} OR "customerEmail" ILIKE ${pattern} OR "customerPhone" ILIKE ${pattern})`,
    );
  }
  const where = filters.length ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}` : Prisma.empty;
  const having = Prisma.sql`HAVING COUNT(*) >= ${params.minBookings}`;
  const order =
    params.sort === "bookings"
      ? Prisma.sql`ORDER BY total DESC, last DESC`
      : params.sort === "name"
        ? Prisma.sql`ORDER BY name ASC`
        : Prisma.sql`ORDER BY last DESC`;
  const offset = (params.page - 1) * CUSTOMER_PAGE_SIZE;

  const [rows, totalRows] = await Promise.all([
    db.$queryRaw<CustomerRow[]>(Prisma.sql`
      SELECT lower("customerEmail") AS email,
             (array_agg("customerName" ORDER BY "createdAt" DESC))[1] AS name,
             (array_agg("customerPhone" ORDER BY "createdAt" DESC))[1] AS phone,
             COUNT(*)::int AS total,
             MIN("createdAt") AS first,
             MAX("createdAt") AS last
      FROM "Booking"
      ${where}
      GROUP BY lower("customerEmail")
      ${having}
      ${order}
      LIMIT ${CUSTOMER_PAGE_SIZE} OFFSET ${offset}
    `),
    db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count FROM (
        SELECT 1 FROM "Booking" ${where}
        GROUP BY lower("customerEmail") ${having}
      ) AS grouped
    `),
  ]);

  return { rows, total: totalRows[0]?.count ?? 0 };
}

export async function getCustomer(email: string) {
  const db = getDb();
  const bookings = await db.booking.findMany({
    where: { customerEmail: { equals: email, mode: "insensitive" } },
    orderBy: { startAt: "desc" },
    include: { service: true, method: true },
  });
  if (bookings.length === 0) return null;
  const latest = [...bookings].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!;
  return {
    email: email.toLowerCase(),
    name: latest.customerName,
    phone: latest.customerPhone,
    bookings,
  };
}

