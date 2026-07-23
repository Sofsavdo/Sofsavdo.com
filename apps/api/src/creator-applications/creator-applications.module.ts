import { Module } from "@nestjs/common";
import { CreatorApplicationsController } from "./creator-applications.controller";
import { AdminApplicationsController } from "./admin-applications.controller";
import { CreatorApplicationsService } from "./creator-applications.service";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { ReferralsModule } from "../referrals/referrals.module";

@Module({
  imports: [CampaignsModule, ReferralsModule],
  controllers: [CreatorApplicationsController, AdminApplicationsController],
  providers: [CreatorApplicationsService],
  exports: [CreatorApplicationsService],
})
export class CreatorApplicationsModule {}
