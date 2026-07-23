import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { RolesService } from "../roles/roles.service";
import { DomainException } from "../common/errors/domain-error";
import type { AccessTokenPayload } from "./token.service";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private roles: RolesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("jwt.accessSecret")!,
    });
  }

  // Runs on every authenticated request. Deliberately re-reads the user + role/permission set
  // from the database rather than trusting anything beyond `sub` from the JWT — the token itself
  // carries no role/permission claims (spec §7: "JWT ichiga ortiqcha user data joylama"), so a
  // permission change or account suspension takes effect immediately, not at next token refresh.
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { creatorProfile: true },
    });
    if (!user || user.status !== "ACTIVE") {
      throw new DomainException("UNAUTHORIZED", "Sessiya yaroqsiz.");
    }
    const { roleKeys, permissions } = await this.roles.getRoleKeysAndPermissionsForUser(user.id);
    return {
      userId: user.id,
      email: user.email,
      phone: user.phone,
      roleKeys,
      permissions,
      creatorId: user.creatorProfile?.id ?? null,
    };
  }
}
