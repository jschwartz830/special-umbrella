# WEB_APP_INVENTORY

> Inventory of the workout-plan tracker web app (React + TypeScript + Zustand, Vite, deployed as a PWA to GitHub Pages). This document is the source of truth for the **product behavior** the native iOS app must reproduce. See `IOS_IMPLEMENTATION_SPEC.md` for the native rebuild plan.
>
> Tech stack: React Router (`src/App.tsx`), Zustand stores with `persist` middleware (localStorage), `date-fns` for date math, `js-yaml` for program import, `lucide-react` icons, Tailwind CSS. No backend — all state is local-first.

## Screens / Routes

Routing is defined in `src/App.tsx` and wrapped in `ErrorBoundary` + `AppShell` (persistent `BottomNav`).

- **`/`** → redirects to `/today` via `<Navigate to="/today" replace />` (no separate home screen).
- **`/today`** (`TodayPage`)
  - Active plan projection (`useActivePlan`): today's resolved day + upcoming preview (next 7 via `getUpcomingDays`).
  - Header: date, plan name, "Day X of N in rotation", cycle progress (`computeRotationCycleProgress`), week progress, rotation-completion messages.
  - Stats bar: current streak (`computePlanStreak`), 7-day count, total (`computeHistoryStats`).
  - Weekly activity strip: 7-day dot row with completion/skip/day-off status.
  - Primary log actions (complete / skip / day off) plus override controls (`advance`, `go_back`, `jump`) through `usePlanActions`.
  - Double-day flow: logs primary planned entry plus a bonus extra workout (`historyStore.addExtraEntry`, `source='double_day'`) using a distinct outcome instance id via `makeExtraWorkoutInstanceId`; logging the bonus advances the rotation.
  - Active workout tracker lifecycle: launch → minimize → resume → completion prefill into `OutcomeModal` (state machine `activeWorkoutState`: `hidden`/`open`/`minimized`).
  - Inline insights: run adaptation note (`generateRunAdaptationNote`), difficulty spacing warning (`generateDifficultySpacingWarning`), cycle/week progress, last-session summary (`buildLastSessionSummary`), unlogged-day nudge with batch "Mark as Day Off" (`getUnloggedPastDates` + `markDaysAsOff`).
  - Expiry banner (`isPlanExpired`) dismissible per-plan (`useExpiryDismiss`, localStorage key prefix `wpt_expiry_dismissed_v1_`).
  - Upcoming cards are tappable to log a future/other day; logging "complete" on a future date is redirected to today, and if today already has an entry the workout is logged as an extra.
- **`/calendar`** (`CalendarPage`)
  - Month grid (6 weeks × 7 days) rendered by `buildMonthGrid`; cells colored by `DayStatus`, with slot/extra dots, day-off (coffee) marker, and a legend. Month nav + "Today" button.
  - Day detail modal with a 3-level hierarchy (`detailTarget`: overview → rotation detail / extra detail).
  - Retroactive logging: removes existing same-date jump overrides first (`removeRetroJumpForDate`), then if the chosen plan-day differs from the projected one writes a noon jump anchor override (`appliedAt = "${date}T12:00:00"` local) so the projection stays aligned.
  - Completion flow launches `OutcomeModal`; on save, outcome completion-state can back-sync `HistoryEntry.action`.
  - Supports planned and extra outcome editing, outcome **date moves**, clear-day behavior (`clearDate` → `removeRetroJumpForDate` + `removeEntry` + `removeOutcome`), extra workout add/remove, and historical Active Workout resume (`startHistoricalResume`).
- **`/history`** (`HistoryPage`)
  - Plan filter dropdown (shown when >1 plan has history, via `getPlansWithHistory`).
  - Stats bar (streak / 7-day / 30-day / total) + training-mix label (e.g. "3 weights · 2 runs · 1 yoga") from `computeWorkoutTypeBreakdown`.
  - Expandable Personal Records section (`computePersonalRecords`) — max load + max reps per exercise with dates.
  - Expandable Weekly Activity section (single-plan only) from `computeWeeklyBreakdown` + `padWeekGaps` (8-week window, ISO weeks starting Monday).
  - Unified timeline: newest date first; within a date, rotation entries before extras; within extras, newest createdAt first. Each row shows slot details, `OutcomeMetrics`, notes, and a status badge.
  - Entry editing (date move with conflict check, action change, notes, delete), extra editing, "+ Add workout" per date (extras created with `source='history'`).
  - CSV import/export via `CsvToolbar` + `lib/csv.ts`.
- **`/plans`** (`PlansPage`)
  - Active / inactive / archived grouping; per-card progress (`computePlanProgress`) + expired badge (`isPlanExpired`).
  - Actions: activate (modal sets `startDate` + `startDayIndex`), deactivate, duplicate (`duplicatePlan`), archive, delete.
  - Delete confirmation **cascades**: `clearPlanHistory` + `clearPlanOutcomes` + `removeProgressionStates` + `clearPlanVars` + `clearByPlanId` (exercise history) + `deletePlan` (`PlansPage.tsx:332-337`).
  - CSV import/export of plans via `CsvToolbar` (`plansToCsv`/`plansFromCsv`).
- **`/plans/new`** and **`/plans/:id/edit`** (`PlanBuilderPage`)
  - Plan metadata (name, description, duration value + type toggle) + draggable day/slot authoring.
  - Per-slot type-specific fields (run distance/pace/time, weights focus/intent/deload/location, swim/yoga/other duration + subtype), run config (subtype, structure text, adaptive progression with group id + step), difficulty toggle, weights exercise editor (library autocomplete, sets/reps/load/rest, per-exercise progression type + if/then/else rule with templates), notes.
  - "Edit YAML" round-trip: dumps current plan to YAML and re-parses via `parseYamlProgram` to apply edits.
  - Dirty tracking with unsaved-changes guard on navigation.
- **`/plans/import`** (`ProgramImportPage`)
  - YAML intake with syntax-highlighted editor (expandable to fullscreen), template loader (raw YAML files imported from `programs/`, e.g. gzclp-5k, upper-lower-12w), Preview (`parseYamlProgram`) with error/warning list, and Import (`createPlan` + `initVars` when `programMeta.vars` present).
- **`/settings`** (`SettingsPage`)
  - Set-timer start-delay control (Off / 5s / 10s / 15s / 30s) persisted in `settingsStore` (`startDelaySeconds`).
  - PWA/web-cache recovery: "Force refresh app" updates + unregisters service workers, clears Cache Storage, reloads with a cache-busting `?refresh=<ts>` query param.
  - Version/build metadata modal from injected build constants (`__LATEST_COMMIT_ISO_DATE__`, `__LATEST_COMMIT_TITLE__`), formatted to EST.

## Components

- **Layout**
  - `AppShell` (`src/components/layout/AppShell.tsx`): shell chrome + `<Outlet />`, bottom padding for nav, safe-area aware.
  - `BottomNav`: persistent 5-tab nav (Today / Calendar / History / Plans / Settings), active styling via `NavLink`.
- **Workout domain UI**
  - `WorkoutDayCard`: compact day card — status icon (complete/skip/day-off), label, "Today" badge, session count ("×N done"), stacked `WorkoutSlotDetails`, notes.
  - `WorkoutSlotDetails`: renders a slot's prescription — type/difficulty badges, deload flag, run targets resolved via `resolveWorkoutDisplayTarget` (progression-aware, `TrendingUp` marker when adapted), exercise lines via `formatExercisePrescription` (resolves load/reps expressions against program vars), notes.
  - `WorkoutBadge`, `DifficultyBadge`: pill badges driven by `WORKOUT_META` / `DIFFICULTY_META` (`src/lib/constants.ts`).
  - `OutcomeModal`: canonical outcome capture/edit surface. Status (completed/partial), perceived effort (1–5), `completedAt`, duration, modality sections (weights set grid with previous-set baseline; run distance/time/pace with derived pace; swim distance/time/pace), notes. Resolves set defaults from template + program vars (`buildInitialWeightActuals`, `resolveRepsFromVars`, `parseNumericLoad`, `parseRestToSeconds`). Discard-confirm on dirty close.
  - `OutcomeMetrics`: compact metric preview (effort dots, completed-set count, run/swim distance/duration/pace, progression recommendation).
  - `ActiveWorkoutTracker`: full-screen live session. Per-set reps/load/done grid, warmup vs working-set numbering, swipe-to-delete sets, add/replace exercise (optionally saved back to the plan template via `usePlanStore`), workout/rest/set timers using **wall-clock reconciliation** across background/visibility changes, **pre-scheduled AudioContext** rest tones (-15s warning + end chord), wake-lock during rest, audio keepalive oscillator (iOS), progression preview + suppression toggle, and **draft persistence** to localStorage (`wpt_active_draft_${workoutInstanceId}`). Emits `LoggedExerciseActual[]` + session meta (`startTime`, `endTime`, `pausePeriods`, `totalElapsedSeconds`) on complete. Reads `startDelaySeconds` from `settingsStore`.
- **Shared infra components**
  - `Modal`: bottom-sheet on mobile / centered on desktop, Escape + backdrop close, safe-area aware, optional footer.
  - `EmptyState`: icon + title + description + optional action.
  - `CsvToolbar`: export/import buttons; import returns `{ summary, warnings }` shown in a result modal, errors in an error modal.
  - `NumericInputField`: custom on-screen numeric keypad (portal), ± delta buttons, optional integer-only, null-safe.
  - `ErrorBoundary`: class component fallback with "Try again".

## User Flows

1. **Plan lifecycle**
   - Create/edit/import plan → activate (`setActivePlan` sets `status='active'`, `startDate`, `startDayIndex`; any other active plan is demoted to inactive) → projection recalculates from the new anchor.
   - Duplicate (`duplicatePlan`) deep-clones days/slots/exercises/segments with fresh IDs, resets to `inactive`, today's start date, day index 0, and a collision-safe " (copy N)" name.
2. **Today primary logging**
   - User logs an action via quick controls or the outcome modal.
   - Planned-entry uniqueness is enforced per (`planId`,`calendarDate`): a new write **replaces** the existing entry (`addEntry` filter-then-append).
   - Outcome save triggers the progression pipeline (recommendation + run progression + program-var rules) and, for weights, exercise-history sync.
3. **Additional workouts (double-day / ad hoc)**
   - Add an extra workout row (`ExtraWorkoutEntry`) with provenance (`double_day` from Today's bonus, or `history` from History/Calendar) → log/edit its outcome under an `_extra_` instance key.
4. **Retro calendar correction**
   - Logging a historical date with a different plan-day writes/replaces a noon jump anchor so future projection preserves the intended day alignment.
5. **Outcome date move**
   - Planned: destination planned entry removed if present, source entry date changed (`updateEntryDate`), outcome re-keyed (`moveOutcome`).
   - Extra: extra row date changed (`updateExtraEntryDate`), outcome re-keyed by extra instance id.
6. **Clear / undo operations**
   - Calendar "Clear entry" removes the planned entry + planned outcome + retro jump for that date. Extra entries are deleted separately.
   - Today "Undo" removes today's entry + outcome and any `double_day`-sourced extras (leaves `history`-sourced extras).
7. **Import / export**
   - History import dedupe: entries deduped by newest `createdAt` per (`planId`,`calendarDate`); extras deduped by `id`; outcomes overwrite by `workoutInstanceId` (last-write-wins). Rows referencing unknown `planId` are skipped with warnings.
   - Plan CSV import generates new day/slot IDs but **preserves the original `planId`** so exported history CSVs continue to match; never imports a plan as `active`.

## Data Models

Types live in `src/types/index.ts`, `src/types/program.ts`, and the `src/modules/*/types.ts` files.

- **`Plan`** (`types/index.ts`): `id`, `name`, `description?`, `status` (`active`/`inactive`/`archived`), `days[]`, `duration` (`{ type: 'rotations'|'weeks', value }`), `startDate` (YYYY-MM-DD calendar anchor), `startDayIndex` (rotation index at activation), `createdAt`/`updatedAt`, optional `programMeta` (`{ version: 1, vars }`).
- **`PlanDay`**: `id`, `label`, `slots[]` (1–2 slots).
- **`WorkoutSlot`**: `id`, `type` (`WorkoutType`), `name`, plus a large optional surface:
  - Legacy/simple targets: `notes`, `targetTime`, `isDeload`, `targetDistance`, `targetPace`, `targetDuration`.
  - Metadata: `tags?`, `difficulty?`, `subtype?`, `location?`, `weightsFocusArea?`, `weightsIntent?`, `durationMin?`, `timeMin?`, `structureDescription?`, `adaptiveProgressionEnabled?`.
  - Run config: `runConfig?` (`RunWorkoutConfig`: subtype, target distance/duration/pace range/structure text, `progressionEligible`, `progressionGroupId`, `defaultStepMiles`/`minStepMiles`/`maxStepMiles`).
  - Program/DSL (YAML-imported): `warmup?` / `exercises?` (`ExerciseSpec[]`), `segments?` (`RunSegment[]`), `slotProgress?` (`ProgressionRule`).
- **`WorkoutType`**: `weights` | `run` | `swim` | `yoga` | `other` (canonical) plus legacy `weightlifting` | `long_run` | `recovery_run` | `rest` (migrated on read; see Business Logic).
- **`HistoryEntry`**: `id`, `planId`, `calendarDate`, `planDayIndex?` (undefined for `day_off`), `action` (`complete`/`skip`/`day_off`), `notes?`, `createdAt`. **One planned action per (`planId`,`calendarDate`)**.
- **`ExtraWorkoutEntry`**: `id`, `planId`, `calendarDate`, `workoutType`, `workoutName`, `notes?`, `createdAt`, `source?` (`history`|`double_day`; undefined treated as `double_day` for safe undo).
- **`OverrideEntry`**: `id`, `planId`, `appliedAt` (ISO timestamp), `type` (`advance`/`go_back`/`jump`/`swap_slot`), `targetDayIndex?` (jump), `slotId?`/`newSlotType?` (swap_slot), `delta?` (±1).
- **`ResolvedDay`** (computed, never persisted): `calendarDate`, `planDayIndex`, `planDay`, `status` (`DayStatus`), `historyEntry?`.
- **`WorkoutOutcome`** (`modules/workout-outcomes/types.ts`): keyed by `workoutInstanceId`. `completionState` (`planned`/`completed`/`partially_completed`/`skipped`/`deferred`/`swapped`), `completedAt?`, `durationActualMin?`, `perceivedEffort?` (1–5), `notes?`, `swapTargetWorkoutTemplateId?`, modality actuals: `runActual?` (`RunWorkoutActual`), `weightsActual?` (`WeightsWorkoutActual` → `LoggedExerciseActual[]` → `LoggedSetActual[]`), `swimActual?` (`SwimWorkoutActual`), and `progressionRecommendation?`.
- **`RunProgressionState`** (`modules/run-adaptation/types.ts`): keyed by `progressionGroupId`; `currentTargetDistanceMiles?`, `lastCompletedWorkoutInstanceId?`, `lastResult?`, `updatedAt`.
- **Program vars**: `vars[planId][varName] = number` (`programStore`).
- **`ExerciseSessionRecord`** (`store/exerciseHistoryStore.ts`, derived): per-exercise-per-workout record with `sets[]` (`ExerciseSetRecord`: reps/load/volume/completed) and precomputed `totalVolume`/`maxLoad`/`maxReps`, plus `planName`/`workoutName` snapshots that survive plan deletion.
- **Program/DSL types** (`types/program.ts`): `ExerciseSpec`, `SetSpec`, `WarmupRampSpec`, `RunSegment`, `DrillSpec`, `ProgressionRule` (`if`/`then`/`else`), `ProgressionType` (`single`/`double`/`dynamic_double`/`triple`/`step_loading`), `ProgramMeta`, and the `Yaml*` source-document shapes the parser reads.

## Business Logic / Calculations

- **Rotation / day resolution** (`engine/rotationEngine.ts`):
  - `computeCurrentDayIndex` derives the pointer at the START of a target date by replaying every day from `startDate`: overrides for a date are applied first (advance/go_back/jump; `swap_slot` does **not** move the pointer), then **any logged action (complete/skip/day_off) advances the pointer by +1**. A past day with no entry leaves the pointer stuck.
  - `getTodayResolvedDay` applies today's overrides on top of the base pointer. `getUpcomingDays` always advances past today (logged or not) and projects forward. `getResolvedDaysRange` (calendar) applies overrides before reading `planDay`, advances on logged action, and for today/future always projects forward.
  - Entry de-duplication everywhere keeps the newest `createdAt` per date.
  - `mod()` is a symmetric modulo so `go_back` from index 0 wraps correctly.
- **Plan expiry** (`isPlanExpired`): `weeks` plans expire when `today >= startDate + value*7` days; `rotations` plans expire when `floor(complete+skip count / days.length) >= value` (`day_off` excluded).
- **Calendar month projection** (`engine/calendarProjection.ts`): `buildMonthGrid` clamps `fromDate` to `plan.startDate` (pre-start cells render neutral). `getFutureProjection` delegates to `getUpcomingDays`.
- **Stats / progress** (`lib/historyStats.ts`): `computeHistoryStats` (totals, 7/30-day windows, current + longest streak — streak counts `complete`/`day_off` rotation entries or any extra; lone `skip` or empty day breaks it; future-dated entries excluded from longest), `computePlanProgress`, `computeRotationCycleProgress`, `computeRotationPlanRemaining`, `countPastUnloggedDays`/`getUnloggedPastDates`, `computeWorkoutTypeBreakdown` (rotation type from the day's **first slot**, extras by `workoutType`, `day_off` excluded, avg effort from outcomes), `computePersonalRecords`, `computePlanStreak`, `countPlanDayCompletions`, `computeWeeklyBreakdown` (+ `padWeekGaps`, ISO weeks Monday-start). Internal date math uses UTC string helpers (`shiftDay`, `dateDiffDays`, `isoWeekStart`).
- **Outcome progression pipeline** (`outcomeStore.logOutcomeWithProgression`):
  1. Attach a recommendation (`buildProgressionRecommendation`) and persist the outcome (`setOutcome` → also syncs weights to `exerciseHistoryStore`).
  2. Evaluate/apply legacy run progression for slots with `runConfig.progressionEligible` + `progressionGroupId` (`evaluateRunProgression` → `applyRunProgressionDecision`).
  3. Evaluate program-rule expressions for YAML plans: slot-level `slotProgress` and per-exercise `progress` rules via `programStore.applyProgressionRule` (only when the plan has vars).
- **Run progression engine** (`modules/run-adaptation/engine.ts`): default step 0.5 mi. Skip/defer → hold. Hit target = actual ≥ 95% of target, or `completedAsPlanned===true` when no actual. Completed + hit + effort ≤ 3 → progress (+step). Effort 5 → regress (−step, floored at baseline). Partial with actual < 80% target → regress. Completed + hit + effort 4, or partial otherwise → hold. `resolveWorkoutDisplayTarget` (`selectors.ts`) prefers progression state over config over legacy fields and builds an adaptation note.
- **Recommendation copy** (`modules/recommendation/explanation.ts` + `workout-outcomes/progression.ts`): `buildProgressionRecommendation` returns discipline/mode/action/note for weights (modes single/double/volume/maintenance with all-sets-hit-target logic), run, and swim. `generateRunAdaptationNote`, `generateDifficultySpacingWarning` (back-to-back `hard`), `summariseRunOutcome`.
- **Expression evaluation** (`lib/expressionEval.ts`): hand-written recursive-descent parser/evaluator (no `eval`/`Function`). Supports arithmetic, comparison, `and`/`or`/`not`, functions `min/max/round/floor/ceil/abs/round5/round2_5`, numeric literals, variable refs, and keywords `all_reps`/`session_complete`/`effort` injected into context. `evaluateCondition`, `evaluateUpdates` (comma-separated `+=`/`-=`/`*=`/`/=`/`=` with paren-aware splitting), `resolveLoad` (strips `lb`/`kg`), `resolveQuantityString` (unit-aware). In `logOutcomeWithProgression` the context derives `all_reps` = `completionState==='completed'`, `session_complete` = not skipped/planned/deferred, `effort` = perceivedEffort.
- **Notes synchronization**: history note edits patch the linked outcome notes (`updateOutcomeNotes`); CSV export prefers entry/extra `notes` over outcome notes.
- **Plan migration/defaulting** (`planStore`): `migratePlanState` (persist version 2) normalizes slot types via `migrateSlot` (`weightlifting`→`weights`, `long_run`/`recovery_run`→`run`+subtype, `rest`→`other`+subtype, derives `location`/`weightsFocusArea` from legacy `tags`, then drops `tags`). `makeSlot`/`makeDay` provide type-specific defaults.
- **YAML program import** (`engine/programParser.ts`): `parseYamlProgram` (js-yaml) coerces workout types/focus/intent/difficulty, parses weights `warmup`/`exercises` and run `segments`/`drills`, builds a `structureDescription` summary, collects numeric `vars` into `programMeta`, validates required fields (`name`, `duration`, non-empty `days`) and returns `{ plan, errors }`; on parse failure returns a fallback plan.
- **Workout instance id** (`lib/workoutInstanceId.ts`): `parseWorkoutInstanceId` locates the date via regex and derives `planId` from the separator position (robust to underscores). Keys: `${planId}_${calendarDate}` (planned), `${planId}_${calendarDate}_extra_${extraId}` (extra).

## Persistence / API Behavior

- **Local-first only**; no backend/network API in core product flows.
- **Persisted Zustand stores** (localStorage via `persist`):
  - `wpt_plans` (`planStore`, versioned migration at v2; `plans` + `activePlanId`).
  - `wpt_history` (`historyStore`: `entries` + `overrides` + `extraEntries`).
  - `wpt_outcomes` (`outcomeStore`: `outcomes` + `progressionStates`).
  - `wpt_program_vars` (`programStore`: `vars`).
  - `wpt_exercise_history` (`exerciseHistoryStore`: `records`, derived from weights outcomes).
  - `wpt_settings` (`settingsStore`: `startDelaySeconds`).
- **Additional localStorage usage**:
  - Per-plan expiry-banner dismissal: key prefix `wpt_expiry_dismissed_v1_` (`useExpiryDismiss`).
  - Active workout draft: key `wpt_active_draft_${workoutInstanceId}` (`ActiveWorkoutTracker`).
- **Import/export** and YAML parse are fully client-side. CSV schemas (`lib/csv.ts`) are versioned by added columns (`entryKind`, `extraId`, `extraSource`) with documented backward-compatible defaults; BOM-aware, RFC-4180-ish quoting.
- **Cross-store mutations** are orchestrated from UI/store methods and are **not transactionally guaranteed** (e.g. plan delete cascade, outcome date move).
- **PWA / service worker**: app caches assets offline; Settings "Force refresh" performs SW update/unregister + Cache Storage clear + cache-busted reload. Build metadata is injected at build time via `__LATEST_COMMIT_ISO_DATE__` / `__LATEST_COMMIT_TITLE__`.

## Edge Cases

- No active plan: Today/Calendar render empty state + CTA to `/plans`.
- Day-off entries intentionally leave `planDayIndex` undefined; all three action types still advance the rotation pointer by +1.
- `setActivePlan` early-returns if the id isn't present; it demotes any currently-active plan and stamps a fresh `startDate`/`startDayIndex`.
- Retro jump matching parses `new Date(appliedAt)` then formats to a local date string; the noon (`T12:00:00`) anchor reduces but does not eliminate timezone/DST day-shift risk.
- Planned outcome date move implicitly overwrites a destination planned entry (and any destination outcome) — silent.
- Extra outcome moves rely on the `_extra_` suffix in the instance id; `parseWorkoutInstanceId` only returns `planId`/`calendarDate`, so callers reconstruct extra keys.
- Program vars initialize **missing keys only** (`initVars` is idempotent) — re-activating a plan does not reset changed values.
- `removeEntry` does not remove same-date extras (extras require separate deletion).
- Exercise-history sync depends on a parseable `workoutInstanceId` and a present weights `exercises` array; otherwise it silently no-ops.
- `computeWorkoutTypeBreakdown` attributes rotation type from `slots[0]` only — a day's second slot is not counted.
- Logging "complete" on a future date from Today is redirected to today; if today already has an entry it becomes an extra.
- Active workout timers reconcile against wall-clock on visibility/focus changes so backgrounding (or iOS suspension) doesn't lose elapsed time; rest tones are pre-scheduled on the audio hardware clock.
- CSV history import skips rows with unknown `planId`, invalid `calendarDate`, invalid `action`/`workoutType`, and validates effort range 1–5.

## Known Bugs / UX Quirks

- Multi-store mutations (history/outcome/program vars/exercise history) are non-atomic and can drift if an operation is interrupted mid-sequence.
- **Plan delete cascade deletes all completed-workout records** (history, outcomes, exercise history, progression states, vars) — this conflicts with the product direction that completed workouts should be retained (see Open Questions #7). Archive does retain data.
- Extra CSV dedupe by `id` can create semantic duplicates when the same workout is re-entered with a new id.
- "One planned entry per day" replacement can feel destructive for users expecting multiple planned logs per day.
- The hidden noon jump anchor affects projection but has limited user-facing visibility.
- Several flows treat `planDay.slots[0]` as canonical, under-representing the second slot (type breakdown, some summaries).
- `swap_slot` exists in the model and `usePlanActions` but has no first-class user-facing control.
- Settings "Force refresh" is destructive for offline cache and may surprise users if not clearly messaged (web-specific behavior).

## Open Questions / Ambiguities (Updated with Product Direction)

1. **Planned sessions per day**: Multi-planned sessions/day are allowed. Default projection logic should still assume each rotation item maps to subsequent days unless explicitly marked day off or otherwise overridden.
2. **Collision behavior when moving/logging outcomes**: Plan is guidance, not a hard limit. If a different workout is performed on a planned day, that day's originally planned workout should be deferred to the following day by default. Users can still log multiple workouts on the same day. *(Current web behavior silently overwrites on date-move collisions — gap vs. desired behavior.)*
3. **Retroactive edits recomputation**: Yes — retroactive edits/deletes must trigger recomputation of run progression state, program variables, and derived exercise history. *(Current web behavior recomputes forward only on each new log; it does not replay history after a retro edit — gap.)*
4. **`swap_slot` UX intent**: User-visible controls are desired for changing rotation order within plans (current model-level capability should become explicit UI behavior).
5. **Import dedupe policy for extras**: Move from ID-only dedupe to semantic dedupe keys (at least date + workout type + name/source, with clear tie-break rules).
6. **Timezone policy**: Canonical policy is device local timezone for date mapping (`calendarDate`), jump anchoring, and DST/travel behavior.
7. **Archive/delete retention policy**: Archiving/deleting a plan should **not** delete completed workout records. Historical workouts remain on calendar/history but are not counted toward the active/latest plan rotation metrics. **⚠ The current web app deletes everything on plan delete (`PlansPage.tsx:332-337`) — this must change in iOS, and the desired web behavior should be confirmed.**
8. **Historical resume without matching planned/extra row**: Allowed. Outcome/workout records are first-class entities and should be saveable even without plan linkage.
9. **Settings force-refresh in iOS**: Not required as a user-facing iOS feature; web-specific service-worker recovery behavior should remain web-only.
10. **Set-timer start delay (`settingsStore.startDelaySeconds`)**: Should this remain a single global setting in iOS, or move to per-plan / per-workout configuration?
11. **Second-slot attribution**: Should stats/summaries that currently use `slots[0]` account for both slots of a 2-slot day (e.g. weights + run on the same day)? Confirm desired counting.
12. **Active-session audio/wake-lock parity**: The web tracker pre-schedules rest tones, holds a wake lock, and persists a draft. Confirm the iOS equivalents (local notifications/`AVAudioEngine`, idle-timer disabling, crash-safe draft) and whether background timers must survive app termination.
