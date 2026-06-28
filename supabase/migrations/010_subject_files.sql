-- Subject file uploads (complément des liens Dropbox).
create table subject_files (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  labo text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_subject_files_subject on subject_files(subject_id);
alter table subject_files enable row level security;
-- Aucune policy : tout l'accès passe par l'API service-role (comme dropbox_links).

-- Bucket privé pour les fichiers de sujets (50 Mo, liste blanche MIME).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subject-files', 'subject-files', false, 52428800,
  array[
    'application/pdf','image/png','image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv','text/plain'
  ]
)
on conflict (id) do nothing;
