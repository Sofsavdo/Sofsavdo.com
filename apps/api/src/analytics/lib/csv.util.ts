// Minimal CSV serialization — no new dependency needed (§15 of ANALYTICS.md: CSV was already
// achievable with a plain string-join before this phase; Excel/PDF are the ones that need a new
// library, and both are deferred). Handles the one real escaping case (values containing a comma,
// quote, or newline get wrapped in quotes with internal quotes doubled).
function stringifyCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return value.toString();
  return JSON.stringify(value);
}

function escapeCsvValue(value: unknown): string {
  const str = stringifyCsvValue(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const lines = [headers.join(","), ...rows.map((row) => headers.map((h) => escapeCsvValue(row[h])).join(","))];
  return lines.join("\n");
}
