import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/prisma";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { DEFAULT_SETTINGS, getBusinessSettings } from "@/lib/booking/settings";
import { addDaysToKey, todayKey } from "@/lib/timezone";
import {
  BookingForm,
  type PublicMethod,
  type PublicService,
} from "@/components/booking/booking-form";

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
  const initialServiceId =
    serviceSlug === "other"
      ? "other"
      : serviceSlug
        ? services.find((item) => item.slug === serviceSlug)?.id
        : undefined;

  const unavailable = methods.length === 0;

  return (
    <div className="relative isolate overflow-x-hidden py-6 sm:py-10 lg:py-12">
      {/* Ambient background decoration */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 transform-gpu overflow-hidden blur-3xl"
        aria-hidden="true"
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-brand-300 to-brand-100 opacity-35 sm:left-[calc(50%-20rem)] sm:w-[50rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Page Hero Header */}
        <header className="mb-6 max-w-3xl sm:mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-brand-800 shadow-2xs backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
            <span>
              {locale === "ar" ? "حجز استشارة متخصصة" : "Professional Consultation"}
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            {dict.booking.title}
          </h1>

          <p className="mt-2 text-xs leading-6 text-slate-600 sm:text-sm md:text-base">
            {dict.booking.subtitle}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              {locale === "ar" ? "مراجعة واعتماد يدوي" : "Verified & Reviewed"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              {locale === "ar" ? "حجز مؤقت لمدة 30 دقيقة" : "30-minute slot hold"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-1.074-.827l.45-2.25a7.868 7.868 0 0 1-1.286-3.893C3.5 9.444 7.53 5.75 12.5 5.75s9 3.694 9 8.25Z" />
              </svg>
              {locale === "ar" ? "تواصل مباشر عبر واتساب" : "WhatsApp notifications"}
            </span>
          </div>
        </header>

        {/* Content Area */}
        <div>
          {unavailable ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/90 p-8 text-center text-sm leading-6 text-amber-900 shadow-sm">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-xl text-amber-700">
                ⚠️
              </span>
              <p className="mt-3 font-bold text-base">
                {services.length === 0 ? dict.booking.noServices : dict.booking.noMethods}
              </p>
              <p className="mt-1 text-xs text-amber-800">
                {locale === "ar"
                  ? "يرجى المحاولة في وقت لاحق أو التواصل مع الإدارة."
                  : "Please try again later or reach out to the administrator."}
              </p>
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
    </div>
  );
}
