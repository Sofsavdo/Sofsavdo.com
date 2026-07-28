import { Module } from "@nestjs/common";
import { AdminCreatorsController } from "./admin-creators.controller";
import { AdminCreatorsService } from "./admin-creators.service";
import { ReferralsModule } from "../referrals/referrals.module";

@Module({
  imports: [ReferralsModule],
  controllers: [AdminCreatorsController],
  providers: [AdminCreatorsService],
})
export class AdminCreatorsModule {}
