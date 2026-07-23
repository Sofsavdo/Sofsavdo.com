import { Module } from "@nestjs/common";
import { LandingsController } from "./landings.controller";
import { LandingSectionsController } from "./landing-sections.controller";
import { PublicLandingController } from "./public-landing.controller";
import { LandingsService } from "./landings.service";
import { OffersModule } from "../offers/offers.module";
import { DeliveryModule } from "../delivery/delivery.module";

@Module({
  imports: [OffersModule, DeliveryModule],
  controllers: [LandingsController, LandingSectionsController, PublicLandingController],
  providers: [LandingsService],
  exports: [LandingsService],
})
export class LandingsModule {}
