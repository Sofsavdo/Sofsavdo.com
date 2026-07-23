import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { DeliveryService } from "./delivery.service";
import { CreateDeliveryRegionDto } from "./dto/create-delivery-region.dto";
import { UpdateDeliveryRegionDto } from "./dto/update-delivery-region.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

// Delivery regions are a sub-resource of Offer editing — gated by "offer.write", the same
// permission that gates every other Offer admin mutation (matches the existing
// landing-sections-under-landing.write / campaign-media-under-campaign.write pattern).
@ApiTags("admin/delivery")
@ApiBearerAuth("bearer")
@Controller("admin/offers/:offerId/delivery-regions")
export class DeliveryController {
  constructor(private delivery: DeliveryService) {}

  @RequirePermissions("offer.write")
  @Get()
  list(@Param("offerId") offerId: string) {
    return this.delivery.listForAdmin(offerId);
  }

  @RequirePermissions("offer.write")
  @Post()
  create(@Param("offerId") offerId: string, @Body() dto: CreateDeliveryRegionDto) {
    return this.delivery.create(offerId, dto);
  }
}

// Individually addressed by region id — same reasoning as LandingSectionsController.
@ApiTags("admin/delivery")
@ApiBearerAuth("bearer")
@Controller("admin/delivery-regions")
export class DeliveryRegionItemController {
  constructor(private delivery: DeliveryService) {}

  @RequirePermissions("offer.write")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateDeliveryRegionDto) {
    return this.delivery.update(id, dto);
  }

  @RequirePermissions("offer.write")
  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string) {
    await this.delivery.remove(id);
  }
}
