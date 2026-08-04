import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Payout, PayoutStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CommissionsService } from "../commissions/commissions.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import type { RequestPayoutDto } from "./dto/request-payout.dto";
import type { PayoutQueryDto } from "./dto/payout-query.dto";

const PAYOUT_INCLUDE = {
  creator: { select: { id: true, displayName: true } },
  payoutMethod: { select: { id: true, type: true, cardHolder: true, bankName: true } },
  commissions: { select: { id: true, amountMinor: true, orderId: true } },
} satisfies Prisma.PayoutInclude;

type PayoutWithRelations = Prisma.PayoutGetPayload<{ include: typeof PAYOUT_INCLUDE }>;

export interface PayoutResponse {
  id: string;
  creator: { id: string; displayName: string };
  payoutMethodLabel: string;
  amountMinor: number;
  currency: string;
  status: PayoutStatus;
  requestedAt: Date;
  reviewedAt: Date | null;
  paidAt: Date | null;
  rejectionReason: string | null;
  commissionCount: number;
  createdAt?: Date;
}

// Explicit per-action allowed source-states — same convention as OrdersService/CommissionsService.
const APPROVE_FROM: PayoutStatus[] = ["REQUESTED"];
const REJECT_FROM: PayoutStatus[] = ["REQUESTED", "APPROVED"];
const CANCEL_FROM: PayoutStatus[] = ["REQUESTED"];
const PROCESSING_FROM: PayoutStatus[] = ["APPROVED"];
const PAID_FROM: PayoutStatus[] = ["PROCESSING"];
const FAILED_FROM: PayoutStatus[] = ["PROCESSING"];

@Injectable()
export class PayoutsService {
  private readonly minimumPayoutMinor: number;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private commissions: CommissionsService,
    private audit: AuditService,
  ) {
    this.minimumPayoutMinor = this.config.get<number>("payouts.minimumPayoutMinor")!;
  }

  private toResponse(p: PayoutWithRelations): PayoutResponse {
    const methodLabel =
      p.payoutMethod.type === "CARD" ? `Karta — ${p.payoutMethod.cardHolder ?? ""}` : `${p.payoutMethod.bankName ?? "Bank"} hisobi`;
    return {
      id: p.id,
      creator: p.creator,
      payoutMethodLabel: methodLabel,
      amountMinor: p.amountMinor,
      currency: p.currency,
      status: p.status,
      requestedAt: p.requestedAt,
      reviewedAt: p.reviewedAt,
      paidAt: p.paidAt,
      rejectionReason: p.rejectionReason,
      commissionCount: p.commissions.length,
    };
  }

  private async findRawOrThrow(id: string): Promise<Payout> {
    const p = await this.prisma.payout.findUnique({ where: { id } });
    if (!p) throw new DomainException("PAYOUT_NOT_FOUND", "Payout so'rovi topilmadi.");
    return p;
  }

  private async findFullOrThrow(id: string): Promise<PayoutResponse> {
    const p = await this.prisma.payout.findUnique({ where: { id }, include: PAYOUT_INCLUDE });
    if (!p) throw new DomainException("PAYOUT_NOT_FOUND", "Payout so'rovi topilmadi.");
    return this.toResponse(p);
  }

  private assertTransition(from: PayoutStatus, allowed: PayoutStatus[], to: PayoutStatus): void {
    if (!allowed.includes(from)) {
      throw new DomainException("INVALID_PAYOUT_TRANSITION", "Bu holatlar orasida o'tish mumkin emas.", { from, to });
    }
  }

  // ---- Creator-facing ----

  async requestPayout(creatorId: string, userId: string, dto: RequestPayoutDto): Promise<PayoutResponse> {
    if (dto.amountMinor < this.minimumPayoutMinor) {
      throw new DomainException("BELOW_MINIMUM", "So'ralgan miqdor minimal chegaradan kam.", { minimumPayoutMinor: this.minimumPayoutMinor });
    }
    // Phase Q — the soft enforcement mechanism for the bio-compliance policy (DECISIONS.md
    // ADR-034): a STANDARD-tier creator an admin has manually marked NON_COMPLIANT can't withdraw
    // until either their bio is re-checked as compliant, or they're granted Premium. PENDING
    // (never reviewed) is never blocked — an admin review backlog must never become the creator's
    // problem. This is deliberately not account suspension; every other creator-facing feature
    // stays fully usable.
    const profile = await this.prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId }, select: { bioComplianceStatus: true, tier: true } });
    if (profile.tier === "STANDARD" && profile.bioComplianceStatus === "NON_COMPLIANT") {
      throw new DomainException(
        "BIO_COMPLIANCE_REQUIRED",
        "Pul yechish uchun avval ijtimoiy tarmoq bio'ingizga sofsavdo.com havolasini qo'shing yoki Premium tarifga o'ting.",
      );
    }
    const method = await this.prisma.payoutMethod.findUnique({ where: { id: dto.payoutMethodId } });
    if (!method || method.creatorId !== creatorId) throw new DomainException("PAYOUT_METHOD_NOT_FOUND", "To'lov usuli topilmadi.");
    if (!method.isActive) throw new DomainException("PAYOUT_METHOD_INACTIVE", "Bu to'lov usuli faol emas.");

    // Launch Bonus integration - check for unlocked bonus and include in available balance
    const unlockedBonus = await this.prisma.launchBonus.findUnique({
      where: { creatorProfileId: creatorId, status: "UNLOCKED" },
    });
    const bonusAmountMinor = unlockedBonus?.bonusAmountMinor || 0;

    const payout = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payout.create({
        data: { creatorId, payoutMethodId: dto.payoutMethodId, amountMinor: dto.amountMinor, status: "REQUESTED" },
      });
      // Throws INSUFFICIENT_BALANCE (rolling back the whole transaction, including the Payout
      // row just created) if the creator's available balance can't cover it — see
      // CommissionsService.lockPayableCommissions for the race-safety reasoning.
      // Pass bonus amount to allow using unlocked bonus for payout
      await this.commissions.lockPayableCommissions(tx, creatorId, dto.amountMinor, created.id, bonusAmountMinor);
      
      // If bonus was used, mark it PAID (distinct from EXPIRED — this is the success path, not a
      // missed deadline) so it can never be folded into a second payout.
      if (bonusAmountMinor > 0 && unlockedBonus) {
        await tx.launchBonus.update({
          where: { id: unlockedBonus.id },
          data: { status: "PAID" },
        });
      }
      
      return created;
    });

    await this.audit.record({ actorId: userId, action: "PAYOUT_REQUESTED", entityType: "Payout", entityId: payout.id, after: { amountMinor: dto.amountMinor, bonusIncluded: bonusAmountMinor } });
    return this.findFullOrThrow(payout.id);
  }

  async listMine(creatorId: string, query: PayoutQueryDto): Promise<PaginatedResult<PayoutResponse>> {
    const where: Prisma.PayoutWhereInput = { creatorId, status: query.status };
    const [items, total] = await Promise.all([
      this.prisma.payout.findMany({ where, orderBy: { requestedAt: "desc" }, skip: query.skip, take: query.take, include: PAYOUT_INCLUDE }),
      this.prisma.payout.count({ where }),
    ]);
    return paginate(items.map((p) => this.toResponse(p)), total, query);
  }

  // Phase 14 fix (applies to every transition method below, not just this one): `existing.status`
  // was read and checked in application code, then a separate, unguarded `update()` ran — two
  // concurrent calls (a double-click, a creator racing an admin, two admins) could both pass the
  // check before either write committed. `settleLockedCommissions`/`releaseLockedCommissions` are
  // NOT naturally idempotent against being run twice for the same payout (a second run would
  // create duplicate PAYOUT/ledger side effects) — this is exactly the "no double payout" /
  // "no double wallet credit" invariant the platform requires, so every payout transition now runs
  // its state check as a guarded `updateMany` (WHERE re-asserts the required starting status)
  // inside the same transaction as the commission side effect, aborting on a lost race (count 0)
  // before ever touching CommissionsService.
  async cancel(id: string, creatorId: string, userId: string): Promise<PayoutResponse> {
    const existing = await this.findRawOrThrow(id);
    if (existing.creatorId !== creatorId) throw new DomainException("PAYOUT_NOT_FOUND", "Payout so'rovi topilmadi.");
    this.assertTransition(existing.status, CANCEL_FROM, "CANCELLED");
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.payout.updateMany({ where: { id, status: { in: CANCEL_FROM } }, data: { status: "CANCELLED" } });
      if (result.count === 0) throw new DomainException("INVALID_PAYOUT_TRANSITION", "Bu holatlar orasida o'tish mumkin emas.", { from: existing.status, to: "CANCELLED" });
      await this.commissions.releaseLockedCommissions(tx, id);
    });
    await this.audit.record({ actorId: userId, action: "PAYOUT_CANCELLED", entityType: "Payout", entityId: id });
    return this.findFullOrThrow(id);
  }

  // ---- Admin ----

  async list(query: PayoutQueryDto): Promise<PaginatedResult<PayoutResponse>> {
    const where: Prisma.PayoutWhereInput = {
      status: query.status,
      creatorId: query.creatorId,
      ...(query.dateFrom || query.dateTo
        ? { requestedAt: { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(query.dateTo) : undefined } }
        : {}),
      ...(query.search ? { creator: { displayName: { contains: query.search, mode: "insensitive" } } } : {}),
    };
    const sortableFields = new Set(["requestedAt", "amountMinor", "status"]);
    const orderBy: Prisma.PayoutOrderByWithRelationInput = query.sortBy && sortableFields.has(query.sortBy) ? { [query.sortBy]: query.sortDir ?? "desc" } : { requestedAt: "desc" };

    const [items, total] = await Promise.all([
      this.prisma.payout.findMany({ where, orderBy, skip: query.skip, take: query.take, include: PAYOUT_INCLUDE }),
      this.prisma.payout.count({ where }),
    ]);
    return paginate(items.map((p) => this.toResponse(p)), total, query);
  }

  async findOneOrThrow(id: string): Promise<PayoutResponse> {
    return this.findFullOrThrow(id);
  }

  async approve(id: string, actorId: string): Promise<PayoutResponse> {
    const existing = await this.findRawOrThrow(id);
    this.assertTransition(existing.status, APPROVE_FROM, "APPROVED");
    const result = await this.prisma.payout.updateMany({ where: { id, status: { in: APPROVE_FROM } }, data: { status: "APPROVED", reviewedById: actorId, reviewedAt: new Date() } });
    if (result.count === 0) throw new DomainException("INVALID_PAYOUT_TRANSITION", "Bu holatlar orasida o'tish mumkin emas.", { from: existing.status, to: "APPROVED" });
    await this.audit.record({ actorId, action: "PAYOUT_APPROVED", entityType: "Payout", entityId: id });
    return this.findFullOrThrow(id);
  }

  async reject(id: string, actorId: string, reason: string): Promise<PayoutResponse> {
    const existing = await this.findRawOrThrow(id);
    this.assertTransition(existing.status, REJECT_FROM, "REJECTED");
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.payout.updateMany({ where: { id, status: { in: REJECT_FROM } }, data: { status: "REJECTED", reviewedById: actorId, reviewedAt: new Date(), rejectionReason: reason } });
      if (result.count === 0) throw new DomainException("INVALID_PAYOUT_TRANSITION", "Bu holatlar orasida o'tish mumkin emas.", { from: existing.status, to: "REJECTED" });
      await this.commissions.releaseLockedCommissions(tx, id);
    });
    await this.audit.record({ actorId, action: "PAYOUT_REJECTED", entityType: "Payout", entityId: id, after: { reason } });
    return this.findFullOrThrow(id);
  }

  async markProcessing(id: string, actorId: string): Promise<PayoutResponse> {
    const existing = await this.findRawOrThrow(id);
    this.assertTransition(existing.status, PROCESSING_FROM, "PROCESSING");
    const result = await this.prisma.payout.updateMany({ where: { id, status: { in: PROCESSING_FROM } }, data: { status: "PROCESSING" } });
    if (result.count === 0) throw new DomainException("INVALID_PAYOUT_TRANSITION", "Bu holatlar orasida o'tish mumkin emas.", { from: existing.status, to: "PROCESSING" });
    await this.audit.record({ actorId, action: "PAYOUT_PROCESSING", entityType: "Payout", entityId: id });
    return this.findFullOrThrow(id);
  }

  async markPaid(id: string, actorId: string): Promise<PayoutResponse> {
    const existing = await this.findRawOrThrow(id);
    this.assertTransition(existing.status, PAID_FROM, "PAID");
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.payout.updateMany({ where: { id, status: { in: PAID_FROM } }, data: { status: "PAID", paidAt: new Date() } });
      if (result.count === 0) throw new DomainException("INVALID_PAYOUT_TRANSITION", "Bu holatlar orasida o'tish mumkin emas.", { from: existing.status, to: "PAID" });
      await this.commissions.settleLockedCommissions(tx, id);
    });
    await this.audit.record({ actorId, action: "PAYOUT_PAID", entityType: "Payout", entityId: id });
    return this.findFullOrThrow(id);
  }

  async markFailed(id: string, actorId: string, reason: string): Promise<PayoutResponse> {
    const existing = await this.findRawOrThrow(id);
    this.assertTransition(existing.status, FAILED_FROM, "FAILED");
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.payout.updateMany({ where: { id, status: { in: FAILED_FROM } }, data: { status: "FAILED", rejectionReason: reason } });
      if (result.count === 0) throw new DomainException("INVALID_PAYOUT_TRANSITION", "Bu holatlar orasida o'tish mumkin emas.", { from: existing.status, to: "FAILED" });
      await this.commissions.releaseLockedCommissions(tx, id);
    });
    await this.audit.record({ actorId, action: "PAYOUT_FAILED", entityType: "Payout", entityId: id, after: { reason } });
    return this.findFullOrThrow(id);
  }
}
