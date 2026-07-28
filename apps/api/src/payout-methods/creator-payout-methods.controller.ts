import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PayoutMethodsService } from "./payout-methods.service";
import { CreatePayoutMethodDto } from "./dto/create-payout-method.dto";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Ownership-scoped by creatorId from the JWT, not RBAC-gated — same convention as Wallet/Content.
@ApiTags("creator/payout-methods")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator/payout-methods")
export class CreatorPayoutMethodsController {
  constructor(private payoutMethods: PayoutMethodsService) {}

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.payoutMethods.listMine(user.creatorId!);
  }

  @Post()
  create(@Body() dto: CreatePayoutMethodDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payoutMethods.create(user.creatorId!, user.userId, dto);
  }

  @Patch(":id/set-default")
  setDefault(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payoutMethods.setDefault(id, user.creatorId!, user.userId);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.payoutMethods.deactivate(id, user.creatorId!, user.userId);
  }
}
