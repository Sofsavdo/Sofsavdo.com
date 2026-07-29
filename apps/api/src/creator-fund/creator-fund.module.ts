import { Module } from "@nestjs/common";
import { CreatorFundController } from "./creator-fund.controller";
import { CreatorFundService } from "./creator-fund.service";
import { AnalyticsModule } from "../analytics/analytics.module";
import { CommissionsModule } from "../commissions/commissions.module";

@Module({
  imports: [AnalyticsModule, CommissionsModule],
  controllers: [CreatorFundController],
  providers: [CreatorFundService],
})
export class CreatorFundModule {}
