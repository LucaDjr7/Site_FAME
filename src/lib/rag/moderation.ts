interface ModerationResult {
  results: { flagged: boolean; categories: Record<string, boolean> }[]
}

export async function moderateInput(
  text: string,
  deps: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ flagged: boolean; categories?: string[] }> {
  const apiKey = deps.apiKey ?? process.env.OPENAI_API_KEY
  const doFetch = deps.fetchImpl ?? fetch
  if (!apiKey) return { flagged: false }
  try {
    const res = await doFetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
    })
    // Fail-open volontaire (ne pas casser l'assistant si l'API modération hoquette),
    // mais on journalise pour détecter une désactivation silencieuse prolongée.
    if (!res.ok) { console.warn('moderation: OpenAI non-ok', res.status); return { flagged: false } }
    const json = (await res.json()) as ModerationResult
    const r = json.results[0]
    if (!r) return { flagged: false }
    const categories = Object.entries(r.categories).filter(([, v]) => v).map(([k]) => k)
    return { flagged: r.flagged, categories }
  } catch (e) {
    console.warn('moderation: échec appel', e instanceof Error ? e.message : e)
    return { flagged: false }
  }
}
