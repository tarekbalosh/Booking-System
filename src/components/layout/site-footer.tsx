import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { publicWhatsAppUrl } from "@/lib/public-contact";

export function SiteFooter({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-3">
          <p className="text-base font-semibold text-slate-900">{dict.common.brand}</p>
          <p className="text-sm leading-6 text-slate-600">{dict.meta.description}</p>
          <a
            href={publicWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-900"
          >
            <WhatsAppIcon />
            {dict.footer.contact}
          </a>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Link href={`/${locale}/services`} className="text-slate-600 hover:text-brand-800">
            {dict.common.services}
          </Link>
          <Link href={`/${locale}/booking`} className="text-slate-600 hover:text-brand-800">
            {dict.common.book}
          </Link>
          <Link href={`/${locale}/booking-status`} className="text-slate-600 hover:text-brand-800">
            {dict.common.bookingStatus}
          </Link>
          <Link href={`/${locale}/privacy`} className="text-slate-600 hover:text-brand-800">
            {dict.footer.privacy}
          </Link>
          <Link href={`/${locale}/terms`} className="text-slate-600 hover:text-brand-800">
            {dict.footer.terms}
          </Link>
          <Link href={`/${locale}/admin/login`} className="text-slate-500 hover:text-brand-800">
            {dict.common.admin}
          </Link>
        </div>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">
        © {year} {dict.common.brand}. {dict.footer.rights}
      </div>
    </footer>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1-1.26-4.4c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.25-8.23 8.25Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.15.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}
