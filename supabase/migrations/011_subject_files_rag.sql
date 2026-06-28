-- Autoriser le type 'subject_file' dans rag_chunks.
alter table rag_chunks drop constraint rag_chunks_source_type_check;
alter table rag_chunks add constraint rag_chunks_source_type_check
  check (source_type in ('subject','task','publication','prompt','member','kb','subject_file'));

-- match_rag_chunks renvoie désormais metadata (pour les citations de documents).
drop function if exists match_rag_chunks(vector(1536), int, boolean);
create function match_rag_chunks(
  query_embedding vector(1536),
  match_count int,
  include_member boolean
)
returns table (
  id uuid, source_type text, source_id text, content text,
  labo text, lang text, metadata jsonb, similarity float
)
language sql stable as $$
  select
    c.id, c.source_type, c.source_id, c.content, c.labo, c.lang, c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from rag_chunks c
  where c.embedding is not null
    and (include_member or c.visibility = 'public')
  order by c.embedding <=> query_embedding
  limit match_count
$$;

-- Recherche vectorielle scopée aux documents d'UN sujet (génération assistée).
drop function if exists match_subject_files(vector(1536), text, int);
create function match_subject_files(
  query_embedding vector(1536),
  p_subject_id text,
  match_count int
)
returns table (
  id uuid, source_type text, source_id text, content text,
  labo text, lang text, metadata jsonb, similarity float
)
language sql stable as $$
  select
    c.id, c.source_type, c.source_id, c.content, c.labo, c.lang, c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from rag_chunks c
  where c.embedding is not null
    and c.source_type = 'subject_file'
    and c.metadata->>'subject_id' = p_subject_id
  order by c.embedding <=> query_embedding
  limit match_count
$$;
