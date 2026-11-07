"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={
        className ??
        "inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-brand-700 via-brand-700 to-brand-800 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-700/20 transition-all duration-200 hover:from-brand-800 hover:to-brand-900 hover:shadow-lg hover:shadow-brand-700/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {pending ? (
        <>
          <svg
            className="h-4 w-4 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{pendingLabel ?? "…"}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
