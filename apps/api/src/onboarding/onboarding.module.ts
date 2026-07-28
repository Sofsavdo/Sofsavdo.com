import { Module } from "@nestjs/common";
import { OnboardingController } from "./onboarding.controller";
import { AdminOnboardingController } from "./admin-onboarding.controller";
import { OnboardingService } from "./onboarding.service";
import { ReferralsModule } from "../referrals/referrals.module";

@Module({
  imports: [ReferralsModule],
  controllers: [OnboardingController, AdminOnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
