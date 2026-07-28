import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsString, MinLength, ValidateIf } from "class-validator";

const TYPES = ["CARD", "BANK_ACCOUNT"] as const;

export class CreatePayoutMethodDto {
  @ApiProperty({ enum: TYPES })
  @IsIn(TYPES)
  type!: (typeof TYPES)[number];

  @ApiPropertyOptional({ description: "Required when type=CARD." })
  @ValidateIf((o: CreatePayoutMethodDto) => o.type === "CARD")
  @IsString()
  @MinLength(12)
  cardNumber?: string;

  @ApiPropertyOptional({ description: "Required when type=CARD." })
  @ValidateIf((o: CreatePayoutMethodDto) => o.type === "CARD")
  @IsString()
  @MinLength(3)
  cardHolder?: string;

  @ApiPropertyOptional({ description: "Required when type=BANK_ACCOUNT." })
  @ValidateIf((o: CreatePayoutMethodDto) => o.type === "BANK_ACCOUNT")
  @IsString()
  @MinLength(3)
  bankName?: string;

  @ApiPropertyOptional({ description: "Required when type=BANK_ACCOUNT." })
  @ValidateIf((o: CreatePayoutMethodDto) => o.type === "BANK_ACCOUNT")
  @IsString()
  @MinLength(5)
  bankAccount?: string;
}
