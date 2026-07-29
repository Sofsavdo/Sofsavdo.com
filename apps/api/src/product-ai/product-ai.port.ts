// Provider-agnostic port for the AI Product Creation Engine — the exact same shape this codebase
// already uses for PaymentPort/StoragePort (one interface, one real implementation registered by
// the module, callers depend only on the interface). See DECISIONS.md ADR-028.

export interface ProductAiDraftInput {
  // Already-uploaded image URLs (e.g. from an existing Product's `images` field, or pasted by the
  // admin) — this engine drafts copy from what's already hosted, it does not add new upload
  // plumbing of its own. At least one of imageUrls/shortDescription must be given (see
  // GenerateProductDraftDto's class-validator rule).
  imageUrls: string[];
  productName?: string;
  shortDescription?: string;
}

export interface ProductAiFaqItem {
  question: string;
  answer: string;
}

// Every field an admin might want pre-filled across the Product/Offer/LandingSection forms this
// engine is meant to feed (see the Product Launch Wizard integration) — always a draft to review
// and edit, never auto-saved (see ADR-028's "review-before-save is mandatory" decision).
export interface ProductAiDraft {
  title: string;
  shortDescription: string;
  description: string;
  features: string[];
  benefits: string[];
  specs: Record<string, string>;
  usageInstructions: string;
  ctaLabel: string;
  marketingCopy: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  faq: ProductAiFaqItem[];
  highlights: string[];
  tags: string[];
}

export const PRODUCT_AI_PORT = Symbol("PRODUCT_AI_PORT");

export interface ProductAiPort {
  generateDraft(input: ProductAiDraftInput): Promise<ProductAiDraft>;
}
