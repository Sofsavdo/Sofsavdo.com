import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { FidemIntegrationService } from "./fidem-integration.service";
import { FidemWebhookDto } from "./dto/fidem-webhook.dto";
import { Public } from "../common/decorators/public.decorator";

// Fidem's backend (a separate Railway service/repo) calls this directly — no browser, no bearer
// token. Authenticated entirely by the signed payload (see fidem-click-token.util.ts), the same
// "signature is the security boundary, not request rate" reasoning as ClickCallbackController.
@SkipThrottle()
@ApiExcludeController()
@Controller("integrations/fidem")
export class FidemIntegrationController {
  constructor(private fidem: FidemIntegrationService) {}

  @Public()
  @Post("webhook")
  @HttpCode(200)
  async webhook(@Body() dto: FidemWebhookDto): Promise<{ status: "created" | "duplicate" }> {
    return this.fidem.recordConversion(dto);
  }
}
