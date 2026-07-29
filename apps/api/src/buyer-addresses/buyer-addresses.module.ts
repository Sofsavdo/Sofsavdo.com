import { Module } from "@nestjs/common";
import { BuyerAddressesController } from "./buyer-addresses.controller";
import { BuyerAddressesService } from "./buyer-addresses.service";

@Module({
  controllers: [BuyerAddressesController],
  providers: [BuyerAddressesService],
})
export class BuyerAddressesModule {}
