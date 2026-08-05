// Boundary for "how do we learn a public Instagram video's view count" — same Port/Adapter
// convention as TelegramPort/EmailPort/PaymentPort. The only implementation today
// (InstagramViewsScraperAdapter) is a best-effort HTML fetch, not Instagram's own API — see that
// file's own comment for why. Swapping to the real Graph API later (once a creator OAuth flow +
// Meta App Review exist) means one new adapter class, no change to CompetitionsService.
export const INSTAGRAM_VIEWS_PORT = Symbol("INSTAGRAM_VIEWS_PORT");

export interface InstagramViewCountResult {
  ok: boolean;
  viewCount?: number;
  errorMessage?: string;
}

export interface InstagramViewsPort {
  fetchViewCount(videoUrl: string): Promise<InstagramViewCountResult>;
}
