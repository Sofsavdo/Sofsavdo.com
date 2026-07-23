import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreatorApplicationsService } from "./creator-applications.service";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Ownership is enforced in the service (same id can never resolve to another creator's
// application), not by RBAC permissions — see RBAC.md's "creator ownership" note.
@ApiTags("creator/applications")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller()
export class CreatorApplicationsController {
  constructor(private applications: CreatorApplicationsService) {}

  @Post("creator/campaigns/:campaignId/applications")
  create(@Param("campaignId") campaignId: string, @Body() dto: CreateApplicationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.create(campaignId, user.creatorId!, dto);
  }

  @Get("creator/applications")
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.applications.listMine(user.creatorId!);
  }

  @Get("creator/my-campaigns")
  listMyCampaigns(@CurrentUser() user: AuthenticatedUser) {
    return this.applications.listMyCampaigns(user.creatorId!);
  }

  @Get("creator/applications/:id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.findMineOrThrow(id, user.creatorId!);
  }

  @Patch("creator/applications/:id")
  updateDraft(@Param("id") id: string, @Body() dto: CreateApplicationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.updateDraft(id, user.creatorId!, dto);
  }

  @Post("creator/applications/:id/submit")
  submit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.submit(id, user.creatorId!);
  }

  @Post("creator/applications/:id/resubmit")
  resubmit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.resubmit(id, user.creatorId!);
  }

  @Post("creator/applications/:id/withdraw")
  withdraw(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.withdraw(id, user.creatorId!);
  }
}
