/**
 * Simplified Products Controller
 * 
 * Controller for the simplified v2 products API.
 * Hides technical fields like slug, SKU, internal codes.
 * Auto-generates slugs and SKUs when creating products.
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ProductsViewService } from './products-view.service';
import {
  SimplifiedProductDto,
  SimplifiedProductListDto,
  CreateSimplifiedProductDto,
  UpdateSimplifiedProductDto,
} from './dto/simplified-product.dto';

@ApiTags('Products V2')
@Controller('v2/products')
export class ProductsV2Controller {
  constructor(private readonly productsViewService: ProductsViewService) {}

  @Get()
  @ApiOperation({ summary: 'List simplified products' })
  @ApiResponse({ status: 200, description: 'Products retrieved', type: SimplifiedProductListDto })
  @ApiQuery({ name: 'skip', required: false })
  @ApiQuery({ name: 'take', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  async list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ): Promise<SimplifiedProductListDto> {
    return this.productsViewService.list({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      status,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get simplified product by ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved', type: SimplifiedProductDto })
  async findOne(@Param('id') id: string): Promise<SimplifiedProductDto> {
    return this.productsViewService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create simplified product (auto-generates slug and SKU)' })
  @ApiResponse({ status: 201, description: 'Product created', type: SimplifiedProductDto })
  async create(@Body() dto: CreateSimplifiedProductDto): Promise<SimplifiedProductDto> {
    return this.productsViewService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update simplified product' })
  @ApiResponse({ status: 200, description: 'Product updated', type: SimplifiedProductDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSimplifiedProductDto,
  ): Promise<SimplifiedProductDto> {
    return this.productsViewService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete product (soft delete by archiving)' })
  @ApiResponse({ status: 200, description: 'Product archived' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.productsViewService.remove(id);
  }
}
