import { getDb } from "@/lib/db/prisma";
import { getAdminExtra } from "@/lib/i18n/admin-extra";
import { formatDateTime } from "@/lib/timezone";
import Link from "next/link";

/** Read-only view of active (unreleased) slot locks and their parent bookings. */
export async function SlotLocksPanel({
  locale,
  timezone,
}: {
  locale: "ar" | "en";
  timezone: string;
}) {
  const x = getAdminExtra(locale);
  const now = new Date();
  const locks = await getDb()
    .slotLock.findMany({
      where: { releasedAt: null },
      orderBy: { startAt: "asc" },
      take: 100,
      include: {
        booking: {
          select: {
            id: true,
            publicReference: true,
            customerName: true,
            status: true,
            expiresAt: true,
          },
        },
      },
    })
    .catch(() => null);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{x.slotLocks}</h2>
      <p className="mt-1 text-xs text-slate-500">{x.slotLocksHint}</p>
      {locks === null ? (
        <p className="mt-4 text-sm text-rose-700">{x.errorLoading}</p>
      ) : locks.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{x.noLocks}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pe-4 text-start">{x.startEnd}</th>
                <th className="py-2 pe-4 text-start">{locale === "ar" ? "الحجز" : "Booking"}</th>
                <th className="py-2 pe-4 text-start">{locale === "ar" ? "الحالة" : "State"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {locks.map((lock) => {
                const pending = lock.booking.status === "PENDING_APPROVAL";
                const overdue = pending && lock.booking.expiresAt.getTime() <= now.getTime();
                return (
                  <tr key={lock.id}>
                    <td className="whitespace-nowrap py-2 pe-4 text-slate-700">
                      {formatDateTime(lock.startAt, timezone, locale)}
                      <span className="block text-xs text-slate-500">
                        → {formatDateTime(lock.endAt, timezone, locale, { timeStyle: "short" })}
                      </span>
                    </td>
                    <td className="py-2 pe-4">
                      <Link
                        href={`/${locale}/admin/bookings/${lock.booking.id}`}
                        className="font-mono text-xs font-semibold text-brand-700"
                      >
                        {lock.booking.publicReference}
                      </Link>
                      <span className="block text-xs text-slate-500">{lock.booking.customerName}</span>
                    </td>
                    <td className="py-2 pe-4 text-xs">
                      {pending ? (
                        <span className={overdue ? "text-amber-800" : "text-sky-800"}>
                          {overdue ? x.holdOverdue : x.holdActive} · {x.holdExpires}{" "}
                          {formatDateTime(lock.booking.expiresAt, timezone, locale, { timeStyle: "short" })}
                        </span>
                      ) : (
                        <span className="text-emerald-800">{x.confirmedSlot}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

