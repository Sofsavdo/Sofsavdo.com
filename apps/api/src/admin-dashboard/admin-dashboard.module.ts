import { Module } from "@nestjs/common";
import { AdminDashboardController } from "./admin-dashboard.controller";
import { AdminDashboardService } from "./admin-dashboard.service";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [AnalyticsModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminDashboardModule {}
