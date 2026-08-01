/**
 * Simplified Orders Controller
 * 
 * Controller for the simplified v2 orders API.
 * Hides technical fields like attribution, commission details.
 * Focuses on customer, items, total, status.
 */

import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { OrdersViewService } from './orders-view.service';
import {
  SimplifiedOrderDto,
  SimplifiedOrderListDto,
  UpdateOrderStatusDto,
  CreateSimplifiedOrderDto,
} from './dto/simplified-order.dto';

@ApiTags('Orders V2')
@Controller('v2/orders')
export class OrdersV2Controller {
  constructor(private readonly ordersViewService: OrdersViewService) {}

  @Get()
  @ApiOperation({ summary: 'List simplified orders' })
  @ApiResponse({ status: 200, description: 'Orders retrieved', type: SimplifiedOrderListDto })
  @ApiQuery({ name: 'skip', required: false })
  @ApiQuery({ name: 'take', required: false })
  @ApiQuery({ name: 'status', required: false })
  async list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('status') status?: string,
  ): Promise<SimplifiedOrderListDto> {
    return this.ordersViewService.list({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get simplified order by ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved', type: SimplifiedOrderDto })
  async findOne(@Param('id') id: string): Promise<SimplifiedOrderDto> {
    return this.ordersViewService.findOne(id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: 200, description: 'Order status updated', type: SimplifiedOrderDto })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<SimplifiedOrderDto> {
    return this.ordersViewService.updateStatus(id, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create simplified order (for buyer checkout)' })
  @ApiResponse({ status: 201, description: 'Order created', type: SimplifiedOrderDto })
  async create(@Body() dto: CreateSimplifiedOrderDto): Promise<SimplifiedOrderDto> {
    return this.ordersViewService.create(dto);
  }
}
