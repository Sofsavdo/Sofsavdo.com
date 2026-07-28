import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { TelegramBotAdapter } from "./telegram-bot.adapter";

describe("TelegramBotAdapter", () => {
  let adapter: TelegramBotAdapter;
  let botToken: string;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    botToken = "test-token";
    const moduleRef = await Test.createTestingModule({
      providers: [TelegramBotAdapter, { provide: ConfigService, useValue: { get: () => botToken } }],
    }).compile();
    adapter = moduleRef.get(TelegramBotAdapter);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fails loudly (never fakes success) when TELEGRAM_BOT_TOKEN is unconfigured", async () => {
    botToken = "";
    const result = await adapter.send({ chatId: "123", html: "hi" });
    expect(result).toEqual({ ok: false, errorMessage: expect.stringContaining("TELEGRAM_BOT_TOKEN") });
  });

  it("returns ok:true on a successful Bot API response", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
    const result = await adapter.send({ chatId: "123", html: "hi" });
    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("test-token"), expect.objectContaining({ method: "POST" }));
  });

  it("surfaces the Bot API's own error description on a rejected send", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ ok: false, description: "chat not found" }) });
    const result = await adapter.send({ chatId: "999", html: "hi" });
    expect(result).toEqual({ ok: false, errorMessage: "chat not found" });
  });

  it("catches a network error rather than throwing", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    const result = await adapter.send({ chatId: "123", html: "hi" });
    expect(result).toEqual({ ok: false, errorMessage: "network down" });
  });
});
