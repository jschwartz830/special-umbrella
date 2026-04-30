# WEB_APP_INVENTORY

## Screens / Routes
- `/` redirects to `/today` using `<Navigate to="/today" replace />`; there is no persisted home dashboard route. (`src/App.tsx`)
- `/today` (`TodayPage`):
  - Displays active plan’s resolved current day and upcoming days from `useActivePlan`.
  - Logs primary completion / skip / day-off to `historyStore.logAction`.
  - Supports manual overrides (`advance`, `go_back`, `jump`, `swap_slot`) via `usePlanActions`.
  - Supports “double day” logging, including extra workout creation (`historyStore.addExtraEntry`) and `_extra_` outcome instance IDs (`makeExtraWorkoutInstanceId`).
  - Includes Active Workout Tracker launch/minimize/resume flow and post-session prefill into `OutcomeModal`.
  - Shows run adaptation notes (`generateRunAdaptationNote`) and spacing warning (`generateDifficultySpacingWarning`).
  - Shows expiry banner controls via `useExpiryDismiss`.
- `/calendar` (`CalendarPage`):
  - Renders month grid from `buildMonthGrid`.
  - Allows per-date complete / skip / day-off logging.
  - Handles retroactive day-index anchoring by removing same-day jump override first (`removeRetroJumpForDate`) and optionally re-adding noon jump (`addOverride` with `${date}T12:00:00.000`).
  - Supports extra workouts add/edit/delete and extra-outcome editing.
  - Supports historical active-workout resume flow.
  - Supports outcome date-move behavior for both planned and extra entries (`updateEntryDate`, `updateExtraEntryDate`, `moveOutcome`).
- `/history` (`HistoryPage`):
  - Historical log browsing, scope filters, and notes editing.
  - CSV import/export workflows through `CsvToolbar`, `lib/csv.ts`, and scope helpers in `lib/historyScope.ts`.
- `/plans` (`PlansPage`):
  - Active/inactive/archived grouping.
  - Activate/deactivate, duplicate, archive, delete.
- `/plans/new` + `/plans/:id/edit` (`PlanBuilderPage`):
  - Plan day/slot editing, type-specific slot config, duration setup.
- `/plans/import` (`ProgramImportPage`):
  - YAML program ingestion via parser/engine modules (`engine/programParser.ts`), schema-backed structure, and conversion to plan state.
- `/settings` (`SettingsPage`):
  - Data tools, diagnostics, and maintenance actions.

## Components
- Layout
  - `AppShell`: global shell with safe-area spacing and nested route outlet.
  - `BottomNav`: persistent five-tab navigation.
- Workout interaction
  - `WorkoutDayCard`: card-level surface for planned day details and actions.
  - `WorkoutSlotDetails`: slot metadata rendering (run, weights, and generic).
  - `OutcomeModal`: canonical completion-state + metrics capture and edit UI.
  - `ActiveWorkoutTracker`: session timer/logging view with minimized mode handoff.
  - `OutcomeMetrics`: compact prior/outcome metric display in list/card contexts.
  - `WorkoutBadge`, `DifficultyBadge`: semantic chips for workout type/difficulty.
- Shared
  - `Modal`: shared modal shell.
  - `EmptyState`: no-data/no-plan call-to-action surface.
  - `CsvToolbar`: CSV import/export controls + file interaction.

## User Flows
1. **Plan lifecycle**
   - Create/edit/import plan → activate plan (`setActivePlan`) → previous active plan auto-set inactive in store loop → current plan drives projection.
2. **Primary daily logging (Today)**
   - User logs complete/skip/day-off → history entry replaced per (`planId`, `date`) uniqueness (`addEntry`) → outcome optionally saved/edited (`OutcomeModal`) → completion state syncs entry action through `completionStateToAction`.
3. **Double-day / additional workout logging**
   - User enables “double day” or logs extra/upcoming workout → `ExtraWorkoutEntry` persisted with source (`history` or `double_day`) → outcome keyed as `{planId}_{date}_extra_{extraId}`.
4. **Calendar retroactive correction**
   - User logs historical date with plan-day selector → same-date jump is removed first to avoid stale-anchor drift, then new jump optionally added if needed.
5. **Outcome date move**
   - User edits completion date in outcome modal.
   - Planned entry path: destination date’s planned entry is removed, source entry moved, outcome key moved.
   - Extra path: extra entry date updated by id, outcome key moved.
6. **Undo/clear behavior**
   - Clearing a planned day removes planned history + planned outcome + retro jump for that date.
   - Extra entries are managed separately and may remain unless explicitly removed.
7. **Import/export flows**
   - History import deduplicates by (`planId`,`calendarDate`) with newest `createdAt` retained.
   - Extra import deduplicates by `id` only.
   - Outcome import is key overwrite (last-write-wins per `workoutInstanceId`).

## Data Models
- `Plan`
  - Core fields: `id`, `name`, `status`, `days[]`, `duration`, `startDate`, `startDayIndex`, `createdAt`, `updatedAt`, optional `programMeta`.
- `PlanDay`
  - `id`, `label`, 1..N `slots` (UI commonly assumes first slot as primary in some contexts).
- `WorkoutSlot`
  - Canonical types include `weights`, `run`, `swim`, `yoga`, `other`.
  - Migration path supports legacy types (`weightlifting`, `long_run`, `recovery_run`, `rest`) normalized in `migrateSlot`.
  - May contain advanced structured programming data (`warmup`, `exercises`, `segments`, `slotProgress`).
- `HistoryEntry`
  - Represents planned-day action for a date (`complete`, `skip`, `day_off`), one row per (`planId`,`calendarDate`).
- `ExtraWorkoutEntry`
  - Additional workout entry keyed by generated `id`, with `source` provenance and freeform metadata.
- `OverrideEntry`
  - Rotation overrides including `advance`, `go_back`, `jump`, `swap_slot` and optional target fields.
- `WorkoutOutcome`
  - Stored in map by `workoutInstanceId`, with completion state, notes, and modality-specific actuals (run/swim/weights).
- `RunProgressionState`
  - Stored by progression group id, updated by legacy run-adaptation engine.
- Program variable state
  - `vars[planId][varName] = number`, initialized idempotently from `programMeta.vars`.

## Business Logic / Calculations
- **Rotation/day projection**
  - `engine/rotationEngine.ts` resolves effective day index using plan anchors + history + overrides.
  - `engine/calendarProjection.ts` builds month grid and resolved-day metadata.
- **Stats and progress**
  - `computeHistoryStats`, `countPastUnloggedDays`, `computeRotationCycleProgress`, `computePlanProgress` (`lib/historyStats.ts`).
- **Outcome-driven progression stack**
  1. `buildProgressionRecommendation` attaches recommendation payload to each saved outcome.
  2. Run adaptation checks (`evaluateRunProgression`) and state updates (`applyRunProgressionDecision`) when eligible.
  3. YAML/program progression rule eval via expression engine (`evaluateCondition`, `evaluateUpdates`) through `programStore.applyProgressionRule`.
- **Date-change logic**
  - Moving completion date mutates both history/extra entities and outcome instance key, but operations are currently non-transactional across stores.
- **Plan migration and defaults**
  - `planStore` migration normalizes legacy slot types and derives location/focus from tags.
  - `makeSlot` and `makeDay` create default day/slot scaffolding with type-based defaults.

## Persistence / API Behavior
- Entire app is local-first with persisted Zustand stores:
  - `wpt_plans` (`planStore`), with schema `version: 2` + migration hook.
  - `wpt_history` (`historyStore`).
  - `wpt_outcomes` (`outcomeStore`).
  - `wpt_program_vars` (`programStore`).
- No network API is used in core workflows.
- CSV/YAML operations are client-side transforms.
- Cross-store operations are orchestration-based in UI handlers (no ACID transaction boundary).

## Edge Cases
- No active plan: Today/Calendar surfaces empty state and route-to-plans CTA.
- Day-off action clears/omits `planDayIndex` intentionally.
- `setActivePlan` deactivates existing active plans but does not guard nonexistent `id` before spread assignment.
- Retro jump date matching uses `format(new Date(appliedAt), 'yyyy-MM-dd')`; timezone interpretation can shift day in edge locales.
- Planned date move removes destination planned entry before moving source (implicit overwrite).
- Extra date move for outcomes depends on parsing `_extra_` id suffix.
- Program vars only initialize missing keys (re-activation does not reset modified vars).
- `removeEntry` does not automatically remove extras for same date; cleanup depends on caller flow.

## Known Bugs / UX Quirks
- Non-atomic multi-store writes (history/outcome/program vars) can briefly diverge on interrupted flows.
- Extra import dedupe by `id` can admit semantic duplicates (same date/name/type with different ids).
- “One planned entry per date” replacement can feel destructive when users expect multiple planned logs in one day.
- Noon jump anchor is implicit/internal and not user-visible, yet materially affects rotation projection.
- Several UI paths treat `planDay.slots[0]` as primary, which can underrepresent secondary slot data in multi-slot plans.

## Open Questions / Ambiguities
1. Is single planned `HistoryEntry` per date a hard product rule, or should same-day planned multi-session logging be supported?
2. On outcome date move collisions, should behavior remain silent replace, become merge-aware, or require user confirmation?
3. Should progression state and program vars be recomputed when users edit or delete historical outcomes that originally advanced progression?
4. Should `swap_slot` overrides be first-class in UI flows, or remain model-level only for now?
5. Should extra-entry dedupe logic evolve from `id`-only to semantic dedupe keys?
6. What is the canonical timezone/date policy for `calendarDate` and jump `appliedAt` across travel/DST?
7. When deleting or archiving plans, what long-term retention/cascade policy is desired for related history, outcomes, extras, and program vars?
8. Should historical Active Workout Tracker resume be allowed to create/update outcomes without corresponding history entry validation?
