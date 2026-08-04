import { Controller, Get, Post, Body, Param, UseGuards, Redirect, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { FlowsService } from "./flows.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";
import type { Response } from "express";

@ApiTags("flows")
@ApiBearerAuth("bearer")
@Controller("flows")
@UseGuards(JwtAuthGuard)
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Post()
  createFlow(@CurrentUser() user: AuthenticatedUser, @Body() body: { productId: string }) {
    if (!user.creatorId) {
      throw new Error("Creator profile not found");
    }
    return this.flowsService.createFlow(user.creatorId, body.productId);
  }

  @Get()
  listFlows(@CurrentUser() user: AuthenticatedUser) {
    if (!user.creatorId) {
      throw new Error("Creator profile not found");
    }
    return this.flowsService.listFlows(user.creatorId);
  }

  @Post(":id/pause")
  pauseFlow(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    if (!user.creatorId) {
      throw new Error("Creator profile not found");
    }
    return this.flowsService.pauseFlow(id, user.creatorId);
  }

  @Post(":id/activate")
  activateFlow(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    if (!user.creatorId) {
      throw new Error("Creator profile not found");
    }
    return this.flowsService.activateFlow(id, user.creatorId);
  }

  @Get(":id/images/:index/download")
  async downloadWatermarkedImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("index") index: string,
    @Res() res: Response,
  ) {
    if (!user.creatorId) {
      throw new Error("Creator profile not found");
    }
    const { buffer, contentType } = await this.flowsService.getWatermarkedProductImage(id, user.creatorId, Number(index));
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="sofsavdo-${id}-${index}.jpg"`);
    res.send(buffer);
  }
}
