import { Module } from "@nestjs/common";
import { DebugSeedController } from "./debug-seed.controller";
import { DebugSeedService } from "./debug-seed.service";

// See DebugSeedController's header comment — temporary, staging-only, remove once real seeding
// runs reliably in every deploy.
@Module({
  controllers: [DebugSeedController],
  providers: [DebugSeedService],
})
export class DebugModule {}
