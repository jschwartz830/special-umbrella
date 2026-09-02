# Test Results — 2026-09-02

## Summary

| Metric | Value |
|---|---|
| Test files | 35 |
| Tests before this pass | 1352 |
| Tests added this pass | 4 |
| Tests after this pass | 1356 |
| Failures | 0 |
| TypeScript errors | 0 |

## Command

```
npx vitest run
```

## Output (final lines)

```
Test Files  35 passed (35)
     Tests  1356 passed (1356)
  Start at  04:19:34
  Duration  4.44s (transform 2.33s, setup 0ms, import 4.71s, tests 926ms, environment 4ms)
```

## New Tests Added This Pass

**File:** `src/modules/run-adaptation/__tests__/engine.test.ts`

**Tests:**
1. `adaptation note uses "Holding" wording for hold result` — verifies `resolveWorkoutDisplayTarget` returns an adaptation note containing "Holding" when `lastResult` is `'hold'` and the progression distance differs from the template.
2. `adaptation note uses "Stepped back" wording for regress result` — verifies the "Stepped back" wording when `lastResult` is `'regress'`.
3. `adaptation note uses "Reset" wording for reset result` — verifies the "Reset" wording when `lastResult` is `'reset'`.
4. `adaptation note uses "Targeting" wording for unknown result` — verifies the default-branch fallback "Targeting" wording when `lastResult` is an unrecognised value (cast to `never` to simulate a future-added case).

**What they cover:** The `buildAdaptationNote` switch statement's 'hold', 'regress', 'reset', and default branches via the `resolveWorkoutDisplayTarget` call path. These branches were previously covered only via `explanation.test.ts` (a different call path through `generateRunAdaptationNote`); these tests ensure the selector itself correctly propagates all adaptation note variants to its caller.
