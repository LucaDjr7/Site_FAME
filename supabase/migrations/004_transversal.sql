-- Vague 1 — feature « sujets transversaux ».
-- Additive, réversible, défaut false (comportement actuel préservé).
-- Un sujet/prompt transversal est VISIBLE dans les deux labos (visibilité, pas droits).
-- publications : aucune colonne — toujours partagées (le filtre labo est retiré au listing).

ALTER TABLE subjects ADD COLUMN is_transversal boolean NOT NULL DEFAULT false;
ALTER TABLE prompts  ADD COLUMN is_transversal boolean NOT NULL DEFAULT false;
