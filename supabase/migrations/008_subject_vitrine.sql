-- Vague vitrine — fiche sujet éditable.
-- Additif, réversible, défauts '' (sujets existants restent valides).
ALTER TABLE subjects ADD COLUMN question text NOT NULL DEFAULT '';
ALTER TABLE subjects ADD COLUMN accroche text NOT NULL DEFAULT '';
ALTER TABLE subjects ADD COLUMN periode  text NOT NULL DEFAULT '';
