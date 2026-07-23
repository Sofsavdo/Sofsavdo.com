import { Module } from "@nestjs/common";
import { ReferralsService } from "./referrals.service";
import { CreatorReferralsController } from "./creator-referrals.controller";
import { AdminReferralsController, AdminReferralRulesController, AdminReferralRewardsController } from "./admin-referrals.controller";

@Module({
  controllers: [CreatorReferralsController, AdminReferralsController, AdminReferralRulesController, AdminReferralRewardsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
