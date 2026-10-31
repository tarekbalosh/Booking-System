import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/prisma";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  const service = await getDb()
    .consultationService.findUnique({ where: { slug } })
    .catch(() => null);

  if (!service || !service.active) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href={`/${locale}/services`} className="text-sm font-medium text-brand-700 hover:text-brand-900">
        ← {dict.servicesPage.backToServices}
      </Link>
      <article className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold text-slate-900">
          {locale === "ar" ? service.titleAr : service.titleEn}
        </h1>
        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">
          {locale === "ar" ? service.descriptionAr : service.descriptionEn}
        </p>

        <dl className="mt-8 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-slate-500">{dict.common.price}</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">
              {formatPrice(service.price.toString(), service.currency, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">{dict.common.duration}</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">
              {service.durationMinutes} {dict.common.minutes}
            </dd>
          </div>
        </dl>

        <Link
          href={`/${locale}/booking?service=${encodeURIComponent(service.slug)}`}
          className="mt-8 inline-flex rounded-full bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800"
        >
          {dict.servicesPage.bookService}
        </Link>
      </article>
    </div>
  );
}
