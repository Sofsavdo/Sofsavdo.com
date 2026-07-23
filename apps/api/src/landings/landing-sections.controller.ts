import { Body, Controller, Delete, HttpCode, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LandingsService } from "./landings.service";
import { UpdateLandingSectionDto } from "./dto/landing-section.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

// Individually addressed by section id — separate from LandingsController (which is nested under
// /admin/offers/:offerId) because a section's own id, not its parent offer, is the natural key
// for a single-row PATCH/DELETE.
@ApiTags("admin/landings")
@ApiBearerAuth("bearer")
@Controller("admin/landing-sections")
export class LandingSectionsController {
  constructor(private landings: LandingsService) {}

  @RequirePermissions("landing.write")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateLandingSectionDto) {
    return this.landings.updateSection(id, dto);
  }

  @RequirePermissions("landing.write")
  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string) {
    await this.landings.removeSection(id);
  }
}
