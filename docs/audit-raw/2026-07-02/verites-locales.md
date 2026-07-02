# Vérités locales — baseline 2026-07-02

- **Commit audité** : `3d4142a` (branche `main`)
- **`npx tsc --noEmit`** : exit 0, aucune erreur.
- **`npm run lint`** : exit 0, aucune erreur.
- **`npm test -- --run`** : **432/432 tests verts** (110 fichiers), 6.8 s.
- **`npm run build`** : exit 0, build de prod OK (middleware proxy, robots/sitemap statiques).
- **`npm audit`** : **3 moderate / 0 high / 0 critical** (JSON complet : `npm-audit.json`) :
  - `postcss` — XSS via `</style>` non échappé dans la sortie stringify (fix disponible)
  - `next` — moderate via `postcss` (fix disponible)
  - `next-intl` — moderate via `next` (fix disponible)

Conforme à la baseline annoncée par STATUS.md (écart mineur : 432 tests vs « 431 » — un test ajouté par la fix wave PR #49).
