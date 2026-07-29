import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ProductAiService } from "./product-ai.service";
import { GenerateProductDraftDto } from "./dto/generate-product-draft.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

// Reuses product.write rather than a new permission key — this is a sub-capability of product
// creation (same pattern as Campaign media reusing campaign.write), not an independent domain.
// Callable from any principal-scoped controller per the architecture review's "unified product
// creation" goal — there is only ever this one caller today (the admin Product Launch Wizard), but
// nothing here is admin-specific.
@ApiTags("admin/product-ai")
@ApiBearerAuth("bearer")
@Controller("admin/product-ai")
export class ProductAiController {
  constructor(private productAi: ProductAiService) {}

  @RequirePermissions("product.write")
  @Post("draft")
  generateDraft(@Body() dto: GenerateProductDraftDto) {
    return this.productAi.generateDraft(dto);
  }
}
