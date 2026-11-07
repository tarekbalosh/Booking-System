import type { PaymentStatus } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const styles: Record<PaymentStatus, { className: string; dot: string; key: keyof Dictionary["payment"] }> = {
  PAID: { key: "paid", className: "bg-emerald-50 text-emerald-800 ring-emerald-600/20", dot: "bg-emerald-500" },
  PENDING: { key: "pending", className: "bg-amber-50 text-amber-800 ring-amber-600/20", dot: "bg-amber-500" },
  UNPAID: { key: "unpaid", className: "bg-slate-100 text-slate-600 ring-slate-500/20", dot: "bg-slate-400" },
  REFUNDED: { key: "refunded", className: "bg-blue-50 text-blue-800 ring-blue-600/20", dot: "bg-blue-500" },
};

/** Renders the real `paymentStatus` value of a booking. */
export function PaymentBadge({ status, dict }: { status: PaymentStatus; dict: Dictionary }) {
  const config = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${config.className}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {dict.payment[config.key]}
    </span>
  );
}

