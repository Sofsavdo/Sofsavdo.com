import { Controller, Get, Param, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { FlowsService } from "./flows.service";
import { FidemIntegrationService } from "../fidem-integration/fidem-integration.service";
import { IzdoshIntegrationService } from "../izdosh-integration/izdosh-integration.service";
import { Public } from "../common/decorators/public.decorator";
import type { Response } from "express";

@ApiTags("referral")
@Controller("r")
export class ReferralController {
  constructor(
    private readonly flowsService: FlowsService,
    private readonly config: ConfigService,
    private readonly fidem: FidemIntegrationService,
    private readonly izdosh: IzdoshIntegrationService,
  ) {}

  @Public()
  @Get(":code")
  @ApiOperation({ summary: "Handle referral link and redirect to the product's live offer page (or a partner platform for an external-redirect product)" })
  @ApiResponse({ status: 302, description: "Redirect to product offer page, or a partner platform" })
  @ApiResponse({ status: 404, description: "Referral code not found" })
  async handleReferral(@Param("code") code: string, @Res() res: Response) {
    const frontendUrl = this.config.get<string>("FRONTEND_URL") ?? "https://sofsavdo.com";
    try {
      const flow = await this.flowsService.getFlowByReferralCode(code);

      // Partner-platform product (e.g. Fidem, Izdosh) — never sold through Sofsavdo's own
      // checkout. A signed click token binds this click to the Flow so the partner's later
      // conversion webhook can attribute a commission back to the right creator. Which partner's
      // signer and redirect query-param shape to use depends on externalPartner: Fidem is a
      // Telegram bot and expects `?start=` (a Telegram deep-link start param); Izdosh is a normal
      // website and takes `?ref=`.
      if (flow.product.externalRedirectUrl) {
        const separator = flow.product.externalRedirectUrl.includes("?") ? "&" : "?";
        if (flow.product.externalPartner === "IZDOSH") {
          const clickToken = this.izdosh.signClickToken(flow.id);
          return res.redirect(302, `${flow.product.externalRedirectUrl}${separator}ref=${clickToken}`);
        }
        const clickToken = this.fidem.signClickToken(flow.id);
        return res.redirect(302, `${flow.product.externalRedirectUrl}${separator}start=${clickToken}`);
      }

      const offer = flow.product.offers[0];
      if (!offer) {
        // Product has no live offer to sell through yet — nothing to redirect a buyer to.
        return res.redirect(302, frontendUrl);
      }

      res.cookie("referral_code", code, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: "lax",
      });

      res.cookie("flow_id", flow.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: "lax",
      });

      return res.redirect(302, `${frontendUrl}/o/${offer.slug}?ref=${code}`);
    } catch {
      // Referral code not found/inactive — fall back to homepage rather than a broken page.
      return res.redirect(302, frontendUrl);
    }
  }
}
