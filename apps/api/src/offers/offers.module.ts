import { Module } from "@nestjs/common";
import { OffersController } from "./offers.controller";
import { PublicOffersController } from "./public-offers.controller";
import { OffersService } from "./offers.service";

@Module({
  controllers: [OffersController, PublicOffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
