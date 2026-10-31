import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/prisma";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { saveMethodAction, toggleMethodAction } from "@/server/actions/admin-catalog";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export default async function AdminMethodsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string; error?: string; edit?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  await requireAdminPage(locale, "methods:manage");
  const dict = getDictionary(locale);
  const db = getDb();

  const methods = await db.consultationMethod.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const editingMethod = query.edit
    ? methods.find((m) => m.id === query.edit)
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{dict.admin.methodsTitle}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {locale === "ar"
            ? "إدارة طرق وقنوات تقديم الاستشارة (مثل مكالمة فيديو، واتساب، مكالمة هاتفية، لقاء شخصي)."
            : "Manage consultation delivery channels (e.g. video call, WhatsApp, phone, in-person)."}
        </p>
      </div>

      {query.saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ {dict.common.save}
        </div>
      )}
      {query.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          ✕ {dict.common.error}
        </div>
      )}

      {/* Add / Edit Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">
          {editingMethod ? dict.admin.editMethod : dict.admin.addMethod}
        </h2>

        <form action={saveMethodAction} className="mt-4 space-y-4">
          <input type="hidden" name="locale" value={locale} />
          {editingMethod && <input type="hidden" name="id" value={editingMethod.id} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nameAr" className="block text-xs font-semibold text-slate-700">
                {dict.admin.methodNameAr}
              </label>
              <input
                id="nameAr"
                name="nameAr"
                type="text"
                required
                defaultValue={editingMethod?.nameAr ?? ""}
                dir="rtl"
                placeholder="مثال: مكالمة فيديو عبر Google Meet"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="nameEn" className="block text-xs font-semibold text-slate-700">
                {dict.admin.methodNameEn}
              </label>
              <input
                id="nameEn"
                name="nameEn"
                type="text"
                required
                defaultValue={editingMethod?.nameEn ?? ""}
                dir="ltr"
                placeholder="e.g. Video call via Google Meet"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="instructionsAr" className="block text-xs font-semibold text-slate-700">
                {dict.admin.instructionsAr} ({dict.common.optional})
              </label>
              <textarea
                id="instructionsAr"
                name="instructionsAr"
                rows={2}
                defaultValue={editingMethod?.instructionsAr ?? ""}
                dir="rtl"
                placeholder="سيتم إرسال رابط الاجتماع قبل الموعد بـ 15 دقيقة."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="instructionsEn" className="block text-xs font-semibold text-slate-700">
                {dict.admin.instructionsEn} ({dict.common.optional})
              </label>
              <textarea
                id="instructionsEn"
                name="instructionsEn"
                rows={2}
                defaultValue={editingMethod?.instructionsEn ?? ""}
                dir="ltr"
                placeholder="Meeting link will be sent 15 minutes before the session."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="w-32">
              <label htmlFor="sortOrder" className="block text-xs font-semibold text-slate-700">
                {dict.admin.sortOrder}
              </label>
              <input
                id="sortOrder"
                name="sortOrder"
                type="number"
                defaultValue={editingMethod?.sortOrder ?? 0}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                id="active"
                name="active"
                type="checkbox"
                defaultChecked={editingMethod ? editingMethod.active : true}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="active" className="text-xs font-medium text-slate-700">
                {dict.common.active}
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <SubmitButton className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800">
              {editingMethod ? dict.common.save : dict.common.add}
            </SubmitButton>
            {editingMethod && (
              <a
                href={`/${locale}/admin/methods`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {dict.common.cancel}
              </a>
            )}
          </div>
        </form>
      </div>

      {/* Methods Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">
            {dict.admin.methodsTitle} ({methods.length})
          </h2>
        </div>

        {methods.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{dict.admin.noMethods}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" dir={locale === "ar" ? "rtl" : "ltr"}>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{dict.admin.methodNameAr}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.methodNameEn}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.sortOrder}</th>
                  <th className="px-4 py-3 font-medium">{dict.common.status}</th>
                  <th className="px-4 py-3 font-medium text-end">{dict.common.details}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {methods.map((method) => (
                  <tr key={method.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{method.nameAr}</td>
                    <td className="px-4 py-3 text-slate-700">{method.nameEn}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{method.sortOrder}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          method.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {method.active ? dict.common.active : dict.common.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/${locale}/admin/methods?edit=${method.id}`}
                          className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-brand-400"
                        >
                          {dict.common.edit}
                        </a>
                        <form action={toggleMethodAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={method.id} />
                          <input type="hidden" name="active" value={method.active ? "false" : "true"} />
                          <button
                            type="submit"
                            className={`rounded px-2.5 py-1 text-xs font-medium ${
                              method.active
                                ? "border border-rose-200 text-rose-700 hover:bg-rose-50"
                                : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {method.active ? dict.admin.deactivate : dict.admin.activate}
                          </button>
                        </form>
                      </div>
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
