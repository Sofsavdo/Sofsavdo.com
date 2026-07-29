import { Module } from "@nestjs/common";
import { PromoCodesService } from "./promo-codes.service";
import { AdminPromoCodesController } from "./admin-promo-codes.controller";

@Module({
  controllers: [AdminPromoCodesController],
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}
