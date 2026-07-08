import type { Chapter } from './types'

export const BASE_LAB = 'paris'

// NB Task 5 : les sélecteurs marqués [VERIFY] sont à valider contre le DOM réel
// (composants indiqués en commentaire) lors du dry-run. Corriger le sélecteur,
// jamais la structure des beats.
export const CHAPTERS: Chapter[] = [
  {
    id: 'welcome',
    beats: [
      { line: 'welcome.1', actions: [{ kind: 'goto', path: '/{locale}' }] },
      // Globe.tsx / LabPin.tsx — le pin Paris navigue vers /{locale}/paris  [VERIFY]
      { line: 'welcome.2', actions: [{ kind: 'pause', ms: 1200 }, { kind: 'click', selector: 'text=Paris' }] },
    ],
  },
  {
    id: 'tour',
    beats: [
      { line: 'tour.grid', actions: [{ kind: 'goto', path: '/{locale}/paris' }] },
      // SubjectVitrine — cartes de la grille ; cliquer la 1re carte démo  [VERIFY]
      { line: 'tour.paper', actions: [{ kind: 'click', selector: 'text=Sentiment des annonces' }] },
      { line: 'tour.tasks', actions: [{ kind: 'goto', path: '/{locale}/paris/tasks' }] },
      { line: 'tour.publications', actions: [{ kind: 'goto', path: '/{locale}/paris/publications' }] },
      { line: 'tour.team', actions: [{ kind: 'goto', path: '/{locale}/paris/team' }] },
      { line: 'tour.data', actions: [{ kind: 'goto', path: '/{locale}/paris/data' }] },
      { line: 'tour.prompts', actions: [{ kind: 'goto', path: '/{locale}/paris/prompts' }] },
      { line: 'tour.graph', actions: [{ kind: 'goto', path: '/{locale}/graph' }, { kind: 'pause', ms: 1500 }] },
      // ChatBubble (bas de page) puis ChatPanel  [VERIFY]
      { line: 'tour.astra', actions: [{ kind: 'goto', path: '/{locale}/paris' }, { kind: 'click', selector: 'button[aria-label*="Astra"], button[title*="assistant" i]' }] },
    ],
  },
  {
    id: 'subject',
    beats: [
      // EditModeToggle (crayon) puis carte pointillée d'ajout — SubjectGrid  [VERIFY]
      { line: 'subject.create', actions: [{ kind: 'goto', path: '/{locale}/paris' }, { kind: 'click', selector: '[aria-label*="édition" i], [aria-label*="edit" i]' }] },
      { line: 'subject.fill', actions: [{ kind: 'click', selector: 'text=Sentiment des annonces' }, { kind: 'pause', ms: 800 }] },
      // Bouton ✨ d'un champ — VitrineEditor / PaperSheet en mode édition  [VERIFY]
      { line: 'subject.assist', actions: [{ kind: 'hover', selector: 'text=✨' }] },
      { line: 'subject.i18n', actions: [{ kind: 'pause', ms: 500 }] },
      // RelationsPanel — bouton « créer une fiche fille »  [VERIFY]
      { line: 'subject.child', actions: [{ kind: 'scroll', y: 600 }] },
      { line: 'subject.status', actions: [{ kind: 'scroll', y: 0 }] },
      // Fiche démo confidentielle S_PRIV — montrer le badge/cadenas  [VERIFY]
      { line: 'subject.confidential', actions: [{ kind: 'goto', path: '/{locale}/paris' }, { kind: 'hover', selector: 'text=Signal propriétaire' }] },
    ],
  },
  {
    id: 'daily',
    beats: [
      { line: 'daily.task', actions: [{ kind: 'goto', path: '/{locale}/paris/tasks' }] },
      // TaskCard « Baseline de sentiment » → TaskModal → bouton claim  [VERIFY]
      { line: 'daily.claim', actions: [{ kind: 'click', selector: 'text=Baseline de sentiment' }] },
      // SubtaskList dans TaskModal de « Constituer le corpus »  [VERIFY]
      { line: 'daily.subtasks', actions: [{ kind: 'pause', ms: 500 }] },
      { line: 'daily.comments', actions: [{ kind: 'goto', path: '/{locale}/paris' }, { kind: 'click', selector: 'text=Sentiment des annonces' }, { kind: 'scroll', y: 900 }] },
      // FilesPanel — section fichiers déposés  [VERIFY]
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
