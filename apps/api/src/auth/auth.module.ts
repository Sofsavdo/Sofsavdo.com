import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";
import { JwtStrategy } from "./jwt.strategy";
import { RolesModule } from "../roles/roles.module";
import { CommonModule } from "../common/common.module";
import { ReferralsModule } from "../referrals/referrals.module";

@Module({
  imports: [PassportModule, JwtModule.register({}), RolesModule, CommonModule, ReferralsModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
