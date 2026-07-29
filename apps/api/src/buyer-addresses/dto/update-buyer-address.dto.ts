import { PartialType } from "@nestjs/swagger";
import { CreateBuyerAddressDto } from "./create-buyer-address.dto";

export class UpdateBuyerAddressDto extends PartialType(CreateBuyerAddressDto) {}
