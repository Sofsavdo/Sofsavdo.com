// Real HTTP client for apps/api — the counterpart to mocks/store.ts. Both are consumed through
// the same seam (lib/api/admin.ts re-exports one or the other based on NEXT_PUBLIC_API_MODE), so
// call sites (services/*.ts, components) never know or care which one is active.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// The access token lives in memory only (never localStorage/sessionStorage) — see
// DECISIONS.md ADR-008. It's lost on a full page reload by design; `bootstrapSession()` recovers
// it via the refresh cookie the browser still holds.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Same {code, message} shape as MockApiError so every existing call site
// (`(error as ApiError).message`, form error rendering, etc.) works unchanged regardless of
// which mode is active.
export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  requestId?: string;

  constructor(code: string, message: string, statusCode: number, details?: Record<string, unknown>, requestId?: string) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  // Internal: prevents infinite refresh loops if the refresh call itself ever hit this function.
  skipRefreshOnAuthError?: boolean;
  // Public endpoints (e.g., /offers/:slug/public) should not send auth token even if one exists
  skipAuth?: boolean;
}

async function rawRequest<T>(path: string, options: RequestOptions): Promise<T> {
  // FormData (file uploads — see campaign-media admin functions) must NOT get a manual
  // Content-Type: the browser sets `multipart/form-data; boundary=...` itself, and JSON.stringify
  // would just serialize the FormData object into garbage.
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include", // sends the HttpOnly refresh cookie on same-site requests
    headers: {
      ...(options.body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(accessToken && !options.skipAuth ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body === undefined ? undefined : isFormData ? (options.body as FormData) : JSON.stringify(options.body),
  });

  if (res.status === 204) return undefined as T;

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new ApiError(
      typeof json.code === "string" ? json.code : "ERROR",
      typeof json.message === "string" ? json.message : "So'rovni bajarib bo'lmadi.",
      res.status,
      json.details as Record<string, unknown> | undefined,
      typeof json.requestId === "string" ? json.requestId : undefined,
    );
  }

  return json as T;
}

// One retry, exactly once, on a 401 — matches TokenService's rotation model (see
// apps/api/src/auth/token.service.ts): the refresh cookie is single-use per rotation, so a loop
// here would just burn through the token family for no benefit, not actually recover.
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    if (options.skipRefreshOnAuthError || !(err instanceof ApiError) || err.statusCode !== 401) {
      throw err;
    }
    try {
      const refreshed = await rawRequest<{ accessToken: string }>("/auth/refresh", {
        method: "POST",
        skipRefreshOnAuthError: true,
      });
      setAccessToken(refreshed.accessToken);
    } catch {
      setAccessToken(null);
      throw err; // surface the ORIGINAL 401, not the refresh failure
    }
    return rawRequest<T>(path, options);
  }
}
