import type { BookingStatus, PaymentStatus } from "@prisma/client";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/timezone";
import { formatPrice } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

export type BookingSummaryData = {
  publicReference: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  customerName: string;
  consultationTopic: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  priceSnapshot: { toString(): string } | string | number;
  currencySnapshot: string;
  expiresAt: Date;
  createdAt: Date;
  service: { titleAr: string; titleEn: string };
  method: { nameAr: string; nameEn: string };
};

const paymentKey: Record<PaymentStatus, keyof Dictionary["payment"]> = {
  UNPAID: "unpaid",
  PENDING: "pending",
  PAID: "paid",
  REFUNDED: "refunded",
};

export function BookingSummary({
  booking,
  dict,
  locale,
  showHold = true,
}: {
  booking: BookingSummaryData;
  dict: Dictionary;
  locale: Locale;
  showHold?: boolean;
}) {
  const statusNote =
    booking.status === "APPROVED"
      ? dict.statusPage.approvedNote
      : booking.status === "REJECTED"
        ? dict.statusPage.rejectedNote
        : booking.status === "EXPIRED"
          ? dict.statusPage.expiredNote
          : booking.status === "CANCELLED"
            ? dict.statusPage.cancelledNote
            : dict.statusPage.pendingNote;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge status={booking.status} dict={dict} />
        <p className="text-sm text-slate-600">
          {dict.received.referenceLabel}:{" "}
          <span className="font-mono font-semibold text-slate-900">{booking.publicReference}</span>
        </p>
      </div>

      <p
        className={`rounded-lg border px-3 py-2 text-sm leading-6 ${
          booking.status === "APPROVED"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : booking.status === "PENDING_APPROVAL"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-slate-200 bg-slate-50 text-slate-700"
        }`}
      >
        {statusNote}
      </p>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <Detail label={dict.statusPage.appointment}>
          {formatDateTime(booking.startAt, booking.timezone, locale, {
            dateStyle: "full",
            timeStyle: "short",
          })}
        </Detail>
        <Detail label={dict.statusPage.service}>
          {locale === "ar" ? booking.service.titleAr : booking.service.titleEn}
        </Detail>
        <Detail label={dict.statusPage.method}>
          {locale === "ar" ? booking.method.nameAr : booking.method.nameEn}
        </Detail>
        <Detail label={dict.statusPage.price}>
          {formatPrice(booking.priceSnapshot.toString(), booking.currencySnapshot, locale)}
          <span className="block text-xs font-normal text-slate-500">
            {dict.statusPage.payment}: {dict.payment[paymentKey[booking.paymentStatus]]}
          </span>
        </Detail>
        <Detail label={dict.statusPage.topic}>{booking.consultationTopic}</Detail>
        <Detail label={dict.statusPage.createdAt}>
          {formatDateTime(booking.createdAt, booking.timezone, locale)}
        </Detail>
        {showHold && booking.status === "PENDING_APPROVAL" && (
          <Detail label={dict.statusPage.holdExpires}>
            {formatDateTime(booking.expiresAt, booking.timezone, locale)}
          </Detail>
        )}
      </dl>

      <p className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
        {locale === "ar" ? "المنطقة الزمنية" : "Timezone"}: {booking.timezone}
      </p>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{children}</dd>
    </div>
  );
}
