import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface AuditRecordInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

// Thin wrapper around the pre-existing, previously-unused AuditLog model (generic action/
// entityType/entityId/before/after — see schema.prisma). The Content domain is the first to
// actually populate it (see DECISIONS.md ADR-014); any future domain needing an audit trail
// should inject this rather than inventing a parallel table.
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before === undefined ? undefined : (input.before as object),
        after: input.after === undefined ? undefined : (input.after as object),
      },
    });
  }
}
