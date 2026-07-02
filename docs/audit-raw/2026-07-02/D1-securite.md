# D1 — Sécurité & Auth (Opus, lecture seule)

**Verdict** : 0 Critical, 0 High. Chaîne `confidentiel` bout-en-bout **solide** (mieux tenue qu'au 28/06). `createServiceClient()` sans cookies OK. Secrets tous server-only. 37 routes : toutes les méthodes mutantes ≥ requireMember ; toutes les lectures publiques gatent `confidentiel`. Tokens activation = 256 bits, exp 7 j, single-use.

## 🟡 Medium
- **R1 — Relations vers sujets confidentiels fuitent dans le payload RSC (graphe + Paper).** `src/app/[locale]/graph/page.tsx:29` (`select('*')` sans filtre) et `paper/[id]/page.tsx:62`. Le *rendu* masque (buildGraphData / RelationsPanel), mais UUID + topologie + `label`/`label_i18n` d'associations de sujets confidentiels restent dans le HTML/flight envoyé à l'anonyme. Fix : filtrer côté serveur aux relations dont les DEUX extrémités sont visibles.

## ⚪ Low
- **R2 — `DELETE /api/admin/logs/[id]` : `type in DELETABLE` traverse le prototype** (`constructor`, `__proto__`… passent → 500). Admin-only, non exploitable. Fix : `Object.prototype.hasOwnProperty.call`.
- **R3 — `POST /api/comments` sans gate `confidentiel`/existence sur `sujet_id`.** Un visiteur connaissant l'UUID (cf. R1) peut écrire un commentaire sur un sujet confidentiel (ne peut pas le lire). Fix : 404 si `subject.confidentiel && !isMember`.

Voir tableau route × méthode × garde dans le rapport maître (37 routes, toutes OK).
