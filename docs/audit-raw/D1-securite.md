# Audit Sécurité — D1 (FAME Website)

Branche : `audit` · Périmètre : 25 routes `src/app/api/**/route.ts`, libs server-only, middleware, migrations RLS.
Auditeur en lecture seule — aucun fichier source modifié.

---

## 1. Fuite de secrets côté client

### ⚪ Aucun secret server-only détecté dans un bundle client
- Fichiers : `src/lib/supabase/server.ts`, `src/lib/dropbox/client.ts`, `src/lib/resend/*.ts`, `src/scripts/seed-admin.ts`
- Constat : `SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY` ne sont lus que dans des modules server-only (routes `/api`, `src/lib`, RSC, script CLI). `grep -rln '"use client"'` sur les fichiers important `createServiceClient`/dropbox/resend → **0 résultat**.
- Les 3 pages qui importent `createServiceClient` (`[lab]/page.tsx`, `[lab]/tasks/page.tsx`, `[lab]/paper/[id]/page.tsx`) sont des **React Server Components** (pas de `"use client"`, vérifié) — usage conforme.
- Seuls `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `NEXT_PUBLIC_APP_URL` portent le préfixe public. `NEXT_PUBLIC_APP_URL` ne contient qu'une URL de base non sensible.
- `.env.local` n'est **pas** tracké par git (`.gitignore` ligne 34 : `.env*`). Aucun fichier env committé.
- Verdict : **conforme**, pas de fuite de secret.

---

## 2. Construction de `createServiceClient()`

### ⚪ Construction correcte — pas de cookies, Authorization = service-role
- Fichier : `src/lib/supabase/server.ts:30-36`
- `createServiceClient()` utilise `createClient` de `@supabase/supabase-js` (et non `createServerClient` de `@supabase/ssr`), **sans** passer les cookies de la requête, avec `auth: { persistSession: false, autoRefreshToken: false }`. Le piège connu (JWT user écrasant la clé service-role → exécution en rôle `authenticated` sous RLS) est **évité**. Commentaire explicatif présent (lignes 25-29).
- Verdict : **conforme**.

---

## 3. Contrôle d'accès route par route

### 🟠 `GET /api/members` totalement public — fuite des emails de tous les membres
- Fichier : `src/app/api/members/route.ts:7-17`
- Impact : aucun garde `requireMember`/`requireAdmin`. N'importe quel visiteur non authentifié récupère `email`, `role`, `domaines`, `is_admin`, `prenom`, `nom` de **tous** les membres d'un labo. La page Team (`team/page.tsx`) est publique et `MemberGrid` (client) appelle cette route → emails exposés au public. Donnée personnelle (RGPD) + surface de phishing/énumération de comptes admin (`is_admin`).
- Reproduction : `curl 'https://<host>/api/members?lab=paris'` sans cookie → JSON avec tous les emails.
- Fix suggéré : soit retirer `email`/`is_admin` du `select` pour les appels non authentifiés, soit exiger `requireMember()` et ne renvoyer les emails qu'aux membres ; afficher un trombinoscope public limité (prénom/nom/rôle/photo) sans email.

### 🟠 `POST /api/comments` sans rate-limit ni protection anti-abus (spam visiteur)
- Fichier : `src/app/api/comments/route.ts:5-36`
- Impact : endpoint public par conception (visiteurs peuvent commenter). Aucune limite de débit, aucune limite de longueur sur `texte`, aucun anti-bot. Un attaquant peut insérer en masse des commentaires (DoS applicatif, pollution BDD, stockage illimité). `auteur_nom` et `texte` non bornés.
- Reproduction : boucle `curl -XPOST /api/comments` avec `sujet_id` valide + `texte` arbitrairement long.
- Fix suggéré : borner `texte` (ex. ≤ 4000 car.) et `visitor_prenom/nom` (≤ 80), ajouter un rate-limit (IP / token) ou un challenge (captcha/honeypot) sur la soumission visiteur.

### 🟡 `POST /api/proposals` public sans borne de longueur ni rate-limit
- Fichier : `src/app/api/proposals/route.ts:40-66`
- Impact : soumission publique. Validation de types/énumérations correcte (labo, domaine, difficulté), mais `titre`/`description` non bornés en longueur et pas de rate-limit → spam / stockage abusif.
- Reproduction : `curl -XPOST /api/proposals` en boucle avec payloads volumineux.
- Fix suggéré : borner longueurs, ajouter rate-limit / honeypot.

### 🟡 `GET /api/proposals?ids=...` public — énumération si un ID fuit
- Fichier : `src/app/api/proposals/route.ts:16-24`
- Impact : la branche `ids` est volontairement publique (tracker visiteur). Les ID sont des UUID v4 (non devinables), donc risque faible, mais la réponse inclut `proposant_email`, `commentaire_admin`, `traitee_par`. Si un UUID fuit (logs, partage de lien), un tiers lit l'email du proposant et le commentaire admin interne.
- Reproduction : `curl '/api/proposals?ids=<uuid>'` → renvoie `proposant_email` + `commentaire_admin`.
- Fix suggéré : pour la branche publique `ids`, restreindre le `select` aux champs nécessaires au tracker (statut, titre, date) et exclure `proposant_email`/`commentaire_admin`.

### Routes mutatives correctement gardées (constat positif)
- Toutes les routes mutatives (POST/PATCH/DELETE) hors soumissions publiques appellent `requireMember()` ou `requireAdmin()` en tête de méthode. Vérifié individuellement (voir tableau §9). Aucune route mutative trouvée **sans** garde, exception faite des soumissions publiques intentionnelles (`POST /comments`, `POST /proposals`).
- `members/invite` et `proposals/[id]` (PATCH + convert) exigent bien `requireAdmin()`.

---

## 4. Isolation des labos

### 🟠 Routes `[id]` mutatives ne valident pas l'appartenance au labo — écriture cross-lab
- Fichiers : `src/app/api/subjects/[id]/route.ts:15-37` (PATCH/DELETE), `src/app/api/subjects/[id]/order/route.ts:6-15` (PATCH), `src/app/api/tasks/[id]/route.ts` (PATCH/DELETE), `src/app/api/comments/[id]/route.ts` (DELETE), `src/app/api/publications/[id]/route.ts` (DELETE), `src/app/api/prompts/[id]/route.ts` (PATCH/DELETE), `src/app/api/dropbox/links/[id]/route.ts` (DELETE), `src/app/api/tasks/[id]/subtasks/route.ts`, `src/app/api/tasks/[id]/claim/route.ts`
- Impact : ces handlers n'opèrent que sur l'`id` fourni, **sans** vérifier que la ressource appartient au labo du membre appelant. Comme `requireMember()` ne porte aucune notion de labo (un membre Paris est un membre "global"), un membre du labo Paris peut modifier/supprimer un sujet, une tâche, une publication, un prompt ou un commentaire du labo Montréal s'il devine/obtient l'UUID. Les deux labos sont censés être **indépendants** : c'est une violation d'isolation. Les UUID v4 ne sont pas devinables (atténuation), mais un membre voit déjà des IDs via les API GET filtrées… or les GET `[id]` (`subjects/[id]`, `tasks/[id]`) ne filtrent pas non plus par labo et sont accessibles : `GET /api/subjects/<uuid>` renvoie le sujet de l'autre labo à tout visiteur.
- Reproduction : membre Paris connecté → `curl -XPATCH /api/subjects/<uuid-montreal> -d '{"statut":"done"}'` → succès. Ou visiteur → `curl /api/subjects/<uuid-montreal>` → fiche renvoyée.
- Fix suggéré : introduire la notion de labo dans la session (le membre a `member.labo`) et, dans chaque route `[id]`, charger la ressource, comparer `ressource.labo === member.labo` (ou passer le `lab` attendu et filtrer `.eq('labo', lab)` sur le update/delete). Pour les GET `[id]` exposant des fiches, décider si la lecture cross-lab est acceptable (le site est en partie vitrine publique) — sinon filtrer.

### 🟡 Pas de vérification que `sujet_id`/`task_id` appartient au `labo` lors des créations
- Fichiers : `src/app/api/tasks/route.ts:32-47` (POST), `src/app/api/dropbox/links/route.ts:32-60` (POST)
- Impact : `POST /api/tasks` insère une tâche avec `labo` et `sujet_id` fournis par le client sans vérifier que le sujet appartient bien à ce labo. Idem `dropbox_links` : `subject_id`/`task_id` non vérifiés contre `labo`. Permet de rattacher une tâche/un lien d'un labo à un sujet de l'autre labo → incohérence + fuite croisée des données Dropbox.
- Fix suggéré : avant insertion, charger le sujet/tâche cible et vérifier `cible.labo === labo`.

---

## 5. Validation des entrées

### 🟠 Injection HTML / email dans les templates Resend (champs utilisateur non échappés)
- Fichiers : `src/lib/resend/send-invitation.ts:23-33` (`prenom`), `src/lib/resend/send-proposal-result.ts:24-35` (`proposantPrenom`, `titreProposal`, `commentaire`)
- Impact : les champs proviennent d'entrées utilisateur (proposition publique : `proposant_prenom`, `titre` ; commentaire admin) et sont interpolés **directement** dans le HTML de l'email sans échappement. Un proposant peut injecter du markup/lien (`titre = '<a href="evil">…'`) dans l'email envoyé au proposant lors d'un rejet, ou un `commentaire_admin` mal formé casse/altère le rendu. Vecteur de phishing si l'email est relayé. Pas de RCE, mais injection de contenu.
- Reproduction : soumettre une proposition avec `titre` contenant des balises HTML → admin rejette → email avec HTML injecté.
- Fix suggéré : échapper toutes les variables interpolées (`& < > " '`) avant insertion dans le HTML de l'email.

### 🟡 `subjects/[id]/order` PATCH : `orderedIds` non validé (type/contenu)
- Fichier : `src/app/api/subjects/[id]/order/route.ts:8-13`
- Impact : `orderedIds` est utilisé tel quel dans `Promise.all` de `update().eq('id', id)`. Pas de vérif que c'est un tableau de strings, ni que les IDs appartiennent au labo du membre. Un membre peut réordonner (effet de bord d'écriture sur `ordre`) des sujets de l'autre labo en passant leurs IDs. Si `orderedIds` n'est pas un tableau → exception 500.
- Fix suggéré : valider `Array.isArray(orderedIds)` + chaque élément string ; filtrer les updates aux sujets du labo du membre.

### ⚪ Champ `lien` (publications) et `node_path` (dropbox) — pas d'injection SQL
- Fichiers : `src/app/api/publications/route.ts:24-39`, `src/app/api/dropbox/links/route.ts:32-60`
- Constat : toutes les requêtes utilisent l'API paramétrée de supabase-js (`.eq`, `.in`, `.insert`) — pas de SQL string brut, pas de `.or()` construit dynamiquement à partir d'entrée utilisateur. Pas d'injection SQL/PostgREST. `lien` (URL publication) n'est ni validé comme URL ni échappé à l'affichage — à vérifier côté rendu (hors périmètre BDD) pour XSS potentiel si rendu en `href` sans validation `http(s)`.
- Note Dropbox : `path` (`/api/dropbox/tree?path=`) est transmis tel quel à `filesListFolder`. Le membre authentifié peut naviguer n'importe quel chemin du compte Dropbox configuré — comportement attendu (un seul compte partagé), mais aucune restriction par labo : un membre Paris voit l'arbre Dropbox complet (incluant Montréal). Voir §4.

### ⚪ Énumérations / types : globalement bien validés
- `subjects`, `tasks`, `prompts`, `proposals`, `publications`, `members/invite` valident `labo`, `role`, `type_cible`, `difficulte`, `statut`, `domaine` contre des listes blanches. Bon point. Manque surtout : bornes de longueur des champs texte (cf. spam §3).

---

## 6. RLS & migrations

### 🟡 RLS activée partout mais aucune policy — repose entièrement sur le service-role
- Fichier : `supabase/migrations/001_initial_schema.sql:196-213`
- Constat : `enable row level security` sur les 14 tables, **zéro** policy permissive définie → par défaut, les rôles `anon`/`authenticated` ne lisent/écrivent rien en accès direct. C'est cohérent : tout passe par le service-role en API. Pas de table oubliée (les 14 sont couvertes). Pas de policy trop permissive (il n'y en a aucune).
- Risque résiduel (🟡) : la sécurité repose à 100% sur la discipline des routes `/api` (toute route oubliant `requireMember`/un filtre devient la seule barrière — cf. §3/§4). Le modèle est sain mais sans filet RLS labo-aware. Aucune action BDD requise, mais cela amplifie l'impact des manques §3/§4.
- Note : la colonne `members.password_hash` (001:18) est un résidu inutilisé (l'auth réelle est dans Supabase Auth) — à supprimer pour éviter toute confusion, non bloquant.

---

## 7. Middleware

### 🟡 Le gate `/admin` au middleware ne vérifie que l'authentification, pas le rôle admin
- Fichier : `src/middleware.ts:33-55`
- Impact : `MEMBER_ONLY_PATHS` et `ADMIN_ONLY_PATHS` sont traités identiquement — le middleware vérifie seulement `user != null`, pas `is_admin`. Un membre non-admin connecté **n'est pas** bloqué au edge sur `/admin/*`. Le commentaire l'assume (l'enforcement admin doit se faire dans la RSC via `requireAdmin()`). **À vérifier hors périmètre BDD** : que chaque page sous `/admin` appelle bien `requireAdmin()` côté serveur. Si une page admin l'oublie, un membre simple accède à l'UI admin (les mutations restent protégées par les routes API qui, elles, font `requireAdmin`). Risque = exposition d'UI/données admin en lecture.
- Reproduction : membre non-admin → naviguer `/en/admin/proposals` ; vérifier que la RSC redirige/403.
- Fix suggéré : documenter et tester que toutes les pages `/admin/*` appellent `requireAdmin()` ; idéalement vérifier le rôle aussi au plus près (RSC), ce qui est déjà le modèle voulu.

### ⚪ Court-circuit `/api/` sûr, matcher cohérent
- Fichier : `src/middleware.ts:19, 60-62`
- Constat : `/api/*` retourne `NextResponse.next()` avant tout traitement intl, et le `matcher` exclut déjà `api`. Les routes API gèrent leur propre auth. Le strip de locale (`/^\/(en|fr)/`) est correct. Pas de bypass évident du gate via casse/locale (les chemins sont normalisés par next-intl). Verdict OK.

---

## 8. Tokens & sessions

### ⚪ Token d'activation : robuste
- Fichiers : `src/app/api/members/invite/route.ts:30-32`, `src/app/api/auth/activate/route.ts:4-41`
- Constat : token = `crypto.randomBytes(32).toString('hex')` (256 bits, non devinable), `unique` en BDD (001:27), expiration 7 jours vérifiée (`gt('expires_at', now())`), **supprimé** après usage (`activate` ligne 39) → non réutilisable. Mot de passe min 8 (activate:7). Bon.
- Note 🟡 mineure : `activate` n'invalide pas explicitement les autres invitations en attente pour le même membre, et `members/invite` peut créer plusieurs invitations actives. Faible. La création échoue proprement si l'email existe déjà (auth createUser renvoie une erreur → rollback).

### ⚪ Cookies de session httpOnly, sign-out invalide la session
- Fichiers : `src/lib/supabase/server.ts:5-23`, `src/app/api/auth/sign-out/route.ts`
- Constat : sessions gérées par `@supabase/ssr` (cookies httpOnly gérés par la lib, `getUser()` revalide côté serveur). `sign-out` appelle `supabase.auth.signOut()` qui révoque la session et efface les cookies. `sign-in` renvoie un message d'erreur générique (`Invalid credentials`) — pas de fuite d'existence de compte. Bon.

---

## 9. Tableau route × méthode × rôle attendu × verdict

| Route | Méthode | Rôle attendu | Garde présente | Verdict |
|---|---|---|---|---|
| `/api/auth/sign-in` | POST | public | — (login) | OK |
| `/api/auth/sign-out` | POST | public | — | OK |
| `/api/auth/activate` | POST | public + token | token validé/expiré/usage unique | OK |
| `/api/members` | GET | membre (emails) | **aucune** | 🟠 fuite emails |
| `/api/members/[id]` | PATCH | self ou admin | requireMember + check self/admin + champs filtrés | OK |
| `/api/members/[id]` | DELETE | admin | requireAdmin | OK |
| `/api/members/invite` | POST | admin | requireAdmin | OK |
| `/api/subjects` | GET | public | lab validé | OK |
| `/api/subjects` | POST | membre | requireMember | OK |
| `/api/subjects/[id]` | GET | public | aucune (lecture cross-lab) | 🟡 pas de filtre labo |
| `/api/subjects/[id]` | PATCH | membre | requireMember, **pas de check labo** | 🟠 cross-lab |
| `/api/subjects/[id]` | DELETE | membre | requireMember, **pas de check labo** | 🟠 cross-lab |
| `/api/subjects/[id]/order` | PATCH | membre | requireMember, **pas de check labo + input non validé** | 🟠 cross-lab |
| `/api/tasks` | GET | public | lab validé (optionnel) | OK |
| `/api/tasks` | POST | membre | requireMember, sujet_id non vérifié vs labo | 🟡 |
| `/api/tasks/[id]` | GET | public | aucune | 🟡 cross-lab read |
| `/api/tasks/[id]` | PATCH | membre | requireMember, pas de check labo | 🟠 cross-lab |
| `/api/tasks/[id]` | DELETE | membre | requireMember, pas de check labo | 🟠 cross-lab |
| `/api/tasks/[id]/subtasks` | POST | membre | requireMember | OK* (pas de check labo) |
| `/api/tasks/[id]/subtasks` | PATCH | membre | requireMember + valid done | OK* |
| `/api/tasks/[id]/claim` | POST | membre | requireMember (self assign) | OK |
| `/api/comments` | POST | public/membre | — (public intentionnel), **pas de borne/rate-limit** | 🟠 spam |
| `/api/comments/[id]` | DELETE | membre | requireMember, pas de check labo | 🟡 |
| `/api/publications` | GET | public | lab validé | OK |
| `/api/publications` | POST | membre | requireMember | OK |
| `/api/publications/[id]` | DELETE | membre | requireMember, pas de check labo | 🟡 |
| `/api/prompts` | GET | membre | requireMember + lab validé | OK |
| `/api/prompts` | POST | membre | requireMember | OK |
| `/api/prompts/[id]` | PATCH | membre | requireMember, pas de check labo | 🟡 |
| `/api/prompts/[id]` | DELETE | membre | requireMember, pas de check labo | 🟡 |
| `/api/proposals` | GET (ids) | public | — (UUID), expose email/commentaire | 🟡 |
| `/api/proposals` | GET (lab) | membre | requireMember + lab validé | OK |
| `/api/proposals` | POST | public | — (intentionnel), pas de borne/rate-limit | 🟡 spam |
| `/api/proposals/[id]` | PATCH | admin | requireAdmin | OK |
| `/api/proposals/[id]/convert` | POST | admin | requireAdmin | OK |
| `/api/dropbox/tree` | GET | membre | requireMember (pas de cloison labo) | OK* |
| `/api/dropbox/links` | GET | membre | requireMember + lab validé | OK |
| `/api/dropbox/links` | POST | membre | requireMember, subject_id/task_id non vérifié vs labo | 🟡 |
| `/api/dropbox/links/[id]` | DELETE | membre | requireMember, pas de check labo | 🟡 |

\* `OK*` = garde d'authentification correcte, mais absence de cloisonnement labo (cf. §4) — acceptable seulement si la lecture/écriture inter-labo est jugée non sensible, ce qui contredit le principe « deux labos indépendants ».

---

## 10. Récapitulatif par sévérité

| Sévérité | Nombre |
|---|---|
| 🔴 Critical | 0 |
| 🟠 High | 6 |
| 🟡 Medium | 9 |
| ⚪ Low / Conforme | 7 |

### Détail des 🟠 High
1. `GET /api/members` public → fuite des emails de tous les membres (`members/route.ts:7`)
2. Routes `subjects/[id]` PATCH/DELETE — écriture cross-labo sans check d'appartenance (`subjects/[id]/route.ts:15,30`)
3. Routes `tasks/[id]` PATCH/DELETE — écriture cross-labo sans check (`tasks/[id]/route.ts:18,55`)
4. `subjects/[id]/order` PATCH — cross-labo + input non validé (`subjects/[id]/order/route.ts:6`)
5. `POST /api/comments` public sans rate-limit ni bornes → spam/DoS (`comments/route.ts:5`)
6. Injection HTML dans les emails Resend (`send-proposal-result.ts:27`, `send-invitation.ts:25`)

---

## Conclusion

Les deux pièges architecturaux majeurs sont **bien évités** : `createServiceClient()` est cookie-less (rôle service-role préservé), et aucun secret server-only ne fuit dans un bundle client. RLS activée sur toutes les tables sans policy permissive (modèle service-role cohérent).

Les faiblesses réelles sont concentrées sur **(a)** une fuite de données — `GET /api/members` public exposant les emails — et **(b)** l'absence systématique de cloisonnement par labo dans les routes `[id]` mutatives et certaines lectures, qui viole le principe « deux labos indépendants » dès qu'un UUID est connu. Aucune faille 🔴 critique exploitable à distance sans authentification au-delà de la fuite d'emails et du spam. Recommandation prioritaire : ajouter `member.labo` à la session et filtrer/vérifier le labo dans toutes les routes `[id]`, fermer `GET /api/members`, échapper le HTML des emails, et borner/limiter les soumissions publiques.
