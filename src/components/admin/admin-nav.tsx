"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/admin/icons";

export type AdminNavItem = { href: string; label: string; icon: string };
export type AdminNavGroup = { title: string; items: AdminNavItem[] };

type Labels = { collapse: string; expand: string; openMenu: string; closeMenu: string };

function isActive(pathname: string, href: string): boolean {
  return /\/admin$/.test(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavContent({
  groups,
  collapsed,
  onNavigate,
}: {
  groups: AdminNavGroup[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((group, index) => (
        <div key={group.title}>
          {collapsed ? (
            index > 0 && <div className="mx-2 mb-3 border-t border-slate-200" role="separator" />
          ) : (
            <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-slate-400">
              {group.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                      collapsed ? "justify-center px-0" : ""
                    } ${
                      active
                        ? "bg-brand-50 text-brand-800"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-brand-700"
                      />
                    )}
                    <Icon
                      name={item.icon}
                      className={`shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                        active ? "text-brand-700" : "text-slate-400 group-hover:text-slate-600"
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ name, subtitle, compact }: { name: string; subtitle: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-700 text-base font-bold text-white shadow-sm">
        {name.trim().charAt(0).toUpperCase() || "C"}
      </span>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold text-slate-900">{name}</p>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>
      )}
    </div>
  );
}

export function AdminSidebar({
  groups,
  brandName,
  brandSubtitle,
  labels,
}: {
  groups: AdminNavGroup[];
  brandName: string;
  brandSubtitle: string;
  labels: Labels;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on navigation and on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pathname]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-e border-slate-200 bg-white transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b border-slate-200 px-4 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          <Brand name={brandName} subtitle={brandSubtitle} compact={collapsed} />
        </div>
        <NavContent groups={groups} collapsed={collapsed} />
        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-pressed={collapsed}
            title={collapsed ? labels.expand : labels.collapse}
            className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <Icon name="collapse" className="shrink-0" />
            {!collapsed && <span>{collapsed ? labels.expand : labels.collapse}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Brand name={brandName} subtitle={brandSubtitle} compact />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={labels.openMenu}
          aria-expanded={open}
          className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 active:scale-95"
        >
          <Icon name="menu" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={labels.openMenu}>
          <button
            type="button"
            aria-label={labels.closeMenu}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <div className="admin-pop absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <Brand name={brandName} subtitle={brandSubtitle} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={labels.closeMenu}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <Icon name="x" />
              </button>
            </div>
            <NavContent groups={groups} collapsed={false} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

/** Shows the label of the current admin page in the top bar. */
export function PageContext({
  items,
  rootLabel,
}: {
  items: AdminNavItem[];
  rootLabel: string;
}) {
  const pathname = usePathname();
  const current = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isActive(pathname, item.href));
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
      <span className="hidden text-slate-400 sm:inline">{rootLabel}</span>
      <Icon name="chevron" width={14} height={14} className="hidden text-slate-300 sm:block rtl:rotate-180" />
      <span className="truncate font-semibold text-slate-900">{current?.label ?? rootLabel}</span>
    </nav>
  );
}
