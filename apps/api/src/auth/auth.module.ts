import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthV2Service } from "./auth-v2.service";
import { TokenService } from "./token.service";
import { JwtStrategy } from "./jwt.strategy";
import { PrismaModule } from "../prisma/prisma.module";
import { RolesModule } from "../roles/roles.module";
import { ReferralsModule } from "../referrals/referrals.module";
import { LaunchBonusModule } from "../launch-bonus/launch-bonus.module";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [PrismaModule, RolesModule, ReferralsModule, LaunchBonusModule, ConfigModule, JwtModule.register({}), PassportModule],
  controllers: [],
  providers: [AuthService, AuthV2Service, TokenService, JwtStrategy],
  exports: [AuthService, TokenService, JwtStrategy],
})
export class AuthModule {}
