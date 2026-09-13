# FAME Website

Site web interne + vitrine publique pour deux laboratoires de recherche indépendants, **Paris** et **Montréal** :

- **Visiteurs** — lecture publique des fiches sujets, publications, équipe ; commentaires et proposition de sujets
- **Membres** — contribution active (tâches, fiches sujets, publications, fichiers, assistant Astra)
- **Admin** — gestion des membres, validation des propositions, configuration Dropbox

## Stack technique

| Couche | Choix |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| UI | React 19, Tailwind CSS v4 |
| BDD + Auth | Supabase (`@supabase/ssr`) |
| i18n | next-intl (`en` / `fr`) |
| Email | Resend |
| Fichiers | Dropbox JS SDK (server-only) |
| Assistant | RAG maison (« Astra ») sur `rag_chunks` |

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner les variables (Supabase, Dropbox, Resend, OpenAI, ...)
npm run dev                  # http://localhost:3000
```

Autres commandes utiles :

```bash
npm run build          # build de production
npx tsc --noEmit        # vérification TypeScript
npm run lint            # ESLint
npm test                # suite de tests (Vitest)
npm run seed:admin      # créer le compte admin initial (SEED_ADMIN_* dans .env.local)
npm run index:rag       # (ré)indexer le contenu pour l'assistant Astra
```

## Documentation

- [`AGENTS.md`](./AGENTS.md) — conventions de code, structure des fichiers, règles i18n/sécurité
- [`CLAUDE.md`](./CLAUDE.md) — guide de session pour le développement assisté
- [`docs/STATUS.md`](./docs/STATUS.md) — état d'avancement, dernières tâches livrées
- [`specs_projet_FAME.md`](./specs_projet_FAME.md) — spécifications complètes du projet

## Déploiement

Le site est déployé sur [Vercel](https://vercel.com), avec Supabase comme backend BDD/Auth/Storage.
