import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { IzdoshIntegrationService } from "./izdosh-integration.service";
import { IzdoshWebhookDto } from "./dto/izdosh-webhook.dto";
import { Public } from "../common/decorators/public.decorator";

// Izdosh's backend (a separate Railway service/repo) calls this directly — no browser, no bearer
// token. Authenticated entirely by the signed payload (see izdosh-click-token.util.ts), the same
// "signature is the security boundary, not request rate" reasoning as FidemIntegrationController.
@SkipThrottle()
@ApiExcludeController()
@Controller("integrations/izdosh")
export class IzdoshIntegrationController {
  constructor(private izdosh: IzdoshIntegrationService) {}

  @Public()
  @Post("webhook")
  @HttpCode(200)
  async webhook(@Body() dto: IzdoshWebhookDto): Promise<{ status: "created" | "duplicate" }> {
    return this.izdosh.recordConversion(dto);
  }
}
