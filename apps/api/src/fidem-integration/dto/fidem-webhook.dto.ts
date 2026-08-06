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

  // Fidem's own already-computed referral reward (50% of the payment, capped by tier — see
  // sofsavdo_integration.py's caller in payments_r.py), not something Sofsavdo re-derives from a
  // generic commission rate. Recorded as the Commission's amountMinor as-is.
  @IsInt()
  @IsPositive()
  commissionAmountMinor!: number;

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
