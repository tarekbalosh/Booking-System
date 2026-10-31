"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBookingAction, type BookingActionState } from "@/server/actions/booking";
import { addDaysToKey, formatDateTime } from "@/lib/timezone";
import { formatDateKeyShort, formatPrice } from "@/lib/format";
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
  common: Pick<Dictionary["common"], "minutes" | "next" | "previous" | "required" | "optional" | "loading">;
  services: PublicService[];
  methods: PublicMethod[];
  timezone: string;
  todayKey: string;
  maxDateKey: string;
  bookingWindowDays: number;
  initialServiceId?: string;
}) {
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(initialServiceId ?? "");
  const [methodId, setMethodId] = useState("");
  const [dateKey, setDateKey] = useState(todayKey);
  const [rawSlots, setRawSlots] = useState<SlotOption[]>([]);
  const [rawSlotsState, setRawSlotsState] = useState<SlotsState>("idle");
  const [fetchedKey, setFetchedKey] = useState<string>("");
  const [selectedStart, setSelectedStart] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
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
  const quickDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDaysToKey(todayKey, index)),
    [todayKey],
  );

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
        setRawSlotsState(data.dailyLimitReached ? "limit" : data.isClosed ? "closed" : "ready");
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

  const stepLabels = [strings.step1, strings.step2, strings.step3];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <ol className="flex flex-wrap gap-2" aria-label={strings.title}>
          {stepLabels.map((label, index) => {
            const number = index + 1;
            const current = step === number;
            const done = step > number;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                    current
                      ? "bg-brand-700 text-white"
                      : done
                        ? "bg-brand-100 text-brand-800"
                        : "bg-slate-100 text-slate-500"
                  }`}
                  aria-current={current ? "step" : undefined}
                >
                  {done ? "✓" : number}
                </span>
                <span className={`text-xs font-medium ${current ? "text-slate-900" : "text-slate-500"}`}>
                  {label}
                </span>
                {number < 3 && <span className="mx-1 h-px w-4 bg-slate-200" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>

        {clientError && (
          <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {clientError}
          </p>
        )}

        {step === 1 && (
          <section className="mt-6 space-y-6" aria-label={strings.step1}>
            <div>
              <label htmlFor="service" className="block text-sm font-semibold text-slate-800">
                {strings.selectService}
              </label>
              <select
                id="service"
                value={serviceId}
                onChange={(event) => {
                  setServiceId(event.target.value);
                  setSelectedStart("");
                  setClientError(null);
                }}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">{strings.selectServicePlaceholder}</option>
                {services.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} — {formatPrice(item.price, item.currency, locale)} ({item.durationMinutes}{" "}
                    {common.minutes})
                  </option>
                ))}
              </select>
              {service && (
                <p className="mt-2 text-xs leading-5 text-slate-600">{service.description}</p>
              )}
            </div>

            <div>
              <label htmlFor="method" className="block text-sm font-semibold text-slate-800">
                {strings.selectMethod}
              </label>
              <select
                id="method"
                value={methodId}
                onChange={(event) => {
                  setMethodId(event.target.value);
                  setClientError(null);
                }}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">{strings.selectMethodPlaceholder}</option>
                {methods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {method?.instructions && (
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  <span className="font-medium">{strings.methodInstructions}: </span>
                  {method.instructions}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={goToStepTwo}
              className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
            >
              {common.next}
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="mt-6 space-y-6" aria-label={strings.step2}>
            <div>
              <label htmlFor="date" className="block text-sm font-semibold text-slate-800">
                {strings.selectDate}
              </label>
              <input
                id="date"
                type="date"
                value={dateKey}
                min={todayKey}
                max={maxDateKey}
                onChange={(event) => {
                  if (event.target.value) {
                    setDateKey(event.target.value);
                    setClientError(null);
                  }
                }}
                dir="ltr"
                className="mt-2 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              />
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {quickDates.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setDateKey(key);
                      setClientError(null);
                    }}
                    aria-pressed={dateKey === key}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                      dateKey === key
                        ? "border-brand-700 bg-brand-700 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-brand-400"
                    }`}
                  >
                    {formatDateKeyShort(key, locale)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {strings.dateHint
                  .replace("{days}", String(bookingWindowDays))
                  .replace("{timezone}", timezone)}
              </p>
            </div>

            <div aria-live="polite">
              <p className="text-sm font-semibold text-slate-800">{strings.selectTime}</p>
              {slotsState === "loading" && (
                <p className="mt-3 text-sm text-slate-500">{strings.loadingSlots}</p>
              )}
              {slotsState === "idle" && (
                <p className="mt-3 text-sm text-slate-500">{strings.pickDateFirst}</p>
              )}
              {slotsState === "closed" && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {strings.closedDay}
                </p>
              )}
              {slotsState === "limit" && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {strings.dailyLimit}
                </p>
              )}
              {slotsState === "error" && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {strings.genericError}
                </p>
              )}
              {slotsState === "ready" && slots.length === 0 && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {strings.noSlots}
                </p>
              )}
              {slots.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {slots.map((slot) => (
                    <button
                      key={slot.startAt}
                      type="button"
                      aria-pressed={selectedStart === slot.startAt}
                      onClick={() => {
                        setSelectedStart(slot.startAt);
                        setClientError(null);
                      }}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
                        selectedStart === slot.startAt
                          ? "border-brand-700 bg-brand-700 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:border-brand-500"
                      }`}
                    >
                      {slot.timeLabel}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                {common.previous}
              </button>
              <button
                type="button"
                onClick={goToStepThree}
                className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
              >
                {common.next}
              </button>
            </div>
          </section>
        )}

        {step === 3 && service && method && selectedSlot && (
          <form action={formAction} className="mt-6 space-y-5" aria-label={strings.step3}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="methodId" value={method.id} />
            <input type="hidden" name="startAt" value={selectedSlot.startAt} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="customerName" className="block text-sm font-semibold text-slate-800">
                  {strings.fullName} <span className="text-rose-700">*</span>
                </label>
                <input
                  id="customerName"
                  name="customerName"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="customerEmail" className="block text-sm font-semibold text-slate-800">
                  {strings.email} <span className="text-rose-700">*</span>
                </label>
                <input
                  id="customerEmail"
                  name="customerEmail"
                  type="email"
                  required
                  autoComplete="email"
                  dir="ltr"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="customerPhone" className="block text-sm font-semibold text-slate-800">
                  {strings.phone} <span className="text-rose-700">*</span>
                </label>
                <input
                  id="customerPhone"
                  name="customerPhone"
                  type="tel"
                  required
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="+60..."
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="consultationTopic" className="block text-sm font-semibold text-slate-800">
                {strings.topic} <span className="text-rose-700">*</span>
              </label>
              <textarea
                id="consultationTopic"
                name="consultationTopic"
                required
                minLength={3}
                maxLength={500}
                rows={3}
                placeholder={strings.topicPlaceholder}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>

            <label className="flex items-start gap-2.5 text-sm text-slate-700">
              <input type="checkbox" name="consent" required className="mt-1 h-4 w-4" />
              <span>
                {strings.consent}{" "}
                <Link href={`/${locale}/privacy`} target="_blank" className="font-medium text-brand-700 underline">
                  {locale === "ar" ? "الخصوصية" : "Privacy"}
                </Link>
                {" · "}
                <Link href={`/${locale}/terms`} target="_blank" className="font-medium text-brand-700 underline">
                  {locale === "ar" ? "الشروط" : "Terms"}
                </Link>
              </span>
            </label>

            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              {strings.holdNotice}
            </p>

            {state?.error && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800">
                <p>{state.error}</p>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="mt-2 font-semibold underline"
                >
                  {strings.selectTime}
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                {common.previous}
              </button>
              <SubmitButton pendingLabel={strings.submitting}>{strings.submit}</SubmitButton>
            </div>
          </form>
        )}
      </div>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
        <h2 className="text-sm font-semibold text-slate-900">{strings.summary}</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <SummaryRow label={strings.summaryService} value={service?.title} />
          <SummaryRow label={strings.summaryMethod} value={method?.name} />
          <SummaryRow
            label={strings.summaryDateTime}
            value={
              selectedSlot
                ? `${formatDateTime(new Date(selectedSlot.startAt), timezone, locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}`
                : undefined
            }
          />
          <SummaryRow
            label={strings.summaryDuration}
            value={service ? `${service.durationMinutes} ${common.minutes}` : undefined}
          />
          <SummaryRow
            label={strings.summaryPrice}
            value={service ? formatPrice(service.price, service.currency, locale) : undefined}
            strong
          />
        </dl>
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          {locale === "ar" ? "جميع الأوقات بتوقيت" : "All times are in"} {timezone}
        </p>
      </aside>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-end ${strong ? "font-bold text-slate-900" : "font-medium text-slate-800"}`}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

