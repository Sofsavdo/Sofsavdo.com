import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";
import { CustomerInfoDto } from "./customer-info.dto";

// Buyer-facing payment method choice — validated against the specific Offer's configured
// paymentOptions in OrdersService (an admin opts an Offer into "PAY_LATER" the same way it opts
// into "CLICK"; there is no universal always-on option). Click is the only real gateway wired in
// Phase 8 (see PaymentPort/ClickPaymentAdapter); PAYME/CARD/COD exist as Offer-configurable labels
// for a future adapter and are rejected with PAYMENT_METHOD_NOT_SUPPORTED until one exists.
const PAYMENT_METHODS = ["CLICK", "PAYME", "CARD", "COD", "PAY_LATER"] as const;

export class CreateCheckoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({ description: "Required for PHYSICAL_PRODUCT offers." })
  @IsOptional()
  @IsString()
  regionCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiPropertyOptional({ description: "ReferralLink.code — attributes this sale to a creator." })
  @IsOptional()
  @IsString()
  refCode?: string;

  @ApiPropertyOptional({ description: "Returned by POST /offers/:slug/visit — links this order back to that click." })
  @IsOptional()
  @IsString()
  visitorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryMethod?: string;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  paymentMethod!: (typeof PAYMENT_METHODS)[number];

  @ApiProperty({ type: CustomerInfoDto })
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customer!: CustomerInfoDto;

  @ApiProperty({ description: "Client-generated — dedupes retried checkout submissions into a single Order." })
  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}
