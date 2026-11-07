import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getAdminExtra } from "@/lib/i18n/admin-extra";
import { isLocale } from "@/lib/i18n/config";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/timezone";
import { getCustomer } from "@/server/services/admin-customers";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; email: string }>;
}) {
  const { locale, email: rawEmail } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPage(locale, "bookings:view");
  const dict = getDictionary(locale);
  const x = getAdminExtra(locale);

  const email = decodeURIComponent(rawEmail).trim().toLowerCase();
  if (!z.string().email().max(254).safeParse(email).success) notFound();

  const customer = await getCustomer(email).catch(() => null);
  if (!customer) notFound();

  const digits = customer.phone.replace(/[^\d]/g, "");
  const base = `/${locale}/admin`;

  return (
    <div className="space-y-6">
      <Link href={`${base}/customers`} className="text-sm text-brand-700">← {x.customersTitle}</Link>

      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
        <p className="mt-1 text-sm text-slate-500">{x.customerProfile}</p>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-slate-500">{dict.common.email}</dt>
            <dd className="mt-0.5 text-slate-900" dir="ltr">{customer.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">{dict.common.phone}</dt>
            <dd className="mt-0.5 text-slate-900" dir="ltr">{customer.phone}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">{x.totalBookingsCol}</dt>
            <dd className="mt-0.5 text-slate-900">{customer.bookings.length}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`mailto:${customer.email}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-400">
            {x.sendEmail}
          </a>
          <a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-400">
            {x.callPhone}
          </a>
          {digits && (
            <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-400">
              {x.whatsapp}
            </a>
          )}
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">{x.customerHistory}</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-sand-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start">{dict.admin.reference}</th>
                <th className="px-4 py-3 text-start">{dict.admin.service}</th>
                <th className="px-4 py-3 text-start">{x.method}</th>
                <th className="px-4 py-3 text-start">{dict.admin.appointment}</th>
                <th className="px-4 py-3 text-start">{dict.common.status}</th>
                <th className="px-4 py-3 text-start">{x.payment}</th>
                <th className="px-4 py-3 text-start">{dict.common.details}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customer.bookings.map((b) => (
                <tr key={b.id} className="hover:bg-sand-50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{b.publicReference}</td>
                  <td className="px-4 py-3 text-slate-700">{locale === "ar" ? b.service.titleAr : b.service.titleEn}</td>
                  <td className="px-4 py-3 text-slate-700">{locale === "ar" ? b.method.nameAr : b.method.nameEn}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(b.startAt, b.timezone, locale)}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} dict={dict} /></td>
                  <td className="px-4 py-3 text-slate-700">{dict.payment[b.paymentStatus.toLowerCase() as keyof typeof dict.payment]}</td>
                  <td className="px-4 py-3">
                    <Link href={`${base}/bookings/${b.id}`} className="font-semibold text-brand-700 hover:text-brand-900">{dict.common.view}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

