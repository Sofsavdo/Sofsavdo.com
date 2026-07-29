import { Module } from "@nestjs/common";
import { HomepageSectionsController } from "./homepage-sections.controller";
import { PublicHomepageController } from "./public-homepage.controller";
import { HomepageSectionsService } from "./homepage-sections.service";

@Module({
  controllers: [HomepageSectionsController, PublicHomepageController],
  providers: [HomepageSectionsService],
  exports: [HomepageSectionsService],
})
export class HomepageModule {}
