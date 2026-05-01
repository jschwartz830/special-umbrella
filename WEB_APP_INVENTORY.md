# WEB_APP_INVENTORY

## Screens / Routes
- `/` redirects to `/today` via `<Navigate to="/today" replace />` (no separate home screen).
- `/today` (`TodayPage`)
  - Active plan projection (`useActivePlan`) with today + upcoming cards.
  - Primary log actions (complete / skip / day off) plus override controls (`advance`, `go_back`, `jump`, `swap_slot`) through `usePlanActions`.
  - Double-day flow: logs primary planned entry plus bonus extra workout (`historyStore.addExtraEntry`, source=`double_day`) and distinct outcome instance IDs via `makeExtraWorkoutInstanceId`.
  - Active workout tracker lifecycle: launch → minimize → resume → completion prefill into `OutcomeModal`.
  - Inline insights: run adaptation notes, difficulty spacing warnings, cycle/week progress, last-session summary, unlogged-day nudge.
  - Expiry banner dismissal persisted per-plan (`useExpiryDismiss`, localStorage key prefix `wpt_expiry_dismissed_v1_`).
- `/calendar` (`CalendarPage`)
  - Month grid rendering (`buildMonthGrid`) and day detail actions.
  - Retroactive logging: removes existing same-date jump overrides first, then optionally writes a noon jump anchor (`${date}T12:00:00.000`).
  - Completion flow launches `OutcomeModal`; outcome completion-state can back-sync `HistoryEntry.action`.
  - Supports planned and extra outcome editing, outcome date moves, clear-day behavior, extra workout add/remove, and historical active-workout resume.
- `/history` (`HistoryPage`)
  - Timeline + scoped summaries using history scope/stat helpers.
  - Notes editing and CSV import/export orchestration through `CsvToolbar` + `lib/csv.ts`.
- `/plans` (`PlansPage`)
  - Active / inactive / archived grouping.
  - Actions: activate/deactivate, duplicate, archive, delete.
- `/plans/new` and `/plans/:id/edit` (`PlanBuilderPage`)
  - Plan metadata + day/slot authoring (including type-specific slot fields).
- `/plans/import` (`ProgramImportPage`)
  - YAML intake/parsing/normalization (`engine/programParser.ts`) and conversion into plan/program state.
- `/settings` (`SettingsPage`)
  - PWA/web-cache recovery flow: updates + unregisters service workers, clears Cache Storage, reloads with cache-busting query param.
  - Build metadata modal from injected constants (`__LATEST_COMMIT_ISO_DATE__`, `__LATEST_COMMIT_TITLE__`).

## Components
- Layout
  - `AppShell`: shell chrome + route outlet.
  - `BottomNav`: persistent tab-like navigation.
- Workout domain UI
  - `WorkoutDayCard`, `WorkoutSlotDetails`, `WorkoutBadge`, `DifficultyBadge`.
  - `OutcomeModal`: canonical outcome capture/edit surface.
  - `OutcomeMetrics`: compact metrics preview.
  - `ActiveWorkoutTracker`: in-session tracking with minimized mode handoff.
- Shared infra components
  - `Modal`, `EmptyState`, `CsvToolbar`.

## User Flows
1. **Plan lifecycle**
   - Create/edit/import plan → activate (`setActivePlan`) → current active plan (if any) auto-demoted to inactive → projection recalculates from new anchor.
2. **Today primary logging**
   - User logs action via quick controls or outcome modal.
   - Planned entry uniqueness enforced per (`planId`,`calendarDate`) (new write replaces old).
   - Outcome save may also trigger progression recommendation and variable/run-state updates.
3. **Additional workouts (double-day/ad hoc)**
   - Add extra workout row (`ExtraWorkoutEntry`) with provenance (`double_day` or `history`) → log/edit outcome with `_extra_` key.
4. **Retro calendar correction**
   - Logging a historical date can write/replace jump anchor so future projection preserves intended day alignment.
5. **Outcome date move**
   - Planned: destination planned entry removed, source entry date changed, outcome key moved.
   - Extra: extra row date changed by extra id, outcome key moved.
6. **Clear / undo operations**
   - Clear planned date removes planned entry + planned outcome + retro jump for that date.
   - Extra entries require separate deletion.
7. **Import/export**
   - Planned history import dedupe: newest `createdAt` per (`planId`,`calendarDate`).
   - Extra import dedupe: `id`-only.
   - Outcome import: overwrite by `workoutInstanceId` (last-write-wins).

## Data Models
- `Plan`: id/status/name, days, duration, start anchor, timestamps, optional `programMeta`.
- `PlanDay`: id/label/slots[].
- `WorkoutSlot`: normalized types (`weights`,`run`,`swim`,`yoga`,`other`) plus legacy migration from old enums.
- `HistoryEntry`: one planned action per (`planId`,`calendarDate`).
- `ExtraWorkoutEntry`: ad-hoc workout rows keyed by generated `id` with `source` provenance.
- `OverrideEntry`: rotation modifiers (`advance`, `go_back`, `jump`, `swap_slot`) + optional target data.
- `WorkoutOutcome`: keyed by workout-instance id; stores completion state, notes, perceived effort, and modality-specific actuals.
- `RunProgressionState`: progression state by progression group id.
- Program vars map: `vars[planId][varName]` numeric values.
- Exercise history projection (secondary model): derived/stored index of weight exercises in `exerciseHistoryStore` for historical lift references.

## Business Logic / Calculations
- Rotation/day resolution: `engine/rotationEngine.ts`.
- Calendar month projection: `engine/calendarProjection.ts`.
- Stats/progress: `computeHistoryStats`, `countPastUnloggedDays`, `computeRotationCycleProgress`, `computePlanProgress`.
- Outcome progression pipeline (`outcomeStore.logOutcomeWithProgression`):
  1. Attach recommendation (`buildProgressionRecommendation`).
  2. Evaluate/apply run progression (`evaluateRunProgression`, `applyRunProgressionDecision`).
  3. Evaluate program rule expressions (`programStore.applyProgressionRule` via `expressionEval`).
- Notes synchronization: history note edits may update linked outcome notes.
- Plan migration/defaulting: slot type normalization and tag-derived metadata in `planStore.migrateSlot` + `makeSlot`/`makeDay` defaults.

## Persistence / API Behavior
- Local-first only; no backend/network API in core product flows.
- Persisted Zustand stores:
  - `wpt_plans` (`planStore`, versioned migration currently at v2).
  - `wpt_history` (`historyStore`: entries + overrides + extras).
  - `wpt_outcomes` (`outcomeStore`: outcomes + run progression states).
  - `wpt_program_vars` (`programStore`).
  - `wpt_exercise_history` (`exerciseHistoryStore`, derived from outcomes).
- Additional localStorage usage: per-plan expiry-banner dismissal key prefix `wpt_expiry_dismissed_v1_`.
- Import/export and YAML parse are fully client-side.
- Cross-store mutations are orchestrated from UI/store methods and are not transactionally guaranteed.

## Edge Cases
- No active plan: Today/Calendar render empty state and CTA.
- Day-off entries intentionally unset `planDayIndex`.
- `setActivePlan` writes `updated[id] = { ...updated[id], ... }` without explicit missing-id guard.
- Retro jump match uses `new Date(appliedAt)` then local date formatting; timezone parsing can move day.
- Planned outcome date move implicitly overwrites destination planned entry.
- Extra outcome moves rely on parsing `_extra_` suffix from instance id.
- Program vars initialize missing keys only (reactivation does not reset changed values).
- `removeEntry` does not remove extras for same date.
- Exercise-history sync assumes `workoutInstanceId` format split by `_`; malformed IDs silently degrade indexing.

## Known Bugs / UX Quirks
- Multi-store mutations (history/outcome/program vars/exercise history) are non-atomic and can drift on interrupted operations.
- Extra import dedupe by `id` can create semantic duplicates.
- “One planned entry per day” replacement can feel destructive for users expecting multiple planned logs/day.
- Hidden noon jump anchor affects projection but has limited user-facing visibility.
- Several flows treat `planDay.slots[0]` as canonical, under-representing secondary slots.
<<<<<<< codex/update-web_app_inventory.md-and-ios_implementation_spec.md-in1hbo
- Settings “force refresh” is destructive for offline cache and may surprise users if not clearly messaged (web-specific behavior).

## Open Questions / Ambiguities (Updated with Product Direction)
1. **Planned sessions per day**: Multi-planned sessions/day are allowed. Default projection logic should still assume each rotation item maps to subsequent days unless explicitly marked day off or otherwise overridden.
2. **Collision behavior when moving/logging outcomes**: Plan should be treated as guidance, not a hard limit. If a different workout is performed on a planned day, that day's originally planned workout should be deferred to the following day by default. Users can still log multiple workouts on the same day.
3. **Retroactive edits recomputation**: Yes—retroactive edits/deletes must trigger recomputation of run progression state, program variables, and derived exercise history.
4. **`swap_slot` UX intent**: User-visible controls are desired for changing rotation order within plans (current model-level capability should become explicit UI behavior).
5. **Import dedupe policy for extras**: Move from ID-only dedupe to semantic dedupe keys (at least date + workout type + name/source, with clear tie-break rules).
6. **Timezone policy**: Canonical policy is device local timezone for date mapping (`calendarDate`), jump anchoring, and DST/travel behavior.
7. **Archive/delete retention policy**: Archiving/deleting a plan should **not** delete completed workout records. Historical workouts remain on calendar/history, but are not counted toward the active/latest plan rotation metrics.
8. **Historical resume without matching planned/extra row**: Allowed. Outcome/workout records are first-class entities and should be saveable even without plan linkage.
9. **Settings force-refresh in iOS**: Not required as a user-facing iOS feature; web-specific recovery behavior should remain web-only.
=======
- Settings “force refresh” is destructive for offline cache and may surprise users if not clearly messaged.

## Open Questions / Ambiguities
1. Is one planned `HistoryEntry` per date an intentional permanent rule, or should multi-planned sessions/day exist?
2. For planned-date collisions during outcome move, should behavior remain silent overwrite, become merge-aware, or prompt user choice?
3. When outcomes/history are edited retroactively, should run progression state + program vars + exercise history be recomputed?
4. Should `swap_slot` overrides become user-visible controls beyond current model hooks?
5. Should extra import dedupe evolve from ID-only to semantic dedupe keys?
6. What canonical timezone policy should govern `calendarDate`, jump anchors, and travel/DST behavior?
7. On archive/delete, what retention/cascade policy is required for history, outcomes, extras, overrides, vars, and exercise history?
8. Is historical Active Workout resume allowed to create outcomes if matching planned/extra entry is missing?
9. Should Settings force-refresh remain a user-facing action in native iOS, and what equivalent recovery behavior is required?
>>>>>>> main
