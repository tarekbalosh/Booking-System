import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/prisma";
import { requireAdminPage } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/timezone";
import { getBusinessSettings, DEFAULT_SETTINGS } from "@/lib/booking/settings";
import { createAdminUserAction, updateAdminUserAction } from "@/server/actions/admin-users";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string; error?: string; edit?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const currentAdmin = await requireAdminPage(locale, "users:manage");
  const dict = getDictionary(locale);
  const db = getDb();

  let timezone = DEFAULT_SETTINGS.timezone;
  try {
    timezone = (await getBusinessSettings()).timezone;
  } catch {
    timezone = DEFAULT_SETTINGS.timezone;
  }

  const users = await db.adminUser.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  const editingUser = query.edit
    ? users.find((u) => u.id === query.edit)
    : undefined;

  const errorMessage =
    query.error === "duplicate"
      ? "البريد الإلكتروني مسجل مسبقًا"
      : query.error === "password"
      ? "كلمة المرور يجب أن تكون 12 حرفًا على الأقل وتتضمن حروفًا وأرقامًا"
      : query.error === "last_owner"
      ? dict.admin.lastOwner
      : query.error === "self"
      ? dict.admin.cannotModifySelf
      : query.error === "forbidden"
      ? dict.common.noPermission
      : query.error
      ? dict.common.error
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{dict.admin.usersTitle}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {locale === "ar"
            ? "إدارة حسابات المدراء وصلاحياتهم (مالك، مدير، موظف)."
            : "Manage administrator accounts and role permissions (Owner, Admin, Staff)."}
        </p>
      </div>

      {query.saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ {dict.common.save}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          ✕ {errorMessage}
        </div>
      )}

      {/* Add or Edit Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">
          {editingUser ? `${dict.common.edit}: ${editingUser.name}` : dict.admin.addUser}
        </h2>

        {editingUser ? (
          <form action={updateAdminUserAction} className="mt-4 space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={editingUser.id} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="editName" className="block text-xs font-semibold text-slate-700">
                  {dict.common.name}
                </label>
                <input
                  id="editName"
                  name="name"
                  type="text"
                  required
                  defaultValue={editingUser.name}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="editRole" className="block text-xs font-semibold text-slate-700">
                  {dict.admin.role}
                </label>
                <select
                  id="editRole"
                  name="role"
                  defaultValue={editingUser.role}
                  disabled={editingUser.id === currentAdmin.id}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  <option value="STAFF">{dict.admin.roleStaff}</option>
                  <option value="ADMIN">{dict.admin.roleAdmin}</option>
                  <option value="OWNER">{dict.admin.roleOwner}</option>
                </select>
                {editingUser.id === currentAdmin.id && (
                  <input type="hidden" name="role" value={editingUser.role} />
                )}
              </div>

              <div>
                <label htmlFor="editPassword" className="block text-xs font-semibold text-slate-700">
                  {dict.admin.newPassword}
                </label>
                <input
                  id="editPassword"
                  name="password"
                  type="password"
                  placeholder="••••••••••••"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="editActive"
                name="active"
                type="checkbox"
                defaultChecked={editingUser.active}
                disabled={editingUser.id === currentAdmin.id}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
              />
              <label htmlFor="editActive" className="text-xs font-medium text-slate-700">
                {dict.common.active}
              </label>
              {editingUser.id === currentAdmin.id && (
                <input type="hidden" name="active" value="on" />
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <SubmitButton className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800">
                {dict.common.save}
              </SubmitButton>
              <a
                href={`/${locale}/admin/users`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {dict.common.cancel}
              </a>
            </div>
          </form>
        ) : (
          <form action={createAdminUserAction} className="mt-4 space-y-4">
            <input type="hidden" name="locale" value={locale} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-slate-700">
                  {dict.common.name}
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="الاسم الكامل"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-700">
                  {dict.common.email}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="admin@example.com"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-xs font-semibold text-slate-700">
                  {dict.admin.role}
                </label>
                <select
                  id="role"
                  name="role"
                  defaultValue="STAFF"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="STAFF">{dict.admin.roleStaff}</option>
                  <option value="ADMIN">{dict.admin.roleAdmin}</option>
                  <option value="OWNER">{dict.admin.roleOwner}</option>
                </select>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                  {dict.admin.password}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  placeholder="••••••••••••"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-slate-500">{dict.admin.passwordHint}</p>

            <div className="flex justify-end pt-2">
              <SubmitButton className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800">
                {dict.admin.addUser}
              </SubmitButton>
            </div>
          </form>
        )}
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">
            {dict.admin.usersTitle} ({users.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" dir={locale === "ar" ? "rtl" : "ltr"}>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{dict.common.name}</th>
                <th className="px-4 py-3 font-medium">{dict.common.email}</th>
                <th className="px-4 py-3 font-medium">{dict.admin.role}</th>
                <th className="px-4 py-3 font-medium">{dict.common.status}</th>
                <th className="px-4 py-3 font-medium">آخر تسجيل دخول</th>
                <th className="px-4 py-3 font-medium text-end">{dict.common.details}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {user.name}
                    {user.id === currentAdmin.id && (
                      <span className="mx-2 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">
                        حسابك
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                        user.role === "OWNER"
                          ? "bg-purple-100 text-purple-800"
                          : user.role === "ADMIN"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {dict.roles[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        user.active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {user.active ? dict.common.active : dict.common.inactive}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt, timezone, locale) : "—"}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <a
                      href={`/${locale}/admin/users?edit=${user.id}`}
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-brand-400"
                    >
                      {dict.common.edit}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
