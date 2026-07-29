import { Module } from "@nestjs/common";
import { ActivityTickerController } from "./activity-ticker.controller";
import { ActivityTickerService } from "./activity-ticker.service";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [AnalyticsModule],
  controllers: [ActivityTickerController],
  providers: [ActivityTickerService],
})
export class ActivityTickerModule {}
