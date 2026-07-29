import { Injectable } from "@nestjs/common";
import type { BuyerAddress } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import type { CreateBuyerAddressDto } from "./dto/create-buyer-address.dto";
import type { UpdateBuyerAddressDto } from "./dto/update-buyer-address.dto";

// Deliberately separate from the checkout-time `Address` model (see schema comment on
// BuyerAddress) — this is saved convenience data for pre-filling checkout faster next time, never
// itself referenced by an Order. Editing or deleting a saved address can never retroactively
// change what a past order shipped to.
@Injectable()
export class BuyerAddressesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string): Promise<BuyerAddress[]> {
    return this.prisma.buyerAddress.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  }

  private async findOwnedOrThrow(id: string, userId: string): Promise<BuyerAddress> {
    const address = await this.prisma.buyerAddress.findUnique({ where: { id } });
    if (!address || address.userId !== userId) throw new DomainException("NOT_FOUND", "Manzil topilmadi.");
    return address;
  }

  async create(userId: string, dto: CreateBuyerAddressDto): Promise<BuyerAddress> {
    const existingCount = await this.prisma.buyerAddress.count({ where: { userId } });
    return this.prisma.buyerAddress.create({
      data: { userId, ...dto, isDefault: existingCount === 0 },
    });
  }

  async update(id: string, userId: string, dto: UpdateBuyerAddressDto): Promise<BuyerAddress> {
    await this.findOwnedOrThrow(id, userId);
    return this.prisma.buyerAddress.update({ where: { id }, data: dto });
  }

  async setDefault(id: string, userId: string): Promise<BuyerAddress> {
    await this.findOwnedOrThrow(id, userId);
    await this.prisma.$transaction([
      this.prisma.buyerAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
      this.prisma.buyerAddress.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.prisma.buyerAddress.findUniqueOrThrow({ where: { id } });
  }

  async remove(id: string, userId: string): Promise<void> {
    const address = await this.findOwnedOrThrow(id, userId);
    await this.prisma.buyerAddress.delete({ where: { id } });
    if (address.isDefault) {
      const next = await this.prisma.buyerAddress.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
      if (next) await this.prisma.buyerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
}
