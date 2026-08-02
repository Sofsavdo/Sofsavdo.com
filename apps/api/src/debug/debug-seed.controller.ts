import { Body, Controller, ForbiddenException, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import { DebugSeedService } from "./debug-seed.service";
import { SeedTestUserDto } from "./dto/seed-test-user.dto";

// TEMPORARY, staging-only debug endpoint — created to unblock manual login testing while the
// real fix (prisma/seed.ts actually running as part of a deploy) is sorted out. This endpoint:
//   - hard-refuses to run when NODE_ENV=production, mirroring the same guard prisma/seed.ts uses
//     for the exact same reason (a publicly-known-shape endpoint that mints/updates credentials
//     must never be reachable on a real production database);
//   - is intentionally narrow — only creates/updates a User + (UserRole "admin" | CreatorProfile),
//     nothing else prisma/seed.ts seeds (no catalog/campaign data), so it can't be mistaken for a
//     general seeding tool;
//   - is @Public() only in the sense that JwtAuthGuard doesn't block it (there is no admin
//     session to require yet — that's the whole problem this unblocks), not in the sense that it's
//     safe to leave enabled anywhere reachable from the internet long-term. Remove this module
//     once RUNBOOK.md's real seed/bootstrap step runs reliably in every environment.
@ApiTags("debug")
@Controller("debug")
export class DebugSeedController {
  constructor(
    private debugSeed: DebugSeedService,
    private config: ConfigService,
  ) {}

  private assertNotProduction() {
    if (this.config.get<string>("nodeEnv") === "production") {
      throw new ForbiddenException("This debug endpoint is disabled in production.");
    }
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @Post("seed-test-users")
  async seedTestUsers(@Body() dto: SeedTestUserDto) {
    this.assertNotProduction();
    const result = await this.debugSeed.seedTestUser(dto);
    return { ok: true, ...result };
  }
}
