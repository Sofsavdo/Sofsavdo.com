import { Module } from "@nestjs/common";
import { CreatorProfileController } from "./creator-profile.controller";
import { CreatorProfileService } from "./creator-profile.service";

@Module({
  controllers: [CreatorProfileController],
  providers: [CreatorProfileService],
})
export class CreatorProfileModule {}
