import type { AdminRole } from "@prisma/client";

export type Permission =
  | "dashboard:view"
  | "bookings:view"
  | "bookings:decide"
  | "bookings:notes"
  | "services:manage"
  | "methods:manage"
  | "availability:manage"
  | "settings:manage"
  | "users:manage"
  | "notifications:view"
  | "notifications:retry"
  | "audit:view";

const STAFF_PERMISSIONS: readonly Permission[] = [
  "dashboard:view",
  "bookings:view",
  "notifications:view",
];

const ADMIN_PERMISSIONS: readonly Permission[] = [
  ...STAFF_PERMISSIONS,
  "bookings:decide",
  "bookings:notes",
  "services:manage",
  "methods:manage",
  "availability:manage",
  "settings:manage",
  "notifications:retry",
  "audit:view",
];

const OWNER_PERMISSIONS: readonly Permission[] = [...ADMIN_PERMISSIONS, "users:manage"];

const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  STAFF: STAFF_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  OWNER: OWNER_PERMISSIONS,
};

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsForRole(role: AdminRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export type UserMutation = "create" | "update" | "deactivate";

export type UserMutationCheck =
  | { allowed: true }
  | { allowed: false; reason: "forbidden" | "last_owner" | "self" };

/**
 * Only owners manage users. The last active owner cannot be demoted or
 * deactivated, and nobody can deactivate their own account from the UI.
 */
export function canMutateUser(params: {
  actorRole: AdminRole;
  actorId: string;
  targetId?: string;
  targetRole?: AdminRole;
  targetActive?: boolean;
  remainingActiveOwners: number;
  mutation: UserMutation;
  nextRole?: AdminRole;
  nextActive?: boolean;
}): UserMutationCheck {
  if (params.actorRole !== "OWNER") return { allowed: false, reason: "forbidden" };

  if (params.mutation === "create") return { allowed: true };

  if (params.targetId && params.targetId === params.actorId) {
    if (
      params.mutation === "deactivate" ||
      params.nextActive === false ||
      (params.nextRole !== undefined && params.nextRole !== params.actorRole)
    ) {
      return { allowed: false, reason: "self" };
    }
  }

  const isTargetOwner = params.targetRole === "OWNER";
  const removesOwner =
    isTargetOwner &&
    (params.nextRole !== undefined && params.nextRole !== "OWNER" || params.nextActive === false);

  if (removesOwner && params.remainingActiveOwners <= 1) {
    return { allowed: false, reason: "last_owner" };
  }

  return { allowed: true };
}
