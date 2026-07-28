import { Module } from "@nestjs/common";
import { AdminRefundsController } from "./admin-refunds.controller";
import { AdminRefundsService } from "./admin-refunds.service";

@Module({
  controllers: [AdminRefundsController],
  providers: [AdminRefundsService],
})
export class AdminRefundsModule {}
