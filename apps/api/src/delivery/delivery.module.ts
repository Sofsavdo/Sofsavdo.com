import { Module } from "@nestjs/common";
import { DeliveryController, DeliveryRegionItemController } from "./delivery.controller";
import { PublicQuoteController } from "./public-quote.controller";
import { DeliveryService } from "./delivery.service";

@Module({
  controllers: [DeliveryController, DeliveryRegionItemController, PublicQuoteController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
