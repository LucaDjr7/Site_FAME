import type { Chapter } from './types'

export const BASE_LAB = 'paris'

// Ids fixes du seed démo (src/scripts/seed-demo-data.ts) — stables, indépendants
// de la locale ; utilisés pour scoper des sélecteurs sur une carte précise sans
// dépendre d'un texte traduit.
const S_EARN = 'de300002-0000-4000-8000-000000000001' // "Sentiment des annonces de résultats"
const S_PRIV = 'de300002-0000-4000-8000-000000000004' // "Signal propriétaire — calibration"

// NB Task 5 : les sélecteurs marqués [VERIFY] sont à valider contre le DOM réel
// (composants indiqués en commentaire) lors du dry-run. Corriger le sélecteur,
// jamais la structure des beats.
export const CHAPTERS: Chapter[] = [
  {
    id: 'welcome',
    beats: [
      { line: 'welcome.1', actions: [{ kind: 'goto', path: '/{locale}' }] },
      // Globe.tsx / LabPin.tsx — le pin Paris navigue vers /{locale}/paris.
      // button[aria-label="Paris"] (pas "text=Paris" : le header au-dessus du
      // globe affiche déjà la tagline "Paris · Montréal"/"Paris · Montreal",
      // qui matcherait en premier et n'est pas cliquable). Le pin n'est
      // cliquable (pointer-events) que lorsque le globe l'a fait apparaître
      // dans l'hémisphère visible ; Playwright réessaie le clic jusqu'à ce que
      // ce soit le cas (auto-wait), la pause laisse le temps à la rotation
      // initiale de s'installer.
      { line: 'welcome.2', actions: [{ kind: 'pause', ms: 1200 }, { kind: 'click', selector: 'button[aria-label="Paris"]' }] },
    ],
  },
  {
    id: 'tour',
    beats: [
      { line: 'tour.grid', actions: [{ kind: 'goto', path: '/{locale}/paris' }] },
      // SubjectVitrine — cartes de la grille ; cliquer la fiche démo « Sentiment
      // des annonces de résultats ». data-subject-id (posé par SubjectGrid) plutôt
      // qu'un texte : le titre/la question affichés diffèrent entre FR et EN.
      { line: 'tour.paper', actions: [{ kind: 'click', selector: `[data-subject-id="${S_EARN}"]` }] },
      { line: 'tour.tasks', actions: [{ kind: 'goto', path: '/{locale}/paris/tasks' }] },
      { line: 'tour.publications', actions: [{ kind: 'goto', path: '/{locale}/paris/publications' }] },
      { line: 'tour.team', actions: [{ kind: 'goto', path: '/{locale}/paris/team' }] },
      { line: 'tour.data', actions: [{ kind: 'goto', path: '/{locale}/paris/data' }] },
      { line: 'tour.prompts', actions: [{ kind: 'goto', path: '/{locale}/paris/prompts' }] },
      { line: 'tour.graph', actions: [{ kind: 'goto', path: '/{locale}/graph' }, { kind: 'pause', ms: 1500 }] },
      // ChatBubble (bas de page) — aria-label = "Ask Astra" / "Demander à Astra",
      // "Astra" est commun aux deux locales.
      { line: 'tour.astra', actions: [{ kind: 'goto', path: '/{locale}/paris' }, { kind: 'click', selector: 'button[aria-label*="Astra"], button[title*="assistant" i]' }] },
    ],
  },
  {
    id: 'subject',
    beats: [
      // SubjectGrid — bouton bascule (texte "Mode édition" / "Edit mode", sans
      // aria-label) puis carte pointillée d'ajout en fin de grille.
      { line: 'subject.create', actions: [{ kind: 'goto', path: '/{locale}/paris' }, { kind: 'click', selector: 'text=/Mode édition|Edit mode/i' }] },
      // En mode édition le clic sur la carte n'ouvre plus l'éditeur (onCardClick
      // désactivé) : il faut le petit bouton crayon (✎, aria-label "Modifier la
      // fiche sujet" / "Edit subject sheet") scopé à la carte S_EARN.
      { line: 'subject.fill', actions: [{ kind: 'click', selector: `[data-subject-id="${S_EARN}"] button[aria-label*="Modifier"], [data-subject-id="${S_EARN}"] button[aria-label*="Edit subject"]` }, { kind: 'pause', ms: 800 }] },
      // Bouton ✨ d'un champ — VitrineEditor (premier champ : la question).
      { line: 'subject.assist', actions: [{ kind: 'hover', selector: 'text=✨' }] },
      { line: 'subject.i18n', actions: [{ kind: 'pause', ms: 500 }] },
      // Le bouton « créer une fiche fille » et le RelationsPanel vivent sur la
      // page Paper (PaperView.tsx), pas dans VitrineEditor — navigation ajoutée
      // pour les montrer (structure des beats inchangée).
      { line: 'subject.child', actions: [{ kind: 'goto', path: `/{locale}/paris/paper/${S_EARN}` }, { kind: 'scroll', y: 300 }] },
      { line: 'subject.status', actions: [{ kind: 'scroll', y: 0 }] },
      // Fiche démo confidentielle S_PRIV — data-subject-id plutôt que le texte
      // (titre/question traduits) pour survoler la bonne carte dans les 2 locales.
      { line: 'subject.confidential', actions: [{ kind: 'goto', path: '/{locale}/paris' }, { kind: 'hover', selector: `[data-subject-id="${S_PRIV}"]` }] },
    ],
  },
  {
    id: 'daily',
    beats: [
      { line: 'daily.task', actions: [{ kind: 'goto', path: '/{locale}/paris/tasks' }] },
      // TaskCard « Constituer le corpus de communiqués » → TaskModal → bouton
      // claim. "corpus" est commun aux titres FR/EN ; c'est aussi la seule tâche
      // du seed avec des sous-tâches (nécessaire pour le beat suivant).
      { line: 'daily.claim', actions: [{ kind: 'click', selector: 'text=/corpus/i' }] },
      // SubtaskList dans le TaskModal de « Constituer le corpus » (toujours ouvert).
      { line: 'daily.subtasks', actions: [{ kind: 'pause', ms: 500 }] },
      { line: 'daily.comments', actions: [{ kind: 'goto', path: '/{locale}/paris' }, { kind: 'click', selector: `[data-subject-id="${S_EARN}"]` }, { kind: 'scroll', y: 900 }] },
      // FilesPanel — section fichiers déposés, colonne droite de PaperView.
      { line: 'daily.files', actions: [{ kind: 'scroll', y: 600 }] },
      { line: 'daily.filelock', actions: [{ kind: 'pause', ms: 500 }] },
      { line: 'daily.dropbox', actions: [{ kind: 'pause', ms: 500 }] },
    ],
  },
  {
    id: 'reflexes',
    // Chapitre « checklist » : l'écran reste sur la grille, la mascotte + les
    // cartes de la checklist portent le contenu (composition Task 7).
    beats: [
      { line: 'reflexes.intro', actions: [{ kind: 'goto', path: '/{locale}/paris' }] },
      { line: 'reflexes.1', actions: [] },
      { line: 'reflexes.2', actions: [] },
      { line: 'reflexes.3', actions: [] },
      { line: 'reflexes.4', actions: [{ kind: 'goto', path: '/{locale}/paris/propose' }] },
      { line: 'reflexes.5', actions: [] },
    ],
  },
  {
    id: 'outro',
    beats: [
      { line: 'outro.1', actions: [{ kind: 'goto', path: '/{locale}' }] },
    ],
  },
]
