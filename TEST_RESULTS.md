# Test Results — 2026-08-26

## Summary

| Metric | Value |
|---|---|
| Test files | 35 |
| Tests before this pass | 1348 |
| Tests added this pass | 1 |
| Tests after this pass | 1349 |
| Failures | 0 |
| TypeScript errors | 0 |

## Command

```
npx vitest run
```

## Output (final lines)

```
Test Files  35 passed (35)
     Tests  1349 passed (1349)
  Start at  07:17:03
  Duration  3.56s (transform 1.91s, setup 0ms, import 3.78s, tests 699ms, environment 4ms)
```

## New Test Added This Pass

**File:** `src/lib/__tests__/storeSync.test.ts`

**Test:** `backfills weekStartsOn via migrateSettingsState when missing from old cloud data`

**What it covers:** Verifies that when `syncOnLogin` hydrates `wpt_settings` from a cloud snapshot that pre-dates the `weekStartsOn` field, `migrateSettingsState` backfills the field to `0` (Sunday default). This directly exercises the code path changed in this pass (`storeSync.ts`).
