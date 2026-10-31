import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/prisma";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { saveServiceAction, toggleServiceAction } from "@/server/actions/admin-catalog";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string; error?: string; edit?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  await requireAdminPage(locale, "services:manage");
  const dict = getDictionary(locale);
  const db = getDb();

  const services = await db.consultationService.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const editingService = query.edit
    ? services.find((s) => s.id === query.edit)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{dict.admin.servicesTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {locale === "ar"
              ? "إضافة وتعديل الخدمات الاستشارية وتحديد مدتها وسعرها."
              : "Manage consultation services, their duration and pricing."}
          </p>
        </div>
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

      {/* Add / Edit Service Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">
          {editingService ? dict.admin.editService : dict.admin.addService}
        </h2>

        <form action={saveServiceAction} className="mt-4 space-y-4">
          <input type="hidden" name="locale" value={locale} />
          {editingService && <input type="hidden" name="id" value={editingService.id} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="titleAr" className="block text-xs font-semibold text-slate-700">
                {dict.admin.serviceTitleAr}
              </label>
              <input
                id="titleAr"
                name="titleAr"
                type="text"
                required
                defaultValue={editingService?.titleAr ?? ""}
                dir="rtl"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="titleEn" className="block text-xs font-semibold text-slate-700">
                {dict.admin.serviceTitleEn}
              </label>
              <input
                id="titleEn"
                name="titleEn"
                type="text"
                required
                defaultValue={editingService?.titleEn ?? ""}
                dir="ltr"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="descriptionAr" className="block text-xs font-semibold text-slate-700">
                {dict.admin.serviceDescAr}
              </label>
              <textarea
                id="descriptionAr"
                name="descriptionAr"
                rows={3}
                required
                defaultValue={editingService?.descriptionAr ?? ""}
                dir="rtl"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="descriptionEn" className="block text-xs font-semibold text-slate-700">
                {dict.admin.serviceDescEn}
              </label>
              <textarea
                id="descriptionEn"
                name="descriptionEn"
                rows={3}
                required
                defaultValue={editingService?.descriptionEn ?? ""}
                dir="ltr"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="price" className="block text-xs font-semibold text-slate-700">
                {dict.common.price}
              </label>
              <input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={editingService ? Number(editingService.price) : 100}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="currency" className="block text-xs font-semibold text-slate-700">
                {dict.common.currency}
              </label>
              <input
                id="currency"
                name="currency"
                type="text"
                maxLength={3}
                required
                defaultValue={editingService?.currency ?? "MYR"}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              />
            </div>

            <div>
              <label htmlFor="durationMinutes" className="block text-xs font-semibold text-slate-700">
                {dict.common.duration} ({dict.common.minutes})
              </label>
              <input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min="10"
                max="480"
                step="5"
                required
                defaultValue={editingService?.durationMinutes ?? 60}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="sortOrder" className="block text-xs font-semibold text-slate-700">
                {dict.admin.sortOrder}
              </label>
              <input
                id="sortOrder"
                name="sortOrder"
                type="number"
                defaultValue={editingService?.sortOrder ?? 0}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="active"
              name="active"
              type="checkbox"
              defaultChecked={editingService ? editingService.active : true}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="active" className="text-xs font-medium text-slate-700">
              {dict.common.active}
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <SubmitButton className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800">
              {editingService ? dict.common.save : dict.common.add}
            </SubmitButton>
            {editingService && (
              <a
                href={`/${locale}/admin/services`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {dict.common.cancel}
              </a>
            )}
          </div>
        </form>
      </div>

      {/* Services List */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">
            {dict.admin.servicesTitle} ({services.length})
          </h2>
        </div>

        {services.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{dict.admin.noServices}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" dir={locale === "ar" ? "rtl" : "ltr"}>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{dict.admin.serviceTitleAr}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.serviceTitleEn}</th>
                  <th className="px-4 py-3 font-medium">{dict.common.duration}</th>
                  <th className="px-4 py-3 font-medium">{dict.common.price}</th>
                  <th className="px-4 py-3 font-medium">{dict.admin.slug}</th>
                  <th className="px-4 py-3 font-medium">{dict.common.status}</th>
                  <th className="px-4 py-3 font-medium text-end">{dict.common.details}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map((service) => (
                  <tr key={service.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{service.titleAr}</td>
                    <td className="px-4 py-3 text-slate-700">{service.titleEn}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {service.durationMinutes} {dict.common.minutes}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                      {Number(service.price).toFixed(2)} {service.currency}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{service.slug}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          service.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {service.active ? dict.common.active : dict.common.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/${locale}/admin/services?edit=${service.id}`}
                          className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-brand-400"
                        >
                          {dict.common.edit}
                        </a>
                        <form action={toggleServiceAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={service.id} />
                          <input type="hidden" name="active" value={service.active ? "false" : "true"} />
                          <button
                            type="submit"
                            className={`rounded px-2.5 py-1 text-xs font-medium ${
                              service.active
                                ? "border border-rose-200 text-rose-700 hover:bg-rose-50"
                                : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {service.active ? dict.admin.deactivate : dict.admin.activate}
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
