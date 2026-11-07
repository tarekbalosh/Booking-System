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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={`/${locale}`} className="group flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-brand-700 to-brand-500 text-white shadow-md shadow-brand-700/20 transition-transform duration-200 group-hover:scale-105">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
              />
            </svg>
          </span>
          <span className="text-base font-extrabold tracking-tight text-slate-900 transition-colors group-hover:text-brand-800">
            {dict.common.brand}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={dict.common.home}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-brand-50 hover:text-brand-800"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <LocaleSwitcher locale={locale} label={dict.common.language} />
          <Link
            href={`/${locale}/booking`}
            className="hidden rounded-xl bg-gradient-to-r from-brand-700 to-brand-800 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-700/20 transition-all duration-200 hover:from-brand-800 hover:to-brand-900 hover:shadow-lg hover:shadow-brand-700/30 active:scale-[0.98] sm:inline-block"
          >
            {dict.common.book}
          </Link>
          <details className="relative md:hidden">
            <summary className="cursor-pointer list-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-2xs">
              {locale === "ar" ? "القائمة" : "Menu"}
            </summary>
            <div className="absolute end-0 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-brand-50 hover:text-brand-800"
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
