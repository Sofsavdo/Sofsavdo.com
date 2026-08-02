import { Controller, Get, Post, Put, Body, UseGuards, Request } from "@nestjs/common";
import { LaunchBonusService, LaunchBonusProgress } from "./launch-bonus.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@Controller("launch-bonus")
export class LaunchBonusController {
  constructor(private readonly launchBonusService: LaunchBonusService) {}

  @Get("my-progress")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async getMyProgress(@Request() req: { user: AuthenticatedUser }): Promise<LaunchBonusProgress | null> {
    const creatorId = req.user.creatorId;
    if (!creatorId) return null;
    return this.launchBonusService.getCreatorBonusProgress(creatorId);
  }

  @Get("settings")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("launch_bonus.read")
  async getSettings() {
    return this.launchBonusService.getSettings();
  }

  @Put("settings")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("launch_bonus.admin")
  async updateSettings(@Body() data: any) {
    return this.launchBonusService.updateSettings(data);
  }

  @Get("pending-verifications")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("launch_bonus.verify")
  async getPendingVerifications() {
    return this.launchBonusService.getPendingBioVerifications();
  }

  @Post("verify-bio")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("launch_bonus.verify")
  async verifyBioLink(@Body() body: { creatorProfileId: string; approved: boolean }, @Request() req: { user: AuthenticatedUser }) {
    return this.launchBonusService.verifyBioLink(body.creatorProfileId, req.user.userId, body.approved);
  }

  @Post("check-bonuses")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("launch_bonus.admin")
  async checkBonuses() {
    return this.launchBonusService.checkAndUpdateBonuses();
  }
}
