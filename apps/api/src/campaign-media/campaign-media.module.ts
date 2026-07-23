import { Module } from "@nestjs/common";
import { CampaignMediaController, CampaignMediaItemController } from "./campaign-media.controller";
import { CampaignMediaService } from "./campaign-media.service";

@Module({
  controllers: [CampaignMediaController, CampaignMediaItemController],
  providers: [CampaignMediaService],
  exports: [CampaignMediaService],
})
export class CampaignMediaModule {}
