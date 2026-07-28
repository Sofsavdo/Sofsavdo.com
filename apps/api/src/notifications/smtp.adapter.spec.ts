import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import { SmtpEmailAdapter } from "./smtp.adapter";

jest.mock("nodemailer");

describe("SmtpEmailAdapter", () => {
  let adapter: SmtpEmailAdapter;
  let smtpHost: string;
  let sendMail: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    smtpHost = "smtp.example.uz";
    sendMail = jest.fn().mockResolvedValue({ messageId: "1" });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const config = {
      get: (key: string) => {
        const values: Record<string, unknown> = {
          "notifications.email.smtpHost": smtpHost,
          "notifications.email.smtpPort": 587,
          "notifications.email.smtpUser": "user",
          "notifications.email.smtpPass": "pass",
          "notifications.email.fromAddress": "no-reply@rosti.uz",
        };
        return values[key];
      },
    };
    const moduleRef = await Test.createTestingModule({ providers: [SmtpEmailAdapter, { provide: ConfigService, useValue: config }] }).compile();
    adapter = moduleRef.get(SmtpEmailAdapter);
  });

  it("fails loudly (never fakes success) when SMTP_HOST is unconfigured", async () => {
    smtpHost = "";
    const config2 = { get: (key: string) => (key === "notifications.email.smtpHost" ? "" : undefined) };
    const moduleRef = await Test.createTestingModule({ providers: [SmtpEmailAdapter, { provide: ConfigService, useValue: config2 }] }).compile();
    const unconfigured = moduleRef.get(SmtpEmailAdapter);
    const result = await unconfigured.send({ to: "x@example.uz", subject: "s", html: "<p>h</p>", text: "h" });
    expect(result).toEqual({ ok: false, errorMessage: expect.stringContaining("SMTP_HOST") });
  });

  it("sends via nodemailer and returns ok:true on success", async () => {
    const result = await adapter.send({ to: "x@example.uz", subject: "s", html: "<p>h</p>", text: "h" });
    expect(result).toEqual({ ok: true });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "x@example.uz", subject: "s" }));
  });

  it("catches a send rejection rather than throwing", async () => {
    sendMail.mockRejectedValue(new Error("mailbox full"));
    const result = await adapter.send({ to: "x@example.uz", subject: "s", html: "<p>h</p>", text: "h" });
    expect(result).toEqual({ ok: false, errorMessage: "mailbox full" });
  });

  it("reuses the same transporter across sends instead of reconnecting each time", async () => {
    await adapter.send({ to: "a@example.uz", subject: "s", html: "<p>h</p>", text: "h" });
    await adapter.send({ to: "b@example.uz", subject: "s", html: "<p>h</p>", text: "h" });
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });
});
