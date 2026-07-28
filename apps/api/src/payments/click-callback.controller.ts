import { Body, Controller, HttpCode, Inject, Post, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import { PaymentsService } from "./payments.service";
import { PAYMENT_PORT, type PaymentPort } from "./payment.port";
import { Public } from "../common/decorators/public.decorator";
import { DomainException } from "../common/errors/domain-error";

// Click's own servers call these two endpoints directly (Prepare then Complete) — no browser, no
// bearer token, and Click does not understand this API's normal JSON error envelope. Every path,
// success or failure, must reply with Click's own {click_trans_id, merchant_trans_id, error,
// error_note, ...} shape and HTTP 200, or Click will treat the callback as undelivered and retry
// indefinitely. @ApiExcludeController — this is not a browsable/Swagger-documented endpoint.
//
// @SkipThrottle() — confirmed necessary the same way HealthController's was (Phase 14 §13's load
// test): without it, this controller silently inherits the global 120-req/60s-per-IP default like
// every other route. Click's callback traffic can plausibly come from a small set of shared
// infrastructure IPs serving many merchants at once, so that default could legitimately drop a
// real "payment succeeded" confirmation under load — a severe financial-integrity gap, not a
// theoretical one. Skipping the rate limit here doesn't open a real abuse vector: every request
// is cheaply rejected up front unless its MD5 signature is valid (requires knowledge of
// CLICK_SECRET_KEY), so the actual security boundary is the signature check, not request rate.
@SkipThrottle()
@ApiExcludeController()
@Controller("payments/click")
export class ClickCallbackController {
  constructor(
    private payments: PaymentsService,
    @Inject(PAYMENT_PORT) private paymentPort: PaymentPort,
  ) {}

  private async handle(action: "PREPARE" | "COMPLETE", body: Record<string, unknown>, res: Response): Promise<void> {
    try {
      const { verified } = await this.payments.handleClickCallback(body);
      const reply = this.paymentPort.buildCallbackReply(action, body, { ok: true, internalId: verified.paymentId });
      res.status(reply.httpStatus).json(reply.body);
    } catch (err) {
      const code = err instanceof DomainException ? err.code : "VALIDATION_ERROR";
      const message = err instanceof DomainException ? err.message : "Ichki xatolik.";
      const errorCode = code === "INVALID_PAYMENT_SIGNATURE" ? -1 : code === "PAYMENT_NOT_FOUND" ? -5 : code === "INVALID_PAYMENT_AMOUNT" ? -2 : -8;
      const reply = this.paymentPort.buildCallbackReply(action, body, { ok: false, errorCode, errorNote: message });
      res.status(reply.httpStatus).json(reply.body);
    }
  }

  @Public()
  @Post("prepare")
  @HttpCode(200)
  async prepare(@Body() body: Record<string, unknown>, @Res() res: Response): Promise<void> {
    await this.handle("PREPARE", body, res);
  }

  @Public()
  @Post("complete")
  @HttpCode(200)
  async complete(@Body() body: Record<string, unknown>, @Res() res: Response): Promise<void> {
    await this.handle("COMPLETE", body, res);
  }
}
