/**
 * Simplified Creators Controller
 * 
 * Controller for the simplified v2 creators API.
 * Hides technical fields like tier, compliance status.
 * Focuses on profile, streams, earnings, and link generation.
 * Public endpoints for testing - will use auth guard in production.
 */

import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatorsViewService } from './creators-view.service';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import {
  SimplifiedCreatorProfileDto,
  UpdateSimplifiedCreatorProfileDto,
  SimplifiedCreatorProductDto,
  CreatorStreamDto,
  CreatorEarningsDto,
} from './dto/simplified-creator.dto';

@ApiTags('Creators V2')
@ApiBearerAuth('bearer')
@Controller('v2/creators')
export class CreatorsV2Controller {
  constructor(private readonly creatorsViewService: CreatorsViewService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my simplified profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved', type: SimplifiedCreatorProfileDto })
  async getMyProfile(@CurrentUser('creatorId') creatorId: string): Promise<SimplifiedCreatorProfileDto> {
    return this.creatorsViewService.getMyProfile(creatorId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update my simplified profile' })
  @ApiResponse({ status: 200, description: 'Profile updated', type: SimplifiedCreatorProfileDto })
  async updateMyProfile(
    @CurrentUser('creatorId') creatorId: string,
    @Body() dto: UpdateSimplifiedCreatorProfileDto,
  ): Promise<SimplifiedCreatorProfileDto> {
    return this.creatorsViewService.updateMyProfile(creatorId, dto);
  }

  @Get('me/streams')
  @ApiOperation({ summary: 'Get my active streams with stats' })
  @ApiResponse({ status: 200, description: 'Streams retrieved', type: [CreatorStreamDto] })
  async getMyStreams(@CurrentUser('creatorId') creatorId: string): Promise<CreatorStreamDto[]> {
    return this.creatorsViewService.getMyStreams(creatorId);
  }

  @Get('me/streams/:productId')
  @ApiOperation({ summary: 'Get stream detail with referral link' })
  @ApiResponse({ status: 200, description: 'Stream detail retrieved', type: CreatorStreamDto })
  async getStreamDetail(
    @CurrentUser('creatorId') creatorId: string,
    @Param('productId') productId: string,
  ): Promise<CreatorStreamDto> {
    return this.creatorsViewService.getStreamDetail(creatorId, productId);
  }

  @Get('me/earnings')
  @ApiOperation({ summary: 'Get my earnings data' })
  @ApiResponse({ status: 200, description: 'Earnings retrieved', type: CreatorEarningsDto })
  async getMyEarnings(@CurrentUser('creatorId') creatorId: string): Promise<CreatorEarningsDto> {
    return this.creatorsViewService.getMyEarnings(creatorId);
  }

  @Post('me/earnings/withdraw')
  @ApiOperation({ summary: 'Request withdrawal' })
  @ApiResponse({ status: 200, description: 'Withdrawal requested' })
  async requestWithdrawal(
    @CurrentUser('creatorId') creatorId: string,
    @Body() body: { amountMinor: number },
  ): Promise<{ success: boolean }> {
    return this.creatorsViewService.requestWithdrawal(creatorId, body.amountMinor);
  }
}
