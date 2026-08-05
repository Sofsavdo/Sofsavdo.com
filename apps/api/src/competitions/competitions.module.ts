import { Module } from "@nestjs/common";
import { CompetitionsController } from "./competitions.controller";
import { CreatorCompetitionsController } from "./creator-competitions.controller";
import { CompetitionsService } from "./competitions.service";
import { AnalyticsModule } from "../analytics/analytics.module";
import { INSTAGRAM_VIEWS_PORT } from "./instagram-views.port";
import { InstagramViewsScraperAdapter } from "./instagram-views-scraper.adapter";

@Module({
  imports: [AnalyticsModule],
  controllers: [CompetitionsController, CreatorCompetitionsController],
  providers: [CompetitionsService, { provide: INSTAGRAM_VIEWS_PORT, useClass: InstagramViewsScraperAdapter }],
})
export class CompetitionsModule {}
