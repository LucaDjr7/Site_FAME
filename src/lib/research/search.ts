// src/lib/research/search.ts
// The public /research page builds a PostgREST `.or()` filter from the raw `q`
// query param:
//     query.or(`title.ilike.%${q}%,abstract.ilike.%${q}%`)
// `.or()` takes a mini-language string, so a `q` containing `,` `.` `(` `)` or
// a quote re-partitions that string into different filters, and `%` `_` `*` `\`
// are wildcards/escapes for `ilike`. None of them is a security hole here (the
// `status = 'published'` term is a separate AND clause and cannot be escaped),
// but they produce wrong results or a 400 from PostgREST.
//
// None of these characters carries meaning in a free-text title/abstract search,
// so stripping is both simplest and lossless in practice.
const UNSAFE_IN_OR_FILTER = /[,.()%_*\\"']/g

export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(UNSAFE_IN_OR_FILTER, ' ').replace(/\s+/g, ' ').trim()
}
