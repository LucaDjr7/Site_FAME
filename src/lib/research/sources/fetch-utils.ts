// src/lib/research/sources/fetch-utils.ts
// Shared HTTP retry: exponential backoff on 429/5xx, gives up after 3 attempts.
//
// `minDelayMs` floors that backoff to a source's own documented rate-limit
// interval (e.g. arXiv's 3.1s — see sources/arxiv.ts). Without it, the
// default backoff's first retry (2s) fires *faster* than arXiv's required
// spacing: a query that trips one 429 — possibly just shared-IP noise on a
// serverless platform, nothing this pipeline's own pacing controls — then
// retries too soon, is likely to trip another, and the exponential schedule
// never catches up within 3 attempts. Confirmed in a live prod run
// (2026-09-13): half of a batch of arXiv queries exhausted all 3 attempts
// despite the inter-query pacing fix being in place and working correctly.
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  sourceName: string,
  attempt = 1,
  minDelayMs = 0
): Promise<Response> {
  const res = await fetch(url, init)

  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 3) throw new Error(`[${sourceName}] HTTP ${res.status} after 3 attempts`)
    const delay = Math.max(Math.pow(2, attempt) * 1000, minDelayMs)
    await new Promise((r) => setTimeout(r, delay))
    return fetchWithRetry(url, init, sourceName, attempt + 1, minDelayMs)
  }

  return res
}
