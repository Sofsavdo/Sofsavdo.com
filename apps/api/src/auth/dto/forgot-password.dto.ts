import { IsEmail } from "class-validator";

// Architecture stub per Phase 6 spec §7 ("forgot password architecture") — issues a reset token
// and would email/SMS it via NotificationsModule once a real provider is wired (§25). For now,
// in non-production environments the token is logged instead of sent, exactly like the mock
// payment/notification adapters elsewhere in this codebase.
export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}
