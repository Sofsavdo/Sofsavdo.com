import { Inject, Injectable } from "@nestjs/common";
import { DomainException } from "../common/errors/domain-error";
import { PRODUCT_AI_PORT, type ProductAiDraft, type ProductAiPort } from "./product-ai.port";
import type { GenerateProductDraftDto } from "./dto/generate-product-draft.dto";

@Injectable()
export class ProductAiService {
  constructor(@Inject(PRODUCT_AI_PORT) private aiPort: ProductAiPort) {}

  async generateDraft(dto: GenerateProductDraftDto): Promise<ProductAiDraft> {
    if (!dto.imageUrls?.length && !dto.shortDescription) {
      throw new DomainException("VALIDATION_ERROR", "imageUrls yoki shortDescription'dan kamida bittasi berilishi kerak.");
    }
    return this.aiPort.generateDraft({
      imageUrls: dto.imageUrls ?? [],
      productName: dto.productName,
      shortDescription: dto.shortDescription,
    });
  }
}
