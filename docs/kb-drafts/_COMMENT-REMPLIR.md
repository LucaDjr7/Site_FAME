# Comment compléter la KB de l'assistant (Astra)

Ce dossier `docs/kb-drafts/` contient des **brouillons à compléter**. Il n'est **PAS** indexé par l'assistant (l'indexeur ne lit que `docs/kb/` à plat). Tu peux donc y laisser des `[À COMPLÉTER]` sans risque.

## Workflow
1. Ouvre un fichier de ce dossier et **remplace chaque `[À COMPLÉTER : …]`** par ta réponse (en français, 2–6 phrases par section suffisent).
2. Quand un fichier est prêt, **déplace-le** (ou copie son contenu) dans `docs/kb/` :
   `mv docs/kb-drafts/recherche.md docs/kb/recherche.md`
3. Relance l'indexation : `npm run index:rag`.
4. Dis-moi quand un lot est rempli : je génère la **version anglaise** (`*-en` ou `*.md` lang:en) correspondante et on réindexe.

## Règles d'écriture (pour que le RAG réponde bien)
- **Une section = une question/un thème** (titre `## …`). Chaque section devient un « chunk » récupérable. Garde-les autonomes (compréhensibles seules).
- **Sois factuel et concret.** Ce que tu écris, l'assistant le citera comme vérité. Si tu ne sais pas / ne veux pas publier, supprime la section ou écris « non communiqué ».
- **Pas d'emails ni de coordonnées personnelles** (PII) : l'assistant a l'interdiction de les diffuser de toute façon.
- Ne touche pas au **frontmatter** en haut (`lang:` / `labo:`) — il est déjà prêt. (`labo:` vide = info valable pour les deux labos ; mets `paris` ou `montreal` si la section ne concerne qu'un labo.)
- Supprime les sections qui ne s'appliquent pas. Ajoute-en si besoin (même format `## …`).

## Fichiers de ce dossier
- `recherche.md` — le programme scientifique (objectif, données, méthodes, axes, résultats).
- `equipe-gouvernance.md` — organisation, rôles, rattachement, contact.
- `contribuer.md` — proposer un sujet, devenir membre, workflow de contribution.
- `donnees-publications.md` — jeux de données, accès, publications.
- `glossaire.md` — définitions (j'ai pré-rempli les termes généraux ; valide/complète les spécifiques FAME).
- `faq-supplement.md` — questions fréquentes (certaines pré-remplies, d'autres à compléter).

## Déjà fait (dans `docs/kb/`, contenu réel en+fr — à relire/ajuster si besoin)
`about-fame`, `faq`, `using-the-platform`. Tu peux les enrichir directement.
