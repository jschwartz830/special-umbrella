# Claude Code Instructions

## Branching & Deployment

- **Always commit directly to `main`** — no feature branches, no pull requests unless explicitly asked.
- This repo deploys to GitHub Pages from `main` via GitHub Actions. Changes land on the live app as soon as they're pushed.

## Reversing Changes

Every commit is individually revertable. If something breaks:

```bash
# See recent commits
git log --oneline -10

# Undo a specific commit safely (creates a new "undo" commit, keeps history)
git revert <commit-sha>
git push origin main
```

`git revert` is safe — it never rewrites history, so nothing is lost. The site will redeploy automatically after the revert is pushed.

## Project Overview

Workout plan tracker — React + TypeScript + Zustand, built with Vite, deployed to GitHub Pages as a PWA.

Key files:
- `src/engine/rotationEngine.ts` — core rotation/scheduling logic
- `src/pages/TodayPage.tsx` — today's workout view
- `src/pages/CalendarPage.tsx` — calendar with retroactive logging
- `src/store/historyStore.ts` — workout history + overrides (persisted via localStorage)
- `src/store/outcomeStore.ts` — rich outcome data per workout instance
