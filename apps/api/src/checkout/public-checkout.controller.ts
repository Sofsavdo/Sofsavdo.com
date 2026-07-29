import { createHash } from "node:crypto";
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CheckoutService } from "./checkout.service";
import { TrackVisitDto } from "./dto/track-visit.dto";
import { ValidatePromoDto } from "./dto/validate-promo.dto";
import { CreateCheckoutDto } from "../orders/dto/create-checkout.dto";
import { Public } from "../common/decorators/public.decorator";
import { OptionalAuth } from "../common/decorators/optional-auth.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

// Phase 14 finding: none of these three public routes had a route-specific rate limit — only the
// global default (120/60s per IP) applied, the same gap the 6A→6B audit already found and fixed
// for the auth endpoints. All three are realistic abuse targets: `visit` can be spammed to
// pollute attribution/click data, `promo-code/validate` can be used to brute-force-guess valid
// codes, and `checkout` creates real Order rows (idempotencyKey prevents a true duplicate, but
// not a flood of distinct fake orders). Limits below are generous enough for real buyer behavior
// (a shopper does not hit any of these more than a handful of times per minute) while materially
// slowing a script.
@ApiTags("public")
@Controller("offers")
export class PublicCheckoutController {
  constructor(private checkout: CheckoutService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Public()
  @Post(":slug/visit")
  trackVisit(@Param("slug") slug: string, @Body() dto: TrackVisitDto, @Req() req: Request) {
    return this.checkout.trackVisit(slug, dto, hashIp(req.ip ?? "unknown"), req.headers["user-agent"]);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Public()
  @Post(":slug/promo-code/validate")
  validatePromo(@Param("slug") slug: string, @Body() dto: ValidatePromoDto) {
    return this.checkout.validatePromo(slug, dto);
  }

  // @OptionalAuth(), not @Public() — a guest checkout must keep working with no token at all, but
  // a logged-in buyer's order should link to their account automatically, with no separate
  // "claim this order" step afterward. See OrdersService.upsertCustomer for the actual merge rule.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @OptionalAuth()
  @Post(":slug/checkout")
  createCheckout(@Param("slug") slug: string, @Body() dto: CreateCheckoutDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.checkout.checkout(slug, dto, user?.userId);
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
