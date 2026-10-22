# Workout Plan Tracker

A rotation-based workout plan tracker, installable as a PWA. Built with React, TypeScript, Zustand and Vite, synced to Supabase, and deployed to GitHub Pages.

**Live app:** https://jschwartz830.github.io/special-umbrella/

## Features

- **Today**: today's workout from the active plan, with set and rest timers, run segments, mobility routines and quick ad-hoc logging
- **Calendar**: projected schedule plus retroactive logging and editing
- **History**: stats, streaks, personal records, weekly and day-of-week breakdowns, CSV import/export
- **Plans**: build plans by hand, or import YAML programs (5/3/1, Couch to 5K, and others; see [`docs/workout-yaml-schema.md`](docs/workout-yaml-schema.md))
- **Sync and backup**: data lives in `localStorage` and syncs to Supabase, with offline retry and conflict handling. Settings has full JSON export and restore.

## Development

```bash
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev            # http://localhost:5173/special-umbrella/
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm test` | Vitest unit tests |
| `npm run lint` | ESLint (incl. React hooks rules) |
| `npm run build` | Typecheck and production build to `dist/` |

The Supabase table definition is in [`supabase/schema.sql`](supabase/schema.sql).

## Deployment

Every push to `main` runs lint, tests and the build in GitHub Actions, then deploys to GitHub Pages. To roll back, revert the commit (`git revert <sha> && git push origin main`).

## Project layout

```
src/
  pages/          route-level screens (lazy-loaded except Today)
  components/     UI, grouped by feature (workout/, plan-builder/, history/, settings/, …)
  engine/         rotation scheduling, calendar projection, YAML program parsing
  store/          Zustand stores, persisted to localStorage
  lib/            pure helpers: stats, CSV, cloud sync (storeSync.ts), backup
  modules/        self-contained domains (workout outcomes, run adaptation, metadata)
  programs/       bundled YAML programs
docs/             schema docs, iOS spec, archived planning notes
```
