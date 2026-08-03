import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import type { RefundQueryDto } from "./dto/refund-query.dto";

const REFUND_SELECT = {
  id: true,
  orderId: true,
  amountMinor: true,
  reason: true,
  status: true,
  requestedById: true,
  reviewedById: true,
  reviewedAt: true,
  rejectionReason: true,
  processedAt: true,
  createdAt: true,
  order: {
    select: {
      publicToken: true,
      totalMinor: true,
      offer: { select: { name: true } },
      customer: { select: { fullName: true } },
    },
  },
} satisfies Prisma.RefundSelect;

type RefundRow = Prisma.RefundGetPayload<{ select: typeof REFUND_SELECT }>;

export interface RefundAdminResponse {
  id: string;
  orderId: string;
  orderPublicToken: string;
  offerName: string;
  customerName: string;
  amountMinor: number;
  isPartial: boolean;
  reason: string;
  status: string;
  requestedById: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  processedAt: Date | null;
  createdAt: Date;
}

const DECIDE_FROM = ["REQUESTED"] as const;

// Admin refund review decisions (Phase 12) — layered on top of `OrdersService.createRefund`
// (Phase 8, frozen), never re-implementing it. That method already performs the real financial
// action synchronously at request time (releases stock and flips the Order to REFUNDED for a full
// refund; a partial refund touches neither) and creates the Refund row at `REQUESTED`, which
// nothing before this phase ever moved out of. Approve/reject here is an administrative review
// decision recorded on the Refund row itself — audit trail and bookkeeping, not a second
// money-movement trigger and not a way to reverse the order-level action a full refund already
// performed. See DECISIONS.md ADR-019 for the full reasoning, including why REJECTED on an
// already-completed full refund does not (and structurally cannot, via this service) undo it.
@Injectable()
export class AdminRefundsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private toResponse(r: RefundRow): RefundAdminResponse {
    return {
      id: r.id,
      orderId: r.orderId,
      orderPublicToken: r.order.publicToken,
      offerName: r.order.offer?.name ?? "Unknown",
      customerName: r.order.customer.fullName,
      amountMinor: r.amountMinor,
      isPartial: r.amountMinor < r.order.totalMinor,
      reason: r.reason,
      status: r.status,
      requestedById: r.requestedById,
      reviewedById: r.reviewedById,
      reviewedAt: r.reviewedAt,
      rejectionReason: r.rejectionReason,
      processedAt: r.processedAt,
      createdAt: r.createdAt,
    };
  }

  async list(query: RefundQueryDto): Promise<PaginatedResult<RefundAdminResponse>> {
    const where: Prisma.RefundWhereInput = {
      status: query.status,
      ...(query.search
        ? { OR: [{ order: { publicToken: { contains: query.search, mode: "insensitive" } } }, { order: { customer: { fullName: { contains: query.search, mode: "insensitive" } } } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.refund.findMany({ where, select: REFUND_SELECT, orderBy: { createdAt: "desc" }, skip: query.skip, take: query.take }),
      this.prisma.refund.count({ where }),
    ]);
    return paginate(items.map((r) => this.toResponse(r)), total, query);
  }

  private async findRowOrThrow(id: string): Promise<RefundRow> {
    const row = await this.prisma.refund.findUnique({ where: { id }, select: REFUND_SELECT });
    if (!row) throw new DomainException("NOT_FOUND", "Refund topilmadi.");
    return row;
  }

  async findOneOrThrow(id: string): Promise<RefundAdminResponse> {
    return this.toResponse(await this.findRowOrThrow(id));
  }

  async approve(id: string, actorId: string): Promise<RefundAdminResponse> {
    const existing = await this.findRowOrThrow(id);
    if (!DECIDE_FROM.includes(existing.status as (typeof DECIDE_FROM)[number])) {
      throw new DomainException("INVALID_REFUND_TRANSITION", "Faqat so'ralgan refundni tasdiqlash mumkin.", { from: existing.status });
    }
    // Phase 14 fix: guard the write against a concurrent decision on the same refund
    // (TOCTOU) by only updating rows still in DECIDE_FROM, and checking the affected count.
    const result = await this.prisma.refund.updateMany({
      where: { id, status: { in: [...DECIDE_FROM] } },
      data: { status: "APPROVED", reviewedById: actorId, reviewedAt: new Date() },
    });
    if (result.count === 0) {
      throw new DomainException("INVALID_REFUND_TRANSITION", "Faqat so'ralgan refundni tasdiqlash mumkin.", { from: existing.status });
    }
    await this.audit.record({ actorId, action: "REFUND_APPROVED", entityType: "Refund", entityId: id, before: { status: existing.status }, after: { status: "APPROVED" } });
    return this.findOneOrThrow(id);
  }

  async reject(id: string, actorId: string, reason: string): Promise<RefundAdminResponse> {
    const existing = await this.findRowOrThrow(id);
    if (!DECIDE_FROM.includes(existing.status as (typeof DECIDE_FROM)[number])) {
      throw new DomainException("INVALID_REFUND_TRANSITION", "Faqat so'ralgan refundni rad etish mumkin.", { from: existing.status });
    }
    const result = await this.prisma.refund.updateMany({
      where: { id, status: { in: [...DECIDE_FROM] } },
      data: { status: "REJECTED", reviewedById: actorId, reviewedAt: new Date(), rejectionReason: reason },
    });
    if (result.count === 0) {
      throw new DomainException("INVALID_REFUND_TRANSITION", "Faqat so'ralgan refundni rad etish mumkin.", { from: existing.status });
    }
    await this.audit.record({ actorId, action: "REFUND_REJECTED", entityType: "Refund", entityId: id, before: { status: existing.status }, after: { status: "REJECTED", reason } });
    return this.findOneOrThrow(id);
  }
}
