import { PartialType } from "@nestjs/swagger";
import { CreateDeliveryRegionDto } from "./create-delivery-region.dto";

export class UpdateDeliveryRegionDto extends PartialType(CreateDeliveryRegionDto) {}
