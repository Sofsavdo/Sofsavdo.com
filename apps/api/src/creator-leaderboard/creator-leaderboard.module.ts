import { Module } from "@nestjs/common";
import { CreatorLeaderboardController } from "./creator-leaderboard.controller";
import { CreatorLeaderboardService } from "./creator-leaderboard.service";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [AnalyticsModule],
  controllers: [CreatorLeaderboardController],
  providers: [CreatorLeaderboardService],
})
export class CreatorLeaderboardModule {}
