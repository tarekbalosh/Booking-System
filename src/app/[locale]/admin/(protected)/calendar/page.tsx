import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/prisma";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { getBusinessSettings, DEFAULT_SETTINGS } from "@/lib/booking/settings";
import {
  todayKey as getTodayKey,
  addDaysToKey,
  zonedDateTimeToUtc,
  formatDate,
  formatDateTime,
} from "@/lib/timezone";
import {
  addAvailabilityExceptionAction,
  deleteAvailabilityExceptionAction,
} from "@/server/actions/admin-schedule";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; date?: string; error?: string; saved?: string }>;
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

  const todayDateKey = getTodayKey(timezone);
  const selectedDate = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : todayDateKey;
  const isDayView = query.view === "day";

  // Days to show: 1 day for day view, 7 days starting from selectedDate for week view
  const dayCount = isDayView ? 1 : 7;
  const days: string[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    days.push(addDaysToKey(selectedDate, i));
  }

  const firstDay = days[0] ?? todayDateKey;
  const lastDay = days[days.length - 1] ?? firstDay;
  const startUtc = zonedDateTimeToUtc(firstDay, "00:00", timezone);
  const endUtc = zonedDateTimeToUtc(addDaysToKey(lastDay, 1), "00:00", timezone);

  const [bookings, exceptions] = await Promise.all([
    db.booking.findMany({
      where: {
        startAt: { gte: startUtc, lt: endUtc },
      },
      include: { service: true, method: true },
      orderBy: { startAt: "asc" },
    }),
    db.availabilityException.findMany({
      where: {
        date: {
          gte: new Date(`${firstDay}T00:00:00Z`),
          lte: new Date(`${lastDay}T23:59:59Z`),
        },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const prevDate = addDaysToKey(selectedDate, isDayView ? -1 : -7);
  const nextDate = addDaysToKey(selectedDate, isDayView ? 1 : 7);

  // Group bookings by day key
  const bookingsByDay: Record<string, typeof bookings> = {};
  for (const day of days) {
    bookingsByDay[day] = [];
  }
  for (const booking of bookings) {
    for (const d of days) {
      const dStart = zonedDateTimeToUtc(d, "00:00", timezone);
      const dEnd = zonedDateTimeToUtc(addDaysToKey(d, 1), "00:00", timezone);
      if (booking.startAt >= dStart && booking.startAt < dEnd) {
        const list = bookingsByDay[d];
        if (list) list.push(booking);
        break;
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{dict.admin.calendarTitle}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {dict.common.timezone}: {timezone}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Day / Week View Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <Link
              href={`/${locale}/admin/calendar?view=week&date=${selectedDate}`}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                !isDayView ? "bg-brand-700 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {dict.admin.weekView}
            </Link>
            <Link
              href={`/${locale}/admin/calendar?view=day&date=${selectedDate}`}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                isDayView ? "bg-brand-700 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {dict.admin.dayView}
            </Link>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1">
            <Link
              href={`/${locale}/admin/calendar?view=${isDayView ? "day" : "week"}&date=${prevDate}`}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              ←
            </Link>
            <Link
              href={`/${locale}/admin/calendar?view=${isDayView ? "day" : "week"}&date=${todayDateKey}`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {dict.common.date} (اليوم)
            </Link>
            <Link
              href={`/${locale}/admin/calendar?view=${isDayView ? "day" : "week"}&date=${nextDate}`}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              →
            </Link>
          </div>
        </div>
      </div>

      {query.saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ {dict.common.save}
        </div>
      )}

      {/* Calendar Grid */}
      <div className={`grid gap-4 ${isDayView ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-7"}`}>
        {days.map((day) => {
          const dayBookings = bookingsByDay[day] ?? [];
          const dayExceptions = exceptions.filter(
            (e) => e.date.toISOString().slice(0, 10) === day,
          );
          const isToday = day === todayDateKey;

          return (
            <div
              key={day}
              className={`flex flex-col rounded-xl border bg-white p-3 shadow-sm ${
                isToday ? "border-brand-500 ring-2 ring-brand-500/20" : "border-slate-200"
              }`}
            >
              <div className="mb-3 border-b border-slate-100 pb-2">
                <p className="text-xs font-medium text-slate-500">
                  {formatDate(new Date(`${day}T00:00:00Z`), timezone, locale, {
                    weekday: "short",
                    month: "numeric",
                    day: "numeric",
                  })}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-slate-900">{day}</span>
                  {isToday && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
                      اليوم
                    </span>
                  )}
                </div>
              </div>

              {/* Day Exceptions */}
              {dayExceptions.map((ex) => (
                <div
                  key={ex.id}
                  className={`mb-2 rounded-lg p-2 text-xs ${
                    ex.type === "CLOSED"
                      ? "border border-rose-200 bg-rose-50 text-rose-800"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                  }`}
                >
                  <p className="font-semibold">
                    {ex.type === "CLOSED" ? dict.admin.exceptionClosed : dict.admin.exceptionOpened}
                    {ex.startTime && ex.endTime ? ` (${ex.startTime} - ${ex.endTime})` : ` (${dict.admin.fullDay})`}
                  </p>
                  {ex.reason && <p className="mt-0.5 text-[11px] opacity-80">{ex.reason}</p>}
                </div>
              ))}

              {/* Bookings List for Day */}
              <div className="space-y-2">
                {dayBookings.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">
                    {dict.common.none}
                  </p>
                ) : (
                  dayBookings.map((b) => {
                    const statusColor =
                      b.status === "APPROVED"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400"
                        : b.status === "PENDING_APPROVAL"
                        ? "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300";

                    return (
                      <Link
                        key={b.id}
                        href={`/${locale}/admin/bookings/${b.id}`}
                        className={`block rounded-lg border p-2 text-xs transition ${statusColor}`}
                      >
                        <div className="flex items-center justify-between font-mono font-semibold">
                          <span>
                            {formatDateTime(b.startAt, timezone, locale, { timeStyle: "short" })}
                          </span>
                          <span className="text-[10px] opacity-75">{b.publicReference}</span>
                        </div>
                        <p className="mt-1 truncate font-medium">{b.customerName}</p>
                        <p className="truncate text-[11px] opacity-75">
                          {locale === "ar" ? b.service.titleAr : b.service.titleEn}
                        </p>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Exception Management Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{dict.admin.addException}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {dict.admin.exceptions} — {dict.admin.closeDay} / {dict.admin.closePeriod}
        </p>

        <form action={addAvailabilityExceptionAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <input type="hidden" name="locale" value={locale} />

          <div>
            <label htmlFor="dateKey" className="block text-xs font-medium text-slate-700">
              {dict.admin.exceptionDate}
            </label>
            <input
              id="dateKey"
              name="dateKey"
              type="date"
              defaultValue={selectedDate}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-xs font-medium text-slate-700">
              {dict.admin.exceptionType}
            </label>
            <select
              id="type"
              name="type"
              defaultValue="CLOSED"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            >
              <option value="CLOSED">{dict.admin.exceptionClosed}</option>
              <option value="OPEN">{dict.admin.exceptionOpened}</option>
            </select>
          </div>

          <div>
            <label htmlFor="startTime" className="block text-xs font-medium text-slate-700">
              {dict.admin.startTime} ({dict.common.optional})
            </label>
            <input
              id="startTime"
              name="startTime"
              type="time"
              placeholder="10:00"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label htmlFor="endTime" className="block text-xs font-medium text-slate-700">
              {dict.admin.endTime} ({dict.common.optional})
            </label>
            <input
              id="endTime"
              name="endTime"
              type="time"
              placeholder="16:00"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label htmlFor="reason" className="block text-xs font-medium text-slate-700">
              {dict.admin.reason}
            </label>
            <input
              id="reason"
              name="reason"
              type="text"
              placeholder="إجازة رسمية / ظرف خاص"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div className="flex items-end">
            <SubmitButton className="w-full rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800">
              {dict.admin.addException}
            </SubmitButton>
          </div>
        </form>

        {exceptions.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold text-slate-800">{dict.admin.exceptions}</h3>
            <ul className="mt-2 divide-y divide-slate-100">
              {exceptions.map((ex) => (
                <li key={ex.id} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span className="font-mono font-medium text-slate-900">
                      {ex.date.toISOString().slice(0, 10)}
                    </span>
                    <span
                      className={`mx-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        ex.type === "CLOSED" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {ex.type === "CLOSED" ? dict.admin.exceptionClosed : dict.admin.exceptionOpened}
                    </span>
                    {ex.startTime && ex.endTime ? `${ex.startTime} - ${ex.endTime}` : dict.admin.fullDay}
                    {ex.reason && <span className="text-slate-500"> · {ex.reason}</span>}
                  </div>
                  <form action={deleteAvailabilityExceptionAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={ex.id} />
                    <button
                      type="submit"
                      className="text-xs text-rose-600 hover:text-rose-800"
                    >
                      {dict.common.delete}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
