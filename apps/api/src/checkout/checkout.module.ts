import { Module } from "@nestjs/common";
import { CheckoutService } from "./checkout.service";
import { PublicCheckoutController, PublicOrderController } from "./public-checkout.controller";
import { OrdersModule } from "../orders/orders.module";
import { PaymentsModule } from "../payments/payments.module";
import { PromoCodesModule } from "../promo-codes/promo-codes.module";

@Module({
  imports: [OrdersModule, PaymentsModule, PromoCodesModule],
  controllers: [PublicCheckoutController, PublicOrderController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
