import "server-only";
import { getDb } from "@/lib/db/prisma";
import { MAX_LOGIN_ATTEMPTS, LOGIN_LOCK_MINUTES } from "@/lib/constants";
import { verifyPassword } from "@/lib/auth/password";

// A valid bcrypt hash used to equalize timing for unknown accounts.
const DUMMY_HASH = "$2b$12$5rIqSaDlkG27sh5ZVmGFIOWOQCnxzgI1XxGiBYTJ8e2tKxvy2Re1G";

export type LoginResult =
  | { ok: true; admin: { id: string; name: string; email: string; role: "OWNER" | "ADMIN" | "STAFF" } }
  | { ok: false; reason: "invalid" | "locked" };

export async function authenticateAdmin(
  emailInput: string,
  password: string,
): Promise<LoginResult> {
  const email = emailInput.trim().toLowerCase();
  const db = getDb();
  const admin = await db.adminUser.findUnique({ where: { email } });

  if (!admin) {
    await verifyPassword(password, DUMMY_HASH).catch(() => false);
    return { ok: false, reason: "invalid" };
  }

  if (!admin.active) {
    await verifyPassword(password, DUMMY_HASH).catch(() => false);
    return { ok: false, reason: "invalid" };
  }

  if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
    return { ok: false, reason: "locked" };
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    const attempts = admin.failedLoginAttempts + 1;
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      await db.adminUser.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000),
        },
      });
      return { ok: false, reason: "locked" };
    }
    await db.adminUser.update({
      where: { id: admin.id },
      data: { failedLoginAttempts: attempts },
    });
    return { ok: false, reason: "invalid" };
  }

  await db.adminUser.update({
    where: { id: admin.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  return {
    ok: true,
    admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
  };
}
