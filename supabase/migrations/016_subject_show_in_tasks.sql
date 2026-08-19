-- Tableau Tasks : opt-in par sujet, partagé entre tous les membres du labo.
-- Nouveaux sujets : masqués par défaut, un membre les ajoute au tableau via le "+".
alter table subjects
  add column show_in_tasks boolean not null default false;

-- Préserver l'existant : les sujets qui ont déjà des tâches restent affichés
-- (pas de vidage silencieux d'un tableau en cours d'usage).
update subjects set show_in_tasks = true
where id in (select distinct sujet_id from tasks);
