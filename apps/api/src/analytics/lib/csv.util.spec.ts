import { toCsv } from "./csv.util";

describe("toCsv", () => {
  it("returns an empty string for an empty row set", () => {
    expect(toCsv([])).toBe("");
  });

  it("writes a header row from the first row's keys, then one row per item", () => {
    const result = toCsv([
      { name: "Malika", revenueMinor: 100 },
      { name: "Aziz", revenueMinor: 200 },
    ]);
    expect(result).toBe("name,revenueMinor\nMalika,100\nAziz,200");
  });

  it("quotes a value containing a comma", () => {
    expect(toCsv([{ note: "a, b" }])).toBe('note\n"a, b"');
  });

  it("quotes and doubles internal quotes", () => {
    expect(toCsv([{ note: 'say "hi"' }])).toBe('note\n"say ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    expect(toCsv([{ note: "line1\nline2" }])).toBe('note\n"line1\nline2"');
  });

  it("renders null/undefined as an empty cell", () => {
    expect(toCsv([{ a: null, b: undefined }])).toBe("a,b\n,");
  });

  it("renders a Date as ISO 8601", () => {
    const d = new Date("2026-01-15T00:00:00.000Z");
    expect(toCsv([{ createdAt: d }])).toBe(`createdAt\n${d.toISOString()}`);
  });

  it("JSON-stringifies a plain object value rather than '[object Object]'", () => {
    expect(toCsv([{ meta: { view: "executive" } }])).toBe('meta\n"{""view"":""executive""}"');
  });
});
