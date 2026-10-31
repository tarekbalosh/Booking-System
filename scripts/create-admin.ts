import { PrismaClient, AdminRole } from "@prisma/client";
import { hashPassword, validatePasswordPolicy } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.ADMIN_EMAIL || process.env.ADMIN_INITIAL_EMAIL || "").trim().toLowerCase();
  const password = args[1] || process.env.ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || "";
  const name = args[2] || process.env.ADMIN_NAME || "System Administrator";
  const roleInput = (args[3] || process.env.ADMIN_ROLE || "OWNER").toUpperCase();

  if (!email || !password) {
    console.error("Usage: npm run admin:create <email> <password> [name] [role]");
    console.error("  Or set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_ROLE in environment.");
    process.exit(1);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error("Error: Invalid email address.");
    process.exit(1);
  }

  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    console.error(`Error: Password policy violation: ${policyError}`);
    process.exit(1);
  }

  const validRoles: AdminRole[] = ["OWNER", "ADMIN", "STAFF"];
  if (!validRoles.includes(roleInput as AdminRole)) {
    console.error(`Error: Invalid role "${roleInput}". Must be one of: OWNER, ADMIN, STAFF`);
    process.exit(1);
  }

  const role = roleInput as AdminRole;
  const passwordHash = await hashPassword(password);

  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (existing) {
    await prisma.adminUser.update({
      where: { email },
      data: {
        passwordHash,
        name,
        role,
        active: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    console.log(`✓ Admin user "${email}" updated successfully with role "${role}".`);
  } else {
    await prisma.adminUser.create({
      data: {
        email,
        name,
        role,
        passwordHash,
        active: true,
      },
    });
    console.log(`✓ Admin user "${email}" created successfully with role "${role}".`);
  }
}

main()
  .catch((err) => {
    console.error("Error creating admin user:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
