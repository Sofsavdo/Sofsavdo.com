import { Module } from "@nestjs/common";
import { PromoCodesService } from "./promo-codes.service";

@Module({
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}
