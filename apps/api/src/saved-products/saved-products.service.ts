import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";

export interface SavedProductResponse {
  offerId: string;
  offer: { id: string; slug: string; name: string; priceMinor: number; currency: string; imageUrl: string | null };
  createdAt: Date;
}

@Injectable()
export class SavedProductsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string): Promise<SavedProductResponse[]> {
    const saved = await this.prisma.savedProduct.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { offer: { include: { product: { select: { images: true } } } } },
    });
    return saved.map((s) => ({
      offerId: s.offerId,
      offer: {
        id: s.offer.id,
        slug: s.offer.slug,
        name: s.offer.name,
        priceMinor: s.offer.priceMinor,
        currency: s.offer.currency,
        imageUrl: s.offer.product.images[0] ?? null,
      },
      createdAt: s.createdAt,
    }));
  }

  // Idempotent — saving an already-saved product is a no-op success, not an error (matches the
  // toggle-a-heart-icon UX this backs; the client doesn't need to know or care whether this is the
  // first save or the fifth).
  async save(userId: string, offerId: string): Promise<void> {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId }, select: { id: true } });
    if (!offer) throw new DomainException("NOT_FOUND", "Offer topilmadi.");
    await this.prisma.savedProduct.upsert({
      where: { userId_offerId: { userId, offerId } },
      create: { userId, offerId },
      update: {},
    });
  }

  // Idempotent — removing an already-unsaved product is also a no-op success.
  async unsave(userId: string, offerId: string): Promise<void> {
    await this.prisma.savedProduct.deleteMany({ where: { userId, offerId } });
  }
}
