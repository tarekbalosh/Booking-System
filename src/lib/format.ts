export function formatPrice(
  amount: number | string,
  currency: string,
  locale: "ar" | "en",
): string {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-MY" : "en-MY", {
      style: "currency",
      currency,
      currencyDisplay: "code",
    }).format(Number.isFinite(numeric) ? numeric : 0);
  } catch {
    return `${numeric.toFixed(2)} ${currency}`;
  }
}

/** Date-key labels are formatted in UTC so the calendar day never shifts. */
export function formatDateKeyShort(dateKey: string, locale: "ar" | "en"): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MY" : "en-MY", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}
