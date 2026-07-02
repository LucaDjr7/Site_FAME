# D7 — Config & Deploy-readiness (Sonnet, lecture seule)

Build exit 0 · pas d'`ignoreBuildErrors` · headers sécu + HSTS présents · `.env.local` gitignoré, 0 secret dans l'historique · `.env.example` à jour · 14 migrations lues : aucun DROP dangereux, ordre correct, `014` backfill correct.

## 🔴 → adjudiqué Medium (voir maître)
- **STATUS.md ambigu sur `011`/`012` (« à appliquer » jamais mis à jour) vs plan déploiement (« appliquées »).** ⚠️ **Résolu empiriquement par le volet BDD** : `match_subject_files` (011) et `tasks.i18n` (012) réellement présents en dev → migrations bien appliquées. Reste : incohérence documentaire (Medium) + aucun mécanisme de suivi (pas de `schema_migrations`) ; `001/004/006/008/009` sans garde `if not exists` → un re-run accidentel casse le runbook.

## 🟠 High
- **`REPORT_EMAIL`/`RESEND_API_KEY` absents → échec silencieux** : `POST /api/report` répond `{ok:true}` sans email. Poser avant lancement.
- **Aucune route n'exporte `maxDuration`** → sur Vercel (défaut 10-15 s) risque de coupure de `assistant/chat` (SSE + outils) et de l'extraction/embedding `after()` (fichiers 50 Mo), échec avalé par `catch{}`. Le « cron de rattrapage » commenté n'existe pas. Fix : `export const maxDuration = 60` sur les 5 routes longues.

## 🟡 Medium
- `NEXT_PUBLIC_APP_URL` absent → fallback silencieux `localhost:3000` dans layout/robots/sitemap (SEO cassé sans erreur) alors qu'`app-url.ts` throw.
- CSP toujours absente (différée M16, statu quo acceptable).
- `middleware.ts` déprécié Next 16 (build warn « use proxy ») ; AGENTS.md impose de traiter les dépréciations.
- `index:rag` ré-embed tout à chaque run (coût OpenAI).

## Vulnérabilités npm : 3 moderate, 0 high/critical
`postcss` (bundlé Next, XSS `</style>`) → `next`/`next-intl` hérités. Patch `next@16.2.10` disponible. `npm audit fix` propose absurdement `next@9.3.3` — **ne pas suivre**.

Checklist go-live complète : voir rapport maître.
