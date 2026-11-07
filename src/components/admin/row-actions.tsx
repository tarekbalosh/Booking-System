"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/admin/icons";
import {
  approveBookingAction,
  cancelBookingAction,
  rejectBookingAction,
} from "@/server/actions/admin-bookings";

type Props = {
  bookingId: string;
  locale: "ar" | "en";
  detailsHref: string;
  rescheduleHref: string | null;
  canApprove: boolean;
  canReject: boolean;
  canCancel: boolean;
  labels: {
    actions: string;
    view: string;
    approve: string;
    reject: string;
    cancel: string;
    reschedule: string;
    approveConfirm: string;
    rejectConfirm: string;
    cancelConfirm: string;
  };
};

const MENU_WIDTH = 208;

/**
 * Compact per-row actions menu. The menu is positioned with `fixed` so the
 * table's horizontal scroll container never clips it. All mutations go through
 * the existing server actions, which re-check permissions on the server.
 */
export function RowActions({
  bookingId,
  locale,
  detailsHref,
  rescheduleHref,
  canApprove,
  canReject,
  canCancel,
  labels,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rtl = document.documentElement.dir === "rtl";
    const rawLeft = rtl ? rect.left : rect.right - MENU_WIDTH;
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - MENU_WIDTH - 8));
    const menuHeight = 220;
    const below = rect.bottom + 6;
    const top = below + menuHeight > window.innerHeight ? Math.max(8, rect.top - menuHeight - 6) : below;
    setPos({ top, left });
    setOpen((value) => !value);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const item =
    "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors";

  const decision = (
    action: (formData: FormData) => Promise<void>,
    confirmMessage: string,
    label: string,
    icon: string,
    tone: string,
  ) => (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <button
        type="submit"
        className={`${item} ${tone}`}
        onClick={(event) => {
          if (!window.confirm(confirmMessage)) event.preventDefault();
        }}
      >
        <Icon name={icon} width={16} height={16} />
        {label}
      </button>
    </form>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={labels.actions}
        title={labels.actions}
        className={`grid h-8 w-8 place-items-center rounded-lg border text-slate-500 transition active:scale-95 ${
          open
            ? "border-brand-600 bg-brand-50 text-brand-800"
            : "border-transparent hover:border-slate-200 hover:bg-white hover:text-slate-800"
        }`}
      >
        <Icon name="more" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_WIDTH }}
          className="admin-pop z-50 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5"
        >
          <Link
            href={detailsHref}
            role="menuitem"
            className={`${item} text-slate-700 hover:bg-slate-100`}
          >
            <Icon name="eye" width={16} height={16} />
            {labels.view}
          </Link>
          {rescheduleHref && (
            <Link
              href={rescheduleHref}
              role="menuitem"
              className={`${item} text-slate-700 hover:bg-slate-100`}
            >
              <Icon name="reschedule" width={16} height={16} />
              {labels.reschedule}
            </Link>
          )}
          {(canApprove || canReject || canCancel) && (
            <div className="my-1 border-t border-slate-100" role="separator" />
          )}
          {canApprove &&
            decision(approveBookingAction, labels.approveConfirm, labels.approve, "check", "text-emerald-700 hover:bg-emerald-50")}
          {canReject &&
            decision(rejectBookingAction, labels.rejectConfirm, labels.reject, "x", "text-red-700 hover:bg-red-50")}
          {canCancel &&
            decision(cancelBookingAction, labels.cancelConfirm, labels.cancel, "ban", "text-slate-700 hover:bg-slate-100")}
        </div>
      )}
    </>
  );
}

