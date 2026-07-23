import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DeliveryService } from "./delivery.service";
import { QuoteDto } from "./dto/quote.dto";
import { Public } from "../common/decorators/public.decorator";

// Read-only price authority for the public Landing page — never creates an Order (see
// DECISIONS.md ADR-013). Same public/no-auth pattern as PublicLandingController.
@ApiTags("public")
@Controller("offers")
export class PublicQuoteController {
  constructor(private delivery: DeliveryService) {}

  @Public()
  @Post(":slug/quote")
  quote(@Param("slug") slug: string, @Body() dto: QuoteDto) {
    return this.delivery.quote(slug, dto.regionCode);
  }
}
