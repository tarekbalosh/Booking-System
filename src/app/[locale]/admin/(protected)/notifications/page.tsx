import Link from "next/link";
import { notFound } from "next/navigation";
import type { NotificationStatus } from "@prisma/client";
import { getDb } from "@/lib/db/prisma";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/timezone";
import { getBusinessSettings, DEFAULT_SETTINGS } from "@/lib/booking/settings";
import { retryNotificationAction } from "@/server/actions/admin-bookings";
import { hasPermission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; retry?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const currentAdmin = await requireAdminPage(locale, "notifications:view");
  const dict = getDictionary(locale);
  const db = getDb();

  let timezone = DEFAULT_SETTINGS.timezone;
  try {
    timezone = (await getBusinessSettings()).timezone;
  } catch {
    timezone = DEFAULT_SETTINGS.timezone;
  }

  const statusFilter =
    query.status && ["PENDING", "SENT", "FAILED", "SKIPPED"].includes(query.status)
      ? (query.status as NotificationStatus)
      : undefined;

  const logs = await db.notificationLog.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      booking: {
        select: { id: true, publicReference: true, customerName: true },
      },
    },
  });

  const canRetry = hasPermission(currentAdmin.role, "notifications:retry");

  const retryFeedback =
    query.retry === "sent"
      ? "تمت إعادة إرسال الإشعار بنجاح."
      : query.retry === "already_sent"
      ? "تم إرسال هذا الإشعار مسبقًا."
      : query.retry === "max_attempts"
      ? "تجاوز الإشعار الحد الأقصى للمحاولات."
      : query.retry === "not_configured"
      ? "واتساب غير مهيأ (الوضع التجريبي)."
      : query.retry === "not_retryable"
      ? "لا يمكن إعادة إرسال هذا السجل."
      : query.retry
      ? "فشلت إعادة الإرسال."
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{dict.admin.notificationsTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {locale === "ar"
              ? "سجل إشعارات WhatsApp مع حالات الإرسال وتفاصيل الأخطاء والمحاولات."
              : "WhatsApp notification delivery log with status, attempts, and retry mechanism."}
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {["ALL", "PENDING", "SENT", "FAILED", "SKIPPED"].map((st) => {
            const active = (!statusFilter && st === "ALL") || statusFilter === st;
            return (
              <Link
                key={st}
                href={st === "ALL" ? `/${locale}/admin/notifications` : `/${locale}/admin/notifications?status=${st}`}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  active ? "bg-brand-700 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st === "ALL"
                  ? dict.common.all
                  : st === "SENT"
                  ? "مرسل"
                  : st === "PENDING"
                  ? "قيد الانتظار"
                  : st === "FAILED"
                  ? "فشل"
                  : "تم التخطي"}
              </Link>
            );
          })}
        </div>
      </div>

      {retryFeedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            query.retry === "sent"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {retryFeedback}
        </div>
      )}

      {/* Notifications Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">
            {dict.admin.notificationsTitle} ({logs.length})
          </h2>
        </div>

        {logs.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{dict.admin.noNotifications}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" dir={locale === "ar" ? "rtl" : "ltr"}>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{dict.admin.reference}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.recipient}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.notificationType}</th>
                  <th className="px-4 py-3 font-medium">{dict.common.status}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.attempts}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.sentAt}</th>
                  {canRetry && <th className="px-4 py-3 font-medium text-end">{dict.admin.retry}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const statusStyle =
                    log.status === "SENT"
                      ? "bg-emerald-100 text-emerald-800"
                      : log.status === "PENDING"
                      ? "bg-amber-100 text-amber-800"
                      : log.status === "FAILED"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-slate-100 text-slate-700";

                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/admin/bookings/${log.booking.id}`}
                          className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                        >
                          {log.booking.publicReference}
                        </Link>
                        <p className="text-xs text-slate-500">{log.booking.customerName}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{log.recipient}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <span className="font-mono">{log.notificationType}</span>
                        {log.errorCode && (
                          <p className="text-[11px] text-rose-600 font-mono mt-0.5">خطأ: {log.errorCode}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusStyle}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{log.attempts}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {log.sentAt
                          ? formatDateTime(log.sentAt, timezone, locale)
                          : formatDateTime(log.createdAt, timezone, locale)}
                      </td>
                      {canRetry && (
                        <td className="px-4 py-3 text-end">
                          {log.status !== "SENT" && (
                            <form action={retryNotificationAction}>
                              <input type="hidden" name="locale" value={locale} />
                              <input type="hidden" name="id" value={log.id} />
                              <button
                                type="submit"
                                className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700"
                              >
                                {dict.admin.retry}
                              </button>
                            </form>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
