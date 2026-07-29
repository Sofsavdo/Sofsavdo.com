import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OffersService } from "./offers.service";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";
import { OfferQueryDto } from "./dto/offer-query.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/offers")
@ApiBearerAuth("bearer")
@Controller("admin/offers")
export class OffersController {
  constructor(private offers: OffersService) {}

  @RequirePermissions("offer.read")
  @Get()
  list(@Query() query: OfferQueryDto) {
    return this.offers.list(query);
  }

  @RequirePermissions("offer.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.offers.findOneOrThrow(id);
  }

  @RequirePermissions("offer.write")
  @Post()
  create(@Body() dto: CreateOfferDto, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.create(dto, user.userId);
  }

  @RequirePermissions("offer.write")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOfferDto, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.update(id, dto, user.userId);
  }

  @RequirePermissions("offer.publish")
  @Post(":id/activate")
  activate(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.activate(id, user.userId);
  }

  @RequirePermissions("offer.pause")
  @Post(":id/pause")
  pause(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.pause(id, user.userId);
  }

  @RequirePermissions("offer.archive")
  @Post(":id/archive")
  archive(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.archive(id, user.userId);
  }

  // Reuses "offer.write" rather than a new granular permission — same precedent as isIndexable
  // (see permissions.constants.ts's comment): this is an existing admin-editable entity gaining a
  // field, not a new domain that needs its own permission.
  @RequirePermissions("offer.write")
  @Post(":id/feature")
  feature(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.feature(id, user.userId);
  }

  @RequirePermissions("offer.write")
  @Post(":id/unfeature")
  unfeature(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.unfeature(id, user.userId);
  }
}
