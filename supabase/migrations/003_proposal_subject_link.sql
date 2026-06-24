-- Migration 003: link a converted proposal to the subject it produced.
-- Enables idempotent convert: if subject_id is already set, skip re-insertion.
-- ON DELETE SET NULL so deleting a subject doesn't orphan or break the proposal row.
alter table proposals
  add column if not exists subject_id uuid references subjects(id) on delete set null;
