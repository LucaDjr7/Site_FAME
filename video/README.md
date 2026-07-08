# FAME — Pipeline vidéo d'onboarding

Workspace npm isolé (Remotion + Playwright + TTS), separe du site Next.js (`src/`).
Rien ici ne depend du site, et le site ne depend pas de `video/`.

## Prerequis

- `.env.local` a la racine du repo avec `OPENAI_API_KEY`, `SEED_DEMO_PASSWORD` et les
  variables Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
- Le site lance en local sur `http://localhost:3000` (`npm run dev` a la racine).
- Jeu de donnees de demo seede : `npm run seed:demo` a la racine.
- `cd video && npm install` (puis `npx playwright install chromium` si besoin).

## Pipeline

```
npm run validate && npm run tts && npm run capture && npm run render && npm run publish
```

Chaque etape est aussi relancable individuellement (`npm run tts`, `npm run capture`, etc.).
Les artefacts generes (`audio/`, `recordings/`, `out/`) ne sont pas commites (voir `.gitignore` racine).
