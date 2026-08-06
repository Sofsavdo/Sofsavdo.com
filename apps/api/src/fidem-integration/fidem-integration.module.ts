import { Module } from "@nestjs/common";
import { FidemIntegrationController } from "./fidem-integration.controller";
import { FidemIntegrationService } from "./fidem-integration.service";

@Module({
  controllers: [FidemIntegrationController],
  providers: [FidemIntegrationService],
  exports: [FidemIntegrationService],
})
export class FidemIntegrationModule {}
