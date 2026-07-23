import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CampaignsService } from "./campaigns.service";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";
import { CampaignQueryDto } from "./dto/campaign-query.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/campaigns")
@ApiBearerAuth("bearer")
@Controller("admin/campaigns")
export class CampaignsController {
  constructor(private campaigns: CampaignsService) {}

  @RequirePermissions("campaign.read")
  @Get()
  list(@Query() query: CampaignQueryDto) {
    return this.campaigns.list(query);
  }

  @RequirePermissions("campaign.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.campaigns.findOneOrThrow(id);
  }

  @RequirePermissions("campaign.write")
  @Post()
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: AuthenticatedUser) {
    return this.campaigns.create(dto, user.userId);
  }

  @RequirePermissions("campaign.write")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCampaignDto, @CurrentUser() user: AuthenticatedUser) {
    return this.campaigns.update(id, dto, user.userId);
  }

  @RequirePermissions("campaign.publish")
  @Post(":id/activate")
  activate(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaigns.activate(id, user.userId);
  }

  @RequirePermissions("campaign.pause")
  @Post(":id/pause")
  pause(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaigns.pause(id, user.userId);
  }

  @RequirePermissions("campaign.complete")
  @Post(":id/complete")
  complete(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaigns.complete(id, user.userId);
  }

  @RequirePermissions("campaign.archive")
  @Post(":id/archive")
  archive(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaigns.archive(id, user.userId);
  }
}
