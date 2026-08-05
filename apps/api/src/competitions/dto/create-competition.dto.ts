import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCompetitionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty()
  @IsDateString()
  startAt!: string;

  @ApiProperty()
  @IsDateString()
  endAt!: string;

  @ApiProperty({
    enum: ["ORDER_COUNT", "REFERRAL_COUNT", "INSTAGRAM_VIEWS"],
    description:
      "Metrika turi: buyurtma soni, taklif qilingan do'stlar soni, yoki Instagram video ko'rishlar soni. " +
      "INSTAGRAM_VIEWS — creator ariza (video havola) topshiradi, admin tasdiqlaydi/rad etadi, keyin ko'rishlar soni qo'lda kiritiladi.",
  })
  @IsEnum(["ORDER_COUNT", "REFERRAL_COUNT", "INSTAGRAM_VIEWS"])
  metric!: "ORDER_COUNT" | "REFERRAL_COUNT" | "INSTAGRAM_VIEWS";

  @ApiProperty({ description: "1-o'rin sovrini" })
  @IsString()
  @MaxLength(500)
  firstPrize!: string;

  @ApiProperty({ description: "2-o'rin sovrini" })
  @IsString()
  @MaxLength(500)
  secondPrize!: string;

  @ApiProperty({ description: "3-o'rin sovrini" })
  @IsString()
  @MaxLength(500)
  thirdPrize!: string;

  @ApiPropertyOptional({ description: "Reklama rasm URL" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;
}
