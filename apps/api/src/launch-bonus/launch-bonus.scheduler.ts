import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { LaunchBonusService } from "./launch-bonus.service";
import { AppLogger } from "../common/logging/app-logger.service";

@Injectable()
export class LaunchBonusScheduler {
  constructor(
    private readonly launchBonusService: LaunchBonusService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(LaunchBonusScheduler.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyBonusCheck() {
    this.logger.log("Starting daily launch bonus check");
    try {
      await this.launchBonusService.checkAndUpdateBonuses();
      this.logger.log("Daily launch bonus check completed");
    } catch (error) {
      this.logger.error(`Error during daily bonus check: ${error}`);
    }
  }
}
