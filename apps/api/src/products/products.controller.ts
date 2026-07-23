import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductQueryDto } from "./dto/product-query.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

@ApiTags("admin/products")
@ApiBearerAuth("bearer")
@Controller("admin/products")
export class ProductsController {
  constructor(private products: ProductsService) {}

  @RequirePermissions("product.read")
  @Get()
  list(@Query() query: ProductQueryDto) {
    return this.products.list(query);
  }

  @RequirePermissions("product.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.products.findOneOrThrow(id);
  }

  @RequirePermissions("product.write")
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @RequirePermissions("product.write")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @RequirePermissions("product.archive")
  @Post(":id/archive")
  archive(@Param("id") id: string) {
    return this.products.archive(id);
  }
}
