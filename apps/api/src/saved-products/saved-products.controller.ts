import { Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SavedProductsService } from "./saved-products.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("buyer/saved-products")
@ApiBearerAuth("bearer")
@Controller("buyer/saved-products")
export class SavedProductsController {
  constructor(private savedProducts: SavedProductsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.savedProducts.list(user.userId);
  }

  @Post(":offerId")
  save(@CurrentUser() user: AuthenticatedUser, @Param("offerId") offerId: string) {
    return this.savedProducts.save(user.userId, offerId);
  }

  @Delete(":offerId")
  unsave(@CurrentUser() user: AuthenticatedUser, @Param("offerId") offerId: string) {
    return this.savedProducts.unsave(user.userId, offerId);
  }
}
