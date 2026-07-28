import { Module } from "@nestjs/common";
import { PayoutsService } from "./payouts.service";
import { CreatorPayoutsController } from "./creator-payouts.controller";
import { AdminPayoutsController } from "./admin-payouts.controller";
import { CommissionsModule } from "../commissions/commissions.module";

@Module({
  imports: [CommissionsModule],
  controllers: [CreatorPayoutsController, AdminPayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
