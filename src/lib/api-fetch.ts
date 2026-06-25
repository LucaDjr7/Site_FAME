export async function apiFetch<T>(url: string, opts: RequestInit, onError: (msg: string) => void, errMsg: string): Promise<T | null> {
  try {
    const res = await fetch(url, opts)
    if (!res.ok) { onError(errMsg); return null }
    return (await res.json()) as T
  } catch { onError(errMsg); return null }
}
