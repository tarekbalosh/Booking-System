import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export function SiteHeader({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const links = [
    { href: `/${locale}`, label: dict.common.home },
    { href: `/${locale}/services`, label: dict.common.services },
    { href: `/${locale}/booking`, label: dict.common.book },
    { href: `/${locale}/booking-status`, label: dict.common.bookingStatus },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-sand-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-sm font-bold text-white">
            C
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900">
            {dict.common.brand}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={dict.common.home}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-brand-50 hover:text-brand-800"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher locale={locale} label={dict.common.language} />
          <Link
            href={`/${locale}/booking`}
            className="hidden rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 sm:inline-block"
          >
            {dict.common.book}
          </Link>
          <details className="relative md:hidden">
            <summary className="cursor-pointer list-none rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">
              {locale === "ar" ? "القائمة" : "Menu"}
            </summary>
            <div className="absolute end-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-brand-50"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
