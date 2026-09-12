// src/lib/research/sources/fetch-utils.ts
// Shared HTTP retry: exponential backoff on 429/5xx, gives up after 3 attempts.
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  sourceName: string,
  attempt = 1
): Promise<Response> {
  const res = await fetch(url, init)

  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 3) throw new Error(`[${sourceName}] HTTP ${res.status} after 3 attempts`)
    const delay = Math.pow(2, attempt) * 1000
    await new Promise((r) => setTimeout(r, delay))
    return fetchWithRetry(url, init, sourceName, attempt + 1)
  }

  return res
}
