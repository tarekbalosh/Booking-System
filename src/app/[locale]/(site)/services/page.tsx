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
        <h1 className="text-3xl font-bold text-slate-900">{dict.servicesPage.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{dict.servicesPage.subtitle}</p>
      </header>

      {services.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          {dict.servicesPage.empty}
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {services.map((service) => (
            <article
              key={service.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                {locale === "ar" ? service.titleAr : service.titleEn}
              </h2>
              <p className="mt-2 flex-1 whitespace-pre-line text-sm leading-6 text-slate-600">
                {locale === "ar" ? service.descriptionAr : service.descriptionEn}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">{dict.common.price}</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatPrice(service.price.toString(), service.currency, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">{dict.common.duration}</dt>
                  <dd className="font-semibold text-slate-900">
                    {service.durationMinutes} {dict.common.minutes}
                  </dd>
                </div>
              </dl>
              <div className="mt-5 flex gap-3">
                <Link
                  href={`/${locale}/booking?service=${encodeURIComponent(service.slug)}`}
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  {dict.servicesPage.bookService}
                </Link>
                <Link
                  href={`/${locale}/services/${service.slug}`}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-400"
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
