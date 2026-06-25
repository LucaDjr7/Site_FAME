-- Recherche vectorielle + FILTRE DE PERMISSIONS (frontière de sécurité).
-- include_member = false (visiteur) ⇒ seulement visibility='public'.
-- include_member = true  (membre)  ⇒ tout (public + member, incl. confidentiel).
create or replace function match_rag_chunks(
  query_embedding vector(1536),
  match_count int,
  include_member boolean
)
returns table (
  id uuid,
  source_type text,
  source_id text,
  content text,
  labo text,
  lang text,
  similarity float
)
language sql
stable
as $$
  select
    c.id, c.source_type, c.source_id, c.content, c.labo, c.lang,
    1 - (c.embedding <=> query_embedding) as similarity
  from rag_chunks c
  where c.embedding is not null
    and (include_member or c.visibility = 'public')
  order by c.embedding <=> query_embedding
  limit match_count
$$;
