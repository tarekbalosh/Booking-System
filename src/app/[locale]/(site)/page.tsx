import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/prisma";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { getBusinessSettings, DEFAULT_SETTINGS } from "@/lib/booking/settings";
import { formatPrice } from "@/lib/format";
import { publicWhatsAppUrl } from "@/lib/public-contact";

export const dynamic = "force-dynamic";

async function loadHomeData() {
  try {
    const db = getDb();
    const [services, methods, settings] = await Promise.all([
      db.consultationService.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 6,
      }),
      db.consultationMethod.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      getBusinessSettings(),
    ]);
    return { services, methods, settings };
  } catch {
    return { services: [], methods: [], settings: DEFAULT_SETTINGS };
  }
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { services, methods } = await loadHomeData();

  const steps = [
    { title: dict.home.step1Title, body: dict.home.step1Body },
    { title: dict.home.step2Title, body: dict.home.step2Body },
    { title: dict.home.step3Title, body: dict.home.step3Body },
    { title: dict.home.step4Title, body: dict.home.step4Body },
  ];

  return (
    <div>
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-brand-50 via-sand-50 to-sand-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.15fr_0.85fr] md:items-center md:py-24">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-800">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden="true" />
              {dict.home.eyebrow}
            </p>
            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              {dict.home.title}
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              {dict.home.subtitle}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${locale}/booking`}
                className="rounded-full bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
              >
                {dict.home.ctaBook}
              </Link>
              <Link
                href={`/${locale}/services`}
                className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-brand-500"
              >
                {dict.home.ctaServices}
              </Link>
            </div>
            <p className="text-xs leading-5 text-slate-500">{dict.home.holdNote}</p>
          </div>

          <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{dict.home.processTitle}</h2>
            <ol className="mt-4 space-y-4">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-800">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-600">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{dict.home.servicesTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">{dict.home.servicesSubtitle}</p>
          </div>
          <Link href={`/${locale}/services`} className="text-sm font-semibold text-brand-700 hover:text-brand-900">
            {dict.home.ctaServices} →
          </Link>
        </div>

        {services.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            {dict.home.noServices}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <article
                key={service.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300"
              >
                <h3 className="text-base font-semibold text-slate-900">
                  {locale === "ar" ? service.titleAr : service.titleEn}
                </h3>
                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">
                  {locale === "ar" ? service.descriptionAr : service.descriptionEn}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {formatPrice(service.price.toString(), service.currency, locale)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {service.durationMinutes} {dict.common.minutes}
                    </p>
                  </div>
                  <Link
                    href={`/${locale}/services/${service.slug}`}
                    className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800 hover:bg-brand-100"
                  >
                    {dict.common.view}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {methods.length > 0 && (
        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-xl font-bold text-slate-900">{dict.home.methodsTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">{dict.home.methodsSubtitle}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {methods.map((method) => (
                <li
                  key={method.id}
                  className="rounded-full border border-slate-200 bg-sand-50 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  {locale === "ar" ? method.nameAr : method.nameEn}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-2xl bg-brand-800 px-6 py-10 text-center text-white sm:px-10">
          <h2 className="text-2xl font-bold">{dict.home.contactTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-brand-100">
            {dict.home.contactBody}
          </p>
          <a
            href={publicWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 transition hover:bg-brand-50"
          >
            {dict.home.contactCta}
          </a>
        </div>
      </section>
    </div>
  );
}
