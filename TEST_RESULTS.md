# Test Results — 2026-09-13

All tests passing.

| Suite | Count |
|---|---|
| All test files | 35 |
| Total tests | 1369 |
| Passed | 1369 |
| Failed | 0 |

## New tests added this pass (+5)

### `src/lib/__tests__/historyStats.test.ts` (+4)

- `computePersonalRecords > excludes future-dated records when today is provided`
- `computePersonalRecords > includes all records when today is not provided (backward-compatible)`
- `computePersonalRecords > excludes future-dated records even when planId filter is applied`
- `computePersonalRecords > returns empty array when all records are in the future`

### `src/lib/__tests__/estimateRunDuration.test.ts` (+1)

- `estimateRunDurationMin > falls through to distance when duration is present but unrecognized`

## Command

```
npx vitest run
```

Duration: ~3.5s
