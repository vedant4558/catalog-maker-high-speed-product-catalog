import { SourceError } from "./types";

export interface HttpOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * JSON GET with timeout and retry. Retries network errors, 429 and 5xx with exponential
 * backoff (honouring Retry-After). Anything else (401/403/404...) fails immediately.
 */
export async function getJson<T>(url: string, opts: HttpOptions = {}): Promise<{ data: T; headers: Headers }> {
  const { headers = {}, timeoutMs = 20_000, retries = 3 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: ctrl.signal, cache: "no-store" });
      if (res.ok) {
        try {
          return { data: (await res.json()) as T, headers: res.headers };
        } catch {
          throw new SourceError("Source returned invalid JSON.", res.status, false);
        }
      }
      const retryable = res.status === 429 || res.status >= 500;
      const err = new SourceError(`Source responded with HTTP ${res.status}${res.status === 401 || res.status === 403 ? " (check credentials)" : ""}.`, res.status, retryable);
      if (!retryable || attempt === retries) throw err;
      const ra = Number(res.headers.get("retry-after"));
      lastErr = err;
      await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 15_000) : 500 * 2 ** attempt);
    } catch (e) {
      if (e instanceof SourceError && !e.retryable) throw e;
      lastErr = e instanceof SourceError ? e : new SourceError(e instanceof Error && e.name === "AbortError" ? "Source request timed out." : `Could not reach source: ${(e as Error).message}`, undefined, true);
      if (attempt === retries) throw lastErr;
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}
