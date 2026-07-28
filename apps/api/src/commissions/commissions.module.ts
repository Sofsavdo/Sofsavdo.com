import { Module } from "@nestjs/common";
import { CommissionsService } from "./commissions.service";
import { AdminCommissionsController } from "./admin-commissions.controller";
import { CreatorWalletController } from "./creator-wallet.controller";

@Module({
  controllers: [AdminCommissionsController, CreatorWalletController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
