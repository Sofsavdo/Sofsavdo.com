import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CampaignsService } from "./campaigns.service";
import { CreatorCampaignQueryDto } from "./dto/creator-campaign-query.dto";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";

// See RBAC.md's "Interim state" note — gated on "is an authenticated creator", not yet on
// "application approved" (that requires the not-yet-built Creator Application domain).
@ApiTags("creator/campaigns")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator/campaigns")
export class CreatorCampaignsController {
  constructor(private campaigns: CampaignsService) {}

  @Get()
  list(@Query() query: CreatorCampaignQueryDto) {
    return this.campaigns.listForCreator(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.campaigns.findOneForCreatorOrThrow(id);
  }
}
