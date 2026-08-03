import { Module } from "@nestjs/common";
import { FlowsService } from "./flows.service";
import { FlowsController } from "./flows.controller";
import { ReferralController } from "./referral.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [FlowsController, ReferralController],
  providers: [FlowsService],
  exports: [FlowsService],
})
export class FlowsModule {}
