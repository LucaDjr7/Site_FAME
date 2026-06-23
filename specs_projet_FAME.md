# Spécifications du site FAME — v3

> Ce document est la référence consolidée du projet. Il intègre les maquettes fonctionnelles du design (9 pages) comme périmètre de référence, les exigences d'une implémentation réelle (authentification, persistance serveur, modèle de données, rôles) et les décisions arrêtées au cours des échanges.

---

## 1. Objectif et portée

Le site FAME est un **outil interne de l'équipe de recherche**, doublé d'une **vitrine publique** pour les personnes extérieures intéressées par le projet. Il permet de :

- Exposer les sujets de recherche en cours sous forme de fiches A4 lisibles.
- Coordonner le travail de l'équipe (tâches, avancement, affectations).
- Centraliser les ressources associées (publications, données Dropbox).
- Recueillir des propositions et commentaires de visiteurs extérieurs.

**Deux types d'accès :**
- **Visiteur** : lecture publique, commentaires identifiés, proposition de sujets.
- **Membre** : contribution active — toutes les actions de production de contenu et d'organisation.

**Deux laboratoires indépendants** : Paris et Montréal. Chaque labo possède son propre jeu de données (sujets, tâches, membres, publications, données Dropbox). Un membre appartient à un labo (ou aux deux si besoin). L'accueil permet de choisir son labo ; la navigation reste ensuite dans ce contexte.

**Langue par défaut : anglais.** Le site est intégralement en anglais. Un sélecteur de langue permet de basculer en français. Toutes les chaînes de l'interface et les libellés système sont à internationaliser (i18n). Le contenu produit par les membres (titres de fiches, descriptions…) reste dans la langue de rédaction.

---

## 2. Pages et fonctionnalités

### 2.1 Page d'accueil — *Home*

**Objectif :** point d'entrée, sélection du laboratoire.

- Globe 3D interactif (D3.js + TopoJSON) avec champ d'étoiles en fond.
- Deux pins animés (pulsation) : **Paris** et **Montréal**.
- Clic sur un pin → toast de confirmation + redirection vers la page Laboratoire du labo correspondant.
- Les deux labos sont indépendants : données, équipe et tâches entièrement séparés.
- Sélecteur de langue (EN / FR) accessible depuis cette page et persistent dans toutes les pages.

---

### 2.2 Page Laboratoire — *Lab*

**Objectif :** vue d'ensemble des sujets de recherche du labo sélectionné.

**Affichage**
- Grille de fiches A4 (posters). Chaque fiche affiche : titre, kicker thématique, statut coloré, liste des auteurs, date, dimensions de recherche (Method / Data / Theory / Writing).
- **Barre de progression du sujet** : barre segmentée dont chaque segment représente une tâche liée au sujet. Segment vide = tâche non terminée, segment plein = tâche terminée. La largeur de chaque segment est identique (barre entière divisée en N parts égales). Affiche le ratio ex. `3 / 7 tasks`.
- Au survol : zoom scale(1.4) avec hitbox élargie pour confort de lecture.
- Au clic : navigation vers la vue détaillée du sujet (page Paper).
- Réorganisation par glisser-déposer (drag-to-reorder) entre fiches (membres uniquement).

**Filtres (sidebar)**
- Filtres par 4 dimensions : Method, Data, Theory, Writing.
- Compteur dynamique par option.
- Tri par date (croissant / décroissant).
- Barre de recherche plein texte sur titre et kicker.
- Réduction / expansion de la sidebar.

**Mode édition (membres uniquement)**
- Ajout d'une fiche via modal : titre, kicker, statut, description, dimensions, auteurs.
- Suppression d'une fiche avec confirmation.
- Badge DONE sur les fiches marquées comme telles.
- Drag-to-reorder activé uniquement en mode édition.

**Persistance**
- Ordre des fiches, fiches supprimées, contenu : stockés en BDD côté serveur.

---

### 2.3 Vue détaillée d'une fiche — *Paper*

**Objectif :** consultation et collaboration sur un sujet de recherche.

**Layout**
- Colonne centrale : fiche A4 complète (titre, kicker, statut, auteurs, date, Context, Method, Results, Keywords).
- **Barre de progression flottante** : même logique segmentée que sur la page Lab — chaque segment = une tâche liée, plein si terminée.
- Panel gauche (togglable) : **Linked tasks** — liste des tâches du sujet avec statut, assignés, barre de progression segmentée par sous-tâches de la tâche.
- Panel droit : deux onglets —
  - **Files & links** : liste des ressources associées (dont lien Dropbox du dossier du sujet), ajout de liens URL manuels.
  - **Comments** : fil de commentaires chronologique, champ de saisie.
- Bande de navigation en bas : thumbnails des autres fiches, clic pour naviguer directement sans repasser par la liste.

**Édition du contenu de la fiche (membres)**
- En mode édition, tous les champs de la fiche sont éditables inline : titre, kicker, statut, auteurs, date, Context, Method, Results, Keywords.
- Sauvegarde automatique avec debounce (2 s après la dernière frappe) + indicateur visuel "Saved".

**Commentaires**
- Visiteur : saisie obligatoire du prénom et nom avant de poster ; affichés en en-tête du commentaire.
- Membre : le nom du membre est automatiquement associé au commentaire (tiré du profil connecté).
- Horodatage affiché sur chaque commentaire.
- **Tout membre connecté peut supprimer n'importe quel commentaire** (pas de restriction au seul auteur ou admin).
- Pas de modération préalable.

---

### 2.4 Page des tâches — *Tasks*

**Objectif :** tableau de bord de coordination de l'équipe.

**Vue kanban**
- Colonnes : une par sujet de recherche actif du labo.
- Chaque carte de tâche affiche : statut coloré (To do / In progress / Done), titre, **barre segmentée** (N segments = N sous-tâches, plein si la sous-tâche est cochée), difficulté (3 niveaux), avatars des assignés, date.
- Si aucun assigné : bouton "Claim task" pour s'affecter en un clic (membres uniquement).
- Scroll horizontal entre colonnes, scroll vertical dans chaque colonne.

**Barre de progression segmentée des tâches**
- La barre entière a toujours la même largeur physique, divisée en N segments égaux (N = nombre de sous-tâches).
- Si une tâche n'a pas de sous-tâches, la barre est soit vide (statut "To do"), soit à moitié pleine (statut "In progress"), soit pleine (statut "Done") — représentation approximative.
- La barre se met à jour en temps réel quand une sous-tâche est cochée.

**Modal de détail d'une tâche**
- Sélecteur de statut (To do / In progress / Done).
- Niveau de difficulté (Easy / Intermediate / Advanced).
- Section **Assignees** : liste des membres assignés avec bouton de retrait individuel (admin = peut retirer n'importe qui ; membre = peut se retirer soi-même uniquement).
- Bouton "Claim / Unclaim" pour s'ajouter ou se retirer.
- Liste de **sous-tâches** avec toggle done/undone et barre segmentée mise à jour en direct.
- Description textuelle.
- Date de création et sujet associé.
- **Historique** : liste déroulante des modifications (statut, assignations, sous-tâches) avec auteur et horodatage.

**Sous-tâches et assignation**
- À la création d'une tâche, les sous-tâches héritent automatiquement des mêmes assignés que la tâche parente.
- Chaque sous-tâche peut ensuite être réassignée indépendamment à un sous-ensemble de membres.

**Filtres (sidebar)**
- Par sujet, statut, difficulté, personne assignée, date.
- Réinitialisation en un clic.
- Compteurs dynamiques par option.
- Bascule "Hide completed tasks".

**Actions membres**
- Ajout d'une tâche via modal : titre (requis), statut, difficulté, assignés initiaux, description, sous-tâches (avec leur assignation initiale héritée).
- Suppression avec confirmation (mode édition).

---

### 2.5 Page des données Dropbox — *Data*

**Objectif :** naviguer dans l'arborescence Dropbox et relier les dossiers aux sujets/tâches.

**Accessible aux membres uniquement.**

**Explorateur de fichiers**
- Arborescence Dropbox rendue par le backend (token Dropbox jamais exposé au front).
- Dossiers et fichiers avec icônes distinctes, expansion/réduction des nœuds.
- Sélection d'un nœud → panel de détail à droite.

**Panel de liaison**
- Un nœud peut être lié à un **sujet** (liste déroulante) et/ou une **tâche** (liste filtrée par sujet).
- Ces liaisons sont stockées en BDD et apparaissent dans la page Paper du sujet (onglet Files & links).
- Suppression d'une liaison depuis le panel.
- Indicateur visuel sur les nœuds déjà liés.

**Sécurité**
- Token Dropbox exclusivement en variable d'environnement côté serveur.
- Le front reçoit uniquement le JSON de l'arborescence via `/api/dropbox/tree`.
- Route protégée : membre authentifié requis.
- Accès en lecture seule depuis le site.

---

### 2.6 Publications — *Publications*

**Objectif :** bibliothèque des publications de l'équipe (par labo).

- Liste groupée par année, ordre décroissant.
- Types : article, preprint, conference, working paper.
- Chaque entrée : auteurs, titre, revue/conférence, année, type, lien (DOI ou URL).
- **Filtres** : type, auteur, année, recherche plein texte sur titre.
- **Mode édition (membres)** : ajout et suppression de publications.

---

### 2.7 Trombinoscope — *Team*

**Objectif :** annuaire de l'équipe FAME, par labo.

**Affichage**
- Membres groupés par rôle : Direction / Researchers / PhD Students / Engineering.
- Chaque carte : photo (ou avatar coloré avec initiales), nom, rôle, domaines de recherche, email, labo.

**Gestion des profils**
- **Création** : réservée à un admin. L'admin crée le profil et invite le membre par email (génération d'un lien d'activation + définition du mot de passe).
- **Modification** : chaque membre peut modifier **son propre profil** (photo, domaines, email). Les champs nom, rôle, labo restent modifiables par l'admin uniquement.
- **Suppression** : admin uniquement, avec confirmation.

**Page de profil individuelle** *(phase secondaire)*
- Informations complètes du membre.
- Liste des tâches sur lesquelles la personne est affectée.
- Accessible via clic sur une carte du trombinoscope.

---

### 2.8 Bibliothèque de prompts — *Prompts*

**Objectif :** centraliser les gabarits de prompts IA pour produire du contenu standardisé.

**Accessible aux membres uniquement.**

- Liste filtrable par type cible : subject, publication, data, member, task.
- Chaque prompt : titre, type, texte, date de création.
- **Copier en un clic** (presse-papier).
- **Mode édition (membres)** : ajout, édition inline, suppression.
- 5 prompts de départ préconfigurés.

---

### 2.9 Proposition de sujet — *Propose*

**Objectif :** recueillir des idées de sujets de recherche de toute personne.

**Accessible à tous.**

**Formulaire**
- Champs : titre (requis), domaine (liste déroulante), niveau de difficulté, description, prénom, nom, email (optionnel — nécessaire pour recevoir un retour).
- Validation côté client et côté serveur.
- Mention RGPD au bas du formulaire (voir §RGPD).

**Workflow de validation**
- À la soumission : notification envoyée à tous les membres du labo concerné *(implémentation ultérieure)*.
- La proposition apparaît dans le tableau de bord admin (`/admin/proposals`).
- Seul un admin accepte ou refuse.
- Si email fourni : mail de retour automatique au visiteur après décision.
- Proposition acceptée → convertible en fiche sujet directement depuis l'interface admin.

**Sidebar de suivi**
- Session en cours : liste des propositions soumises avec statut.
- Membre connecté : toutes les propositions du labo.

---

## 3. Rôles et permissions

| Action | Visiteur | Membre | Admin |
|---|---|---|---|
| Consulter le site (pages publiques) | ✅ | ✅ | ✅ |
| Commenter une fiche (prénom + nom requis) | ✅ | ✅ | ✅ |
| Supprimer un commentaire | ❌ | ✅ | ✅ |
| Proposer un sujet | ✅ | ✅ | ✅ |
| Accéder aux pages Data et Prompts | ❌ | ✅ | ✅ |
| Ajouter une fiche / tâche / publication / prompt | ❌ | ✅ | ✅ |
| Éditer le contenu d'une fiche existante | ❌ | ✅ | ✅ |
| Éditer une tâche (statut, sous-tâches) | ❌ | ✅ | ✅ |
| S'affecter à une tâche (Claim / Unclaim soi-même) | ❌ | ✅ | ✅ |
| Lier un dossier Dropbox à un sujet / tâche | ❌ | ✅ | ✅ |
| Supprimer une fiche / tâche / publication / prompt | ❌ | ✅ | ✅ |
| Modifier son propre profil (photo, domaines, email) | ❌ | ✅ | ✅ |
| Désaffilier quelqu'un d'une tâche | ❌ | ❌ | ✅ |
| Valider / refuser une proposition | ❌ | ❌ | ✅ |
| Convertir une proposition en fiche | ❌ | ❌ | ✅ |
| Créer un profil membre + envoyer invitation | ❌ | ❌ | ✅ |
| Modifier nom / rôle / labo d'un membre | ❌ | ❌ | ✅ |
| Supprimer un profil membre | ❌ | ❌ | ✅ |
| Configurer Dropbox (token, racine) | ❌ | ❌ | ✅ |
| Accéder au tableau de bord `/admin` | ❌ | ❌ | ✅ |

**Authentification : email + mot de passe.**
- Pas d'auto-inscription : un admin invite manuellement un membre (email d'activation).
- Sessions persistantes (cookie httpOnly signé).
- Le mode "visiteur" est l'état par défaut — aucune connexion requise pour consulter.

---

## 4. Modèle de données

### Sujet (Subject)

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| labo | enum | `paris` \| `montreal` |
| titre | string | |
| kicker | string | Sous-titre thématique |
| statut | enum | `active` \| `done` \| `on-hold` |
| context | text | |
| method | text | |
| results | text | |
| keywords | string[] | |
| auteurs | MemberRef[] | |
| dimensions | object | `{ method, data, theory, writing }` (valeurs texte) |
| dropbox_path | string \| null | Chemin du dossier Dropbox lié |
| ordre | int | Ordre d'affichage dans la grille |
| created_at | datetime | |
| updated_at | datetime | |

**Progression d'un sujet** = tâches `done` / total tâches liées (calculé à la volée).

### Tâche (Task)

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| labo | enum | Hérité du sujet principal |
| titre | string | |
| description | text | |
| statut | enum | `to-do` \| `in-progress` \| `done` |
| difficulte | enum | `easy` \| `intermediate` \| `advanced` |
| sujet_id | UUID | Sujet principal (relation directe) |
| assignes | MemberRef[] | Many-to-many via `task_assignee` |
| date_creation | datetime | |
| date_echeance | datetime \| null | |

> Prévoir une table `task_subject` (many-to-many) dès la conception même si l'usage courant est 1 sujet par tâche, pour éviter une refonte future.

**Progression d'une tâche** = sous-tâches `done` / total sous-tâches (calculé à la volée).

### Sous-tâche (SubTask)

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| task_id | UUID | Tâche parente |
| label | string | |
| done | boolean | |
| ordre | int | |
| assignes | MemberRef[] | Hérité des assignés de la tâche parente à la création ; modifiable ensuite indépendamment |

### Historique des tâches (TaskHistory)

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| task_id | UUID | |
| auteur_id | UUID | Membre ayant effectué la modification |
| champ | string | Ex. `statut`, `assignes`, `subtask:done` |
| valeur_avant | jsonb | |
| valeur_apres | jsonb | |
| created_at | datetime | |

### Commentaire (Comment)

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| sujet_id | UUID | |
| auteur_type | enum | `visitor` \| `member` |
| auteur_nom | string | Nom du visiteur ou du membre |
| membre_id | UUID \| null | |
| texte | text | |
| created_at | datetime | |

### Proposition (Proposal)

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| labo | enum | Labo cible |
| titre | string | |
| domaine | string | |
| difficulte | enum | |
| description | text | |
| proposant_prenom | string | |
| proposant_nom | string | |
| proposant_email | string \| null | |
| statut | enum | `pending` \| `accepted` \| `rejected` |
| commentaire_admin | text \| null | |
| created_at | datetime | |
| traitee_at | datetime \| null | |
| traitee_par | UUID \| null | |

### Membre (Member)

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| prenom | string | Admin uniquement |
| nom | string | Admin uniquement |
| email | string | Modifiable par le membre |
| role | enum | `direction` \| `researcher` \| `phd` \| `engineering` |
| labo | enum | `paris` \| `montreal` (ou les deux) |
| domaines | string[] | Modifiable par le membre |
| photo_url | string \| null | Modifiable par le membre |
| is_admin | boolean | |
| password_hash | string | |
| activated_at | datetime \| null | Null si invitation en attente |
| created_at | datetime | |

### Publication (Publication)

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| labo | enum | |
| titre | string | |
| auteurs | string[] | |
| annee | int | |
| type | enum | `article` \| `preprint` \| `conference` \| `working-paper` |
| revue_ou_conf | string \| null | |
| lien | string \| null | |
| created_at | datetime | |

### Prompt (Prompt)

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| labo | enum | |
| titre | string | |
| type_cible | enum | `subject` \| `publication` \| `data` \| `member` \| `task` |
| texte | text | |
| created_by | UUID | |
| created_at | datetime | |

---

## 5. Intégration Dropbox

**Niveau retenu : option intermédiaire.** Le design l'implémente déjà ; c'est le bon niveau d'utilité pour l'équipe.

- Compte Dropbox "service" dédié au projet FAME, géré par l'admin.
- **Token** stocké en variable d'environnement serveur, jamais exposé au front.
- Le backend expose `/api/dropbox/tree` (membre requis) → retourne l'arborescence JSON.
- Liaison dossier/fichier ↔ sujet/tâche stockée en BDD.
- Chaque labo peut avoir sa propre racine Dropbox configurée par l'admin.
- Accès en lecture seule depuis le site.

---

## 6. Stack technique

### Recommandation principale

| Couche | Choix | Raison |
|---|---|---|
| Framework full-stack | **Next.js** (App Router, TypeScript) | SSR + RSC natifs, routing file-based, API Routes intégrées, déploiement Vercel zéro-config |
| Base de données | **PostgreSQL** via **Supabase** | Managé, généreux en free tier, inclut auth + storage |
| Authentification | **Supabase Auth** | Email + mot de passe, gestion des sessions, invitations par email, intégré avec la BDD |
| Hébergement | **Vercel** | Déploiement automatique depuis Git, CDN mondial, preview per-branch, DX excellente |
| Stockage fichiers (photos) | **Supabase Storage** | Inclus dans Supabase, S3-compatible, RLS natif |
| Email transactionnel | **Resend** | API simple, 3 000 emails/mois gratuits, fiable |
| Dropbox | SDK Dropbox JS côté serveur uniquement | |
| i18n | **next-intl** | Conçu pour Next.js App Router, typé, léger, routing par locale intégré |

---

### Comparatif hébergement détaillé

#### Vercel ⭐ (recommandé pour le front)

**Tarification**
- **Hobby** : gratuit. 100 GB bandwidth, 100 000 requêtes serverless/jour, pas de domaine custom sur les Edge Functions (mais custom domain OK sur les pages).
- **Pro** : 20 $/mois par utilisateur. Bandwidth illimitée raisonnable, 1 000 000 requêtes/mois, preview deployments illimités, support standard.
- **Team** : 20 $/mois par membre.

**Avantages**
- Déploiement en 1 clic depuis GitHub/GitLab/Bitbucket.
- Preview deployment automatique à chaque PR — très pratique pour tester des features sans toucher la prod.
- CDN mondial intégré, HTTPS automatique.
- Supporte Next.js nativement, zéro configuration requise.
- Analytics basiques inclus (Web Vitals).
- Zero-config pour la plupart des setups.

**Inconvénients**
- Serverless uniquement : pas de process persistant → les connexions BDD doivent passer par un pool (Supabase gère ça).
- Pas de WebSockets natifs (remplacé par Server-Sent Events ou Supabase Realtime si nécessaire).
- Le plan gratuit limite à 1 membre dans l'équipe Vercel (collaboration limitée).
- Cold starts sur les Edge Functions (généralement < 100 ms mais perceptibles parfois).

---

#### Railway

**Tarification**
- **Starter** : 5 $/mois (crédit inclus). ~500 heures de runtime/mois.
- **Pro** : 20 $/mois + usage (0,000463 $/vCPU/minute, 0,000231 $/GB RAM/minute). PostgreSQL : ~0,10–0,30 $/Go stockage/mois.
- En pratique pour un projet comme FAME : **10–30 $/mois** tout compris.

**Avantages**
- Vraie VM (pas serverless) : connexions BDD persistantes, pas de cold starts, WebSockets natifs.
- PostgreSQL intégré directement dans Railway (pas besoin d'un service tiers).
- Docker natif : déploiement de n'importe quel service.
- Interface simple, déploiement via GitHub.
- Logs et métriques intégrés.

**Inconvénients**
- Pas de CDN intégré (il faut Cloudflare en front si nécessaire).
- Preview deployments moins fluides qu'avec Vercel.
- Prix peut grimper si le trafic ou le volume de données augmente.
- Moins de documentation/communauté que Vercel.

---

#### Fly.io

**Tarification**
- **Free allowance** : 3 VMs partagées (256 MB RAM), 3 GB stockage, 160 GB bandwidth/mois gratuits.
- **Pay-as-you-go** : VM shared-cpu-1x (256 MB) ≈ 1,94 $/mois. PostgreSQL managé ≈ 0,15 $/GB/mois. En pratique : **5–15 $/mois** pour un petit projet.

**Avantages**
- VMs légères ("Fly Machines") qui s'arrêtent quand inactives → très économique.
- PostgreSQL managé intégré avec réplication possible.
- Déploiement Docker, contrôle fin de l'infrastructure.
- Bonne performance grâce aux edge locations.

**Inconvénients**
- Courbe d'apprentissage plus haute (CLI flyctl, TOML de config).
- Interface web moins intuitive que Railway ou Render.
- Moins adapté si l'équipe n'a pas de profil DevOps.

---

#### Render

**Tarification**
- **Free** : web service gratuit avec sleep après 15 min d'inactivité (cold start de ~30 s au réveil). PostgreSQL gratuit limité à 90 jours.
- **Individual** : 7 $/mois pour un web service sans sleep. PostgreSQL à partir de 7 $/mois.
- En pratique : **14–20 $/mois** sans le free tier.

**Avantages**
- Interface très simple, similaire à Heroku.
- PostgreSQL managé intégré.
- Pas de limite de membres.

**Inconvénients**
- Cold starts sur le plan gratuit (rédhibitoire pour un outil d'équipe).
- Moins de fonctionnalités que Vercel (pas de preview deployments automatiques).
- Performance CPU inférieure à Fly ou Railway à prix égal.

---

#### Supabase *(BDD + Auth + Storage — pas hébergement applicatif)*

**Tarification**
- **Free** : 500 MB BDD, 1 GB Storage, 50 000 MAU Auth, 2 projets. Pause automatique après 1 semaine d'inactivité.
- **Pro** : 25 $/mois. 8 GB BDD, 100 GB Storage, MAU illimités, pas de pause. Suffisant pour FAME.
- **Add-ons** : stockage supplémentaire à 0,021 $/GB/mois.

**Avantages**
- PostgreSQL managé + Auth + Storage + Edge Functions en un seul service.
- RLS (Row Level Security) natif : les règles d'accès par rôle peuvent être exprimées directement en SQL.
- Dashboard très bien fait pour inspecter les données.
- SDK JS complet.
- Realtime intégré (WebSockets) — utile si on veut de la collaboration en temps réel plus tard.

**Inconvénients**
- Pause automatique sur le plan gratuit (problématique en production).
- Vendor lock-in partiel (mais Supabase est open-source et auto-hébergeable).
- La couche Auth peut sembler redondante si on écrit soi-même la logique de sessions.

---

### Combinaison recommandée pour FAME

```
Next.js (App Router, TypeScript) — front + API Routes
  └── déployé sur Vercel (Hobby pour les tests, compte labo pour la prod)
        └── connecté à Supabase Pro (25 $/mois)
              ├── PostgreSQL (toutes les tables)
              ├── Auth (sessions, invitations)
              └── Storage (photos membres)
        └── Resend (emails transactionnels, ~gratuit au démarrage)
        └── SDK Dropbox JS (côté serveur, token en variable d'environnement)
```

**Portabilité hébergement** : le build Next.js est portable. Passer d'un compte Vercel Hobby (test) à un compte Pro/labo se fait en reconnectant le repo Git et en recopiant les variables d'environnement — la base Supabase ne bouge pas.

**Coût estimé en production**
- Vercel Hobby (gratuit) + Supabase Pro (25 $/mois) + Resend (gratuit jusqu'à 3 000 emails/mois) = **~25 $/mois**.
- Si Vercel Pro nécessaire (collaboration d'équipe sur la plateforme Vercel) : **~45 $/mois**.

---

## 7. RGPD

Le site collecte des données personnelles (noms et emails de visiteurs dans les commentaires et propositions, profils membres). Les mesures suivantes s'appliquent :

- **Mention d'information** affichée sur le formulaire de commentaire et le formulaire de proposition : finalité de la collecte, durée de conservation, droit de suppression.
- **Page de politique de confidentialité** accessible depuis le footer : données collectées, responsable de traitement, droits des personnes (accès, rectification, suppression).
- **Droit à l'oubli** : un visiteur peut demander la suppression de ses commentaires ou propositions (via email de contact affiché dans la politique).
- **Durée de conservation** : à définir (suggestion : commentaires et propositions conservés 3 ans).
- **Cookies** : uniquement le cookie de session (httpOnly, nécessaire au fonctionnement) — pas de cookies de tracking. Pas de bandeau RGPD requis si uniquement des cookies strictement nécessaires.
- **Hébergement** : si Supabase (Irlande, UE) et Vercel (CDN mondial — à vérifier la localisation des données au repos), vérifier la conformité ou opter pour une région EU explicitement.

---

## 8. Points tranchés

- [x] **Sous-tâches** : les avatars d'assignés ne sont **pas** affichés par sous-tâche dans le modal — seule la tâche parente affiche ses assignés. *(Confirmé par le design.)*
- [x] **Modération des commentaires** : pas de log de suppression requis. Tout membre connecté peut supprimer n'importe quel commentaire, sans trace d'audit. *(Acté.)*
- [x] **Notifications** : implémentation ultérieure (phase 3+). Email uniquement dans un premier temps.
- [x] **Mobile** : desktop-first pour la v1, responsive mobile en v2. *(Confirmé.)*
- [x] **Détail du profil membre** : champs v1 = nom, photo, rôle, domaines de recherche, email. Pas de biographie, ORCID ou page perso en v1. *(Confirmé par le design.)*
- [x] **Lien Dropbox** : un dossier peut être lié à **plusieurs** sujets simultanément (tableau de liaisons côté BDD, pas un simple champ `dropbox_path` par sujet). Modèle de données à adapter : table `dropbox_link` (`node_id`, `subject_id | task_id`). *(Confirmé par le design.)*
- [x] **Labo Montréal** : même structure de site que Paris (mêmes pages, mêmes rôles, même UX). Données entièrement séparées. Labo Montréal démarre **vide** au lancement — les membres et sujets seront saisis par l'admin Montréal après ouverture.
- [x] **Langue** : anglais par défaut. Sélecteur EN / FR disponible sur toutes les pages. Toutes les chaînes d'interface sont à internationaliser (`next-intl`). Le prototype de design est en français — les deux versions (EN + FR) sont à implémenter dès la v1.
- [x] **Admin initial** : `luca.desjardin@dauphine.eu`. Ce compte est créé automatiquement au premier déploiement (via un script de seed). L'email et le mot de passe sont modifiables par l'admin depuis son profil.
- [x] **Contenu au lancement** : la base de données démarre vide pour les deux labos (aucun sujet, aucune tâche, aucune publication, aucun membre sauf l'admin). Tout le contenu est saisi manuellement via l'interface du site après déploiement. Le script de seed se limite à la création du compte admin initial.

---

## 9. Priorisation — MVP

### Phase 1 — Cœur public et navigation
1. Page Home (globe, sélection labo, sélecteur de langue EN/FR).
2. Page Lab : grille de fiches, filtres, recherche, barre de progression segmentée.
3. Page Paper : affichage complet, navigation entre fiches, commentaires (visiteurs + membres).
4. Authentification : email + mot de passe, sessions, invitation par admin.

### Phase 2 — Outil d'équipe
5. Mode édition sur Lab et Paper (ajout, édition, suppression de fiches).
6. Page Tasks : kanban, modal détail, assignations, sous-tâches, barre segmentée, historique.
7. Page Propose + workflow admin (`/admin/proposals`).

### Phase 3 — Ressources et outillage
8. Page Data (intégration Dropbox, liaisons).
9. Page Publications.
10. Page Prompts.
11. Page Team (Trombinoscope) — affichage + gestion admin des profils.
12. Emails transactionnels (validation de proposition, invitation membre).
13. Page de politique de confidentialité (RGPD).

### Phase 4 — Améliorations secondaires
- Page de profil individuelle membre avec ses tâches.
- Drag-to-reorder des fiches persisté côté serveur.
- Notifications in-app.
- Responsive mobile.
