import { Controller, Get, Param, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { FlowsService } from "./flows.service";
import { Public } from "../common/decorators/public.decorator";
import type { Response } from "express";

@ApiTags("referral")
@Controller("r")
export class ReferralController {
  constructor(
    private readonly flowsService: FlowsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get(":code")
  @ApiOperation({ summary: "Handle referral link and redirect to the product's live offer page" })
  @ApiResponse({ status: 302, description: "Redirect to product offer page" })
  @ApiResponse({ status: 404, description: "Referral code not found" })
  async handleReferral(@Param("code") code: string, @Res() res: Response) {
    const frontendUrl = this.config.get<string>("FRONTEND_URL") ?? "https://sofsavdo.com";
    try {
      const flow = await this.flowsService.getFlowByReferralCode(code);
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
