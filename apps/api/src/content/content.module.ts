import { Module } from "@nestjs/common";
import { ContentService } from "./content.service";
import { CreatorContentController, CreatorContentAttachmentController } from "./creator-content.controller";
import { AdminContentController } from "./admin-content.controller";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { ReferralsModule } from "../referrals/referrals.module";

@Module({
  imports: [CampaignsModule, ReferralsModule],
  controllers: [CreatorContentController, CreatorContentAttachmentController, AdminContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
