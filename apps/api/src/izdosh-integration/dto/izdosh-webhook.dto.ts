import { IsInt, IsISO8601, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

// Identical shape to FidemWebhookDto (see fidem-integration/dto/fidem-webhook.dto.ts) — kept as
// its own class rather than reused so the two partner integrations can diverge independently
// later without one's DTO change silently affecting the other's validation.
export class IzdoshWebhookDto {
  @IsString()
  @MaxLength(64)
  clickToken!: string;

  // Izdosh's own payment id — the idempotency key a retried webhook delivery is deduplicated on
  // (see Commission.externalRef's unique index).
  @IsString()
  @MaxLength(200)
  externalPaymentId!: string;

  @IsInt()
  @IsPositive()
  amountMinor!: number;

  // Izdosh's own already-computed 5% commission, not something Sofsavdo re-derives from a
  // generic product commission rate. Recorded as the Commission's amountMinor as-is.
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
