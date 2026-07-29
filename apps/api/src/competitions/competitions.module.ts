import { Module } from "@nestjs/common";
import { CompetitionsController } from "./competitions.controller";
import { CreatorCompetitionsController } from "./creator-competitions.controller";
import { CompetitionsService } from "./competitions.service";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [AnalyticsModule],
  controllers: [CompetitionsController, CreatorCompetitionsController],
  providers: [CompetitionsService],
})
export class CompetitionsModule {}
