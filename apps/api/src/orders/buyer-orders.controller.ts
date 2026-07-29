import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// No RequireBuyerGuard — see DECISIONS.md ADR-024 for why none exists. Every non-@Public() route
// already requires a valid session; ownership is enforced here by scoping every query to the
// caller's own userId, not by a guard that would have nothing left to check.
@ApiTags("buyer/orders")
@ApiBearerAuth("bearer")
@Controller("buyer/orders")
export class BuyerOrdersController {
  constructor(private orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.listForBuyer(user.userId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.orders.findOneForBuyerOrThrow(user.userId, id);
  }
}
