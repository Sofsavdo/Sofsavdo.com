import { Module } from "@nestjs/common";
import { CommissionsService } from "./commissions.service";
import { AdminCommissionsController } from "./admin-commissions.controller";
import { CreatorWalletController } from "./creator-wallet.controller";
import { CreatorSalesController } from "./creator-sales.controller";
import { CreatorCommissionsController } from "./creator-commissions.controller";

@Module({
  controllers: [AdminCommissionsController, CreatorWalletController, CreatorSalesController, CreatorCommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
