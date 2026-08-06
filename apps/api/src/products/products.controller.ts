import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductQueryDto } from "./dto/product-query.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

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

  // Static-path GET routes must all be registered before the ":id" wildcard below — Nest's
  // (Express) router matches by registration order, not specificity, so ":id" declared first
  // would swallow every one of these as if "my-products"/"available-for-promotion"/etc. were the
  // :id value, silently routing them through findOne()'s own permission check instead (confirmed
  // live: this is exactly why GET /admin/products/creator-available-for-promotion 403'd for an
  // approved creator with a real product.read requirement in the error — that requirement belongs
  // to findOne, not this route, which has none).
  @Get("my-products")
  listMyProducts(@CurrentUser() user: AuthenticatedUser) {
    return this.products.listByCreator(user.creatorId!);
  }

  @Post("my-products")
  createMyProduct(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto) {
    return this.products.create({ ...dto, creatorProfileId: user.creatorId! });
  }

  @RequirePermissions("product.read")
  @Get("available-for-promotion")
  listAvailableForPromotion() {
    return this.products.listAvailableForPromotion();
  }

  // Creator-specific endpoint for available products (no admin permission required)
  @Get("creator-available-for-promotion")
  listAvailableForPromotionForCreator() {
    return this.products.listAvailableForPromotion();
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

  @RequirePermissions("product.write")
  @Post(":id/pin")
  pin(@Param("id") id: string) {
    return this.products.pin(id);
  }

  @RequirePermissions("product.write")
  @Post(":id/unpin")
  unpin(@Param("id") id: string) {
    return this.products.unpin(id);
  }
}
