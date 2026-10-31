"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/server/actions/admin-auth";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

export function AdminLoginForm({
  locale,
  next,
  strings,
}: {
  locale: Locale;
  next?: string;
  strings: Dictionary["adminLogin"];
}) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, null);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next ?? ""} />

      {state?.error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {state.error === "locked" ? strings.locked : strings.invalid}
        </p>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-slate-800">
          {strings.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          dir="ltr"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-slate-800">
          {strings.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          dir="ltr"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
      </div>

      <SubmitButton pendingLabel={strings.submitting} className="w-full rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
        {strings.submit}
      </SubmitButton>
    </form>
  );
}
