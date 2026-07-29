import { Module } from "@nestjs/common";
import { CreatorDashboardController } from "./creator-dashboard.controller";
import { CreatorDashboardService } from "./creator-dashboard.service";
import { CommissionsModule } from "../commissions/commissions.module";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [CommissionsModule, AnalyticsModule],
  controllers: [CreatorDashboardController],
  providers: [CreatorDashboardService],
})
export class CreatorDashboardModule {}
