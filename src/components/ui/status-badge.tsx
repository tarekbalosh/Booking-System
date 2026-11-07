import type { BookingStatus } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const styles: Record<
  BookingStatus,
  { className: string; dot: string; key: keyof Dictionary["status"] }
> = {
  PENDING_APPROVAL: {
    key: "pending",
    className: "bg-amber-50 text-amber-800 ring-amber-600/20",
    dot: "bg-amber-500",
  },
  APPROVED: {
    key: "approved",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    key: "rejected",
    className: "bg-red-50 text-red-800 ring-red-600/20",
    dot: "bg-red-500",
  },
  EXPIRED: {
    key: "expired",
    className: "bg-slate-100 text-slate-600 ring-slate-500/20",
    dot: "bg-slate-400",
  },
  CANCELLED: {
    key: "cancelled",
    className: "bg-slate-100 text-slate-700 ring-slate-500/20",
    dot: "bg-slate-500",
  },
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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${config.className}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {dict.status[config.key]}
    </span>
  );
}
