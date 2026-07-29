import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ClaudeProductAiAdapter } from "./claude-product-ai.adapter";
import { DomainException } from "../common/errors/domain-error";

const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
}));

describe("ClaudeProductAiAdapter", () => {
  async function build(apiKey: string): Promise<ClaudeProductAiAdapter> {
    const config = { get: (key: string, fallback?: unknown) => (key === "productAi.anthropicApiKey" ? apiKey : (fallback ?? "claude-sonnet-5")) };
    const moduleRef = await Test.createTestingModule({
      providers: [ClaudeProductAiAdapter, { provide: ConfigService, useValue: config }],
    }).compile();
    return moduleRef.get(ClaudeProductAiAdapter);
  }

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("throws AI_NOT_CONFIGURED when no API key is set — never crashes at boot, fails per-call", async () => {
    const adapter = await build("");
    await expect(adapter.generateDraft({ imageUrls: [], shortDescription: "test" })).rejects.toThrow(DomainException);
    await expect(adapter.generateDraft({ imageUrls: [], shortDescription: "test" })).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
  });

  it("forces structured output via tool_choice and returns the tool_use input as the draft", async () => {
    const draft = {
      title: "Test",
      shortDescription: "sd",
      description: "d",
      features: [],
      benefits: [],
      specs: {},
      usageInstructions: "",
      ctaLabel: "",
      marketingCopy: "",
      seoTitle: "",
      seoDescription: "",
      seoKeywords: [],
      faq: [],
      highlights: [],
      tags: [],
    };
    mockCreate.mockResolvedValue({ content: [{ type: "tool_use", name: "submit_product_draft", input: draft }] });

    const adapter = await build("sk-test");
    const result = await adapter.generateDraft({ imageUrls: ["https://example.com/photo.jpg"], productName: "Chair" });

    expect(result).toEqual(draft);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.tool_choice).toEqual({ type: "tool", name: "submit_product_draft" });
    expect(callArgs.messages[0].content[0]).toEqual({ type: "image", source: { type: "url", url: "https://example.com/photo.jpg" } });
  });

  it("throws AI_GENERATION_FAILED when the response has no tool_use block", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "I refuse to use tools." }] });
    const adapter = await build("sk-test");
    await expect(adapter.generateDraft({ imageUrls: [], shortDescription: "x" })).rejects.toMatchObject({ code: "AI_GENERATION_FAILED" });
  });

  it("throws AI_GENERATION_FAILED when the API call itself rejects", async () => {
    mockCreate.mockRejectedValue(new Error("rate limited"));
    const adapter = await build("sk-test");
    await expect(adapter.generateDraft({ imageUrls: [], shortDescription: "x" })).rejects.toMatchObject({ code: "AI_GENERATION_FAILED" });
  });
});
