# Test Results

## 2026-07-16 (seventy-ninth pass) — branch `claude/dreamy-mccarthy-1jxqcb`

---

### Baseline (before changes)

```
Test Files  31 passed (31)
     Tests  1088 passed (1088)
  Duration  ~4.5s
```

### After all commits (commits 1–7)

All 1088 pre-existing tests continue to pass through all commits. No test regressions.

The BUG-8 fix (commit 1) required updating one test in `outcomeSortKey.test.ts` — the test that previously expected `''` for malformed outcomes was updated to expect `'0000-00-00_no-date-here'`. The test count is unchanged.

```
Test Files  31 passed (31)
     Tests  1088 passed (1088)  (unchanged)
  Duration  ~4.3s
```

### Tests Updated This Pass

| File | Test | Change |
|------|------|--------|
| `src/lib/__tests__/outcomeSortKey.test.ts` | `'returns empty string when instanceId does not contain a recognisable date'` | Updated to expect `'0000-00-00_no-date-here'` and verify it sorts before any valid date |

### Important Areas Still Untested

| Gap | Scope | Risk |
|-----|-------|------|
| TEST-1 | `storeSync.ts` — entire cloud sync module | High |
| TEST-2 | `useToday.ts` — midnight-advance timer | Medium |
| TEST-3 | `ActiveWorkoutTracker.tsx` (1872 lines) | High |
| TEST-4 | `MobilityTracker.tsx` bilateral detection + checkpoint restore | Medium |
| TEST-5 | `useStreakMilestoneDismiss` localStorage I/O | Low |
| TEST-6 | `CardioWorkoutTracker.tsx` auto-advance timer path | Medium |

---

## 2026-07-15 (seventy-eighth pass) — branch `claude/dreamy-mccarthy-cr3jyk`

---

### Baseline (before changes)

```
Test Files  31 passed (31)
     Tests  1081 passed (1081)
  Duration  ~4.6s
```

### After all commits (commits 1–7 — no new tests until commit 8)

All 1081 pre-existing tests continue to pass through commits 1–7. No test regressions.

### After commit 8 (extractExtraId tests — +7 tests)

```
Test Files  31 passed (31)
     Tests  1088 passed (1088)  (+7)
  Duration  ~4.7s
```

New describe block in `src/lib/__tests__/workoutInstanceId.test.ts`:

| Test | Description |
|------|-------------|
| extractExtraId — standard format | `plan-1_2026-01-01_extra_abc123` → `'abc123'` |
| extractExtraId — extra ID with hyphens | `plan-1_2026-01-01_extra_abc-123` → `'abc-123'` |
| extractExtraId — planId with underscores | `my_plan_2026-01-01_extra_xyz` → `'xyz'` |
| extractExtraId — extra ID containing `_extra_` | `plan-1_2026-01-01_extra_foo_extra_bar` → `'foo_extra_bar'` |
| extractExtraId — no date segment | `plan-1_extra_abc123` → `null` |
| extractExtraId — null input | `null` → `null` |
| extractExtraId — undefined input | `undefined` → `null` |

### Important Areas Still Untested (pass 78)

| Gap | Scope | Risk |
|-----|-------|------|
| TEST-1 | `storeSync.ts` — entire cloud sync module | High |
| TEST-2 | `useToday.ts` — midnight-advance timer | Medium |
| TEST-3 | `ActiveWorkoutTracker.tsx` (1872 lines) | High |
| TEST-4 | `MobilityTracker.tsx` bilateral detection + checkpoint restore | Medium |
| TEST-5 | `useStreakMilestoneDismiss` localStorage I/O | Low |
| TEST-6 | `CardioWorkoutTracker.tsx` auto-advance timer path | Medium |
