import type { BookingStatus } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const styles: Record<BookingStatus, { className: string; key: keyof Dictionary["status"] }> = {
  PENDING_APPROVAL: {
    key: "pending",
    className: "border-amber-300 bg-amber-50 text-amber-900",
  },
  APPROVED: {
    key: "approved",
    className: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
  REJECTED: {
    key: "rejected",
    className: "border-rose-300 bg-rose-50 text-rose-900",
  },
  EXPIRED: {
    key: "expired",
    className: "border-slate-300 bg-slate-100 text-slate-700",
  },
  CANCELLED: {
    key: "cancelled",
    className: "border-slate-300 bg-slate-100 text-slate-700",
  },
};

const icons: Record<BookingStatus, string> = {
  PENDING_APPROVAL: "◷",
  APPROVED: "✓",
  REJECTED: "✕",
  EXPIRED: "⌛",
  CANCELLED: "—",
};

export function StatusBadge({
  status,
  dict,
}: {
  status: BookingStatus;
  dict: Dictionary;
}) {
  const config = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
    >
      <span aria-hidden="true">{icons[status]}</span>
      {dict.status[config.key]}
    </span>
  );
}
