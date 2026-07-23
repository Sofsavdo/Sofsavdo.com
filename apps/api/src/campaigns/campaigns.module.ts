import { Module } from "@nestjs/common";
import { CampaignsController } from "./campaigns.controller";
import { CreatorCampaignsController } from "./creator-campaigns.controller";
import { CampaignsService } from "./campaigns.service";
import { CampaignMediaModule } from "../campaign-media/campaign-media.module";

@Module({
  imports: [CampaignMediaModule],
  controllers: [CampaignsController, CreatorCampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
