import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/prisma";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { getBusinessSettings, DEFAULT_SETTINGS } from "@/lib/booking/settings";
import {
  saveAvailabilityRuleAction,
  toggleAvailabilityRuleAction,
  deleteAvailabilityRuleAction,
  saveScheduleSettingsAction,
  addAvailabilityExceptionAction,
  deleteAvailabilityExceptionAction,
} from "@/server/actions/admin-schedule";
import { SlotLocksPanel } from "@/components/admin/slot-locks-panel";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export default async function AdminAvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  await requireAdminPage(locale, "availability:manage");
  const dict = getDictionary(locale);
  const db = getDb();

  const [settings, rules, exceptions] = await Promise.all([
    getBusinessSettings().catch(() => DEFAULT_SETTINGS),
    db.availabilityRule.findMany({
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    }),
    db.availabilityException.findMany({
      orderBy: { date: "asc" },
      take: 50,
    }),
  ]);

  const weekdayNames = [
    dict.weekdays.sunday,
    dict.weekdays.monday,
    dict.weekdays.tuesday,
    dict.weekdays.wednesday,
    dict.weekdays.thursday,
    dict.weekdays.friday,
    dict.weekdays.saturday,
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{dict.admin.availabilityTitle}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {locale === "ar"
            ? "ضبط ساعات العمل الأسبوعية، مدة الجلسات، الفواصل، والحد الأقصى اليومي."
            : "Configure weekly working hours, session duration, buffers, and daily limits."}
        </p>
      </div>

      {query.saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ {dict.common.save}
        </div>
      )}
      {query.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          ✕ {query.error === "duplicate" ? "الفترة موجودة مسبقًا لنفس اليوم" : dict.common.error}
        </div>
      )}

      {/* General Schedule Settings Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">{dict.admin.scheduleDefaults}</h2>
        <p className="mt-1 text-xs text-slate-500">{dict.admin.timezoneHint}</p>

        <form action={saveScheduleSettingsAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="locale" value={locale} />

          <div>
            <label htmlFor="timezone" className="block text-xs font-semibold text-slate-700">
              {dict.common.timezone}
            </label>
            <input
              id="timezone"
              name="timezone"
              type="text"
              required
              defaultValue={settings.timezone}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="slotDurationMinutes" className="block text-xs font-semibold text-slate-700">
              {dict.admin.slotDuration}
            </label>
            <input
              id="slotDurationMinutes"
              name="slotDurationMinutes"
              type="number"
              min="15"
              max="240"
              step="5"
              required
              defaultValue={settings.slotDurationMinutes}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="bufferMinutes" className="block text-xs font-semibold text-slate-700">
              {dict.admin.buffer}
            </label>
            <input
              id="bufferMinutes"
              name="bufferMinutes"
              type="number"
              min="0"
              max="120"
              step="5"
              required
              defaultValue={settings.bufferMinutes}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="dailyMaxBookings" className="block text-xs font-semibold text-slate-700">
              {dict.admin.dailyMax}
            </label>
            <input
              id="dailyMaxBookings"
              name="dailyMaxBookings"
              type="number"
              min="1"
              max="50"
              required
              defaultValue={settings.dailyMaxBookings}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="bookingWindowDays" className="block text-xs font-semibold text-slate-700">
              {dict.admin.bookingWindow}
            </label>
            <input
              id="bookingWindowDays"
              name="bookingWindowDays"
              type="number"
              min="1"
              max="180"
              required
              defaultValue={settings.bookingWindowDays}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-5 flex justify-end pt-2">
            <SubmitButton className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800">
              {dict.common.save}
            </SubmitButton>
          </div>
        </form>
      </div>

      {/* Weekly Working Hours Rules */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">{dict.admin.weeklyRules}</h2>

        {/* Add Rule Form */}
        <form action={saveAvailabilityRuleAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <input type="hidden" name="locale" value={locale} />

          <div>
            <label htmlFor="weekday" className="block text-xs font-semibold text-slate-700">
              {dict.admin.weekday}
            </label>
            <select
              id="weekday"
              name="weekday"
              defaultValue="1"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {weekdayNames.map((name, idx) => (
                <option key={idx} value={idx}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="startTime" className="block text-xs font-semibold text-slate-700">
              {dict.admin.startTime}
            </label>
            <input
              id="startTime"
              name="startTime"
              type="time"
              defaultValue="10:00"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="endTime" className="block text-xs font-semibold text-slate-700">
              {dict.admin.endTime}
            </label>
            <input
              id="endTime"
              name="endTime"
              type="time"
              defaultValue="16:00"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2 pb-2">
              <input
                id="active"
                name="active"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="active" className="text-xs font-medium text-slate-700">
                {dict.common.active}
              </label>
            </div>
            <SubmitButton className="flex-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
              {dict.admin.addRule}
            </SubmitButton>
          </div>
        </form>

        {/* Existing Rules Table */}
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
          {rules.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">{dict.admin.noRules}</p>
          ) : (
            <table className="w-full text-left text-sm" dir={locale === "ar" ? "rtl" : "ltr"}>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{dict.admin.weekday}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.startTime}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.endTime}</th>
                  <th className="px-4 py-3 font-medium">{dict.common.status}</th>
                  <th className="px-4 py-3 font-medium text-end">{dict.common.details}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {weekdayNames[rule.weekday]}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{rule.startTime}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{rule.endTime}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          rule.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {rule.active ? dict.common.active : dict.common.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <form action={toggleAvailabilityRuleAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={rule.id} />
                          <input type="hidden" name="active" value={rule.active ? "false" : "true"} />
                          <button
                            type="submit"
                            className={`rounded px-2.5 py-1 text-xs font-medium ${
                              rule.active
                                ? "border border-amber-200 text-amber-700 hover:bg-amber-50"
                                : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {rule.active ? dict.admin.deactivate : dict.admin.activate}
                          </button>
                        </form>
                        <form action={deleteAvailabilityRuleAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={rule.id} />
                          <button
                            type="submit"
                            className="rounded border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          >
                            {dict.common.delete}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Holidays and Exceptions Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">{dict.admin.exceptions}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {dict.admin.closeDay} / {dict.admin.openPeriod}
        </p>

        <form action={addAvailabilityExceptionAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <input type="hidden" name="locale" value={locale} />

          <div>
            <label htmlFor="exDate" className="block text-xs font-semibold text-slate-700">
              {dict.admin.exceptionDate}
            </label>
            <input
              id="exDate"
              name="dateKey"
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label htmlFor="exType" className="block text-xs font-semibold text-slate-700">
              {dict.admin.exceptionType}
            </label>
            <select
              id="exType"
              name="type"
              defaultValue="CLOSED"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            >
              <option value="CLOSED">{dict.admin.exceptionClosed}</option>
              <option value="OPEN">{dict.admin.exceptionOpened}</option>
            </select>
          </div>

          <div>
            <label htmlFor="exStartTime" className="block text-xs font-semibold text-slate-700">
              {dict.admin.startTime} ({dict.common.optional})
            </label>
            <input
              id="exStartTime"
              name="startTime"
              type="time"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label htmlFor="exEndTime" className="block text-xs font-semibold text-slate-700">
              {dict.admin.endTime} ({dict.common.optional})
            </label>
            <input
              id="exEndTime"
              name="endTime"
              type="time"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label htmlFor="exReason" className="block text-xs font-semibold text-slate-700">
              {dict.admin.reason}
            </label>
            <input
              id="exReason"
              name="reason"
              type="text"
              placeholder="إجازة / مناسبة"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div className="flex items-end">
            <SubmitButton className="w-full rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800">
              {dict.admin.addException}
            </SubmitButton>
          </div>
        </form>

        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
          {exceptions.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">{dict.admin.noExceptions}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {exceptions.map((ex) => (
                <li key={ex.id} className="flex items-center justify-between p-3 text-xs">
                  <div>
                    <span className="font-mono font-bold text-slate-900">
                      {ex.date.toISOString().slice(0, 10)}
                    </span>
                    <span
                      className={`mx-2 rounded px-2 py-0.5 text-[10px] font-semibold ${
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
                      className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      {dict.common.delete}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <SlotLocksPanel locale={locale} timezone={settings.timezone} />
    </div>
  );
}
