import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import type { AdminRole } from "@prisma/client";
import { getDb } from "@/lib/db/prisma";
import {
  ADMIN_SESSION_COOKIE,
  SESSION_DURATION_HOURS,
} from "@/lib/constants";
import {
  hasPermission,
  type Permission,
} from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n/config";

export type CurrentAdmin = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
};

export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
}

export async function createAdminSession(
  adminId: string,
  userAgent: string | null,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = sessionExpiry();
  const db = getDb();

  await db.adminSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      adminId,
      expiresAt,
      userAgent: userAgent?.slice(0, 300) ?? null,
    },
  });

  // Opportunistic cleanup; never blocks sign-in if it fails.
  void db.adminSession
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (token) {
    await getDb().adminSession
      .deleteMany({ where: { tokenHash: hashSessionToken(token) } })
      .catch(() => undefined);
  }
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

/** Validates the session server-side on every request. */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const session = await db.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { admin: true },
  });

  if (!session || session.expiresAt.getTime() <= Date.now() || !session.admin.active) {
    if (session) {
      await db.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  if (Date.now() - session.lastUsedAt.getTime() > 5 * 60_000) {
    await db.adminSession
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  return {
    id: session.admin.id,
    name: session.admin.name,
    email: session.admin.email,
    role: session.admin.role,
  };
});

export async function requireAdminPage(
  locale: Locale,
  permission: Permission = "dashboard:view",
): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect(`/${locale}/admin/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  }
  if (!hasPermission(admin.role, permission)) {
    redirect(`/${locale}/admin?error=forbidden`);
  }
  return admin;
}

export async function requireAdminAction(permission: Permission): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new AuthorizationError("Please sign in again.");
  if (!hasPermission(admin.role, permission)) {
    throw new AuthorizationError("You do not have permission to perform this action.");
  }
  return admin;
}
