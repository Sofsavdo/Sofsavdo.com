import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LandingsService } from "./landings.service";
import { CreateLandingDto } from "./dto/create-landing.dto";
import { UpdateLandingDto } from "./dto/update-landing.dto";
import { CreateLandingSectionDto, ReorderLandingSectionsDto } from "./dto/landing-section.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Nested under /admin/offers/:offerId — a Landing has no identity of its own worth addressing
// directly (1:1 with its Offer, no separate slug — see schema.prisma's LandingStatus comment),
// so every route here is reached through the Offer it belongs to, per API.md's
// `CRUD /admin/offers/:id/landing-sections` convention.
@ApiTags("admin/landings")
@ApiBearerAuth("bearer")
@Controller("admin/offers/:offerId")
export class LandingsController {
  constructor(private landings: LandingsService) {}

  @RequirePermissions("landing.read")
  @Get("landing")
  findOne(@Param("offerId") offerId: string) {
    return this.landings.findByOfferIdOrThrow(offerId);
  }

  @RequirePermissions("landing.write")
  @Post("landing")
  create(@Param("offerId") offerId: string, @Body() dto: CreateLandingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.landings.create(offerId, dto, user.userId);
  }

  @RequirePermissions("landing.write")
  @Patch("landing")
  update(@Param("offerId") offerId: string, @Body() dto: UpdateLandingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.landings.update(offerId, dto, user.userId);
  }

  @RequirePermissions("landing.publish")
  @Post("landing/publish")
  publish(@Param("offerId") offerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.landings.publish(offerId, user.userId);
  }

  @RequirePermissions("landing.publish")
  @Post("landing/unpublish")
  unpublish(@Param("offerId") offerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.landings.unpublish(offerId, user.userId);
  }

  @RequirePermissions("landing.archive")
  @Post("landing/archive")
  archive(@Param("offerId") offerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.landings.archive(offerId, user.userId);
  }

  // Admin-authenticated preview of the rendered public shape — works regardless of publish
  // status (unlike GET /offers/:slug/public), so a DRAFT landing can be reviewed before going
  // live. This is "preview mode": a separate authenticated surface, not a loosened public route.
  @RequirePermissions("landing.read")
  @Get("landing/preview")
  preview(@Param("offerId") offerId: string) {
    return this.landings.preview(offerId);
  }

  @RequirePermissions("landing.read")
  @Get("landing-sections")
  listSections(@Param("offerId") offerId: string) {
    return this.landings.listSections(offerId);
  }

  @RequirePermissions("landing.write")
  @Post("landing-sections")
  addSection(@Param("offerId") offerId: string, @Body() dto: CreateLandingSectionDto) {
    return this.landings.addSection(offerId, dto);
  }

  @RequirePermissions("landing.write")
  @Post("landing-sections/reorder")
  reorderSections(@Param("offerId") offerId: string, @Body() dto: ReorderLandingSectionsDto) {
    return this.landings.reorderSections(offerId, dto.orderedIds);
  }
}
