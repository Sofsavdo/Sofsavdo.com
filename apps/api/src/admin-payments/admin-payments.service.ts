import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import type { PaymentQueryDto } from "./dto/payment-query.dto";

const PAYMENT_SELECT = {
  id: true,
  provider: true,
  status: true,
  amountMinor: true,
  currency: true,
  providerReference: true,
  webhookPayloads: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      publicToken: true,
      offer: { select: { name: true } },
      customer: { select: { fullName: true, phone: true } },
    },
  },
} satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>;

export interface PaymentAdminResponse {
  id: string;
  provider: string;
  status: string;
  amountMinor: number;
  currency: string;
  providerReference: string | null;
  createdAt: Date;
  updatedAt: Date;
  order: { id: string; publicToken: string; offerName: string; customerName: string; customerPhone: string };
}

export interface PaymentTimelineEntry {
  label: string;
  at: Date;
  detail?: unknown;
}

// Platform-wide payment visibility (Phase 12) — read-only, per this phase's own spec ("Read-only
// unless existing payment workflow already supports mutation" — it doesn't; Payment is a frozen
// Phase 8 domain, see ADR-015). No schema change to Payment: the "timeline"/"status history"
// features reuse the two fields Payment already has for exactly this (`webhookPayloads`, the raw
// provider callback history captured at receipt time, and `createdAt`/`updatedAt`) rather than
// inventing a new PaymentStatusHistory table the way Order already has one — see DECISIONS.md
// ADR-019.
@Injectable()
export class AdminPaymentsService {
  constructor(private prisma: PrismaService) {}

  private toResponse(p: PaymentRow): PaymentAdminResponse {
    return {
      id: p.id,
      provider: p.provider,
      status: p.status,
      amountMinor: p.amountMinor,
      currency: p.currency,
      providerReference: p.providerReference,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      order: { id: p.order.id, publicToken: p.order.publicToken, offerName: p.order.offer.name, customerName: p.order.customer.fullName, customerPhone: p.order.customer.phone },
    };
  }

  async list(query: PaymentQueryDto): Promise<PaginatedResult<PaymentAdminResponse>> {
    const where: Prisma.PaymentWhereInput = {
      status: query.status,
      provider: query.provider,
      ...(query.search
        ? { OR: [{ order: { publicToken: { contains: query.search, mode: "insensitive" } } }, { order: { customer: { fullName: { contains: query.search, mode: "insensitive" } } } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({ where, select: PAYMENT_SELECT, orderBy: { createdAt: "desc" }, skip: query.skip, take: query.take }),
      this.prisma.payment.count({ where }),
    ]);
    return paginate(items.map((p) => this.toResponse(p)), total, query);
  }

  private async findRowOrThrow(id: string): Promise<PaymentRow> {
    const row = await this.prisma.payment.findUnique({ where: { id }, select: PAYMENT_SELECT });
    if (!row) throw new DomainException("PAYMENT_NOT_FOUND", "To'lov topilmadi.");
    return row;
  }

  async findOneOrThrow(id: string): Promise<PaymentAdminResponse> {
    return this.toResponse(await this.findRowOrThrow(id));
  }

  // Synthesized, not stored — Payment has no per-transition history table (unlike Order's
  // OrderStatusHistory). `createdAt` is always the PENDING moment (see PaymentsService.create);
  // `updatedAt` only ever changes on the one status flip a real payment makes (see
  // ClickCallbackController), so a two-point timeline plus the raw webhook payloads it received is
  // an honest, non-fabricated view of "what happened and when" without inventing data this domain
  // was never designed to record precisely.
  async getTimeline(id: string): Promise<PaymentTimelineEntry[]> {
    const row = await this.findRowOrThrow(id);
    const entries: PaymentTimelineEntry[] = [{ label: "PENDING", at: row.createdAt }];
    if (row.status !== "PENDING") {
      entries.push({ label: row.status, at: row.updatedAt });
    }
    for (const [i, payload] of row.webhookPayloads.entries()) {
      entries.push({ label: `Provider callback #${i + 1}`, at: row.updatedAt, detail: payload });
    }
    return entries;
  }
}
