import { Body, Controller, HttpCode, Inject, Post, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
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
