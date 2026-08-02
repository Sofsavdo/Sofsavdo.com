import { Module } from "@nestjs/common";
import { LaunchBonusService } from "./launch-bonus.service";
import { LaunchBonusController } from "./launch-bonus.controller";
import { LaunchBonusScheduler } from "./launch-bonus.scheduler";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PrismaModule, ConfigModule, NotificationsModule],
  controllers: [LaunchBonusController],
  providers: [LaunchBonusService, LaunchBonusScheduler],
  exports: [LaunchBonusService],
})
export class LaunchBonusModule {}
