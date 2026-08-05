import { Injectable, Logger } from "@nestjs/common";
import type { InstagramViewCountResult, InstagramViewsPort } from "./instagram-views.port";

// Best-effort, not Instagram's API — there is no public API that returns a specific video's view
// count without the account owner OAuth-connecting a Business/Creator account through a Meta app
// that has passed App Review for `instagram_manage_insights` (see CompetitionParticipant's schema
// comment). This instead fetches the video's own public page — the same page a browser would load
// — and reads the view count already embedded in it for anyone who visits. A standard browser
// User-Agent is sent only because Instagram serves a stripped no-JS page to obvious non-browser
// clients; nothing here bypasses a login wall, a CAPTCHA, or rate limiting — if Instagram blocks or
// changes its markup, this simply reports failure (never fakes a number) and the admin falls back
// to typing the count in by hand, same as before this adapter existed.
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Instagram embeds the count in one of a few inline-JSON key names depending on post type (video
// post vs. reel) and which A/B page variant was served — checked in order, first match wins.
const VIEW_COUNT_PATTERNS = [/"play_count":(\d+)/, /"video_view_count":(\d+)/, /"video_play_count":(\d+)/];

@Injectable()
export class InstagramViewsScraperAdapter implements InstagramViewsPort {
  private readonly logger = new Logger(InstagramViewsScraperAdapter.name);

  async fetchViewCount(videoUrl: string): Promise<InstagramViewCountResult> {
    let parsed: URL;
    try {
      parsed = new URL(videoUrl);
    } catch {
      return { ok: false, errorMessage: "videoUrl to'g'ri havola emas." };
    }
    if (!/(^|\.)instagram\.com$/.test(parsed.hostname)) {
      return { ok: false, errorMessage: "Faqat instagram.com havolalari qo'llab-quvvatlanadi." };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(videoUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false, errorMessage: `Instagram sahifasi ochilmadi (HTTP ${res.status}).` };
      }
      const html = await res.text();
      for (const pattern of VIEW_COUNT_PATTERNS) {
        const match = pattern.exec(html);
        if (match?.[1]) {
          return { ok: true, viewCount: Number(match[1]) };
        }
      }
      return { ok: false, errorMessage: "Ko'rishlar soni topilmadi — Instagram sahifa tuzilishini o'zgartirgan bo'lishi mumkin." };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Noma'lum xatolik";
      this.logger.warn(`Instagram view-count fetch failed for ${videoUrl}: ${message}`);
      return { ok: false, errorMessage: "Instagram'ga ulanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring." };
    } finally {
      clearTimeout(timeout);
    }
  }
}
