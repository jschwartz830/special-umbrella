# WEB_APP_INVENTORY

## Screens / Routes
- `/` redirects to `/today` via `<Navigate replace />`. This means there is no standalone home screen state. 
- `/today` (`TodayPage`): primary daily workflow for logging planned and extra workouts, starting active workout tracking, applying overrides, and reviewing near-term progression/adaptation context.
- `/calendar` (`CalendarPage`): month grid projection, per-day logging/editing, retroactive jump anchoring, extra workout management, and outcome editing.
- `/history` (`HistoryPage`): historical list + filtering/export/import surface (see `CsvToolbar`, `historyScope`, and `csv` utils used by this page).
- `/plans` (`PlansPage`): list of active/inactive/archived plans, activate/deactivate, duplicate, archive/delete pathways.
- `/plans/new` and `/plans/:id/edit` (`PlanBuilderPage`): create/edit repeating day plans and slot configurations.
- `/plans/import` (`ProgramImportPage`): YAML program ingestion/parsing to plan + program metadata.
- `/settings` (`SettingsPage`): app-level preferences and diagnostics utilities.

## Components
- Layout
  - `AppShell`: constrained centered column + fixed bottom nav shell.
  - `BottomNav`: five-tab persistent nav (`Today`, `Calendar`, `History`, `Plans`, `Settings`).
- Workout interaction
  - `WorkoutDayCard`: renders plan-day summary and actions.
  - `WorkoutSlotDetails`: richer slot rendering for run/weights metadata.
  - `WorkoutBadge`, `DifficultyBadge`, `OutcomeMetrics`: compact semantic badges and status metrics.
  - `OutcomeModal`: central form for completion state, notes, effort, run/weights actuals.
  - `ActiveWorkoutTracker`: in-session logging/tracking UI with minimization state.
- Shared
  - `Modal`, `EmptyState`, `CsvToolbar`.

## User Flows
1. **Plan lifecycle**
   - User creates or imports plan → optional edits → activates one plan (others automatically set inactive) → plan drives today/calendar projections.
2. **Today planned workout completion**
   - Complete from `TodayPage` (direct modal or ActiveWorkoutTracker handoff) → history action logged for day → outcome stored by `workoutInstanceId` → progression calculations run.
3. **Double-day / upcoming logging**
   - On `TodayPage`, user can log an upcoming day as additional workout. System creates `ExtraWorkoutEntry` and outcome instance ID suffix `_extra_{id}`.
4. **Retroactive calendar edits**
   - On `CalendarPage`, user logs/changes a date; if selected plan-day index differs, app writes date-scoped `jump` override anchored to noon local-like timestamp (`YYYY-MM-DDT12:00:00.000`).
5. **Outcome date changes**
   - If completion date in outcome differs from original date, both history/extra entry date and outcome key are moved to new date; collision handling removes conflicting entry on destination date first.
6. **Undo/remove behavior**
   - Removing a history day can also remove linked outcome record; extra entries may be preserved/removed based on source semantics.

## Data Models
- `Plan`: id, name, status, repeating `days`, duration (`rotations|weeks`), activation anchor (`startDate`, `startDayIndex`), optional `programMeta`, timestamps.
- `PlanDay`: label + 1..2 `WorkoutSlot`s.
- `WorkoutSlot`: polymorphic slot model with legacy + canonical run/weights metadata, optional structured program DSL sections (`warmup`, `exercises`, `segments`, `slotProgress`).
- `HistoryEntry`: one per (`planId`, `calendarDate`) replacement semantics; action `complete|skip|day_off`.
- `ExtraWorkoutEntry`: ad-hoc workouts on date; includes `source` (`history|double_day`) for undo behavior.
- `OverrideEntry`: rotation overrides (`advance`, `go_back`, `jump`, `swap_slot`) with optional target fields.
- `WorkoutOutcome`: keyed in store by `workoutInstanceId` (`{planId}_{date}` or extra suffix variant).
- `RunProgressionState`: keyed by progression group.
- Program variables map: `planId -> varName -> number` for YAML-defined progression rules.

## Business Logic / Calculations
- Rotation resolution and day projection in `rotationEngine` + `calendarProjection`.
- Plan expiry checks (`isPlanExpired`) and progress counters (`computeHistoryStats`, `countPastUnloggedDays`, `computeRotationCycleProgress`, `computePlanProgress`).
- Progression layers when logging outcomes:
  1) Outcome-level recommendation (`buildProgressionRecommendation`).
  2) Legacy run progression decision engine (`evaluateRunProgression`/`applyRunProgressionDecision`).
  3) YAML program progression rule evaluation (`applyProgressionRule` using expression evaluator).
- Migration logic in `planStore` normalizes legacy slot types (`weightlifting`→`weights`, `long_run`/`recovery_run`→`run`+`subtype`) and derives `location`/focus from tags.
- Entry import deduplication keeps newest `createdAt` per (`planId`,`calendarDate`).

## Persistence / API Behavior
- **Local-only persistence** through multiple Zustand persisted stores:
  - `wpt_plans`, `wpt_history`, `wpt_outcomes`, `wpt_program_vars`.
- No backend API calls in core flows; all CRUD is local state + storage persistence.
- Import/export is file/CSV/YAML driven via client utilities (`csv`, parser modules).
- Cross-store consistency depends on orchestration in page handlers (e.g., moving history date must also move outcome key).

## Edge Cases
- Missing active plan yields empty-state CTA on Today/Calendar.
- Plan duplication deep-clones day/slot IDs to avoid identity collisions.
- Deleting active plan clears `activePlanId`.
- Day-off entries intentionally omit `planDayIndex`.
- Retroactive logging with pre-existing jump override removes stale jump first, then optionally re-adds to preserve intended anchor.
- Outcome date edits can overwrite destination date history via explicit pre-removal.
- Re-import protection:
  - History batch dedupes by date key.
  - Extra entries dedupe by exact `id` only.
  - Outcomes import last-write-wins by instance key.
- Program vars initialize idempotently (only missing vars set).

## Known Bugs / UX Quirks
- Outcome, history, extras, and progression state are in separate stores; some operations rely on caller discipline for atomicity (possible temporary divergence if a flow is interrupted).
- `setActivePlan` assumes provided plan id exists; no explicit guard before spread-update of `updated[id]`.
- Extra-entry import deduping by `id` only may allow semantic duplicates on same day/name when IDs differ.
- Noon timestamp convention for retro jumps is implicit and timezone-sensitive in interpretation.
- “One history entry per date” replacement may surprise users expecting multiple planned completions in same day.

## Open Questions / Ambiguities
1. Should multiple planned completions on one day be supported, or is single `HistoryEntry` per date intentional product behavior?
2. When moving an outcome to another date that already has an outcome, should merge, replace, or conflict prompt be used?
3. For `ExtraWorkoutEntry.source` migration fallback (`undefined` treated as `double_day`), is this still desired long-term?
4. Should `swap_slot` overrides be fully surfaced in UI? Model supports it, but primary flows appear centered on jump/advance/go_back.
5. What is the expected retention policy for archived plans and associated history/outcomes?
6. Should progression state be recomputed if user edits/deletes past outcomes that originally drove progression changes?
7. How should timezone be normalized for date-only semantics (local midnight vs UTC) across history and outcome edits?
