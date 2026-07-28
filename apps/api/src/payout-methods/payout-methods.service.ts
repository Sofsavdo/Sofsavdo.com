import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PayoutMethod } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { encryptSecret, decryptSecret, maskCardNumber } from "../common/crypto/encryption.util";
import type { CreatePayoutMethodDto } from "./dto/create-payout-method.dto";

export interface PayoutMethodResponse {
  id: string;
  type: PayoutMethod["type"];
  label: string; // masked card ("•••• 1234 — Full Name") or bank ("BankName — •••1234")
  isDefault: boolean;
}

@Injectable()
export class PayoutMethodsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  private get encryptionKey(): string {
    return this.config.get<string>("payouts.encryptionKey")!;
  }

  // The decrypted card number is used only to compute the mask below — it is never returned as-is
  // from any method on this service.
  private toResponse(m: PayoutMethod): PayoutMethodResponse {
    if (m.type === "CARD") {
      const digits = m.cardNumberEnc ? decryptSecret(m.cardNumberEnc, this.encryptionKey) : "";
      return { id: m.id, type: m.type, label: `${maskCardNumber(digits)} — ${m.cardHolder ?? ""}`, isDefault: m.isDefault };
    }
    return { id: m.id, type: m.type, label: `${m.bankName ?? ""} — ${maskCardNumber(m.bankAccount ?? "")}`, isDefault: m.isDefault };
  }

  async listMine(creatorId: string): Promise<PayoutMethodResponse[]> {
    const methods = await this.prisma.payoutMethod.findMany({ where: { creatorId, isActive: true }, orderBy: { createdAt: "asc" } });
    return methods.map((m) => this.toResponse(m));
  }

  async create(creatorId: string, userId: string, dto: CreatePayoutMethodDto): Promise<PayoutMethodResponse> {
    const existingCount = await this.prisma.payoutMethod.count({ where: { creatorId, isActive: true } });
    const created = await this.prisma.payoutMethod.create({
      data: {
        creatorId,
        type: dto.type,
        cardNumberEnc: dto.type === "CARD" ? encryptSecret(dto.cardNumber!, this.encryptionKey) : null,
        cardHolder: dto.type === "CARD" ? dto.cardHolder : null,
        bankName: dto.type === "BANK_ACCOUNT" ? dto.bankName : null,
        bankAccount: dto.type === "BANK_ACCOUNT" ? dto.bankAccount : null,
        isDefault: existingCount === 0,
      },
    });
    await this.audit.record({ actorId: userId, action: "PAYOUT_METHOD_ADDED", entityType: "PayoutMethod", entityId: created.id, after: { type: dto.type } });
    return this.toResponse(created);
  }

  private async findOwnedOrThrow(id: string, creatorId: string): Promise<PayoutMethod> {
    const m = await this.prisma.payoutMethod.findUnique({ where: { id } });
    if (!m || m.creatorId !== creatorId || !m.isActive) throw new DomainException("PAYOUT_METHOD_NOT_FOUND", "To'lov usuli topilmadi.");
    return m;
  }

  async setDefault(id: string, creatorId: string, userId: string): Promise<PayoutMethodResponse> {
    await this.findOwnedOrThrow(id, creatorId);
    await this.prisma.$transaction([
      this.prisma.payoutMethod.updateMany({ where: { creatorId, isDefault: true }, data: { isDefault: false } }),
      this.prisma.payoutMethod.update({ where: { id }, data: { isDefault: true } }),
    ]);
    await this.audit.record({ actorId: userId, action: "PAYOUT_METHOD_SET_DEFAULT", entityType: "PayoutMethod", entityId: id });
    const updated = await this.prisma.payoutMethod.findUniqueOrThrow({ where: { id } });
    return this.toResponse(updated);
  }

  // Soft-delete only — historical Payout rows reference this by a required FK (see schema
  // comment), so a real DELETE would either cascade-destroy payout history or fail the FK.
  async deactivate(id: string, creatorId: string, userId: string): Promise<void> {
    const method = await this.findOwnedOrThrow(id, creatorId);
    await this.prisma.payoutMethod.update({ where: { id }, data: { isActive: false, isDefault: false } });
    if (method.isDefault) {
      const next = await this.prisma.payoutMethod.findFirst({ where: { creatorId, isActive: true }, orderBy: { createdAt: "asc" } });
      if (next) await this.prisma.payoutMethod.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    await this.audit.record({ actorId: userId, action: "PAYOUT_METHOD_REMOVED", entityType: "PayoutMethod", entityId: id });
  }
}
