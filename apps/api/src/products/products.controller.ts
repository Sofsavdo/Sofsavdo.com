import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductQueryDto } from "./dto/product-query.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";
import { DomainException } from "../common/errors/domain-error";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("admin/products")
@ApiBearerAuth("bearer")
@Controller("admin/products")
export class ProductsController {
  constructor(private products: ProductsService, private prisma: PrismaService) {}

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

  @Get("my-products")
  listMyProducts(@CurrentUser() user: AuthenticatedUser) {
    return this.products.listByCreator(user.creatorId!);
  }

  @Post("my-products")
  createMyProduct(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto) {
    return this.products.create({ ...dto, creatorProfileId: user.creatorId! });
  }

  @Get("available-for-promotion")
  listAvailableForPromotion() {
    return this.products.listAvailableForPromotion();
  }

  @Post("select-for-promotion/:productId")
  async selectForPromotion(@CurrentUser() user: AuthenticatedUser, @Param("productId") productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        offers: {
          where: { status: "ACTIVE" },
          include: {
            campaigns: true,
          },
        },
      },
    });

    if (!product) throw new DomainException("NOT_FOUND", "Mahsulot topilmadi.");
    const offer = product.offers[0];
    if (!offer) throw new DomainException("NOT_FOUND", "Mahsulot uchun offer topilmadi.");

    const campaign = offer.campaigns[0];
    if (!campaign) throw new DomainException("NOT_FOUND", "Offer uchun campaign topilmadi.");

    // Check if creator already has a referral link for this campaign
    const existingLink = await this.prisma.referralLink.findFirst({
      where: {
        creatorId: user.creatorId!,
        offerId: offer.id,
      },
    });

    if (existingLink) return existingLink;

    // Create referral link
    return this.prisma.referralLink.create({
      data: {
        creatorId: user.creatorId!,
        offerId: offer.id,
        campaignId: campaign.id,
        code: `${user.creatorId!.slice(0, 8)}-${offer.id.slice(0, 8)}`,
        status: "ACTIVE",
      },
    });
  }
}
