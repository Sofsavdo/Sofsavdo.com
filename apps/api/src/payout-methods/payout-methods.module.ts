import { Module } from "@nestjs/common";
import { PayoutMethodsService } from "./payout-methods.service";
import { CreatorPayoutMethodsController } from "./creator-payout-methods.controller";

@Module({
  controllers: [CreatorPayoutMethodsController],
  providers: [PayoutMethodsService],
  exports: [PayoutMethodsService],
})
export class PayoutMethodsModule {}
