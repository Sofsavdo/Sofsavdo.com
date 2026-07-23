import { createHash } from "node:crypto";
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CheckoutService } from "./checkout.service";
import { TrackVisitDto } from "./dto/track-visit.dto";
import { ValidatePromoDto } from "./dto/validate-promo.dto";
import { CreateCheckoutDto } from "../orders/dto/create-checkout.dto";
import { Public } from "../common/decorators/public.decorator";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

@ApiTags("public")
@Controller("offers")
export class PublicCheckoutController {
  constructor(private checkout: CheckoutService) {}

  @Public()
  @Post(":slug/visit")
  trackVisit(@Param("slug") slug: string, @Body() dto: TrackVisitDto, @Req() req: Request) {
    return this.checkout.trackVisit(slug, dto, hashIp(req.ip ?? "unknown"), req.headers["user-agent"]);
  }

  @Public()
  @Post(":slug/promo-code/validate")
  validatePromo(@Param("slug") slug: string, @Body() dto: ValidatePromoDto) {
    return this.checkout.validatePromo(slug, dto);
  }

  @Public()
  @Post(":slug/checkout")
  createCheckout(@Param("slug") slug: string, @Body() dto: CreateCheckoutDto) {
    return this.checkout.checkout(slug, dto);
  }
}

@ApiTags("public")
@Controller("orders/public")
export class PublicOrderController {
  constructor(private checkout: CheckoutService) {}

  @Public()
  @Get(":publicToken")
  getOrder(@Param("publicToken") publicToken: string) {
    return this.checkout.getOrder(publicToken);
  }
}
