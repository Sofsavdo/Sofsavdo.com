import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { DomainException } from "../common/errors/domain-error";
import type { ProductAiDraft, ProductAiDraftInput, ProductAiPort } from "./product-ai.port";

const DRAFT_TOOL_NAME = "submit_product_draft";

// One tool with a strict input_schema, tool_choice forced to it — the standard reliable technique
// for structured JSON output from Claude, rather than asking for JSON in prose and hoping the
// model doesn't wrap it in markdown fences or commentary.
const DRAFT_TOOL_SCHEMA = {
  name: DRAFT_TOOL_NAME,
  description: "Submit the structured product draft. Every field is required — use an empty string/array/object if genuinely nothing applies, never omit a field.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Buyer-facing product title, concise." },
      shortDescription: { type: "string", description: "One or two sentences, for a card/teaser." },
      description: { type: "string", description: "Full buyer-facing description, several paragraphs." },
      features: { type: "array", items: { type: "string" }, description: "Concrete factual features." },
      benefits: { type: "array", items: { type: "string" }, description: "Buyer-facing benefit statements (why it matters, not what it is)." },
      specs: { type: "object", additionalProperties: { type: "string" }, description: "Key-value technical specs, e.g. {\"Material\": \"Cotton\"}." },
      usageInstructions: { type: "string", description: "How to use/care for the product." },
      ctaLabel: { type: "string", description: "Short call-to-action button label." },
      marketingCopy: { type: "string", description: "Punchy promotional copy, e.g. for an ad or banner." },
      seoTitle: { type: "string", description: "Under 60 characters." },
      seoDescription: { type: "string", description: "Under 160 characters." },
      seoKeywords: { type: "array", items: { type: "string" } },
      faq: {
        type: "array",
        items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" } }, required: ["question", "answer"] },
      },
      highlights: { type: "array", items: { type: "string" }, description: "Short badge-style highlights, e.g. \"Bestseller\", \"Fast shipping\"." },
      tags: { type: "array", items: { type: "string" } },
    },
    required: [
      "title",
      "shortDescription",
      "description",
      "features",
      "benefits",
      "specs",
      "usageInstructions",
      "ctaLabel",
      "marketingCopy",
      "seoTitle",
      "seoDescription",
      "seoKeywords",
      "faq",
      "highlights",
      "tags",
    ],
  },
};

const SYSTEM_PROMPT =
  "You are a product copywriting assistant for an e-commerce platform. Given product photos and/or a short " +
  "description, draft complete, honest, factual product listing copy in the same language as any text input " +
  "given (default to Uzbek if no text is given). Never invent specific factual claims (exact measurements, " +
  "certifications, materials) you cannot see in the images or infer from the description — describe what is " +
  "visible/stated instead of guessing specifics. This is always a draft an editor will review before " +
  "publishing, never published verbatim.";

@Injectable()
export class ClaudeProductAiAdapter implements ProductAiPort {
  private client: Anthropic | null;
  private model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>("productAi.anthropicApiKey", "");
    this.model = config.get<string>("productAi.model", "claude-sonnet-5");
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  async generateDraft(input: ProductAiDraftInput): Promise<ProductAiDraft> {
    if (!this.client) {
      throw new DomainException("AI_NOT_CONFIGURED", "AI Product Creation Engine sozlanmagan (ANTHROPIC_API_KEY yo'q).");
    }

    const textParts: string[] = [];
    if (input.productName) textParts.push(`Product name: ${input.productName}`);
    if (input.shortDescription) textParts.push(`Notes from the admin: ${input.shortDescription}`);
    textParts.push("Draft the full product listing using the submit_product_draft tool.");

    const content: Anthropic.Messages.ContentBlockParam[] = [
      ...input.imageUrls.map(
        (url): Anthropic.Messages.ImageBlockParam => ({ type: "image", source: { type: "url", url } }),
      ),
      { type: "text", text: textParts.join("\n\n") },
    ];

    let response: Anthropic.Messages.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
        tools: [DRAFT_TOOL_SCHEMA],
        tool_choice: { type: "tool", name: DRAFT_TOOL_NAME },
      });
    } catch (err) {
      throw new DomainException("AI_GENERATION_FAILED", `AI qoralama yaratishda xatolik: ${err instanceof Error ? err.message : "Noma'lum xatolik"}`);
    }

    const toolUse = response.content.find((block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use" && block.name === DRAFT_TOOL_NAME);
    if (!toolUse) {
      throw new DomainException("AI_GENERATION_FAILED", "AI kutilgan formatda javob qaytarmadi.");
    }
    return toolUse.input as ProductAiDraft;
  }
}
