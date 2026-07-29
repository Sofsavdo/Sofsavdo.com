import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BuyerAddressesService } from "./buyer-addresses.service";
import { CreateBuyerAddressDto } from "./dto/create-buyer-address.dto";
import { UpdateBuyerAddressDto } from "./dto/update-buyer-address.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("buyer/addresses")
@ApiBearerAuth("bearer")
@Controller("buyer/addresses")
export class BuyerAddressesController {
  constructor(private addresses: BuyerAddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.addresses.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBuyerAddressDto) {
    return this.addresses.create(user.userId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateBuyerAddressDto) {
    return this.addresses.update(id, user.userId, dto);
  }

  @Patch(":id/set-default")
  setDefault(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.addresses.setDefault(id, user.userId);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.addresses.remove(id, user.userId);
  }
}
