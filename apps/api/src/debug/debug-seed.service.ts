import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { randomSuffix } from "../common/codes/code-generator";
// Reused, idempotent Role/Permission seeding helper (see prisma/lib/seed-roles-permissions.ts's
// own header); calling it here means this endpoint also works against a completely fresh staging
// database that has never had prisma/seed.ts or bootstrap-admin.ts run, rather than requiring
// that as a separate manual step first.
import { seedRolesAndPermissions } from "../../prisma/lib/seed-roles-permissions";
import { DomainException } from "../common/errors/domain-error";
import type { SeedTestUserDto } from "./dto/seed-test-user.dto";

export interface SeedTestUserResult {
  id: string;
  email: string;
  role: "admin" | "creator";
  createdRole: boolean;
  createdCreatorProfile: boolean;
}

// Backs the temporary POST /debug/seed-test-users endpoint — see DebugSeedController's header
// comment for the full context on why this exists and why it must never run in production.
@Injectable()
export class DebugSeedService {
  constructor(private prisma: PrismaService) {}

  async seedTestUser(dto: SeedTestUserDto): Promise<SeedTestUserResult> {
    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.upsert({
      where: { email: dto.email },
      update: { passwordHash, status: "ACTIVE" },
      create: { email: dto.email, passwordHash, emailVerified: new Date(), status: "ACTIVE" },
    });

    let createdRole = false;
    let createdCreatorProfile = false;

    if (dto.role === "admin") {
      let adminRole = await this.prisma.role.findUnique({ where: { key: "admin" } });
      if (!adminRole) {
        // Fresh staging database with an empty Role/Permission catalog — same chicken-and-egg
        // problem bootstrap-admin.ts exists to solve (see its header comment). Seeding here is
        // idempotent (upserts) and safe to call on every request.
        await seedRolesAndPermissions(this.prisma);
        adminRole = await this.prisma.role.findUnique({ where: { key: "admin" } });
      }
      if (!adminRole) {
        throw new DomainException("NOT_FOUND", "'admin' roli topilmadi — Role/Permission katalogini seed qilib bo'lmadi.");
      }
      const existingUserRole = await this.prisma.userRole.findUnique({
        where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      });
      if (!existingUserRole) {
        await this.prisma.userRole.create({ data: { userId: user.id, roleId: adminRole.id } });
        createdRole = true;
      }
    } else {
      // Creators aren't gated by Role/UserRole (see prisma/seed.ts's identical comment) — having
      // a CreatorProfile row is itself what makes an account a "creator".
      const existingProfile = await this.prisma.creatorProfile.findUnique({ where: { userId: user.id } });
      if (!existingProfile) {
        await this.prisma.creatorProfile.create({
          data: {
            userId: user.id,
            displayName: dto.displayName ?? dto.email.split("@")[0] ?? "Test Creator",
            contentNiches: [],
            referralCode: randomSuffix(8),
          },
        });
        createdCreatorProfile = true;
      }
    }

    return { id: user.id, email: dto.email, role: dto.role, createdRole, createdCreatorProfile };
  }
}
