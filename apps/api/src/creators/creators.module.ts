import { Module } from "@nestjs/common";
import { CreatorsV2Controller } from "./creators-v2.controller";
import { CreatorsViewService } from "./creators-view.service";

@Module({
  controllers: [CreatorsV2Controller],
  providers: [CreatorsViewService],
  exports: [CreatorsViewService],
})
export class CreatorsModule {}
