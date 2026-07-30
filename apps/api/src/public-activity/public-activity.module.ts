import { Module } from "@nestjs/common";
import { PublicActivityController } from "./public-activity.controller";
import { PublicActivityService } from "./public-activity.service";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [AnalyticsModule],
  controllers: [PublicActivityController],
  providers: [PublicActivityService],
})
export class PublicActivityModule {}
