import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Commission, CommissionStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import type { CommissionQueryDto } from "./dto/commission-query.dto";

const COMMISSION_INCLUDE = {
  order: { select: { id: true, publicToken: true } },
  creator: { select: { id: true, displayName: true } },
  commissionRule: { select: { id: true, commissionType: true, campaign: { select: { id: true, name: true } } } },
  ledgerEntries: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.CommissionInclude;

type CommissionWithRelations = Prisma.CommissionGetPayload<{ include: typeof COMMISSION_INCLUDE }>;

export interface AdminCommissionResponse {
  id: string;
  orderId: string;
  orderPublicToken: string;
  creator: { id: string; displayName: string };
  campaign: { id: string; name: string };
  commissionType: string;
  baseAmountMinor: number;
  amountMinor: number;
  currency: string;
  status: CommissionStatus;
  approvedAt: Date | null;
  payableAt: Date | null;
  paidAt: Date | null;
  payoutId: string | null;
  ledger: { id: string; type: string; amountMinor: number; reason: string | null; createdAt: Date }[];
  createdAt: Date;
}

export interface WalletBalance {
  pendingMinor: number;
  availableMinor: number;
  lockedMinor: number;
  paidMinor: number;
  reversedMinor: number;
  currency: string;
  minimumPayoutMinor: number;
}

// Explicit per-action allowed source-states — same convention as OrdersService/ContentService.
// PENDING is the state OrdersService.createOrder leaves a freshly-snapshotted Commission in
// (Phase 8 — untouched by this phase); everything from APPROVED onward is this domain's own.
const APPROVE_FROM: CommissionStatus[] = ["PENDING"];
const REJECT_FROM: CommissionStatus[] = ["PENDING", "APPROVED"];
const MARK_PAYABLE_FROM: CommissionStatus[] = ["APPROVED"];

@Injectable()
export class CommissionsService {
  private readonly minimumPayoutMinor: number;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
  ) {
    this.minimumPayoutMinor = this.config.get<number>("payouts.minimumPayoutMinor")!;
  }

  private toAdminResponse(c: CommissionWithRelations): AdminCommissionResponse {
    return {
      id: c.id,
      orderId: c.order.id,
      orderPublicToken: c.order.publicToken,
      creator: c.creator,
      campaign: c.commissionRule.campaign,
      commissionType: c.commissionRule.commissionType,
      baseAmountMinor: c.baseAmountMinor,
      amountMinor: c.amountMinor,
      currency: c.currency,
      status: c.status,
      approvedAt: c.approvedAt,
      payableAt: c.payableAt,
      paidAt: c.paidAt,
      payoutId: c.payoutId,
      ledger: c.ledgerEntries.map((l) => ({ id: l.id, type: l.type, amountMinor: l.amountMinor, reason: l.reason, createdAt: l.createdAt })),
      createdAt: c.createdAt,
    };
  }

  // ---- Refund reconciliation (lazy sweep, mirrors ContentService.expireStaleContent's
  // "materialize on next read/mutate touch" convention) — deliberately NOT a hook called from
  // OrdersService.createRefund: Phase 8's files are locked for this phase (see DECISIONS.md
  // ADR-016), and this codebase already has an established pattern for reacting to another
  // domain's state changes without that domain calling into this one. Only unlocked commissions
  // (payoutId null) are auto-reversed — one already bundled into an in-flight Payout is a rare
  // edge case left for manual admin handling rather than adding payout-total-adjustment logic this
  // phase doesn't otherwise need. ----
  private async reconcileRefundedOrders(where: Prisma.CommissionWhereInput = {}): Promise<void> {
    const stale = await this.prisma.commission.findMany({
      where: { ...where, status: { notIn: ["REFUNDED", "PAID"] }, payoutId: null, order: { status: "REFUNDED" } },
      select: { id: true, status: true, amountMinor: true },
    });
    if (stale.length === 0) return;
    for (const c of stale) {
      await this.prisma.$transaction(async (tx) => {
        // Only APPROVED/PAYABLE ever had an ACCRUAL entry written (see approve()) — a still-PENDING
        // commission has nothing to reverse in the ledger, just the status flip.
        if (c.status === "APPROVED" || c.status === "PAYABLE") {
          await tx.commissionLedger.create({
            data: { commissionId: c.id, type: "REVERSAL", amountMinor: -c.amountMinor, reason: "Order refunded" },
          });
        }
        await tx.commission.update({ where: { id: c.id }, data: { status: "REFUNDED" } });
      });
      await this.audit.record({ actorId: null, action: "COMMISSION_REVERSED", entityType: "Commission", entityId: c.id, after: { status: "REFUNDED", reason: "Order refunded" } });
    }
  }

  // ---- Admin settlement ----

  async list(query: CommissionQueryDto): Promise<PaginatedResult<AdminCommissionResponse>> {
    await this.reconcileRefundedOrders(query.creatorId ? { creatorId: query.creatorId } : {});
    const where: Prisma.CommissionWhereInput = {
      status: query.status,
      creatorId: query.creatorId,
      commissionRule: query.campaignId ? { campaignId: query.campaignId } : undefined,
      ...(query.dateFrom || query.dateTo
        ? { createdAt: { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(query.dateTo) : undefined } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { creator: { displayName: { contains: query.search, mode: "insensitive" } } },
              { commissionRule: { campaign: { name: { contains: query.search, mode: "insensitive" } } } },
              { order: { publicToken: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const sortableFields = new Set(["createdAt", "amountMinor", "status"]);
    const orderBy: Prisma.CommissionOrderByWithRelationInput = query.sortBy && sortableFields.has(query.sortBy) ? { [query.sortBy]: query.sortDir ?? "desc" } : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      this.prisma.commission.findMany({ where, orderBy, skip: query.skip, take: query.take, include: COMMISSION_INCLUDE }),
      this.prisma.commission.count({ where }),
    ]);
    return paginate(items.map((c) => this.toAdminResponse(c)), total, query);
  }

  async findOneOrThrow(id: string): Promise<AdminCommissionResponse> {
    await this.reconcileRefundedOrders({ id });
    const c = await this.prisma.commission.findUnique({ where: { id }, include: COMMISSION_INCLUDE });
    if (!c) throw new DomainException("COMMISSION_NOT_FOUND", "Komissiya topilmadi.");
    return this.toAdminResponse(c);
  }

  private async findRawOrThrow(id: string): Promise<Commission> {
    const c = await this.prisma.commission.findUnique({ where: { id } });
    if (!c) throw new DomainException("COMMISSION_NOT_FOUND", "Komissiya topilmadi.");
    return c;
  }

  // PENDING -> APPROVED. Writes the ACCRUAL ledger entry — the moment a commission is confirmed
  // as genuinely earned (not merely tentatively snapshotted at checkout), matching
  // CommissionLedger's own "append-only source of truth" design.
  // Phase 14 fix: `existing.status` was read, checked in application code, and THEN a plain
  // (unguarded) `update()` ran as a separate step — two concurrent `approve()` calls (a double-
  // click, or two admins acting on the same commission at once) could both pass the check before
  // either write landed, both proceed, and both insert an ACCRUAL ledger entry, double-counting
  // the creator's earning. The fix is the same one `CommissionsService.lockPayableCommissions`
  // already uses for payout fund-locking: the transition itself is an `updateMany` whose WHERE
  // clause re-asserts the required starting status, and a `count === 0` result means we lost the
  // race — abort before writing any ledger entry, rather than assuming the read was still true.
  async approve(id: string, actorId: string): Promise<AdminCommissionResponse> {
    const existing = await this.findRawOrThrow(id);
    if (!APPROVE_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_COMMISSION_TRANSITION", "Faqat kutilayotgan komissiyani tasdiqlash mumkin.", { from: existing.status });
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.commission.updateMany({ where: { id, status: { in: APPROVE_FROM } }, data: { status: "APPROVED", approvedAt: now } });
      if (result.count === 0) {
        throw new DomainException("INVALID_COMMISSION_TRANSITION", "Faqat kutilayotgan komissiyani tasdiqlash mumkin.", { from: existing.status });
      }
      await tx.commissionLedger.create({ data: { commissionId: id, type: "ACCRUAL", amountMinor: existing.amountMinor } });
    });
    await this.audit.record({ actorId, action: "COMMISSION_APPROVED", entityType: "Commission", entityId: id, after: { status: "APPROVED" } });
    return this.findOneOrThrow(id);
  }

  // PENDING|APPROVED -> REJECTED. An APPROVED commission already has an ACCRUAL entry — rejecting
  // it now requires a REVERSAL to cancel that out; a still-PENDING one never accrued anything.
  // Same race-safety fix as approve() above — a guarded `updateMany` inside the transaction, not a
  // plain `update()` after an earlier, separately-read status check.
  async reject(id: string, actorId: string, reason: string): Promise<AdminCommissionResponse> {
    const existing = await this.findRawOrThrow(id);
    if (!REJECT_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_COMMISSION_TRANSITION", "Bu holatdagi komissiyani rad etib bo'lmaydi.", { from: existing.status });
    }
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.commission.updateMany({ where: { id, status: { in: REJECT_FROM } }, data: { status: "REJECTED" } });
      if (result.count === 0) {
        throw new DomainException("INVALID_COMMISSION_TRANSITION", "Bu holatdagi komissiyani rad etib bo'lmaydi.", { from: existing.status });
      }
      if (existing.status === "APPROVED") {
        await tx.commissionLedger.create({ data: { commissionId: id, type: "REVERSAL", amountMinor: -existing.amountMinor, reason } });
      }
    });
    await this.audit.record({ actorId, action: "COMMISSION_REJECTED", entityType: "Commission", entityId: id, after: { reason } });
    return this.findOneOrThrow(id);
  }

  // APPROVED -> PAYABLE. No new ledger entry — the ACCRUAL already recorded the earning at
  // approve() time; PAYABLE only marks "the holding period is over, this is now withdrawable."
  // Guarded updateMany for the same reason as approve()/reject() — no ledger write here to
  // double, but a lost race would otherwise silently no-op an admin's action without telling them.
  async markPayable(id: string, actorId: string): Promise<AdminCommissionResponse> {
    const existing = await this.findRawOrThrow(id);
    if (!MARK_PAYABLE_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_COMMISSION_TRANSITION", "Faqat tasdiqlangan komissiyani to'lovga tayyor deb belgilash mumkin.", { from: existing.status });
    }
    const result = await this.prisma.commission.updateMany({ where: { id, status: { in: MARK_PAYABLE_FROM } }, data: { status: "PAYABLE", payableAt: new Date() } });
    if (result.count === 0) {
      throw new DomainException("INVALID_COMMISSION_TRANSITION", "Faqat tasdiqlangan komissiyani to'lovga tayyor deb belgilash mumkin.", { from: existing.status });
    }
    await this.audit.record({ actorId, action: "COMMISSION_MARKED_PAYABLE", entityType: "Commission", entityId: id, after: { status: "PAYABLE" } });
    return this.findOneOrThrow(id);
  }

  // ---- Creator-facing ----

  async getWalletBalance(creatorId: string): Promise<WalletBalance> {
    await this.reconcileRefundedOrders({ creatorId });

    const grouped = await this.prisma.commission.groupBy({ by: ["status"], where: { creatorId }, _sum: { amountMinor: true } });
    const sum = (status: CommissionStatus) => grouped.find((g) => g.status === status)?._sum.amountMinor ?? 0;

    const lockedAgg = await this.prisma.commission.aggregate({
      where: { creatorId, payoutId: { not: null }, payout: { status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] } } },
      _sum: { amountMinor: true },
    });
    const availableAgg = await this.prisma.commission.aggregate({
      where: { creatorId, status: "PAYABLE", payoutId: null },
      _sum: { amountMinor: true },
    });

    return {
      pendingMinor: sum("PENDING") + sum("APPROVED"),
      availableMinor: availableAgg._sum.amountMinor ?? 0,
      lockedMinor: lockedAgg._sum.amountMinor ?? 0,
      paidMinor: sum("PAID"),
      reversedMinor: sum("REJECTED") + sum("REFUNDED"),
      currency: "UZS",
      minimumPayoutMinor: this.minimumPayoutMinor,
    };
  }

  async listMyLedger(creatorId: string, query: CommissionQueryDto): Promise<PaginatedResult<{ id: string; type: string; amountMinor: number; reason: string | null; createdAt: Date; commission: { id: string; orderPublicToken: string } }>> {
    await this.reconcileRefundedOrders({ creatorId });
    const where: Prisma.CommissionLedgerWhereInput = { commission: { creatorId } };
    const [items, total] = await Promise.all([
      this.prisma.commissionLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
        include: { commission: { select: { id: true, order: { select: { publicToken: true } } } } },
      }),
      this.prisma.commissionLedger.count({ where }),
    ]);
    return paginate(
      items.map((l) => ({ id: l.id, type: l.type, amountMinor: l.amountMinor, reason: l.reason, createdAt: l.createdAt, commission: { id: l.commission.id, orderPublicToken: l.commission.order.publicToken } })),
      total,
      query,
    );
  }

  // ---- Used by PayoutsService (kept as internal, tx-scoped helpers — Commission-row mutations
  // stay owned by this service, mirroring OrdersService owning every Order-row mutation) ----

  // Locks up to amountMinor of this creator's unlocked PAYABLE commissions (oldest first) into a
  // new Payout by setting payoutId. Throws INSUFFICIENT_BALANCE if the creator's currently
  // available balance can't cover it — re-checked inside the caller's transaction so a race
  // between two concurrent payout requests can't both succeed against the same funds.
  async lockPayableCommissions(tx: Prisma.TransactionClient, creatorId: string, amountMinor: number, payoutId: string): Promise<void> {
    const candidates = await tx.commission.findMany({
      where: { creatorId, status: "PAYABLE", payoutId: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, amountMinor: true },
    });
    const selected: string[] = [];
    let accumulated = 0;
    for (const c of candidates) {
      if (accumulated >= amountMinor) break;
      selected.push(c.id);
      accumulated += c.amountMinor;
    }
    if (accumulated < amountMinor) {
      throw new DomainException("INSUFFICIENT_BALANCE", "So'ralgan miqdor mavjud balansdan oshib ketdi.");
    }
    // `payoutId: null` in the update's own WHERE (not just the earlier read) is what actually
    // makes this race-safe: if a concurrent request locked one of these rows first and committed
    // between our read and this write, Postgres's row lock makes this UPDATE wait for it, then
    // re-evaluates the WHERE against the now-committed data — the row simply won't match anymore.
    // A mismatched count means we lost that race, so we abort rather than silently lock fewer
    // commissions than the caller thinks it reserved.
    const result = await tx.commission.updateMany({ where: { id: { in: selected }, payoutId: null }, data: { payoutId } });
    if (result.count !== selected.length) {
      throw new DomainException("INSUFFICIENT_BALANCE", "Balans o'zgardi, iltimos qayta urinib ko'ring.");
    }
  }

  // Payout reached PAID — settle every commission it locked: PAID status + a PAYOUT ledger entry
  // each (append-only, mirrors ACCRUAL/REVERSAL).
  async settleLockedCommissions(tx: Prisma.TransactionClient, payoutId: string): Promise<void> {
    const locked = await tx.commission.findMany({ where: { payoutId }, select: { id: true, amountMinor: true } });
    const now = new Date();
    for (const c of locked) {
      await tx.commission.update({ where: { id: c.id }, data: { status: "PAID", paidAt: now } });
      await tx.commissionLedger.create({ data: { commissionId: c.id, type: "PAYOUT", amountMinor: -c.amountMinor, reason: `Payout ${payoutId}` } });
    }
  }

  // Payout was rejected/cancelled/permanently failed — release its locked commissions back to
  // PAYABLE (available again), no ledger entry (nothing was ever paid out).
  async releaseLockedCommissions(tx: Prisma.TransactionClient, payoutId: string): Promise<void> {
    await tx.commission.updateMany({ where: { payoutId }, data: { payoutId: null } });
  }
}
