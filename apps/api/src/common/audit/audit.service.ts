import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { paginate, type PaginatedResult, type PaginationQueryDto } from "../pagination/pagination.dto";
import { DomainException } from "../errors/domain-error";

export interface AuditRecordInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actor: { id: string; email: string | null } | null;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
  // Present on rows from `list()` (the general browser, Phase 12) — omitted from `listForEntity`'s
  // rows since the caller already knows the entityType/entityId there (it's the query filter).
  entityType?: string;
  entityId?: string;
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

  // Scoped read for a single entity's history — added for Phase 11's "reviewer audit trail"
  // requirement (see onboarding.service.ts). Deliberately narrow (one entityType/entityId at a
  // time, no cross-entity listing/filtering): a general admin-facing audit-log browser was flagged
  // in the pre-Phase-11 audit as a separate, out-of-scope gap (see PROJECT_STATUS.md Phase 11
  // section) and is not what this method is for.
  async listForEntity(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, email: true } } },
    });
    return rows.map((r) => ({ id: r.id, actorId: r.actorId, actor: r.actor, action: r.action, before: r.before, after: r.after, createdAt: r.createdAt }));
  }

  // The general admin-facing audit-log browser this codebase's own Phase 11 comment (above)
  // flagged as a separate, later gap — Phase 12 (Admin Operations) is that later phase. Distinct
  // from `listForEntity`: filterable/searchable/paginated across the whole table, not scoped to
  // one entity.
  async list(
    query: PaginationQueryDto & { entityType?: string; actorId?: string; action?: string; dateFrom?: string; dateTo?: string; search?: string },
  ): Promise<PaginatedResult<AuditLogEntry>> {
    const where: Prisma.AuditLogWhereInput = {
      entityType: query.entityType,
      actorId: query.actorId,
      action: query.action,
      ...(query.dateFrom || query.dateTo
        ? { createdAt: { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(query.dateTo) : undefined } }
        : {}),
      ...(query.search
        ? { OR: [{ entityId: { contains: query.search, mode: "insensitive" } }, { actor: { email: { contains: query.search, mode: "insensitive" } } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
        include: { actor: { select: { id: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const items = rows.map((r) => ({ id: r.id, actorId: r.actorId, actor: r.actor, action: r.action, before: r.before, after: r.after, createdAt: r.createdAt, entityType: r.entityType, entityId: r.entityId }));
    return paginate(items, total, query);
  }

  async findOneOrThrow(id: string): Promise<AuditLogEntry> {
    const row = await this.prisma.auditLog.findUnique({ where: { id }, include: { actor: { select: { id: true, email: true } } } });
    if (!row) throw new DomainException("NOT_FOUND", "Audit yozuvi topilmadi.");
    return { id: row.id, actorId: row.actorId, actor: row.actor, action: row.action, before: row.before, after: row.after, createdAt: row.createdAt, entityType: row.entityType, entityId: row.entityId };
  }
}
