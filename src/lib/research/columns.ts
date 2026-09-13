// src/lib/research/columns.ts
// Explicit column list for every `research_papers` read whose rows leave the
// server (RSC payload or JSON response). `select('*')` would also ship
// `embedding` — a 1536-float pgvector per row — to the client; the
// `ResearchPaper` type deliberately excludes it, and this list mirrors that type
// field for field.
export const RESEARCH_PAPER_COLUMNS =
  'id, fingerprint, title, authors, abstract, url, source, venue, themes, fame_score, published_at, status, manual_override, fetched_at, updated_at'
