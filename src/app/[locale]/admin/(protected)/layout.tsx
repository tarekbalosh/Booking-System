import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { logoutAction } from "@/server/actions/admin-auth";
import { AdminSidebar, PageContext, type AdminNavGroup } from "@/components/admin/admin-nav";
import { Icon } from "@/components/admin/icons";
import { getAdminExtra } from "@/lib/i18n/admin-extra";
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

  const x = getAdminExtra(locale);
  type Def = { href: string; label: string; icon: string; permission: Permission };
  const base = `/${locale}/admin`;
  const groupDefinitions: Array<{ title: string; items: Def[] }> = [
    {
      title: x.groupMain,
      items: [
        { href: base, label: x.navOverview, icon: "overview", permission: "dashboard:view" },
        { href: `${base}/bookings`, label: x.navBookings, icon: "bookings", permission: "bookings:view" },
        { href: `${base}/calendar`, label: dict.nav.calendar, icon: "calendar", permission: "bookings:view" },
        { href: `${base}/customers`, label: x.navCustomers, icon: "customers", permission: "bookings:view" },
      ],
    },
    {
      title: x.groupManagement,
      items: [
        { href: `${base}/availability`, label: x.navAvailability, icon: "availability", permission: "availability:manage" },
        { href: `${base}/services`, label: x.navServices, icon: "services", permission: "services:manage" },
        { href: `${base}/methods`, label: x.navMethods, icon: "methods", permission: "methods:manage" },
      ],
    },
    {
      title: x.groupMonitoring,
      items: [
        { href: `${base}/notifications`, label: x.navNotifications, icon: "notifications", permission: "notifications:view" },
        { href: `${base}/history`, label: x.navHistory, icon: "history", permission: "bookings:view" },
        { href: `${base}/audit`, label: x.navAudit, icon: "audit", permission: "audit:view" },
      ],
    },
    {
      title: x.groupSystem,
      items: [
        { href: `${base}/users`, label: x.navAdmins, icon: "admins", permission: "users:manage" },
        { href: `${base}/settings`, label: x.navSettings, icon: "settings", permission: "settings:manage" },
      ],
    },
  ];

  const groups: AdminNavGroup[] = groupDefinitions
    .map((group) => ({
      title: group.title,
      items: group.items
        .filter((item) => hasPermission(admin.role, item.permission))
        .map(({ href, label, icon }) => ({ href, label, icon })),
    }))
    .filter((group) => group.items.length > 0);

  const initials = admin.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <div className="admin-shell min-h-screen lg:flex">
      <AdminSidebar
        groups={groups}
        brandName={dict.common.brand}
        brandSubtitle={dict.admin.title}
        labels={{
          collapse: x.collapseSidebar,
          expand: x.expandSidebar,
          openMenu: x.openMenu,
          closeMenu: x.closeMenu,
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 backdrop-blur lg:flex">
          <PageContext items={groups.flatMap((group) => group.items)} rootLabel={dict.admin.title} />
          <div className="flex items-center gap-2">
            <a
              href={`/${locale}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon name="site" width={16} height={16} />
              {dict.nav.site}
            </a>
            <LocaleSwitcher
              locale={locale}
              label={dict.common.language}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-brand-600 hover:text-brand-800"
            />
            <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800"
              >
                {initials || "A"}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900">{admin.name}</p>
                <p className="text-xs text-slate-500">{dict.roles[admin.role]}</p>
              </div>
            </div>
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                title={dict.common.logout}
                aria-label={dict.common.logout}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 active:scale-95"
              >
                <Icon name="logout" width={18} height={18} className="rtl:-scale-x-100" />
              </button>
            </form>
          </div>
        </header>

        {/* Compact account bar for tablets and phones */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800"
            >
              {initials || "A"}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-slate-900">{admin.name}</p>
              <p className="text-xs text-slate-500">{dict.roles[admin.role]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher
              locale={locale}
              label={dict.common.language}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700"
            />
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                aria-label={dict.common.logout}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:text-rose-700"
              >
                <Icon name="logout" width={16} height={16} className="rtl:-scale-x-100" />
              </button>
            </form>
          </div>
        </div>

        <main id="main-content" className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
