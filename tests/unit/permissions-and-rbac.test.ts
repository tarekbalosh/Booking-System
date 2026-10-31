import { describe, expect, it } from "vitest";
import {
  hasPermission,
  permissionsForRole,
  canMutateUser,
  type Permission,
} from "@/lib/auth/permissions";

describe("Role-Based Access Control (RBAC) Permissions", () => {
  it("enforces STAFF role with limited read-only permissions", () => {
    const staffRole = "STAFF";
    expect(permissionsForRole(staffRole)).toContain("dashboard:view");

    expect(hasPermission(staffRole, "dashboard:view")).toBe(true);
    expect(hasPermission(staffRole, "bookings:view")).toBe(true);
    expect(hasPermission(staffRole, "notifications:view")).toBe(true);

    // Forbidden for staff:
    expect(hasPermission(staffRole, "bookings:decide")).toBe(false);
    expect(hasPermission(staffRole, "services:manage")).toBe(false);
    expect(hasPermission(staffRole, "methods:manage")).toBe(false);
    expect(hasPermission(staffRole, "availability:manage")).toBe(false);
    expect(hasPermission(staffRole, "settings:manage")).toBe(false);
    expect(hasPermission(staffRole, "users:manage")).toBe(false);
    expect(hasPermission(staffRole, "audit:view")).toBe(false);
  });

  it("enforces ADMIN role with operational permissions but NO user management", () => {
    const adminRole = "ADMIN";

    // Allowed for admin:
    expect(hasPermission(adminRole, "dashboard:view")).toBe(true);
    expect(hasPermission(adminRole, "bookings:view")).toBe(true);
    expect(hasPermission(adminRole, "bookings:decide")).toBe(true);
    expect(hasPermission(adminRole, "services:manage")).toBe(true);
    expect(hasPermission(adminRole, "methods:manage")).toBe(true);
    expect(hasPermission(adminRole, "availability:manage")).toBe(true);
    expect(hasPermission(adminRole, "settings:manage")).toBe(true);
    expect(hasPermission(adminRole, "notifications:retry")).toBe(true);
    expect(hasPermission(adminRole, "audit:view")).toBe(true);

    // Strictly forbidden for admin (Owner only):
    expect(hasPermission(adminRole, "users:manage")).toBe(false);
  });

  it("enforces OWNER role with full superadmin privileges", () => {
    const ownerRole = "OWNER";
    const allExpectedPermissions: Permission[] = [
      "dashboard:view",
      "bookings:view",
      "bookings:decide",
      "bookings:notes",
      "services:manage",
      "methods:manage",
      "availability:manage",
      "settings:manage",
      "users:manage",
      "notifications:view",
      "notifications:retry",
      "audit:view",
    ];

    for (const perm of allExpectedPermissions) {
      expect(hasPermission(ownerRole, perm)).toBe(true);
    }
  });
});

describe("Admin User Mutation Safety Rules (canMutateUser)", () => {
  const ownerId = "owner-uuid-111";
  const otherAdminId = "admin-uuid-222";

  it("rejects user mutations attempted by non-owners", () => {
    const check = canMutateUser({
      actorRole: "ADMIN",
      actorId: otherAdminId,
      mutation: "create",
      remainingActiveOwners: 1,
    });

    expect(check.allowed).toBe(false);
    if (!check.allowed) {
      expect(check.reason).toBe("forbidden");
    }
  });

  it("prevents an owner from deactivating their own account", () => {
    const check = canMutateUser({
      actorRole: "OWNER",
      actorId: ownerId,
      targetId: ownerId,
      targetRole: "OWNER",
      targetActive: true,
      mutation: "deactivate",
      nextActive: false,
      remainingActiveOwners: 2,
    });

    expect(check.allowed).toBe(false);
    if (!check.allowed) {
      expect(check.reason).toBe("self");
    }
  });

  it("prevents an owner from demoting their own role", () => {
    const check = canMutateUser({
      actorRole: "OWNER",
      actorId: ownerId,
      targetId: ownerId,
      targetRole: "OWNER",
      targetActive: true,
      mutation: "update",
      nextRole: "STAFF",
      remainingActiveOwners: 2,
    });

    expect(check.allowed).toBe(false);
    if (!check.allowed) {
      expect(check.reason).toBe("self");
    }
  });

  it("strictly prevents deactivating or demoting the last active owner", () => {
    const targetOwnerId = "target-owner-333";
    const check = canMutateUser({
      actorRole: "OWNER",
      actorId: ownerId,
      targetId: targetOwnerId,
      targetRole: "OWNER",
      targetActive: true,
      mutation: "update",
      nextActive: false,
      remainingActiveOwners: 1, // Only 1 active owner remains!
    });

    expect(check.allowed).toBe(false);
    if (!check.allowed) {
      expect(check.reason).toBe("last_owner");
    }
  });

  it("allows updating another user when safety constraints are satisfied", () => {
    const check = canMutateUser({
      actorRole: "OWNER",
      actorId: ownerId,
      targetId: otherAdminId,
      targetRole: "STAFF",
      targetActive: true,
      mutation: "update",
      nextRole: "ADMIN",
      nextActive: true,
      remainingActiveOwners: 2,
    });

    expect(check.allowed).toBe(true);
  });
});
