import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { OrderQueryDto } from "./dto/order-query.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { UpdateOrderNotesDto } from "./dto/update-order-notes.dto";
import { CreateRefundDto } from "./dto/create-refund.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/orders")
@ApiBearerAuth("bearer")
@Controller("admin/orders")
export class AdminOrdersController {
  constructor(private orders: OrdersService) {}

  @RequirePermissions("order.read")
  @Get()
  list(@Query() query: OrderQueryDto) {
    return this.orders.list(query);
  }

  @RequirePermissions("order.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.orders.findOneOrThrow(id);
  }

  @RequirePermissions("order.update")
  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateOrderStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.adminUpdateStatus(id, dto.status, user.userId, dto.note);
  }

  @RequirePermissions("order.update")
  @Patch(":id/notes")
  updateNotes(@Param("id") id: string, @Body() dto: UpdateOrderNotesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.updateNotes(id, dto.notes, user.userId);
  }

  @RequirePermissions("order.refund")
  @Post(":id/refunds")
  createRefund(@Param("id") id: string, @Body() dto: CreateRefundDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.createRefund(id, dto, user.userId);
  }
}
