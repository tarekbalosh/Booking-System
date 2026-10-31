"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireAdminAction } from "@/lib/auth/session";
import { canMutateUser } from "@/lib/auth/permissions";
import { hashPassword, validatePasswordPolicy } from "@/lib/auth/password";
import { getDb } from "@/lib/db/prisma";
import { adminUserCreateSchema, adminUserUpdateSchema } from "@/lib/validation/schemas";
import { auditData } from "@/server/audit";

function localeFrom(formData: FormData): "ar" | "en" {
  return formData.get("locale") === "en" ? "en" : "ar";
}

export async function createAdminUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("users:manage");
  const locale = localeFrom(formData);
  const parsed = adminUserCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect(`/${locale}/admin/users?error=invalid`);

  const policyError = validatePasswordPolicy(parsed.data.password);
  if (policyError) redirect(`/${locale}/admin/users?error=password`);

  const db = getDb();
  try {
    const created = await db.adminUser.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
    await db.auditLog.create({
      data: auditData({
        adminId: admin.id,
        action: "admin_user.created",
        entityType: "AdminUser",
        entityId: created.id,
        metadata: { role: created.role },
      }),
    });
  } catch (error) {
    const duplicate =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    redirect(`/${locale}/admin/users?error=${duplicate ? "duplicate" : "failed"}`);
  }

  revalidatePath(`/${locale}/admin/users`);
  redirect(`/${locale}/admin/users?saved=1`);
}

export async function updateAdminUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("users:manage");
  const locale = localeFrom(formData);
  const parsed = adminUserUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    role: formData.get("role"),
    active: formData.get("active") === "on",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) redirect(`/${locale}/admin/users?error=invalid`);

  const db = getDb();

  try {
    await db.$transaction(async (tx) => {
      // Serialize owner-account mutations so two concurrent edits cannot
      // remove the last active owner.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-owners'))`;
      const target = await tx.adminUser.findUnique({ where: { id: parsed.data.id } });
      if (!target) throw new UserActionError("notfound");

      const activeOwners = await tx.adminUser.count({
        where: { role: "OWNER", active: true },
      });
      const otherActiveOwners =
        target.role === "OWNER" && target.active ? activeOwners - 1 : activeOwners;

      const check = canMutateUser({
        actorRole: admin.role,
        actorId: admin.id,
        targetId: target.id,
        targetRole: target.role,
        targetActive: target.active,
        remainingActiveOwners: otherActiveOwners,
        mutation: "update",
        nextRole: parsed.data.role,
        nextActive: parsed.data.active,
      });
      if (!check.allowed) throw new UserActionError(check.reason);

      let passwordHash: string | undefined;
      if (parsed.data.password) {
        const policyError = validatePasswordPolicy(parsed.data.password);
        if (policyError) throw new UserActionError("password");
        passwordHash = await hashPassword(parsed.data.password);
      }

      await tx.adminUser.update({
        where: { id: target.id },
        data: {
          name: parsed.data.name,
          role: parsed.data.role,
          active: parsed.data.active,
          ...(passwordHash ? { passwordHash, failedLoginAttempts: 0, lockedUntil: null } : {}),
        },
      });

      // Deactivating a user must revoke all live sessions immediately.
      if (!parsed.data.active) {
        await tx.adminSession.deleteMany({ where: { adminId: target.id } });
      }

      await tx.auditLog.create({
        data: auditData({
          adminId: admin.id,
          action: parsed.data.active ? "admin_user.updated" : "admin_user.deactivated",
          entityType: "AdminUser",
          entityId: target.id,
          metadata: { role: parsed.data.role },
        }),
      });
    }, { maxWait: 15_000, timeout: 30_000 });
  } catch (error) {
    if (error instanceof UserActionError) {
      redirect(`/${locale}/admin/users?error=${error.code}`);
    }
    redirect(`/${locale}/admin/users?error=failed`);
  }

  revalidatePath(`/${locale}/admin/users`);
  redirect(`/${locale}/admin/users?saved=1`);
}

class UserActionError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "UserActionError";
  }
}
