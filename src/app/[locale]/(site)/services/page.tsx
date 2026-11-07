import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/prisma";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  let services: Awaited<ReturnType<ReturnType<typeof getDb>["consultationService"]["findMany"]>> = [];
  try {
    services = await getDb().consultationService.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  } catch {
    services = [];
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-brand-50/60 px-3 py-1 text-xs font-semibold text-brand-800">
          <span>✨</span>
          <span>{locale === "ar" ? "قائمة الاستشارات" : "Consultation Services"}</span>
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {dict.servicesPage.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
          {dict.servicesPage.subtitle}
        </p>
      </header>

      {services.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-600 shadow-sm">
          {dict.servicesPage.empty}
        </div>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.id}
              className="group flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-xl hover:shadow-brand-900/5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800">
                    ⏱ {service.durationMinutes} {dict.common.minutes}
                  </span>
                  <span className="text-base font-extrabold text-brand-700">
                    {formatPrice(service.price.toString(), service.currency, locale)}
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-bold text-slate-900 transition-colors group-hover:text-brand-900">
                  {locale === "ar" ? service.titleAr : service.titleEn}
                </h2>

                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600 sm:text-sm">
                  {locale === "ar" ? service.descriptionAr : service.descriptionEn}
                </p>
              </div>

              <div className="mt-6 flex items-center gap-2.5 border-t border-slate-100 pt-4">
                <Link
                  href={`/${locale}/booking?service=${encodeURIComponent(service.slug)}`}
                  className="flex-1 rounded-xl bg-gradient-to-r from-brand-700 to-brand-800 px-4 py-2.5 text-center text-xs font-bold text-white shadow-md shadow-brand-700/20 transition hover:from-brand-800 hover:to-brand-900"
                >
                  {dict.servicesPage.bookService}
                </Link>
                <Link
                  href={`/${locale}/services/${service.slug}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  {dict.common.details}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
