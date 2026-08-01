/**
 * Simplified Earnings Controller
 * 
 * Controller for the simplified v2 earnings API.
 * Merges balance, commissions, and payouts into a single "Earnings" concept.
 */

import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EarningsViewService } from './earnings-view.service';
import {
  SimplifiedEarningsDto,
  SimplifiedEarningsWithTransactionsDto,
  CreateWithdrawalDto,
  SimplifiedWithdrawalDto,
} from './dto/simplified-earnings.dto';

@ApiTags('Earnings V2')
@Controller('v2/earnings')
export class EarningsV2Controller {
  constructor(private readonly earningsViewService: EarningsViewService) {}

  @Get()
  @ApiOperation({ summary: 'Get my simplified earnings' })
  @ApiResponse({ status: 200, description: 'Earnings retrieved', type: SimplifiedEarningsDto })
  async getMyEarnings(/* @CurrentUser('creatorId') creatorId: string */): Promise<SimplifiedEarningsDto> {
    // Placeholder - will use auth guard in Phase 2
    const creatorId = 'placeholder-creator-id';
    return this.earningsViewService.getMyEarnings(creatorId);
  }

  @Get('with-transactions')
  @ApiOperation({ summary: 'Get my earnings with recent transactions' })
  @ApiResponse({ status: 200, description: 'Earnings with transactions retrieved', type: SimplifiedEarningsWithTransactionsDto })
  async getMyEarningsWithTransactions(/* @CurrentUser('creatorId') creatorId: string */): Promise<SimplifiedEarningsWithTransactionsDto> {
    // Placeholder - will use auth guard in Phase 2
    const creatorId = 'placeholder-creator-id';
    return this.earningsViewService.getMyEarningsWithTransactions(creatorId);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Create a withdrawal request' })
  @ApiResponse({ status: 201, description: 'Withdrawal created', type: SimplifiedWithdrawalDto })
  async createWithdrawal(
    /* @CurrentUser('creatorId') creatorId: string, */
    @Body() dto: CreateWithdrawalDto,
  ): Promise<SimplifiedWithdrawalDto> {
    // Placeholder - will use auth guard in Phase 2
    const creatorId = 'placeholder-creator-id';
    return this.earningsViewService.createWithdrawal(creatorId, dto);
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'Get my withdrawal history' })
  @ApiResponse({ status: 200, description: 'Withdrawals retrieved', type: [SimplifiedWithdrawalDto] })
  async getMyWithdrawals(/* @CurrentUser('creatorId') creatorId: string */): Promise<SimplifiedWithdrawalDto[]> {
    // Placeholder - will use auth guard in Phase 2
    const creatorId = 'placeholder-creator-id';
    return this.earningsViewService.getMyWithdrawals(creatorId);
  }
}
