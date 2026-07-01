-- Visibilité par document, indépendante du sujet.
-- Nouveaux docs : confidentiels par défaut (fail-closed).
alter table subject_files
  add column confidentiel boolean not null default true;

-- Préserver l'existant : les docs déjà déposés gardent leur visibilité actuelle
-- (publics sur fiche publique) — pas de masquage rétroactif.
update subject_files set confidentiel = false;
