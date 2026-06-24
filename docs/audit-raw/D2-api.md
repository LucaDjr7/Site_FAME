# D2 — Audit des routes API

**Périmètre :** `src/app/api/**/route.ts` (25 fichiers)  
**Référentiels croisés :** `supabase/migrations/001_initial_schema.sql`, `002_subject_difficulte_and_indexes.sql`, `003_proposal_subject_link.sql`, `src/types/index.ts`  
**Date :** 2026-06-24  

---

## Findings

---

### 🔴 F1 — `proposals/[id]/convert` : sujet créé mais échec du lien proposal→subject non bloquant → orphelin possible

**Fichier :** `src/app/api/proposals/[id]/convert/route.ts:50-56`

```ts
const { error: updErr } = await service.from('proposals').update({
  statut: 'accepted',
  traitee_at: new Date().toISOString(),
  traitee_par: member.id,
  subject_id: subject.id,
}).eq('id', id)
if (updErr) console.error('proposal convert: subject created but proposal status update failed', { id, subjectId: subject.id, error: updErr.message })
```

- **Impact :** Si la mise-à-jour de `proposals` échoue après l'insertion du `subject`, la colonne `subject_id` reste `NULL`. Le mécanisme d'idempotence (ligne 23-26 : `if (proposal.subject_id) return existing`) ne peut plus détecter la conversion. Un second appel à `POST /api/proposals/[id]/convert` réinsérera un **deuxième sujet** en doublon. La réponse HTTP est néanmoins 201 (succès partiel non signalé au client).
- **Reproduction :** Injecter un timeout réseau entre l'insert du sujet et l'update de la proposal ; rappeler la route → deux sujets distincts pour la même proposal.
- **Fix suggéré :** Envelopper les deux opérations dans une transaction Postgres (RPC `begin/commit`) ou une fonction SQL `convert_proposal(proposal_id uuid)`. En attendant, au minimum renvoyer HTTP 500 si `updErr` est non-null, et supprimer le sujet orphelin créé (rollback manuel).

---

### 🔴 F2 — `subjects/[id]/order` : aucune vérification d'erreur sur les PATCH parallèles, résultat partiel invisible

**Fichier :** `src/app/api/subjects/[id]/order/route.ts:10-14`

```ts
const updates = orderedIds.map((id, ordre) =>
  service.from('subjects').update({ ordre }).eq('id', id)
)
await Promise.all(updates)
return NextResponse.json({ ok: true })
```

- **Impact :** Chaque `Promise.all` ignore les erreurs individuelles — si n'importe quelle mise-à-jour échoue (UUID invalide, contrainte, panne réseau), la réponse est tout de même `{ ok: true }`. L'ordre en base devient **partiellement corrompu** sans que le client ne le sache. De plus, `Promise.all` sériellement n'est pas atomique : deux réordres concurrents s'entrelacent et peuvent aboutir à un état incohérent.
- **Reproduction :** Passer un ID inexistant dans `orderedIds` → 200 retourné, mais `ordre` de cet élément non mis à jour.
- **Fix suggéré :** Collecter les erreurs et renvoyer 500 si l'une d'elles est non-null. Pour l'atomicité, utiliser une RPC Postgres (`upsert` dans une boucle dans une transaction) ou au minimum un `upsert` en lot. Exemple minimal de détection d'erreur :

```ts
const results = await Promise.all(updates.map(q => q))
const failed = results.find(r => r.error)
if (failed) return NextResponse.json({ error: failed.error.message }, { status: 500 })
```

---

### 🔴 F3 — `tasks/[id]/claim` : race condition → double entrée dans `task_assignees`

**Fichier :** `src/app/api/tasks/[id]/claim/route.ts:14-23`

```ts
const { data: existing } = await service.from('task_assignees')
  .select('*').eq('task_id', task_id).eq('member_id', member.id).single()

if (existing) {
  await service.from('task_assignees').delete().eq('task_id', task_id).eq('member_id', member.id)
  return NextResponse.json({ claimed: false })
} else {
  await service.from('task_assignees').insert({ task_id, member_id: member.id })
  return NextResponse.json({ claimed: true })
}
```

- **Impact :** La paire `SELECT` + `INSERT` n'est pas atomique. Si deux requêtes simultanées du même membre arrivent alors qu'aucun enregistrement n'existe, toutes deux lisent `existing = null` et tentent l'`INSERT`. La contrainte `PRIMARY KEY (task_id, member_id)` protège contre le doublon physique (erreur Postgres), mais l'erreur de la seconde requête n'est **pas vérifiée** — elle revient 200 `{ claimed: true }` avec un status silencieusement échoué en base.
- **Reproduction :** Deux requêtes POST simultanées `/api/tasks/{id}/claim` avec la même session → une réussit, l'autre reçoit `claimed: true` alors que l'insert a échoué.
- **Fix suggéré :** Utiliser un `upsert` ou vérifier l'erreur de l'insert. Solution propre : remplacer le check-then-act par une RPC Postgres atomique `toggle_task_claim(task_id, member_id)` qui utilise `INSERT … ON CONFLICT DO DELETE RETURNING …`. En attendant, vérifier `error` sur le `delete` et l'`insert` et retourner 500 si non-null.

---

### 🟠 F4 — `members/[id]/PATCH` : `prenom` et `nom` non modifiables par l'admin → champ manquant dans `ADMIN_FIELDS`

**Fichier :** `src/app/api/members/[id]/route.ts:17`

```ts
const ADMIN_FIELDS = ['prenom', 'nom', 'role', 'is_admin', ...SELF_FIELDS]
```

Attendez — `prenom` et `nom` SONT dans `ADMIN_FIELDS`. Pas de bug ici. *(Ce finding est annulé.)*

---

### 🟠 F4 — `members/[id]/PATCH` : un membre peut modifier son propre `email` sans re-vérification Supabase Auth

**Fichier :** `src/app/api/members/[id]/route.ts:16-24`

```ts
const SELF_FIELDS = ['email', 'domaines', 'photo_url']
...
const { data, error } = await service.from('members').update(updates).eq('id', id).select().single()
```

- **Impact :** La mise à jour de `email` dans la table `members` ne propage pas le changement à `auth.users.email`. Les deux tables deviennent désynchronisées : la connexion (auth Supabase) reste sur l'ancien email, mais l'affichage et les invitations utilisent le nouvel email. De plus, un membre peut s'assigner l'email d'un autre membre déjà enregistré (violation de l'unicité `members.email unique` → 500 au lieu d'un 409 explicite).
- **Reproduction :** PATCH `/api/members/{self_id}` avec `{ email: "autre@exemple.com" }` → 200, mais connexion impossible avec le nouvel email.
- **Fix suggéré :** Appeler `service.auth.admin.updateUserById(id, { email })` en plus du PATCH membres, ou retirer `email` des `SELF_FIELDS` et le réserver à l'admin avec propagation Auth. Ajouter un test d'unicité explicite (vérifier erreur code `23505` → 409).

---

### 🟠 F5 — `auth/activate` : `members.update` et `invitations.delete` non vérifiés — activation peut rester partielle

**Fichier :** `src/app/api/auth/activate/route.ts:35-39`

```ts
await service.from('members').update({ activated_at: new Date().toISOString() })
  .eq('id', invitation.member_id)

await service.from('invitations').delete().eq('id', invitation.id)
```

- **Impact :** Les erreurs sur ces deux appels sont silencieusement ignorées. Si l'update de `members` échoue (ex. transaction réseau), le membre reste `activated_at = null` mais le mot de passe Supabase Auth est déjà mis à jour. Le membre peut se connecter mais son compte apparaît comme non-activé côté application. Si le delete de l'invitation échoue, le token reste valide — un attaquant qui capture le token peut le rejouer (changement de mot de passe à nouveau).
- **Reproduction :** Simuler un timeout réseau après `updateUserById` → le membre peut se connecter, mais l'invitation reste active et peut être reutilisée.
- **Fix suggéré :** Vérifier `error` sur les deux opérations et retourner 500 si non-null. Idéalement, envelopper dans une transaction ou réordonner (delete invitation en premier, puis update membre).

---

### 🟠 F6 — `subjects/[id]/PATCH` : retourne 500 sur UUID inexistant au lieu de 404

**Fichier :** `src/app/api/subjects/[id]/route.ts:25-27`

```ts
const { data, error } = await service.from('subjects').update(updates).eq('id', id).select().single()
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
return NextResponse.json(data)
```

- **Impact :** Si `id` n'existe pas, PostgREST retourne l'erreur `PGRST116` (0 lignes avec `.single()`). Le code la traite comme une erreur 500, alors que ce devrait être un 404. Idem pour `tasks/[id]/PATCH` ligne 40-41.
- **Reproduction :** PATCH `/api/subjects/00000000-0000-0000-0000-000000000000` → HTTP 500 au lieu de 404.
- **Fix suggéré :** Ajouter avant la ligne `if (error)` :
  ```ts
  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  ```
  Même fix à appliquer dans `tasks/[id]/route.ts:40-41`.

---

### 🟠 F7 — `tasks/[id]/PATCH` : retourne 500 sur UUID inexistant au lieu de 404

**Fichier :** `src/app/api/tasks/[id]/route.ts:40-41`

```ts
const { data, error } = await service.from('tasks').update(updates).eq('id', id).select().single()
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
```

- **Impact :** Même problème que F6 — erreur `PGRST116` mappée en 500 au lieu de 404.
- **Reproduction :** PATCH `/api/tasks/00000000-0000-0000-0000-000000000000` → HTTP 500.
- **Fix suggéré :** Ajouter le même guard `PGRST116 → 404` avant le return 500 générique.

---

### 🟠 F8 — `dropbox/links/[id]/DELETE` : ne vérifie pas si la ligne existe → 200 même si id invalide

**Fichier :** `src/app/api/dropbox/links/[id]/route.ts:10-13`

```ts
const { error } = await service.from('dropbox_links').delete().eq('id', id)
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
return NextResponse.json({ ok: true })
```

- **Impact :** Un DELETE sur un ID inexistant renvoie HTTP 200 `{ ok: true }` au lieu de 404. PostgREST ne remonte pas d'erreur si aucune ligne n'est supprimée ; sans `.select()` pour vérifier `data.length`, le handler est aveugle.
- **Reproduction :** DELETE `/api/dropbox/links/00000000-0000-0000-0000-000000000000` → 200.
- **Fix suggéré :** Ajouter `.select()` après `.delete()` et vérifier `data.length === 0 → 404`, comme le font correctement `publications/[id]` et `comments/[id]`.

---

### 🟠 F9 — `members/GET` : route non protégée — liste complète des membres sans authentification

**Fichier :** `src/app/api/members/route.ts:7-17`

```ts
export async function GET(req: NextRequest) {
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  if (!LABS.includes(lab)) return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
  const service = await createServiceClient()
  const { data, error } = await service
    .from('members')
    .select('id,prenom,nom,email,role,labo,domaines,photo_url,is_admin,activated_at,created_at')
    .eq('labo', lab).order('created_at', { ascending: true })
  ...
```

- **Impact :** N'importe qui peut récupérer la liste complète des membres d'un labo (nom, prénom, email, rôle, `is_admin`, `activated_at`) sans être connecté. L'email et `is_admin` sont des données sensibles. La page Team est publique (trombinoscope), mais cette route expose aussi `is_admin` et `activated_at` qui ne devraient pas être visibles hors admin.
- **Reproduction :** `curl https://site/api/members?lab=paris` sans cookie de session → liste complète.
- **Fix suggéré :** Deux options selon l'intention :  
  1. **Public limité** : retirer `email`, `is_admin`, `activated_at` de la projection pour les appels non authentifiés.  
  2. **Membre requis** : ajouter `try { await requireMember() } catch (e) { return authErrorResponse(e) }` en tête du handler, comme pour `/api/prompts`.

---

### 🟡 F10 — `subjects/route.ts POST` : `last?.ordre` via `.single()` — peut échouer si aucun sujet en base

**Fichier :** `src/app/api/subjects/route.ts:39-43`

```ts
const { data: last } = await service
  .from('subjects')
  .select('ordre')
  .eq('labo', labo)
  .order('ordre', { ascending: false })
  .limit(1)
  .single()

const ordre = (last?.ordre ?? -1) + 1
```

- **Impact :** `.single()` remonte `PGRST116` (erreur) si 0 résultats. L'erreur est destructurée dans `{ data: last }` et ignorée — `last` vaut `null`, donc `ordre = 0`. Ce n'est pas un bug de données (le fallback `?? -1` fonctionne), mais l'erreur Supabase non consommée peut polluer les logs en production.
- **Fix suggéré :** Remplacer `.single()` par `.maybeSingle()` (comme dans `proposals/[id]/convert/route.ts:31`). Pas de changement comportemental, mais plus propre.

---

### 🟡 F11 — `tasks/[id]/subtasks/PATCH` : n'utilise pas `params` mais l'id du segment URL — incohérence de design

**Fichier :** `src/app/api/tasks/[id]/subtasks/route.ts:18-28`

```ts
export async function PATCH(req: NextRequest) {
  ...
  const { subtask_id, done } = await req.json()
  ...
  const { data, error } = await service.from('subtasks').update({ done }).eq('id', subtask_id).select().single()
```

- **Impact :** Le PATCH opère sur `subtask_id` fourni dans le body, pas sur le `[id]` de l'URL (qui représente le `task_id`). Cela signifie qu'un membre peut modifier n'importe quelle sous-tâche (de n'importe quelle tâche) en passant un `subtask_id` arbitraire dans le body. Pas de vérification que la sous-tâche appartient bien à la tâche de l'URL.
- **Reproduction :** PATCH `/api/tasks/{task_A_id}/subtasks` avec body `{ subtask_id: "{subtask_de_task_B}", done: true }` → modifie une sous-tâche d'une autre tâche.
- **Fix suggéré :** Ajouter une vérification que la sous-tâche appartient à la tâche de l'URL :
  ```ts
  const { id: task_id } = await params
  // after update, verify subtask.task_id === task_id, or add .eq('task_id', task_id) to the query
  const { data, error } = await service.from('subtasks')
    .update({ done }).eq('id', subtask_id).eq('task_id', task_id).select().single()
  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Subtask not found in this task' }, { status: 404 })
  ```

---

### 🟡 F12 — `proposals/GET` avec `?ids=` : accessible sans authentification, expose données de proposals

**Fichier :** `src/app/api/proposals/route.ts:12-24`

```ts
if (idsParam) {
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 100)
  ...
  const { data, error } = await service
    .from('proposals').select('*').in('id', ids).order('created_at', { ascending: false })
  ...
  return NextResponse.json(data)
}
```

- **Impact :** C'est intentionnel (tracker visiteur — le visiteur peut retrouver sa propre proposition via l'UUID qu'il a reçu). Cependant, `select('*')` retourne `commentaire_admin` et `traitee_par` (id de l'admin), qui sont des champs internes. Un visiteur ayant deviné ou obtenu d'autres UUIDs peut aussi accéder aux proposals d'autres utilisateurs.
- **Fix suggéré :** Restreindre la projection pour le path public : exclure `commentaire_admin`, `traitee_par`. Exemple : `.select('id,labo,titre,domaine,difficulte,description,proposant_prenom,proposant_nom,statut,created_at')`.

---

### 🟡 F13 — `members/invite` : pas de vérification d'unicité email avant création — doublon auth user possible

**Fichier :** `src/app/api/members/invite/route.ts:19-21`

```ts
const { data: authData, error: authErr } = await service.auth.admin.createUser({ email, password: tmpPassword, email_confirm: true })
if (authErr || !authData?.user) return NextResponse.json({ error: authErr?.message ?? 'Auth user creation failed' }, { status: 500 })
```

- **Impact :** Si `email` est déjà dans `auth.users` (doublon d'invitation), Supabase Auth renvoie une erreur et le handler retourne 500 au lieu d'un 409 explicite avec message lisible. La contrainte `members.email unique` remonterait elle aussi un 500 à l'étape suivante. L'admin voit des erreurs 500 sans savoir pourquoi.
- **Fix suggéré :** Vérifier si l'email existe déjà dans `members` avant de créer l'auth user :
  ```ts
  const { data: existing } = await service.from('members').select('id').eq('email', email).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  ```

---

### 🟡 F14 — `proposals/[id]/convert` : race condition résiduelle entre idempotence-check et insert subject

**Fichier :** `src/app/api/proposals/[id]/convert/route.ts:23-47`

```ts
if (proposal.subject_id) {
  return NextResponse.json({ subject_id: proposal.subject_id }, { status: 200 })
}
// ... ici deux appels concurrents voient subject_id=null ...
const { data: subject, error: sErr } = await service.from('subjects').insert({...}).select().single()
```

- **Impact :** Deux appels `POST /api/proposals/[id]/convert` quasi-simultanés lisent tous les deux `subject_id = null` (car l'update n'est pas encore fait), puis insèrent chacun un sujet → doublon sujets. C'est une variante de F1 à l'entrée du flux.
- **Fix suggéré :** Même résolution que F1 : une RPC atomique ou contrainte unique sur `proposals.subject_id` (UNIQUE partial index).

---

### 🟡 F15 — `comments/route.ts GET` absent — seul `POST` déclaré

**Fichier :** `src/app/api/comments/route.ts`

- **Impact :** Il n'existe pas de route `GET /api/comments` pour lister les commentaires d'un sujet. Les composants client doivent donc requêter directement Supabase (anon key) ou utiliser une autre route. Pas de bug critique, mais potentiel de contournement de la logique auth si le client utilise l'anon key sans restriction RLS.
- **Fix suggéré :** Ajouter un handler `GET` avec filtre `?sujet_id=` — public ou protégé selon la décision produit.

---

### ⚪ F16 — `subjects/[id]/GET` : PGRST116 non distingué des autres erreurs Supabase

**Fichier :** `src/app/api/subjects/[id]/route.ts:10-12`

```ts
const { data, error } = await service.from('subjects').select('*').eq('id', id).single()
if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

- **Impact :** Toute erreur Supabase (connexion réseau, timeout) est mappée en 404. Un vrai problème serveur sera indétectable pour le monitoring. Le comportement est correct pour PGRST116, mais masque les autres erreurs.
- **Fix suggéré :**
  ```ts
  if (error?.code === 'PGRST116' || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  ```
  Même pattern dans `tasks/[id]/route.ts:13-14`.

---

### ⚪ F17 — `tasks/route.ts GET` : résultat non typé — la sélection imbriquée ne correspond pas à `TaskWithRelations`

**Fichier :** `src/app/api/tasks/route.ts:19-22`

```ts
let query = service
  .from('tasks')
  .select(`*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*)`)
```

- **Impact :** `subtasks(*)` ne charge pas les `subtask_assignees` alors que `TaskWithRelations.subtasks` attend des `Subtask` avec `assignees: MemberRef[]`. Le handler `/api/tasks/[id]` (ligne 12) charge correctement `subtasks(*, subtask_assignees(...))`, mais la route liste ne le fait pas. Les clients utilisant `/api/tasks?lab=` reçoivent des sous-tâches sans `assignees`.
- **Fix suggéré :** Harmoniser la query :
  ```ts
  .select(`*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*, subtask_assignees(member_id, members(id,prenom,nom,photo_url)))`)
  ```

---

### ⚪ F18 — `members/[id]/DELETE` : `auth.admin.deleteUser` silencieux si user non trouvé

**Fichier :** `src/app/api/members/[id]/route.ts:36-39`

```ts
await service.auth.admin.deleteUser(id)            // ignore "user not found"
const { data, error } = await service.from('members').delete().eq('id', id).select()
```

- **Impact :** C'est documenté (`// ignore "user not found"`). Comportement correct pour la gestion des membres non encore activés (pas d'auth user). Pas de bug, c'est un nit de lisibilité.
- **Fix suggéré :** Nit uniquement. La logique est correcte.

---

## Tableau de synthèse : route × méthode × verdict

| Route | Méthode | Auth requise | `await params` | Lab validé | Erreurs Supabase | PGRST116 → 404 | Verdict |
|---|---|---|---|---|---|---|---|
| `auth/sign-in` | POST | Non | N/A | N/A | ✅ | N/A | ✅ OK |
| `auth/sign-out` | POST | Non | N/A | N/A | N/A | N/A | ✅ OK |
| `auth/activate` | POST | Non | N/A | N/A | 🟠 update/delete non vérifiés (F5) | N/A | 🟠 |
| `subjects` | GET | Non | N/A | ✅ 400 | ✅ | N/A | ✅ OK |
| `subjects` | POST | requireMember | N/A | ✅ 400 | ✅ | N/A | 🟡 `.single()` sans maybeSingle (F10) |
| `subjects/[id]` | GET | Non | ✅ | N/A | ⚪ all errors → 404 (F16) | ⚪ masqué | ⚪ |
| `subjects/[id]` | PATCH | requireMember | ✅ | N/A | 🟠 PGRST116 → 500 (F6) | ❌ | 🟠 |
| `subjects/[id]` | DELETE | requireMember | ✅ | N/A | ✅ | N/A | ✅ OK |
| `subjects/[id]/order` | PATCH | requireMember | N/A | N/A | 🔴 erreurs ignorées (F2) | N/A | 🔴 |
| `tasks` | GET | Non | N/A | ✅ 400 | ✅ | N/A | ⚪ subtasks sans assignees (F17) |
| `tasks` | POST | requireMember | N/A | ✅ via body | ✅ | N/A | ✅ OK |
| `tasks/[id]` | GET | Non | ✅ | N/A | ⚪ all errors → 404 (F16) | ⚪ masqué | ⚪ |
| `tasks/[id]` | PATCH | requireMember | ✅ | N/A | 🟠 PGRST116 → 500 (F7) | ❌ | 🟠 |
| `tasks/[id]` | DELETE | requireMember | ✅ | N/A | ✅ | N/A | ✅ OK |
| `tasks/[id]/subtasks` | POST | requireMember | ✅ | N/A | ✅ | N/A | ✅ OK |
| `tasks/[id]/subtasks` | PATCH | requireMember | ❌ non utilisé | N/A | 🟡 PGRST116 non géré | ❌ | 🟡 (F11) |
| `tasks/[id]/claim` | POST | requireMember | ✅ | N/A | 🔴 insert non vérifié (F3) | N/A | 🔴 |
| `comments` | POST | Non (public+member) | N/A | N/A | ✅ | N/A | ✅ OK |
| `comments/[id]` | DELETE | requireMember | ✅ | N/A | ✅ | ✅ via select | ✅ OK |
| `publications` | GET | Non | N/A | ✅ 400 | ✅ | N/A | ✅ OK |
| `publications` | POST | requireMember | N/A | ✅ via body | ✅ | N/A | ✅ OK |
| `publications/[id]` | DELETE | requireMember | ✅ | N/A | ✅ | ✅ via select | ✅ OK |
| `members` | GET | ❌ Non (F9) | N/A | ✅ 400 | ✅ | N/A | 🟠 |
| `members/[id]` | PATCH | requireMember (self/admin) | ✅ | N/A | ✅ PGRST116 géré | ✅ | 🟠 email sync (F4) |
| `members/[id]` | DELETE | requireAdmin | ✅ | N/A | ✅ | ✅ via select | ✅ OK |
| `members/invite` | POST | requireAdmin | N/A | ✅ | 🟡 doublon → 500 (F13) | N/A | 🟡 |
| `prompts` | GET | requireMember | N/A | ✅ 400 | ✅ | N/A | ✅ OK |
| `prompts` | POST | requireMember | N/A | ✅ via body | ✅ | N/A | ✅ OK |
| `prompts/[id]` | PATCH | requireMember | ✅ | N/A | ✅ PGRST116 géré | ✅ | ✅ OK |
| `prompts/[id]` | DELETE | requireMember | ✅ | N/A | ✅ | ✅ via select | ✅ OK |
| `proposals` | GET (?ids) | Non (F12) | N/A | N/A | ✅ | N/A | 🟡 select(*) expose champs internes |
| `proposals` | GET (?lab) | requireMember | N/A | ✅ 400 | ✅ | N/A | ✅ OK |
| `proposals` | POST | Non (public) | N/A | ✅ | ✅ | N/A | ✅ OK |
| `proposals/[id]` | PATCH | requireAdmin | ✅ | N/A | ✅ PGRST116 géré | ✅ | ✅ OK |
| `proposals/[id]/convert` | POST | requireAdmin | ✅ | N/A | 🔴 updErr non bloquant (F1) | N/A | 🔴 |
| `dropbox/tree` | GET | requireMember | N/A | N/A | ✅ | N/A | ✅ OK |
| `dropbox/links` | GET | requireMember | N/A | ✅ 400 | ✅ | N/A | ✅ OK |
| `dropbox/links` | POST | requireMember | N/A | ✅ via body | ✅ | N/A | ✅ OK |
| `dropbox/links/[id]` | DELETE | requireMember | ✅ | N/A | 🟠 pas de vérif row manquante (F8) | ❌ 200 au lieu 404 | 🟠 |

---

## Résumé des findings par sévérité

| Sévérité | Nombre | IDs |
|---|---|---|
| 🔴 Critique | 3 | F1, F2, F3 |
| 🟠 Fonctionnel | 5 | F4, F5, F6, F7, F8, F9 (6 en réalité) |
| 🟡 Edge case | 5 | F10, F11, F12, F13, F14, F15 (6 en réalité) |
| ⚪ Nit | 3 | F16, F17, F18 |

> Note : F4 initial (prenom/nom admin) était une fausse alarme, annulé. Le compte exact est 🔴 3 · 🟠 6 · 🟡 6 · ⚪ 3.
