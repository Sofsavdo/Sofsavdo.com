import { Module } from "@nestjs/common";
import { IzdoshIntegrationController } from "./izdosh-integration.controller";
import { IzdoshIntegrationService } from "./izdosh-integration.service";

@Module({
  controllers: [IzdoshIntegrationController],
  providers: [IzdoshIntegrationService],
  exports: [IzdoshIntegrationService],
})
export class IzdoshIntegrationModule {}
