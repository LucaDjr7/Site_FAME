# Récapitulatif du projet — Site FAME

## 1. Objectif

Mettre en lumière le projet FAME en exposant de manière concrète ses avancements à toute personne intéressée. Le site a deux types d'accès :

- **Visiteur** : consultation, commentaires, propositions de sujets.
- **Membre** : contribution active (création, édition, affectation aux tâches).

Une hiérarchie de rôles existe au sein des membres (voir section 3).

---

## 2. Structure du site et navigation

### 2.1 Page d'accueil
- Choix du labo : **Montréal** ou **Paris**.
- Redirige vers la page du labo concerné.

### 2.2 Page d'un labo
- Affiche l'ensemble des **fiches A4** (une fiche = un sujet).
- Au survol : effet de zoom sur la fiche (hitbox élargie par rapport à la fiche visuelle).
- Au clic : ouverture de la fiche en grand.

### 2.3 Vue détaillée d'une fiche
- Affichage en grand de la fiche A4.
- Navigation vers les autres fiches sans repasser par la liste.
- Section **commentaires** (visiteurs et membres).
- Section **liens utiles**.
- Section **tâches liées** à ce sujet.

### 2.4 Page des tâches
- Tâches classées par sujet, avec détail et avancement.
- Possibilité de s'affecter à une tâche (membres uniquement).
- Visible par les visiteurs, mais affectation réservée aux membres.

### 2.5 Trombinoscope
- Vue globale (pas de séparation par labo).
- Affiche : nom, photo, rôle.
- Profil par personne (à confirmer dans le détail) montrant les tâches sur lesquelles la personne est affectée.

### 2.6 Page de proposition de sujet
- Formulaire standardisé, accessible comme une page à part entière du site.
- Ouvert aux visiteurs.

Navigation fluide entre toutes les pages.

---

## 3. Rôles et permissions

| Action | Visiteur | Membre | Admin |
|---|---|---|---|
| Consulter le site | ✅ | ✅ | ✅ |
| Commenter | ✅ (nom + prénom requis) | ✅ | ✅ |
| Proposer un sujet | ✅ | ✅ | ✅ |
| Ajouter une fiche / tâche | ❌ | ✅ | ✅ |
| Éditer une fiche / tâche existante | ❌ | ✅ | ✅ |
| S'affecter à une tâche | ❌ | ✅ | ✅ |
| Accéder aux données Dropbox | ❌ | ✅ | ✅ |
| Gérer l'accès Dropbox | ❌ | ❌ | ✅ |
| Gérer les profils des membres | ❌ | ❌ | ✅ |
| Désaffilier quelqu'un d'une tâche | ❌ | ❌ | ✅ |
| Valider une proposition de sujet | ❌ | ❌ | ✅ |

**Inscription membre** : validation manuelle par un admin (pas d'auto-inscription).

**Affectation aux tâches** : un membre peut s'affecter à plusieurs tâches simultanément.

---

## 4. Modèle de données (résumé)

### Sujet / Fiche
- Un sujet = une fiche A4.
- Si des sous-thèmes apparaissent, ils sont détaillés sur la page dédiée au sujet (pas de fiches multiples par sujet).
- Contenu modifiable par **tous les membres** (pas de restriction par niveau sur ce point précis).
- Origine des fichiers de la fiche : import direct à la création, **ou** récupération depuis Dropbox. Les deux modes doivent être possibles.

### Tâche
- Appartient normalement à **un seul sujet**.
- ⚠️ Décision technique : prévoir une relation **many-to-many** (table de liaison tâche ↔ sujet) dès la conception, même si dans l'usage courant une tâche n'aura qu'un seul sujet. Cela évite une refonte si un cas de tâche transverse apparaît.
- Possède un **historique** des modifications/affectations.
- Peut avoir des **sous-tâches**.
- Champs à finaliser : titre, description, avancement, priorité, deadline, fichiers liés (à confirmer précisément).

### Commentaire
- Visiteur : doit renseigner nom + prénom au moment de poster.
- Pas de modération préalable mentionnée — à reconfirmer si nécessaire.

### Proposition de sujet (par un visiteur)
- Passe par un formulaire standardisé (page dédiée).
- Tous les membres sont notifiés de la proposition.
- **Seuls les admins valident** (acceptent ou refusent) la proposition.
- Si le visiteur s'est identifié, il reçoit un retour par mail suite à la décision.
- Risque de spam jugé faible — pas de mesure anti-spam prévue pour l'instant.

### Profil membre
- Champs : nom, photo, rôle.
- Rempli par un admin ou une personne autorisée (pas par le membre lui-même).
- Affiche les tâches sur lesquelles la personne est affectée.

---

## 5. Intégration Dropbox

- Compte Dropbox **partagé**, géré côté admin (un seul Dropbox, accès identique pour tous les membres ayant les droits).
- Objectif : permettre de savoir où se trouvent, dans l'arborescence Dropbox, les données liées à un sujet ou une tâche donné.
- Réservé aux membres (visiteurs n'y ont pas accès).
- **Niveau d'intégration à trancher** :
  - *Option simple (recommandée pour la v1)* : un lien Dropbox stocké en texte par sujet/tâche, mis à jour manuellement par les membres/admins. Aucune donnée sensible stockée côté site.
  - *Option intermédiaire* : compte Dropbox "service" avec token API stocké côté serveur, permettant d'afficher une arborescence dans le site (lecture seule possible).
  - *Option avancée (non recommandée sauf besoin avéré)* : connexion OAuth individuelle par membre.
- Sécurité : dans tous les cas, ne jamais exposer de token Dropbox côté front-end ; accès en lecture de préférence.

---

## 6. Technique

- **Développement** : custom (pas de no-code/CMS).
- Reste à définir : framework front, backend, base de données, hébergement, responsable de la maintenance post-livraison.
- Design en cours de réflexion séparément.

---

## 7. Points encore ouverts / à trancher

- [ ] Champs exacts d'une tâche (avancement en %, ou statuts fixes type "à faire / en cours / terminé" ?).
- [ ] Les sous-tâches ont-elles leur propre affectation indépendante de la tâche parente ?
- [ ] Modération des commentaires : a posteriori, ou aucune modération prévue ?
- [ ] Choix de la stack technique (front, back, hébergement).
- [ ] Site multilingue (français / anglais, vu Paris / Montréal) ?
- [ ] Responsive mobile : priorité ou non ?
- [ ] Conformité RGPD : politique de confidentialité pour les données collectées (noms/emails des visiteurs, profils membres).
- [ ] Niveau d'intégration Dropbox à choisir définitivement (voir section 5).
- [ ] Détail exact du contenu d'un profil membre (au-delà de nom/photo/rôle) — mentionné comme "à discuter".

---

## 8. Priorisation suggérée pour une v1 (MVP)

1. Accueil + sélection labo + liste des fiches + vue détaillée.
2. Authentification avec rôles (visiteur / membre / admin).
3. Page des tâches avec affectation simple (sans sous-tâches dans un premier temps).
4. Commentaires + formulaire de proposition de sujet + validation admin.
5. Lien Dropbox en version simple (texte/URL).
6. Trombinoscope + profils.
7. Sous-tâches, historique détaillé, intégration Dropbox avancée si besoin confirmé.
