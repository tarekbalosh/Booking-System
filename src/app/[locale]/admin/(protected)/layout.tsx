import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { logoutAction } from "@/server/actions/admin-auth";
import { AdminNav, type AdminNavItem } from "@/components/admin/admin-nav";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const admin = await requireAdminPage(locale, "dashboard:view");
  const dict = getDictionary(locale);

  const navDefinitions: Array<{ href: string; label: string; icon: string; permission: Permission }> = [
    { href: `/${locale}/admin`, label: dict.common.dashboard, icon: "▦", permission: "dashboard:view" },
    { href: `/${locale}/admin/bookings`, label: dict.common.book ?? "", icon: "▤", permission: "bookings:view" },
    { href: `/${locale}/admin/calendar`, label: dict.nav.calendar, icon: "▥", permission: "bookings:view" },
    { href: `/${locale}/admin/services`, label: dict.common.services, icon: "✦", permission: "services:manage" },
    { href: `/${locale}/admin/methods`, label: dict.nav.methods, icon: "◈", permission: "methods:manage" },
    { href: `/${locale}/admin/availability`, label: dict.nav.availability, icon: "◷", permission: "availability:manage" },
    { href: `/${locale}/admin/settings`, label: dict.nav.settings, icon: "⚙", permission: "settings:manage" },
    { href: `/${locale}/admin/users`, label: dict.nav.users, icon: "◎", permission: "users:manage" },
    { href: `/${locale}/admin/notifications`, label: dict.nav.notifications, icon: "✉", permission: "notifications:view" },
    { href: `/${locale}/admin/audit`, label: dict.nav.audit, icon: "≡", permission: "audit:view" },
  ];

  const items: AdminNavItem[] = navDefinitions
    .filter((item) => hasPermission(admin.role, item.permission))
    .map(({ href, label, icon }) => ({ href, label: label || "Bookings", icon }));

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-sm font-bold text-white">
              C
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{dict.admin.title}</p>
              <p className="text-xs text-slate-500">
                {dict.admin.signedInAs} {admin.name} · {dict.roles[admin.role]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/${locale}`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-400"
            >
              {dict.nav.site}
            </a>
            <LocaleSwitcher locale={locale} label={dict.common.language} />
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-rose-300 hover:text-rose-700"
              >
                {dict.common.logout}
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <aside className="lg:w-56 lg:shrink-0">
          <div className="rounded-xl border border-slate-200 bg-white p-2">
            <AdminNav items={items} />
          </div>
        </aside>
        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
