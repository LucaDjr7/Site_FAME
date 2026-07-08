// Jeu de données DÉMO pour la vidéo d'onboarding — fictif, purgeable par id.
// Les UUIDs sont FIXES : ils sont la source de vérité de `seed:demo --purge`.

export const DEMO_MEMBER_EMAIL = 'demo-alice@fame-demo.local'

const M_ALICE = 'de300001-0000-4000-8000-000000000001'
const M_BADR  = 'de300001-0000-4000-8000-000000000002'
const S_EARN  = 'de300002-0000-4000-8000-000000000001'
const S_OSLO  = 'de300002-0000-4000-8000-000000000002'
const S_MEDIA = 'de300002-0000-4000-8000-000000000003'
const S_PRIV  = 'de300002-0000-4000-8000-000000000004'
const T_CORPUS = 'de300003-0000-4000-8000-000000000001'
const T_BASELINE = 'de300003-0000-4000-8000-000000000002'
const T_REVIEW = 'de300003-0000-4000-8000-000000000003'

export const DEMO = {
  members: [
    {
      id: M_ALICE, prenom: 'Alice', nom: 'Martin', email: DEMO_MEMBER_EMAIL,
      role: 'researcher', labo: 'paris', domaines: ['NLP', 'Finance'],
      is_admin: false, activated_at: new Date('2026-01-15').toISOString(),
    },
    {
      id: M_BADR, prenom: 'Badr', nom: 'Kaci', email: 'demo-badr@fame-demo.local',
      role: 'phd', labo: 'montreal', domaines: ['Économétrie'],
      is_admin: false, activated_at: new Date('2026-02-01').toISOString(),
    },
  ],
  subjects: [
    {
      id: S_EARN, labo: 'paris', titre: 'Sentiment des annonces de résultats',
      kicker: 'NLP · Euronext', statut: 'active',
      question: 'Le ton des annonces de résultats prédit-il la volatilité du lendemain ?',
      accroche: 'Lire entre les lignes des communiqués pour anticiper la réaction des marchés.',
      periode: '2025–2027',
      context: "Les annonces de résultats concentrent l'information mais leur ton est difficile à quantifier.",
      method: 'Extraction de sentiment par LLM sur les communiqués Euronext, régression sur la volatilité réalisée.',
      results: 'Premiers résultats : corrélation significative sur le segment Oslo.',
      keywords: ['sentiment', 'earnings', 'volatilité'],
      auteurs: [M_ALICE], difficulte: 'intermediate',
      dimensions: { method: 'LLM scoring', data: 'Communiqués 2019–2025', theory: 'Efficience semi-forte', writing: 'Article en cours' },
      ordre: 1, is_transversal: false, confidentiel: false, inherits: {},
      i18n: {
        fr: { titre: 'Sentiment des annonces de résultats' },
        en: {
          titre: 'Earnings announcement sentiment',
          question: 'Does the tone of earnings announcements predict next-day volatility?',
          accroche: 'Reading between the lines of press releases to anticipate market reactions.',
          context: 'Earnings announcements concentrate information, but their tone is hard to quantify.',
          method: 'LLM sentiment extraction on Euronext releases, regression on realized volatility.',
          results: 'Early results: significant correlation on the Oslo segment.',
          keywords: ['sentiment', 'earnings', 'volatility'],
          dimensions: { method: 'LLM scoring', data: 'Releases 2019–2025', theory: 'Semi-strong efficiency', writing: 'Paper in progress' },
        },
      },
    },
    {
      id: S_OSLO, labo: 'paris', titre: 'Sentiment intrajournalier — Oslo',
      kicker: 'NLP · Intraday', statut: 'active',
      question: 'Le signal de sentiment tient-il à la minute sur Oslo Børs ?',
      accroche: 'Descendre du quotidien à la minute.',
      periode: '2026–2027',
      context: '', method: '', results: '',
      keywords: ['intraday', 'oslo'], auteurs: [M_ALICE], difficulte: 'advanced',
      dimensions: { method: '', data: 'Ticks Oslo 2024–2025', theory: '', writing: '' },
      ordre: 2, is_transversal: false, confidentiel: false,
      inherits: { context: S_EARN, method: S_EARN },
      i18n: {
        fr: { titre: 'Sentiment intrajournalier — Oslo' },
        en: {
          titre: 'Intraday sentiment — Oslo',
          question: 'Does the sentiment signal hold at the minute level on Oslo Børs?',
          accroche: 'From daily down to the minute.',
          keywords: ['intraday', 'oslo'],
          dimensions: { method: '', data: 'Oslo ticks 2024–2025', theory: '', writing: '' },
        },
      },
    },
    {
      id: S_MEDIA, labo: 'montreal', titre: 'Couverture médiatique et liquidité',
      kicker: 'Médias · Microstructure', statut: 'on-hold',
      question: "L'attention médiatique déplace-t-elle la liquidité des mid-caps ?",
      accroche: 'Quand les journaux regardent, les carnets bougent.',
      periode: '2025–2026',
      context: 'La couverture presse des mid-caps Euronext est irrégulière.',
      method: 'Comptage pondéré des mentions presse, panel sur les spreads.',
      results: '', keywords: ['médias', 'liquidité'],
      auteurs: [M_BADR], difficulte: 'easy',
      dimensions: { method: 'Panel', data: 'Presse 2020–2025', theory: 'Attention investisseur', writing: '' },
      ordre: 3, is_transversal: false, confidentiel: false, inherits: {},
      i18n: {
        fr: { titre: 'Couverture médiatique et liquidité' },
        en: {
          titre: 'Media coverage and liquidity',
          question: 'Does media attention move mid-cap liquidity?',
          accroche: 'When newspapers watch, order books move.',
          context: 'Press coverage of Euronext mid-caps is irregular.',
          method: 'Weighted press mention counts, panel on spreads.',
          keywords: ['media', 'liquidity'],
          dimensions: { method: 'Panel', data: 'Press 2020–2025', theory: 'Investor attention', writing: '' },
        },
      },
    },
    {
      id: S_PRIV, labo: 'paris', titre: 'Signal propriétaire — calibration',
      kicker: 'Interne', statut: 'active',
      question: 'Calibration du signal propriétaire (démo confidentialité).',
      accroche: 'Fiche visible des seuls membres.',
      periode: '2026', context: '', method: '', results: '',
      keywords: ['interne'], auteurs: [M_ALICE], difficulte: 'advanced',
      dimensions: { method: '', data: '', theory: '', writing: '' },
      ordre: 4, is_transversal: false, confidentiel: true, inherits: {},
      i18n: {
        fr: { titre: 'Signal propriétaire — calibration' },
        en: { titre: 'Proprietary signal — calibration', question: 'Proprietary signal calibration (confidentiality demo).', accroche: 'Members-only sheet.' },
      },
    },
  ],
  relations: [
    { id: 'de300004-0000-4000-8000-000000000001', source_id: S_EARN, target_id: S_OSLO, kind: 'parent', label: '', label_i18n: {} },
    { id: 'de300004-0000-4000-8000-000000000002', source_id: S_EARN, target_id: S_MEDIA, kind: 'assoc', label: 'données partagées', label_i18n: { en: { label: 'shared data' }, fr: { label: 'données partagées' } } },
  ],
  tasks: [
    {
      id: T_CORPUS, labo: 'paris', titre: 'Constituer le corpus de communiqués',
      description: 'Scraper et nettoyer les communiqués Euronext 2019–2025.',
      statut: 'in-progress', difficulte: 'intermediate', sujet_id: S_EARN,
      i18n: { fr: { titre: 'Constituer le corpus de communiqués', description: 'Scraper et nettoyer les communiqués Euronext 2019–2025.' }, en: { titre: 'Build the press-release corpus', description: 'Scrape and clean Euronext releases 2019–2025.' } },
    },
    {
      id: T_BASELINE, labo: 'paris', titre: 'Baseline de sentiment (lexique)',
      description: 'Comparer le scoring LLM à un lexique financier classique.',
      statut: 'to-do', difficulte: 'easy', sujet_id: S_EARN,
      i18n: { fr: { titre: 'Baseline de sentiment (lexique)', description: 'Comparer le scoring LLM à un lexique financier classique.' }, en: { titre: 'Sentiment baseline (lexicon)', description: 'Compare LLM scoring against a classic financial lexicon.' } },
    },
    {
      id: T_REVIEW, labo: 'paris', titre: 'Revue de littérature volatilité',
      description: 'Synthèse des papiers sentiment → volatilité depuis 2015.',
      statut: 'done', difficulte: 'easy', sujet_id: S_EARN,
      i18n: { fr: { titre: 'Revue de littérature volatilité', description: 'Synthèse des papiers sentiment → volatilité depuis 2015.' }, en: { titre: 'Volatility literature review', description: 'Survey of sentiment → volatility papers since 2015.' } },
    },
  ],
  subtasks: [
    { id: 'de300005-0000-4000-8000-000000000001', task_id: T_CORPUS, label: 'Lister les sources', done: true, ordre: 0 },
    { id: 'de300005-0000-4000-8000-000000000002', task_id: T_CORPUS, label: 'Script de scraping', done: true, ordre: 1 },
    { id: 'de300005-0000-4000-8000-000000000003', task_id: T_CORPUS, label: 'Dédoublonnage', done: false, ordre: 2 },
  ],
  comments: [
    { id: 'de300006-0000-4000-8000-000000000001', sujet_id: S_EARN, auteur_type: 'member', auteur_nom: 'Badr Kaci', membre_id: M_BADR, texte: 'Le segment Lisbonne mériterait le même traitement.' },
    { id: 'de300006-0000-4000-8000-000000000002', sujet_id: S_EARN, auteur_type: 'visitor', auteur_nom: 'Visiteur curieux', membre_id: null, texte: 'Très intéressant ! Les données seront-elles publiques ?' },
  ],
  publications: [
    { id: 'de300007-0000-4000-8000-000000000001', labo: 'paris', titre: 'LLM sentiment and post-announcement volatility: evidence from Oslo Børs', auteurs: ['Alice Martin', 'Badr Kaci'], annee: 2026, type: 'working-paper', revue_ou_conf: 'FAME Working Papers', lien: null },
  ],
} as const
