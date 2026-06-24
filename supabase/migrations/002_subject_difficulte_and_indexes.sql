-- Task 9: add per-subject difficulty + Part-2 carry-forward indexes.
alter table subjects
  add column if not exists difficulte text not null default 'intermediate'
    check (difficulte in ('easy','intermediate','advanced'));

-- Deferred indexes from Part 1 final review (reverse-lookup perf).
create index if not exists idx_task_subjects_subject on task_subjects(subject_id);
create index if not exists idx_dropbox_links_task on dropbox_links(task_id);
