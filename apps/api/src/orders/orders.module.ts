import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { AdminOrdersController } from "./admin-orders.controller";
import { BuyerOrdersController } from "./buyer-orders.controller";
import { OffersModule } from "../offers/offers.module";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { PromoCodesModule } from "../promo-codes/promo-codes.module";
import { ReferralsModule } from "../referrals/referrals.module";

@Module({
  imports: [OffersModule, CampaignsModule, DeliveryModule, PromoCodesModule, ReferralsModule],
  controllers: [AdminOrdersController, BuyerOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
