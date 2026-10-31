import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { AdminLoginForm } from "./login-form";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  const admin = await getCurrentAdmin().catch(() => null);
  if (admin) redirect(`/${locale}/admin`);

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-between">
          <Link href={`/${locale}`} className="text-sm font-medium text-brand-700 hover:text-brand-900">
            ← {dict.adminLogin.backToSite}
          </Link>
          <LocaleSwitcher locale={locale} label={dict.common.language} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-700 text-sm font-bold text-white">
              C
            </span>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">{dict.adminLogin.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{dict.adminLogin.subtitle}</p>
          </div>
          <AdminLoginForm
            locale={locale}
            next={next}
            strings={dict.adminLogin}
          />
          <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            {dict.adminLogin.setupHint}
          </p>
        </div>
      </div>
    </div>
  );
}
