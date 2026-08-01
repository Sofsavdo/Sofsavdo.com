/**
 * Simplified Creators Controller
 * 
 * Controller for the simplified v2 creators API.
 * Hides technical fields like tier, compliance status.
 * Focuses on profile, products, and link generation.
 */

import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreatorsViewService } from './creators-view.service';
import {
  SimplifiedCreatorProfileDto,
  UpdateSimplifiedCreatorProfileDto,
  SimplifiedCreatorProductDto,
} from './dto/simplified-creator.dto';

@ApiTags('Creators V2')
@Controller('v2/creators')
export class CreatorsV2Controller {
  constructor(private readonly creatorsViewService: CreatorsViewService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my simplified profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved', type: SimplifiedCreatorProfileDto })
  async getMyProfile(/* @CurrentUser('creatorId') creatorId: string */): Promise<SimplifiedCreatorProfileDto> {
    // Placeholder - will use auth guard in Phase 2
    const creatorId = 'placeholder-creator-id';
    return this.creatorsViewService.getMyProfile(creatorId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update my simplified profile' })
  @ApiResponse({ status: 200, description: 'Profile updated', type: SimplifiedCreatorProfileDto })
  async updateMyProfile(
    /* @CurrentUser('creatorId') creatorId: string, */
    @Body() dto: UpdateSimplifiedCreatorProfileDto,
  ): Promise<SimplifiedCreatorProfileDto> {
    // Placeholder - will use auth guard in Phase 2
    const creatorId = 'placeholder-creator-id';
    return this.creatorsViewService.updateMyProfile(creatorId, dto);
  }

  @Get('me/products')
  @ApiOperation({ summary: 'Get my simplified products' })
  @ApiResponse({ status: 200, description: 'Products retrieved', type: [SimplifiedCreatorProductDto] })
  async getMyProducts(/* @CurrentUser('creatorId') creatorId: string */): Promise<SimplifiedCreatorProductDto[]> {
    // Placeholder - will use auth guard in Phase 2
    const creatorId = 'placeholder-creator-id';
    return this.creatorsViewService.getMyProducts(creatorId);
  }

  @Post('me/products/:productId/link')
  @ApiOperation({ summary: 'Generate instant sharing link for a product' })
  @ApiResponse({ status: 200, description: 'Link generated' })
  async generateSharingLink(
    /* @CurrentUser('creatorId') creatorId: string, */
    @Param('productId') productId: string,
  ): Promise<{ link: string }> {
    // Placeholder - will use auth guard in Phase 2
    const creatorId = 'placeholder-creator-id';
    const link = await this.creatorsViewService.generateSharingLink(creatorId, productId);
    return { link };
  }
}
