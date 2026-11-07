"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminSession, destroyCurrentSession } from "@/lib/auth/session";
import { authenticateAdmin } from "@/lib/auth/login";
import { loginSchema } from "@/lib/validation/schemas";
import { isLocale } from "@/lib/i18n/config";

export type LoginState = { error: "invalid" | "locked" | "missing" | "server" } | null;

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const localeValue = String(formData.get("locale") ?? "ar");
  const locale = isLocale(localeValue) ? localeValue : "ar";
  const nextValue = String(formData.get("next") ?? "");
  const next =
    nextValue.startsWith(`/${locale}/admin`) && !nextValue.includes("://")
      ? nextValue
      : `/${locale}/admin`;

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    const result = await authenticateAdmin(parsed.data.email, parsed.data.password);
    if (!result.ok) return { error: result.reason };

    const userAgent = (await headers()).get("user-agent");
    await createAdminSession(result.admin.id, userAgent);
  } catch (err) {
    console.error("[loginAction] Failed:", err);
    return { error: "server" };
  }
  redirect(next);
}

export async function logoutAction(formData: FormData): Promise<void> {
  const localeValue = String(formData.get("locale") ?? "ar");
  const locale = isLocale(localeValue) ? localeValue : "ar";
  await destroyCurrentSession();
  redirect(`/${locale}/admin/login`);
}
