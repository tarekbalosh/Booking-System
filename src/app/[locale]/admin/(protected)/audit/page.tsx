import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/prisma";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/timezone";
import { getBusinessSettings, DEFAULT_SETTINGS } from "@/lib/booking/settings";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ entity?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  await requireAdminPage(locale, "audit:view");
  const dict = getDictionary(locale);
  const db = getDb();

  let timezone = DEFAULT_SETTINGS.timezone;
  try {
    timezone = (await getBusinessSettings()).timezone;
  } catch {
    timezone = DEFAULT_SETTINGS.timezone;
  }

  const logs = await db.auditLog.findMany({
    where: query.entity ? { entityType: query.entity } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      admin: {
        select: { name: true, email: true, role: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{dict.admin.auditTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {locale === "ar"
              ? "سجل غير قابل للتعديل لجميع الإجراءات والتعديلات الحساسة في النظام."
              : "Immutable audit log of all sensitive administrative operations and mutations."}
          </p>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            {dict.admin.auditTitle} ({logs.length})
          </h2>
          <span className="text-xs text-slate-500">آخر 100 عملية مسجلة</span>
        </div>

        {logs.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{dict.admin.noAudit}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" dir={locale === "ar" ? "rtl" : "ltr"}>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{dict.admin.actor}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.action}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.entity}</th>
                  <th className="px-4 py-3 font-medium">التفاصيل والبيانات</th>
                  <th className="px-4 py-3 font-medium text-end">{dict.common.createdAt}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {log.admin ? (
                        <div>
                          <p className="font-semibold text-slate-900">{log.admin.name}</p>
                          <p className="font-mono text-xs text-slate-500">{log.admin.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs italic text-slate-500">النظام / مجدول</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-medium text-slate-700">{log.entityType}</span>
                      {log.entityId && (
                        <span className="block font-mono text-[11px] text-slate-400 truncate max-w-[140px]">
                          {log.entityId}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">
                      {log.metadata ? (
                        <pre className="max-w-xs truncate overflow-x-auto text-[11px] bg-slate-50 p-1.5 rounded border border-slate-100">
                          {JSON.stringify(log.metadata)}
                        </pre>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 text-end font-mono">
                      {formatDateTime(log.createdAt, timezone, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
