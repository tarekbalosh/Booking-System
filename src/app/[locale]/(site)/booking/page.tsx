import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/prisma";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { DEFAULT_SETTINGS, getBusinessSettings } from "@/lib/booking/settings";
import { addDaysToKey, todayKey } from "@/lib/timezone";
import { BookingForm, type PublicMethod, type PublicService } from "@/components/booking/booking-form";

export const dynamic = "force-dynamic";

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { locale } = await params;
  const { service: serviceSlug } = await searchParams;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  let services: PublicService[] = [];
  let methods: PublicMethod[] = [];
  let settings = DEFAULT_SETTINGS;

  try {
    const db = getDb();
    const [dbServices, dbMethods, dbSettings] = await Promise.all([
      db.consultationService.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      db.consultationMethod.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      getBusinessSettings(),
    ]);
    settings = dbSettings;
    services = dbServices.map((item) => ({
      id: item.id,
      slug: item.slug,
      title: locale === "ar" ? item.titleAr : item.titleEn,
      description: locale === "ar" ? item.descriptionAr : item.descriptionEn,
      price: Number(item.price),
      currency: item.currency,
      durationMinutes: item.durationMinutes,
    }));
    methods = dbMethods.map((item) => ({
      id: item.id,
      name: locale === "ar" ? item.nameAr : item.nameEn,
      instructions: locale === "ar" ? item.instructionsAr : item.instructionsEn,
    }));
  } catch {
    services = [];
    methods = [];
  }

  const start = todayKey(settings.timezone);
  const maxDate = addDaysToKey(start, Math.max(0, settings.bookingWindowDays - 1));
  const initialServiceId = serviceSlug
    ? services.find((item) => item.slug === serviceSlug)?.id
    : undefined;

  const unavailable = services.length === 0 || methods.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold text-slate-900">{dict.booking.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{dict.booking.subtitle}</p>
      </header>

      <div className="mt-8">
        {unavailable ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-900">
            {services.length === 0 ? dict.booking.noServices : dict.booking.noMethods}
          </div>
        ) : (
          <BookingForm
            locale={locale}
            strings={dict.booking}
            common={{
              minutes: dict.common.minutes,
              next: dict.common.next,
              previous: dict.common.previous,
              required: dict.common.required,
              optional: dict.common.optional,
              loading: dict.common.loading,
            }}
            services={services}
            methods={methods}
            timezone={settings.timezone}
            todayKey={start}
            maxDateKey={maxDate}
            bookingWindowDays={settings.bookingWindowDays}
            initialServiceId={initialServiceId}
          />
        )}
      </div>
    </div>
  );
}
