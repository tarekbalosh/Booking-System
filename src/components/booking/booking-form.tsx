"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBookingAction, type BookingActionState } from "@/server/actions/booking";
import { addDaysToKey, formatDateTime } from "@/lib/timezone";
import { formatPrice } from "@/lib/format";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type PublicService = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  durationMinutes: number;
};

export type PublicMethod = {
  id: string;
  name: string;
  instructions: string;
};

type SlotOption = { startAt: string; endAt: string; timeLabel: string };

type SlotsState = "idle" | "loading" | "ready" | "error" | "closed" | "limit";

function getMethodIcon(name: string) {
  const lower = name.toLowerCase();
  if (
    lower.includes("فيديو") ||
    lower.includes("meet") ||
    lower.includes("zoom") ||
    lower.includes("video")
  ) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
        />
      </svg>
    );
  }
  if (
    lower.includes("واتساب") ||
    lower.includes("whatsapp") ||
    lower.includes("صوتية") ||
    lower.includes("audio")
  ) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0V12a3 3 0 0 1-3 3Z"
        />
      </svg>
    );
  }
  if (lower.includes("هاتف") || lower.includes("phone") || lower.includes("اتصال")) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
        />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006A2.25 2.25 0 0 1 18 16.5h-2.25m-9 0H4.5A2.25 2.25 0 0 1 2.25 14.15m0 0a2.18 2.18 0 0 1-.75-1.661V8.706c0-1.081.768-2.015 1.837-2.175a48.114 48.114 0 0 1 3.413-.387m0 0a48.42 48.42 0 0 1 10.5 0m-10.5 0V4.5A2.25 2.25 0 0 1 8.25 2.25h7.5A2.25 2.25 0 0 1 18 4.5v1.644"
      />
    </svg>
  );
}

function parseDateParts(key: string, locale: Locale) {
  const date = new Date(`${key}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat(locale === "ar" ? "ar-MY" : "en-MY", {
    timeZone: "UTC",
    weekday: "short",
  }).format(date);
  const day = new Intl.DateTimeFormat(locale === "ar" ? "ar-MY" : "en-MY", {
    timeZone: "UTC",
    day: "numeric",
  }).format(date);
  const month = new Intl.DateTimeFormat(locale === "ar" ? "ar-MY" : "en-MY", {
    timeZone: "UTC",
    month: "short",
  }).format(date);
  return { weekday, day, month };
}

export function BookingForm({
  locale,
  strings,
  common,
  services,
  methods,
  timezone,
  todayKey,
  maxDateKey,
  bookingWindowDays,
  initialServiceId,
}: {
  locale: Locale;
  strings: Dictionary["booking"];
  common: Pick<
    Dictionary["common"],
    "minutes" | "next" | "previous" | "required" | "optional" | "loading"
  >;
  services: PublicService[];
  methods: PublicMethod[];
  timezone: string;
  todayKey: string;
  maxDateKey: string;
  bookingWindowDays: number;
  initialServiceId?: string;
}) {
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(initialServiceId ?? services[0]?.id ?? "");
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [dateKey, setDateKey] = useState(todayKey);
  const [weekOffset, setWeekOffset] = useState(0);
  const [rawSlots, setRawSlots] = useState<SlotOption[]>([]);
  const [rawSlotsState, setRawSlotsState] = useState<SlotsState>("idle");
  const [fetchedKey, setFetchedKey] = useState<string>("");
  const [selectedStart, setSelectedStart] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  const [state, formAction] = useActionState<BookingActionState, FormData>(
    createBookingAction,
    null,
  );

  const currentKey = serviceId && dateKey ? `${serviceId}:${dateKey}` : "";
  const slotsState: SlotsState = !currentKey
    ? "idle"
    : fetchedKey !== currentKey
    ? "loading"
    : rawSlotsState;
  const slots = fetchedKey === currentKey ? rawSlots : [];

  const service = services.find((item) => item.id === serviceId);
  const method = methods.find((item) => item.id === methodId);
  const selectedSlot = slots.find((slot) => slot.startAt === selectedStart);

  const totalDays = Math.max(1, bookingWindowDays);
  const maxWeekOffset = Math.max(0, Math.ceil(totalDays / 7) - 1);

  const visibleDates = useMemo(() => {
    const startIdx = weekOffset * 7;
    const count = Math.min(7, totalDays - startIdx);
    return Array.from({ length: Math.max(0, count) }, (_, index) =>
      addDaysToKey(todayKey, startIdx + index),
    );
  }, [todayKey, weekOffset, totalDays]);

  useEffect(() => {
    if (!serviceId || !dateKey) return;

    const controller = new AbortController();
    let active = true;

    fetch(
      `/api/availability?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(dateKey)}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        const data = (await response.json()) as {
          slots?: SlotOption[];
          isClosed?: boolean;
          dailyLimitReached?: boolean;
        };
        if (!response.ok) throw new Error("unavailable");
        if (!active) return;
        setRawSlots(Array.isArray(data.slots) ? data.slots : []);
        setRawSlotsState(
          data.dailyLimitReached ? "limit" : data.isClosed ? "closed" : "ready",
        );
        setFetchedKey(`${serviceId}:${dateKey}`);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRawSlotsState("error");
        setFetchedKey(`${serviceId}:${dateKey}`);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [serviceId, dateKey]);

  function goToStepTwo() {
    if (!serviceId || !methodId) {
      setClientError(strings.requiredFields);
      return;
    }
    setClientError(null);
    setStep(2);
  }

  function goToStepThree() {
    if (!selectedSlot) {
      setClientError(strings.requiredFields);
      return;
    }
    setClientError(null);
    setStep(3);
  }

  const stepLabels = [
    {
      number: 1,
      title: strings.step1,
      desc: locale === "ar" ? "نوع الاستشارة وطريقة اللقاء" : "Service & Method",
    },
    {
      number: 2,
      title: strings.step2,
      desc: locale === "ar" ? "تحديد اليوم والتوقيت" : "Date & Time",
    },
    {
      number: 3,
      title: strings.step3,
      desc: locale === "ar" ? "بيانات التواصل والتأكيد" : "Your Details",
    },
  ];

  const isRtl = locale === "ar";

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
      {/* Main Booking Interactive Card */}
      <div className="min-w-0 w-full rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xl shadow-slate-200/50 backdrop-blur sm:rounded-3xl sm:p-6 md:p-8">
        {/* Stepper Header */}
        <div className="mb-6 border-b border-slate-100 pb-6 sm:mb-8 sm:pb-7">
          <ol className="grid grid-cols-3 gap-2" aria-label={strings.title}>
            {stepLabels.map(({ number, title, desc }) => {
              const current = step === number;
              const done = step > number;
              const canClick = step > number;

              return (
                <li key={number} className="relative flex flex-col items-center text-center">
                  {/* Connector line between circles */}
                  {number < 3 && (
                    <div
                      className={`pointer-events-none absolute top-4 sm:top-5 -z-0 h-0.5 w-full ${
                        isRtl ? "-left-1/2" : "left-1/2"
                      } bg-slate-100`}
                      aria-hidden="true"
                    >
                      <div
                        className={`h-full bg-brand-600 transition-all duration-300 ${
                          done ? "w-full" : "w-0"
                        }`}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!canClick}
                    onClick={() => canClick && setStep(number)}
                    className={`relative z-10 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-xs sm:text-sm font-bold transition-all duration-200 ${
                      done
                        ? "bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700 cursor-pointer"
                        : current
                        ? "bg-brand-700 text-white ring-4 ring-brand-100 shadow-md shadow-brand-700/30"
                        : "border-2 border-slate-200 bg-white text-slate-400"
                    }`}
                    aria-current={current ? "step" : undefined}
                  >
                    {done ? (
                      <svg
                        className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    ) : (
                      number
                    )}
                  </button>

                  <span
                    className={`mt-2 text-[11px] sm:text-xs font-bold leading-tight transition-colors ${
                      current
                        ? "text-brand-900"
                        : done
                        ? "text-slate-700"
                        : "text-slate-400"
                    }`}
                  >
                    {title}
                  </span>
                  <span className="mt-0.5 hidden text-[11px] text-slate-400 md:block">
                    {desc}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Client Error Banner */}
        {clientError && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-800 shadow-sm"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-200/70 text-xs font-bold text-rose-800">
              !
            </span>
            <span>{clientError}</span>
          </div>
        )}

        {/* STEP 1: SERVICE & METHOD */}
        {step === 1 && (
          <section className="space-y-6 sm:space-y-8" aria-label={strings.step1}>
            {/* Service Selection */}
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                    {strings.selectService}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {locale === "ar"
                      ? "اختر نوع الاستشارة التي تناسب احتياجاتك"
                      : "Choose the consultation session that suits your needs"}
                  </p>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                  {services.length} {locale === "ar" ? "خيارات متاحة" : "Options"}
                </span>
              </div>

              {/* Interactive Service Cards Grid */}
              <div className="grid grid-cols-1 gap-3">
                {services.map((item) => {
                  const isSelected = serviceId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setServiceId(item.id);
                        setSelectedStart("");
                        setClientError(null);
                      }}
                      className={`group relative flex w-full flex-col justify-between rounded-2xl border p-4 text-start transition-all duration-200 sm:p-5 ${
                        isSelected
                          ? "border-brand-600 bg-brand-50/50 shadow-md shadow-brand-600/5 ring-2 ring-brand-500/20"
                          : "border-slate-200/90 bg-white hover:border-brand-300 hover:bg-slate-50/60 hover:shadow-sm"
                      }`}
                      aria-pressed={isSelected}
                    >
                      <div className="flex w-full items-start justify-between gap-3 sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-900 sm:text-base">
                              {item.title}
                            </h3>
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                              <svg
                                className="h-3 w-3 text-slate-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                />
                              </svg>
                              {item.durationMinutes} {common.minutes}
                            </span>
                          </div>

                          {item.description && (
                            <p className="mt-2 text-xs leading-5 text-slate-600 sm:text-sm">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Radio Checkbox Indicator */}
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${
                            isSelected
                              ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                              : "border-slate-300 bg-white group-hover:border-brand-400"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="h-3.5 w-3.5 stroke-[3]"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m4.5 12.75 6 6 9-13.5"
                              />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Card Footer with Price */}
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 pt-3">
                        <span className="text-xs text-slate-500">
                          {locale === "ar" ? "قيمة الاستشارة" : "Consultation Fee"}
                        </span>
                        <span className="text-sm font-extrabold text-brand-700 sm:text-base">
                          {formatPrice(item.price, item.currency, locale)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Method Selection */}
            <div>
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                  {strings.selectMethod}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {locale === "ar"
                    ? "حدد الوسيلة المفضلة لإجراء جلسة الاستشارة"
                    : "Select your preferred way to conduct the consultation"}
                </p>
              </div>

              {/* Interactive Method Pills/Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {methods.map((item) => {
                  const isSelected = methodId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setMethodId(item.id);
                        setClientError(null);
                      }}
                      className={`group relative flex items-start gap-3 rounded-2xl border p-4 text-start transition-all duration-200 ${
                        isSelected
                          ? "border-brand-600 bg-brand-50/50 shadow-md shadow-brand-600/5 ring-2 ring-brand-500/20"
                          : "border-slate-200/90 bg-white hover:border-brand-300 hover:bg-slate-50/60 hover:shadow-sm"
                      }`}
                      aria-pressed={isSelected}
                    >
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${
                          isSelected
                            ? "bg-brand-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-700"
                        }`}
                      >
                        {getMethodIcon(item.name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            {item.name}
                          </h4>
                          <span
                            className={`h-4 w-4 shrink-0 rounded-full border transition-all ${
                              isSelected
                                ? "border-brand-600 bg-brand-600 ring-2 ring-white"
                                : "border-slate-300 bg-white"
                            }`}
                          />
                        </div>
                        {item.instructions && (
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {item.instructions}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Next Button */}
            <div className="flex justify-end pt-2 sm:pt-4">
              <button
                type="button"
                onClick={goToStepTwo}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-700 to-brand-800 px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-brand-700/25 transition-all duration-200 hover:from-brand-800 hover:to-brand-900 hover:shadow-lg hover:shadow-brand-700/35 cursor-pointer"
              >
                <span>{common.next}</span>
                <svg
                  className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </section>
        )}

        {/* STEP 2: DATE & TIME */}
        {step === 2 && (
          <section className="space-y-6 sm:space-y-8" aria-label={strings.step2}>
            {/* Date Selection */}
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                    {strings.selectDate}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {strings.dateHint
                      .replace("{days}", String(bookingWindowDays))
                      .replace("{timezone}", timezone)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {maxWeekOffset > 0 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={weekOffset === 0}
                        onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                        aria-label={locale === "ar" ? "الأسبوع السابق" : "Previous week"}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-brand-400 hover:text-brand-800 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <svg
                          className={`h-4 w-4 ${isRtl ? "" : "rotate-180"}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        disabled={weekOffset >= maxWeekOffset}
                        onClick={() => setWeekOffset((w) => Math.min(maxWeekOffset, w + 1))}
                        aria-label={locale === "ar" ? "الأسبوع التالي" : "Next week"}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-brand-400 hover:text-brand-800 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <svg
                          className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowCustomDatePicker((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-400 hover:text-brand-800"
                  >
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                    <span>{locale === "ar" ? "تاريخ آخر" : "Pick Date"}</span>
                  </button>
                </div>
              </div>

              {/* Custom Date Input (Collapsible) */}
              {showCustomDatePicker && (
                <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
                  <label htmlFor="custom-date" className="block text-xs font-bold text-brand-900">
                    {locale === "ar" ? "اختر يوماً من التقويم الكامل:" : "Select from full calendar:"}
                  </label>
                  <input
                    id="custom-date"
                    type="date"
                    value={dateKey}
                    min={todayKey}
                    max={maxDateKey}
                    onChange={(event) => {
                      if (event.target.value) {
                        setDateKey(event.target.value);
                        setSelectedStart("");
                        setClientError(null);
                      }
                    }}
                    dir="ltr"
                    className="mt-2 w-full max-w-xs rounded-xl border border-brand-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15"
                  />
                </div>
              )}

              {/* Responsive 7-Day Date Grid (Fits 100% without overflowing) */}
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {visibleDates.map((key) => {
                  const isSelected = dateKey === key;
                  const isToday = key === todayKey;
                  const parts = parseDateParts(key, locale);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setDateKey(key);
                        setSelectedStart("");
                        setClientError(null);
                      }}
                      aria-pressed={isSelected}
                      className={`group flex flex-col items-center justify-center rounded-2xl border py-2.5 px-1.5 sm:py-3 sm:px-2 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-brand-600 bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-md shadow-brand-600/25 ring-2 ring-brand-500/20"
                          : "border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50/30 hover:shadow-sm"
                      }`}
                    >
                      <span
                        className={`text-[11px] font-semibold truncate max-w-full ${
                          isSelected ? "text-brand-100" : "text-slate-400 group-hover:text-brand-700"
                        }`}
                      >
                        {isToday ? (locale === "ar" ? "اليوم" : "Today") : parts.weekday}
                      </span>
                      <span className="mt-0.5 text-lg sm:text-xl font-black leading-tight">
                        {parts.day}
                      </span>
                      <span
                        className={`text-[10px] sm:text-[11px] font-medium truncate max-w-full ${
                          isSelected ? "text-brand-100" : "text-slate-500"
                        }`}
                      >
                        {parts.month}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots Section */}
            <div aria-live="polite">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <h3 className="text-base font-bold text-slate-900">
                    {strings.selectTime}
                  </h3>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600" dir="ltr">
                  {timezone}
                </span>
              </div>

              {/* Loading State */}
              {slotsState === "loading" && (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-12 animate-pulse rounded-xl bg-slate-100"
                    />
                  ))}
                </div>
              )}

              {/* Idle State */}
              {slotsState === "idle" && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
                  {strings.pickDateFirst}
                </div>
              )}

              {/* Closed State */}
              {slotsState === "closed" && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                  <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-slate-600">
                    ✕
                  </span>
                  <p className="mt-2 text-sm font-bold text-slate-800">{strings.closedDay}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {locale === "ar"
                      ? "يرجى اختيار يوم آخر من التواريخ أعلاه"
                      : "Please pick another date from the options above"}
                  </p>
                </div>
              )}

              {/* Daily Limit */}
              {slotsState === "limit" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-center">
                  <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-amber-200 text-amber-800">
                    !
                  </span>
                  <p className="mt-2 text-sm font-bold text-amber-900">{strings.dailyLimit}</p>
                </div>
              )}

              {/* Error State */}
              {slotsState === "error" && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
                  <p className="text-sm font-semibold text-rose-800">{strings.genericError}</p>
                </div>
              )}

              {/* No Slots Ready */}
              {slotsState === "ready" && slots.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-700">{strings.noSlots}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {locale === "ar"
                      ? "اكتملت جميع مواعيد هذا اليوم، يرجى اختيار تاريخ آخر."
                      : "All appointments for this date are booked, please choose another day."}
                  </p>
                </div>
              )}

              {/* Slots Grid */}
              {slotsState === "ready" && slots.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                  {slots.map((slot) => {
                    const isSelected = selectedStart === slot.startAt;
                    return (
                      <button
                        key={slot.startAt}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedStart(slot.startAt);
                          setClientError(null);
                        }}
                        className={`group relative flex items-center justify-center gap-2 rounded-xl border py-3 px-3 text-sm font-bold transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? "border-brand-600 bg-brand-700 text-white shadow-md shadow-brand-700/25 ring-2 ring-brand-500/20"
                            : "border-slate-200/90 bg-white text-slate-700 hover:border-brand-500 hover:bg-brand-50/40 hover:text-brand-900"
                        }`}
                      >
                        <svg
                          className={`h-4 w-4 shrink-0 ${
                            isSelected ? "text-white" : "text-slate-400 group-hover:text-brand-600"
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                          />
                        </svg>
                        <span dir="ltr">{slot.timeLabel}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Back & Next Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
              >
                <svg
                  className={`h-4 w-4 ${isRtl ? "" : "rotate-180"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
                <span>{common.previous}</span>
              </button>

              <button
                type="button"
                onClick={goToStepThree}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-700 to-brand-800 px-7 py-3 text-sm font-bold text-white shadow-md shadow-brand-700/25 transition-all duration-200 hover:from-brand-800 hover:to-brand-900 hover:shadow-lg hover:shadow-brand-700/35 cursor-pointer"
              >
                <span>{common.next}</span>
                <svg
                  className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </section>
        )}

        {/* STEP 3: CLIENT DETAILS & CONFIRMATION */}
        {step === 3 && service && method && selectedSlot && (
          <form action={formAction} className="space-y-6" aria-label={strings.step3}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="methodId" value={method.id} />
            <input type="hidden" name="startAt" value={selectedSlot.startAt} />

            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                {strings.step3}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {locale === "ar"
                  ? "يرجى كتابة بيانات التواصل الصحيحة لنتمكن من تأكيد الاستشارة معك"
                  : "Please enter your contact details to confirm the appointment"}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="customerName"
                  className="block text-xs font-bold text-slate-800"
                >
                  {strings.fullName} <span className="text-rose-600">*</span>
                </label>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </span>
                  <input
                    id="customerName"
                    name="customerName"
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    placeholder={locale === "ar" ? "أحمد عبدالله" : "Alex Taylor"}
                    className="w-full rounded-xl border border-slate-300 bg-white ps-10 pe-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="customerEmail"
                  className="block text-xs font-bold text-slate-800"
                >
                  {strings.email} <span className="text-rose-600">*</span>
                </label>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                  </span>
                  <input
                    id="customerEmail"
                    name="customerEmail"
                    type="email"
                    required
                    autoComplete="email"
                    dir="ltr"
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-slate-300 bg-white ps-10 pe-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 text-start"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="customerPhone"
                  className="block text-xs font-bold text-slate-800"
                >
                  {strings.phone} <span className="text-rose-600">*</span>
                </label>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                  </span>
                  <input
                    id="customerPhone"
                    name="customerPhone"
                    type="tel"
                    required
                    autoComplete="tel"
                    dir="ltr"
                    placeholder="+60 12 345 6789"
                    className="w-full rounded-xl border border-slate-300 bg-white ps-10 pe-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 text-start"
                  />
                </div>
              </div>

              {/* Consultation Topic */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="consultationTopic"
                  className="block text-xs font-bold text-slate-800"
                >
                  {strings.topic} <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="consultationTopic"
                  name="consultationTopic"
                  required
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  placeholder={strings.topicPlaceholder}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15"
                />
              </div>
            </div>

            {/* Consent Checkbox */}
            <label className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs leading-5">
                {strings.consent}{" "}
                <Link
                  href={`/${locale}/privacy`}
                  target="_blank"
                  className="font-bold text-brand-700 underline hover:text-brand-800"
                >
                  {locale === "ar" ? "الخصوصية" : "Privacy"}
                </Link>
                {" · "}
                <Link
                  href={`/${locale}/terms`}
                  target="_blank"
                  className="font-bold text-brand-700 underline hover:text-brand-800"
                >
                  {locale === "ar" ? "الشروط" : "Terms"}
                </Link>
              </span>
            </label>

            {/* Reassurance Hold Notice */}
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/80 p-4 text-xs leading-5 text-amber-900 shadow-sm">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-200 text-xs font-bold text-amber-900">
                ⏳
              </span>
              <p>{strings.holdNotice}</p>
            </div>

            {/* Server Error Notice */}
            {state?.error && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
              >
                <p className="font-medium">{state.error}</p>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="mt-2 text-xs font-bold text-rose-900 underline"
                >
                  {strings.selectTime}
                </button>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
              >
                <svg
                  className={`h-4 w-4 ${isRtl ? "" : "rotate-180"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
                <span>{common.previous}</span>
              </button>

              <SubmitButton pendingLabel={strings.submitting}>
                <span className="flex items-center gap-2">
                  <span>{strings.submit}</span>
                  <svg
                    className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </SubmitButton>
            </div>
          </form>
        )}
      </div>

      {/* Aside VIP Summary Card */}
      <aside className="min-w-0 w-full rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-xl shadow-slate-200/40 backdrop-blur sm:rounded-3xl sm:p-6 lg:sticky lg:top-24">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              </svg>
            </span>
            <h2 className="text-base font-bold text-slate-900">{strings.summary}</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {locale === "ar" ? `الخطوة ${step} من 3` : `Step ${step} of 3`}
          </span>
        </div>

        <dl className="mt-4 space-y-3.5 text-sm">
          {/* Service */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <dt className="text-xs font-semibold text-slate-500">{strings.summaryService}</dt>
            <dd className="mt-1 font-bold text-slate-900 break-words">
              {service?.title ?? (
                <span className="text-xs font-normal text-slate-400">
                  {locale === "ar" ? "لم تحدد الخدمة بعد" : "Not selected yet"}
                </span>
              )}
            </dd>
            {service && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 shadow-2xs">
                ⏱ {service.durationMinutes} {common.minutes}
              </span>
            )}
          </div>

          {/* Method */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 text-xs">
            <dt className="shrink-0 font-medium text-slate-500">{strings.summaryMethod}</dt>
            <dd className="text-end font-bold text-slate-800">
              {method?.name ?? "—"}
            </dd>
          </div>

          {/* Date & Time */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3 text-xs">
            <dt className="shrink-0 font-medium text-slate-500">{strings.summaryDateTime}</dt>
            <dd className="text-end font-bold text-slate-900">
              {selectedSlot ? (
                formatDateTime(new Date(selectedSlot.startAt), timezone, locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              ) : (
                <span className="font-normal text-slate-400">
                  {locale === "ar" ? "بانتظار تحديد الموعد" : "Pending date/time"}
                </span>
              )}
            </dd>
          </div>

          {/* Price Highlight */}
          <div className="rounded-2xl border border-brand-200/80 bg-gradient-to-br from-brand-50 to-brand-100/40 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-xs font-bold text-brand-900">{strings.summaryPrice}</dt>
              <dd className="text-lg sm:text-xl font-black text-brand-800">
                {service ? formatPrice(service.price, service.currency, locale) : "—"}
              </dd>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-brand-700">
              {locale === "ar"
                ? "لن يتم تحصيل أي مبالغ حتى يعتمد المدير الموعد"
                : "No charges until the appointment is confirmed by admin"}
            </p>
          </div>
        </dl>

        {/* Reassurance points */}
        <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="text-brand-600">✓</span>
            <span>{locale === "ar" ? "حجز فوري ومؤكد مع المستشار" : "Direct & verified consultation"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-brand-600">✓</span>
            <span>{locale === "ar" ? "إشعار فوري عبر الواتساب والبريد" : "Instant updates via WhatsApp & Email"}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>🌐</span>
            <span className="truncate">
              {locale === "ar" ? "التوقيت المعتمد:" : "Timezone:"} {timezone}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
