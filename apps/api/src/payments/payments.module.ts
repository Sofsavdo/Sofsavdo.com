import { Global, Module } from "@nestjs/common";
import { ClickPaymentAdapter } from "./click-payment.adapter";
import { ClickCallbackController } from "./click-callback.controller";
import { PaymentsService } from "./payments.service";
import { PAYMENT_PORT } from "./payment.port";
import { OrdersModule } from "../orders/orders.module";

// Global: PAYMENT_PORT is injectable anywhere without an explicit import — same pattern as
// StorageModule/STORAGE_PORT. Swapping/adding a provider means adding one adapter class and
// changing this one binding (or a small factory keyed on Payment.provider) — no domain-layer
// changes. Only Click is wired today; Payme/Uzum Nasiya adapters can implement the same
// PaymentPort interface later without touching OrdersService/PaymentsService.
// Imports OrdersModule (one-directional: Payments -> Orders) so PaymentsService can hand off
// "this payment succeeded/failed" to OrdersService.markPaid/markPaymentFailed, which owns every
// consequence of an Order's lifecycle (status, stock, referral hook) in one place.
@Global()
@Module({
  imports: [OrdersModule],
  controllers: [ClickCallbackController],
  providers: [PaymentsService, { provide: PAYMENT_PORT, useClass: ClickPaymentAdapter }],
  exports: [PAYMENT_PORT, PaymentsService],
})
export class PaymentsModule {}
