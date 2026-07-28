import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";
import type { EmailPort, EmailSendResult, SendEmailRequest } from "./email.port";

// Real SMTP delivery via nodemailer — transactional only (welcome, password reset, application
// result, payout updates), never marketing/bulk (locked constraint). Same never-fake-success
// philosophy as TelegramBotAdapter: an unconfigured SMTP host or a rejected send returns
// { ok: false, errorMessage }, recorded as a FAILED delivery.
@Injectable()
export class SmtpEmailAdapter implements EmailPort {
  private transporter: Transporter | null = null;

  constructor(private config: ConfigService) {}

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>("notifications.email.smtpHost");
    if (!host) return null;
    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>("notifications.email.smtpPort"),
      secure: this.config.get<number>("notifications.email.smtpPort") === 465,
      auth: { user: this.config.get<string>("notifications.email.smtpUser"), pass: this.config.get<string>("notifications.email.smtpPass") },
    });
    return this.transporter;
  }

  async send(request: SendEmailRequest): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return { ok: false, errorMessage: "SMTP_HOST is not configured" };
    }
    try {
      await transporter.sendMail({
        from: this.config.get<string>("notifications.email.fromAddress"),
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, errorMessage: err instanceof Error ? err.message : "Unknown email delivery error" };
    }
  }
}
