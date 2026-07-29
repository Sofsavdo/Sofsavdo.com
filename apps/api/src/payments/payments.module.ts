import { Global, Module } from "@nestjs/common";
import type { PaymentProviderType } from "@prisma/client";
import { ClickPaymentAdapter } from "./click-payment.adapter";
import { CodPaymentAdapter } from "./cod-payment.adapter";
import { ClickCallbackController } from "./click-callback.controller";
import { PaymentsService } from "./payments.service";
import { PAYMENT_PORT_REGISTRY, type PaymentPort } from "./payment.port";
import { OrdersModule } from "../orders/orders.module";

// Global: PAYMENT_PORT_REGISTRY is injectable anywhere without an explicit import — same pattern
// as StorageModule/STORAGE_PORT. Adding Payme/Uzum Nasiya later means adding one adapter class and
// one entry in this factory's array — no changes to PaymentsService or OrdersService.
//
// Phase F: the registry (a `Map<PaymentProviderType, PaymentPort>`) replaces the original
// single-binding `PAYMENT_PORT` — Click and Cash-on-Delivery genuinely coexist per order now,
// which a single binding could never express. `ClickPaymentAdapter` is also registered as its own
// provider (not just inside the Map) since `ClickCallbackController` needs the concrete class
// directly for Click's own callback contract — see that controller's comment.
// Imports OrdersModule (one-directional: Payments -> Orders) so PaymentsService can hand off
// "this payment succeeded/failed" to OrdersService.markPaid/markPaymentFailed, which owns every
// consequence of an Order's lifecycle (status, stock, referral hook) in one place.
@Global()
@Module({
  imports: [OrdersModule],
  controllers: [ClickCallbackController],
  providers: [
    PaymentsService,
    ClickPaymentAdapter,
    CodPaymentAdapter,
    {
      provide: PAYMENT_PORT_REGISTRY,
      useFactory: (click: ClickPaymentAdapter, cod: CodPaymentAdapter) =>
        new Map<PaymentProviderType, PaymentPort>([
          ["CLICK", click],
          ["CASH_ON_DELIVERY", cod],
        ]),
      inject: [ClickPaymentAdapter, CodPaymentAdapter],
    },
  ],
  exports: [PAYMENT_PORT_REGISTRY, PaymentsService],
})
export class PaymentsModule {}
