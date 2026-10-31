import "server-only";
import type { Prisma } from "@prisma/client";

type AuditInput = {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export function auditData(input: AuditInput): Prisma.AuditLogUncheckedCreateInput {
  return {
    adminId: input.adminId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata,
  };
}
