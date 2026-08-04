import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";
import { JwtStrategy } from "./jwt.strategy";
import { AuthController } from "./auth.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { RolesModule } from "../roles/roles.module";
import { ReferralsModule } from "../referrals/referrals.module";
import { LaunchBonusModule } from "../launch-bonus/launch-bonus.module";
import { ConfigModule } from "@nestjs/config";
import { CommonModule } from "../common/common.module";

@Module({
  imports: [PrismaModule, RolesModule, ReferralsModule, LaunchBonusModule, ConfigModule, CommonModule, JwtModule.register({}), PassportModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy],
  exports: [AuthService, TokenService, JwtStrategy],
})
export class AuthModule {}
