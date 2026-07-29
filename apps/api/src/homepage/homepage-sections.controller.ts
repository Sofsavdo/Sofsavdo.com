import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { HomepageSectionsService } from "./homepage-sections.service";
import { CreateHomepageSectionDto, ReorderHomepageSectionsDto, UpdateHomepageSectionDto } from "./dto/homepage-section.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

// Flat — unlike LandingsController, a homepage section has no parent entity to nest under (see
// schema.prisma's HomepageSection comment / DECISIONS.md ADR-027), so every route here is
// addressed directly by the section's own id, with no offerId-style path segment.
@ApiTags("admin/homepage")
@ApiBearerAuth("bearer")
@Controller("admin/homepage-sections")
export class HomepageSectionsController {
  constructor(private homepage: HomepageSectionsService) {}

  @RequirePermissions("homepage.read")
  @Get()
  list() {
    return this.homepage.list();
  }

  @RequirePermissions("homepage.write")
  @Post()
  add(@Body() dto: CreateHomepageSectionDto) {
    return this.homepage.add(dto);
  }

  @RequirePermissions("homepage.write")
  @Post("reorder")
  reorder(@Body() dto: ReorderHomepageSectionsDto) {
    return this.homepage.reorder(dto.orderedIds);
  }

  @RequirePermissions("homepage.write")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateHomepageSectionDto) {
    return this.homepage.update(id, dto);
  }

  @RequirePermissions("homepage.write")
  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string) {
    await this.homepage.remove(id);
  }
}
