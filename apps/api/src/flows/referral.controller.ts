import { Controller, Get, Param, Res } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { FlowsService } from "./flows.service";
import { Public } from "../common/decorators/public.decorator";
import type { Response } from "express";

@ApiTags("referral")
@Controller("r")
export class ReferralController {
  constructor(private readonly flowsService: FlowsService) {}

  @Public()
  @Get(":code")
  @ApiOperation({ summary: "Handle referral link and redirect to product page" })
  @ApiResponse({ status: 302, description: "Redirect to product page" })
  @ApiResponse({ status: 404, description: "Referral code not found" })
  async handleReferral(@Param("code") code: string, @Res() res: Response) {
    try {
      const flow = await this.flowsService.getFlowByReferralCode(code);
      
      // Store referral information in session/cookie for attribution
      // This will be used when the buyer makes a purchase
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

      // Redirect to product page
      // For now, redirect to homepage since product pages need to be created
      // TODO: Update to redirect to actual product page: /products/${flow.product.slug}
      return res.redirect(302, `/?ref=${code}`);
    } catch (error) {
      // If referral code not found, redirect to homepage
      return res.redirect(302, "/");
    }
  }
}
