import { IsInt, IsISO8601, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

export class FidemWebhookDto {
  @IsString()
  @MaxLength(64)
  clickToken!: string;

  // Fidem's own payment/transaction id — the idempotency key a retried webhook delivery is
  // deduplicated on (see Commission.externalRef's unique index).
  @IsString()
  @MaxLength(200)
  externalPaymentId!: string;

  @IsInt()
  @IsPositive()
  amountMinor!: number;

  @IsISO8601()
  occurredAt!: string;

  @IsString()
  @MaxLength(64)
  signature!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  planName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}
