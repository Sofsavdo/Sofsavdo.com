import { InstagramViewsScraperAdapter } from "./instagram-views-scraper.adapter";

describe("InstagramViewsScraperAdapter", () => {
  let adapter: InstagramViewsScraperAdapter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new InstagramViewsScraperAdapter();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("rejects a non-instagram.com URL without making a request", async () => {
    const result = await adapter.fetchViewCount("https://example.com/reel/x");
    expect(result.ok).toBe(false);
  });

  it("rejects an unparseable URL", async () => {
    const result = await adapter.fetchViewCount("not a url");
    expect(result.ok).toBe(false);
  });

  it("extracts the view count from the page's embedded play_count", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('...garbage..."play_count":54321,"more":1...') });
    const result = await adapter.fetchViewCount("https://www.instagram.com/reel/abc123/");
    expect(result).toEqual({ ok: true, viewCount: 54321 });
  });

  it("falls back to video_view_count when play_count isn't present", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('..."video_view_count":777...') });
    const result = await adapter.fetchViewCount("https://www.instagram.com/reel/abc123/");
    expect(result).toEqual({ ok: true, viewCount: 777 });
  });

  it("fails loudly (never fakes success) when no known count pattern is found", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve("<html>nothing useful here</html>") });
    const result = await adapter.fetchViewCount("https://www.instagram.com/reel/abc123/");
    expect(result.ok).toBe(false);
  });

  it("surfaces a non-2xx HTTP status as a failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve("") });
    const result = await adapter.fetchViewCount("https://www.instagram.com/reel/abc123/");
    expect(result.ok).toBe(false);
  });

  it("catches a network error rather than throwing", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    const result = await adapter.fetchViewCount("https://www.instagram.com/reel/abc123/");
    expect(result.ok).toBe(false);
  });
});
