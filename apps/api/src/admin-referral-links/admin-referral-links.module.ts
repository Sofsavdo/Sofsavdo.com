import { Module } from "@nestjs/common";
import { AdminReferralLinksController } from "./admin-referral-links.controller";
import { AdminReferralLinksService } from "./admin-referral-links.service";
import { AdminVisitorsController } from "./admin-visitors.controller";
import { AdminVisitorsService } from "./admin-visitors.service";

@Module({
  controllers: [AdminReferralLinksController, AdminVisitorsController],
  providers: [AdminReferralLinksService, AdminVisitorsService],
})
export class AdminReferralLinksModule {}
