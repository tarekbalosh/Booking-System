import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { getBusinessSettings, DEFAULT_SETTINGS } from "@/lib/booking/settings";
import { getWhatsAppConfig } from "@/lib/env";
import { saveBrandSettingsAction } from "@/server/actions/admin-schedule";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  await requireAdminPage(locale, "settings:manage");
  const dict = getDictionary(locale);

  const settings = await getBusinessSettings().catch(() => DEFAULT_SETTINGS);
  const whatsAppLive = getWhatsAppConfig() !== null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{dict.admin.settingsTitle}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {locale === "ar"
            ? "تخصيص اسم العلامة التجارية واسم مقدم الاستشارة وحالة التكامل."
            : "Customize brand identity, consultant provider name, and view integration status."}
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

      {/* Brand & Provider Settings Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">{dict.admin.settingsTitle}</h2>

        <form action={saveBrandSettingsAction} className="mt-4 space-y-4">
          <input type="hidden" name="locale" value={locale} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="brandNameAr" className="block text-xs font-semibold text-slate-700">
                {dict.admin.brandAr}
              </label>
              <input
                id="brandNameAr"
                name="brandNameAr"
                type="text"
                required
                defaultValue={settings.brandNameAr}
                dir="rtl"
                placeholder="استشارات مهنية"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="brandNameEn" className="block text-xs font-semibold text-slate-700">
                {dict.admin.brandEn}
              </label>
              <input
                id="brandNameEn"
                name="brandNameEn"
                type="text"
                required
                defaultValue={settings.brandNameEn}
                dir="ltr"
                placeholder="Professional Consultations"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="providerNameAr" className="block text-xs font-semibold text-slate-700">
                {dict.admin.providerAr} ({dict.common.optional})
              </label>
              <input
                id="providerNameAr"
                name="providerNameAr"
                type="text"
                defaultValue={settings.providerNameAr}
                dir="rtl"
                placeholder="مثال: د. طارق / المستشار"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="providerNameEn" className="block text-xs font-semibold text-slate-700">
                {dict.admin.providerEn} ({dict.common.optional})
              </label>
              <input
                id="providerNameEn"
                name="providerNameEn"
                type="text"
                defaultValue={settings.providerNameEn}
                dir="ltr"
                placeholder="e.g. Dr. Tarek / Senior Consultant"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <SubmitButton className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800">
              {dict.common.save}
            </SubmitButton>
          </div>
        </form>
      </div>

      {/* Integration & System Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">حالة التكاملات والنظام</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500">واتساب (WhatsApp Cloud API)</p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  whatsAppLive ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              <span className="text-sm font-semibold text-slate-800">
                {whatsAppLive ? dict.admin.whatsappLive : dict.admin.whatsappConfig}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {whatsAppLive
                ? "يتم إرسال الإشعارات الفعلية عبر Cloud API."
                : "الوضع التجريبي: يتم تسجيل الإشعارات في السجل دون إرسال فعلي حتى تتوفر المفاتيح."}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500">بوابة الدفع (Payment Gateway)</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" />
              <span className="text-sm font-semibold text-slate-800">غير مفعّلة حاليًا</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              تُحفظ أسعار الخدمات والعملات، وتُدار حالة الدفع يدويًا أو لاحقًا عند اختيار المزود.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{dict.common.timezone}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-500" />
              <span className="font-mono text-sm font-semibold text-slate-800">
                {settings.timezone}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              تُخزن المواعيد بتوقيت UTC وتُعرض بتوقيت كوالالمبور.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
