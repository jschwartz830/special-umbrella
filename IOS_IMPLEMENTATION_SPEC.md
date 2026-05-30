# IOS_IMPLEMENTATION_SPEC

> Plan for rebuilding the workout-plan tracker **natively in SwiftUI**. This is not a line-by-line port of the React/Zustand code — it specifies how to reproduce the **product behavior** captured in `WEB_APP_INVENTORY.md` using native iOS idioms, while guaranteeing functional parity. Where the web app's behavior is web-specific (service workers, CSV-as-only-transport), the native adaptation is called out explicitly.
>
> Target: iOS 17+ (so `@Observable`, `NavigationStack`, SwiftData/Observation are available). Swift concurrency (`async/await`) throughout.

## Architecture (SwiftUI-first)

- **Goal**: A native training tracker that preserves all product behavior in the inventory, expressed through native data, navigation, and interaction patterns.
- **Module boundaries**
  - `Domain`: entities/value objects + invariants (Plan, PlanDay, WorkoutSlot, HistoryEntry, ExtraWorkoutEntry, OverrideEntry, WorkoutOutcome, RunProgressionState, ProgramVars, ExerciseSessionRecord, ResolvedDay).
  - `Services`: deterministic engines — rotation projection, calendar projection, history stats, run-adaptation, recommendation, expression evaluation, YAML import, CSV import/export.
  - `Persistence`: repositories + schema/migrations + import/export adapters; storage engine swappable behind protocols.
  - `Features`: Today, Calendar, History, Plans, Plan Builder, Program Import, Settings, Active Workout.
  - `AppCore`: dependency container, `Clock`/`CalendarProvider`/`TimezonePolicy`, `UUIDGenerator`, logging/telemetry, feature flags.
- **Layering rules**
  1. SwiftUI views are declarative UI only.
  2. Feature view models (`@Observable`) own user intents + async workflows; they call domain use-cases, never persistence directly.
  3. Domain services are pure/deterministic where possible (mirror the web engines, which are already pure) so they are unit-testable in isolation.
  4. Persistence is behind protocols; the concrete store is swappable.
- **Determinism**: the web rotation/projection/stats/progression engines are already pure functions over their inputs. Reproduce them as pure Swift `struct`/free functions with identical decision tables (e.g. "all logged actions advance the pointer by +1"; run-progression thresholds 95% / effort≤3 / effort=5 / <80%). Port the test suites (`src/**/__tests__`) as Swift unit tests to lock parity.

## Navigation Structure

- Root `TabView`: **Today / Calendar / History / Plans / Settings** (mirror `BottomNav`). Each tab owns its own `NavigationStack`.
- Stack destinations:
  - Plans → Plan Builder (new/edit), Program Import.
  - History → entry/extra detail editors.
- Presentation:
  - **Sheets (detented)** for outcome capture/edit and the calendar day-detail drill-down.
  - **Full-screen cover** for the Active Workout session.
  - **Confirmation dialogs** for destructive/conflict actions (delete plan, clear day, discard unsaved session, date-move collision).
  - Optional deep link to a specific calendar date.

## Data Models

Model these as Swift `Codable` value types in `Domain` (and `@Model` SwiftData classes in `Persistence` if SwiftData is chosen — keep the two layers mapped, don't leak SwiftData into Domain).

- **Core entities**: `Plan`, `PlanDay`, `WorkoutSlot`, `PlanDuration` (`enum DurationType { rotations, weeks }` + value), `PlanStatus` (`active/inactive/archived`).
  - `WorkoutType` enum with the canonical cases `weights/run/swim/yoga/other` plus the legacy cases `weightlifting/long_run/recovery_run/rest` decoded for import compatibility and **normalized on load** (replicate `migrateSlot`).
  - `WorkoutSlot` retains the full optional surface (simple targets, metadata, `runConfig`, and the program/DSL fields `warmup`/`exercises`/`segments`/`slotProgress`).
- **Logging entities**: `HistoryEntry` (one per plan+date), `ExtraWorkoutEntry` (with `source: ExtraSource? { history, doubleDay }`), `OverrideEntry` (`advance/goBack/jump/swapSlot`).
- **Outcome entities**: `WorkoutOutcome` (completionState, completedAt, durationActualMin, perceivedEffort 1–5, notes, `runActual`/`weightsActual`/`swimActual`, `progressionRecommendation`), `RunProgressionState`, `ProgramVariables` (`[planId: [varName: Double]]`).
- **Derived**: `ExerciseSessionRecord` (per-exercise PR/volume index with `planName`/`workoutName` snapshots), `ResolvedDay` (computed, never persisted).
- **Program/DSL**: `ExerciseSpec`, `SetSpec` (reps may be `Int` or `String` for "5+"/ranges — model as an enum `RepTarget { count(Int), expression(String) }`), `RunSegment`, `DrillSpec`, `ProgressionRule` (`if?`/`then`/`else?`), `ProgressionType`.
- **Enumerations** (port the exact case sets from `WEB_APP_INVENTORY.md` → "Controlled vocabularies / enums" — these are not optional; Plan Builder pickers, badges, recommendation logic, and CSV round-trips all depend on them):
  - `WorkoutType` (canonical `weights/run/swim/yoga/other`) + a separate decode-only `LegacyWorkoutType` (`weightlifting/long_run/recovery_run/rest`) normalized into the canonical enum + a subtype on load (replicate `migrateSlot`). Do **not** surface legacy cases in new UI.
  - `WorkoutDifficulty`, `WorkoutTag` (18 cases), `WorkoutLocation`, `WeightsFocusArea`, `WeightsTrainingIntent`, `RunWorkoutSubtype` (+ legacy aliases), `SwimWorkoutSubtype`, `YogaWorkoutSubtype`, `OtherWorkoutSubtype`.
  - `WorkoutCompletionState` (6 cases) with a `toAction()` mapping to `ActionType` (mirror `completionStateToAction`), `PerceivedEffort` (1–5, model as a validated `Int` or a 5-case enum), `LoggedExerciseActual.progressionMode` (`single/double/volume/maintenance`), `ProgressionRecommendation` (`discipline`/`mode`/`action`/`note`), `OverrideType`, `DayStatus` (9 cases).
  - Decode unknown/legacy raw strings leniently (Codable with a fallback) so importing older CSV/YAML never throws.
- **Extra → slot bridge**: replicate `planDayUtils.extraToPlanDay` — additional/ad-hoc workouts (`ExtraWorkoutEntry`) must project into a synthetic single-slot `PlanDay` so the **same** outcome-capture and Active-Workout surfaces drive them. Don't build a reduced "extra" editor; reuse the slot-driven views (this is what gives extras full set/rest tracking on the web).
- **Identifiers**
  - Use a stable `String` id type (UUID-backed) for all entities.
  - Introduce a typed `WorkoutInstanceKey` enum with `.planned(planId, date)` and `.extra(planId, date, extraId)` cases that serialize **to and from** the web string format (`planId_date`, `planId_date_extra_extraId`) so CSV import/export and any shared data stay compatible. Centralize parsing (replicate `parseWorkoutInstanceId`'s regex-based date locator).
- **Date modeling**
  - Introduce a `LocalDate` value type (year/month/day) for `calendarDate` to avoid time-of-day/timezone bugs; all date math goes through it.
  - Store the jump-anchor's **effective local date explicitly** on the override rather than re-deriving it from an arbitrary ISO timestamp (fixes the web's `new Date(appliedAt)` ambiguity while preserving the "noon anchor" intent).
- **Compatibility constraints**: preserve planned vs. extra outcome semantics, nullable metric fields, and modality-specific actual payloads so CSV round-trips with the web app are lossless.

## State Management Approach

- Feature-scoped `@Observable` view models exposing explicit intent methods (use-case oriented), e.g. `logPlannedAction`, `logExtraWorkout`, `saveOutcome`, `moveOutcomeDate`, `clearDate`, `activatePlan`, `archivePlan`, `deletePlan`, `applyOverride`.
- A **transaction coordinator** at the repository layer wraps cross-entity writes that the web app currently does non-atomically:
  - Planned date move (history + outcome + exercise-history re-key).
  - Extra date move (extra + outcome + exercise-history re-key).
  - Retro jump replacement (remove stale jump + add new + write entry).
  - Plan delete/archive cascade (see Persistence + Open Questions #7).
  - Outcome log → progression pipeline (recommendation + run progression + program-var rules + exercise-history sync) committed as one unit.
- Derived UI state (resolved days, stats, projections) is **computed** from repositories/services, never persisted as extra flags. Cache with `@Observable` derived properties or memoized services keyed by store revision.

## Persistence Strategy (local first, extensible to cloud)

- **v1 local store**: SQLite-backed. **GRDB preferred** for explicit transactions + migrations; SwiftData acceptable only if its migration story is proven for this schema. Either way, expose repository protocols:
  - `PlanRepository`, `HistoryRepository` (entries + overrides + extras), `OutcomeRepository` (outcomes + progression states), `ProgramVarsRepository`, `ExerciseHistoryRepository`, `SettingsRepository`, `ImportExportRepository`.
- **Mapping from web persistence**: the six Zustand stores (`wpt_plans`, `wpt_history`, `wpt_outcomes`, `wpt_program_vars`, `wpt_exercise_history`, `wpt_settings`) map to repositories above. The per-plan expiry-dismissal flags (`wpt_expiry_dismissed_v1_*`) and the active-workout draft (`wpt_active_draft_*`) map to lightweight key-value storage (`UserDefaults`/a `DraftStore`).
- **Migration requirements**
  - Legacy slot-type normalization parity (`weightlifting`→`weights`, `long_run`/`recovery_run`→`run`+subtype, `rest`→`other`+subtype, tag-derived `location`/`focus`). Run this on import and as a one-time data migration.
  - Schema version table + migration tests; mirror the web `version: 2` plan migration as the starting baseline.
- **Atomicity requirements**: all multi-entity updates run in a single transaction; imports are staged/validated then committed atomically with rollback on failure.
- **Cloud-ready extension points**: include `updatedAt`, `deletedAt`/tombstone, `sourceDeviceId`, and a monotonic sync version on every record so CloudKit/iCloud sync can be added without a schema rewrite. (Web has only `createdAt`/`updatedAt`; add the rest now.)
- **Settings store**: persist `startDelaySeconds` (set-timer countdown) — see Open Questions #10 for scope.
- **Bundled resources** (ship as app resources, not user data):
  - **Exercise library** (~336 entries from `src/lib/exerciseLibrary.ts`) — convert to a bundled JSON and load into an `ExerciseLibraryService` (case-insensitive lookup + autocomplete; keep `type`/`target`/`synergist` for classification). Versioned so it can be updated independently of user data.
  - **Program templates** (`src/programs/*.yaml`: `gzclp-5k.yaml`, `upper-lower-hybrid-12w.yaml`) — bundle the raw YAML as resources for the Program Import template picker, parsed through the same import service as user-pasted YAML.
- **CSV schema-version compatibility**: the import adapter must honor the web's additive-column cutovers (`entryKind` default `rotation`; missing `extraId` → fresh id, non-idempotent; missing `extraSource` → `undefined`). Decide the `undefined` `source` policy once (see Open Questions #14) and apply it consistently across import and Undo — the web currently disagrees with itself.

## Screen-by-Screen Mapping (web → iOS adaptation)

- **Today** (`TodayPage` → `TodayView`)
  - Native card stack: today's workout card, completed-today section, optional rest-day card, double-day bonus card, upcoming preview.
  - Header with date, plan name, and a progress line (rotation day, cycle progress, week progress).
  - A compact stats row (streak / 7-day / total) and a 7-day activity strip.
  - "Coach Insights" collapsible section for run adaptation note, difficulty-spacing warning, and last-session summary.
  - Quick actions: Complete (opens outcome sheet) / Skip / Day Off; separate CTA for an additional workout; Override menu (advance / go back / jump-to-day picker).
  - Unlogged-day nudge with a batch "Mark as Day Off" action.
  - Active-workout entry point with a **minimized dock/Live-Activity-style affordance** while a session is running.
  - Treat plan as guidance: logging a non-planned workout defers the displaced planned workout to the next day by default (per product direction #2).
- **Calendar** (`CalendarPage` → `CalendarView`)
  - Pageable month grid with accessible day cells, color-independent status markers, slot/extra indicators, and a legend.
  - Day-detail **detented sheet** with the 3-level structure (overview → rotation detail / extra detail): log actions, adjust the plan-day for retro entries (drives the jump-anchor override), manage extras, edit outcomes, clear day, resume a historical session.
  - Explicit, non-silent UX for date-move collisions (confirm or merge — never the web's silent overwrite).
- **History** (`HistoryPage` → `HistoryView`)
  - Timeline list (sections by date, rotation before extras), filter by plan (segmented control or menu), summary cards (streak/7/30/total + training mix).
  - Expandable Personal Records and Weekly Activity sections.
  - Entry editor (date move with conflict check, action change, notes), extra editor, per-date "Add workout".
  - **Native data transport**: keep CSV import/export (share sheet + Files importer) for parity/portability, but treat CSV as one adapter — the primary store is the local DB. Consider adding JSON export later.
- **Plans** (`PlansPage` → `PlansView`)
  - Sectioned list (active/inactive/archived) with swipe actions and a context menu (activate/deactivate, duplicate, archive, delete).
  - Activate flow as a sheet (start date + start-day picker, mirroring `setActivePlan` semantics including demoting the prior active plan).
  - Delete confirmation must respect the **retention policy** (do not destroy completed workouts — see Open Questions #7).
- **Plan Builder** (`PlanBuilderPage` → `PlanBuilderView`)
  - Native `Form`-based editor: metadata, draggable day list, per-day slot list (1–2 slots, **UI-capped at 2** as on the web), type-specific fields, run config, difficulty, weights exercise editor (library autocomplete from the bundled exercise library, sets/reps/load/rest, per-exercise progression type + if/then/else with templates from a `PROGRESSION_TYPE_META` equivalent, and an exercise-name → program-var slugifier mirroring `toVarName`), notes.
  - Keep the YAML round-trip as an "advanced" editor (text editor sheet) that re-parses through the same import service.
  - Unsaved-changes guard via `.interactiveDismissDisabled` + confirmation dialog.
- **Program Import** (`ProgramImportPage` → `ProgramImportView`)
  - Paste/Files-import YAML, template picker (bundle the `src/programs/*.yaml` templates as resources), parse-result preview with errors/warnings (mirror `PlanPreview`/`SlotPreview`/`ExerciseRow`/`SegmentRow`), and import (creates plan + initializes program vars).
  - A native YAML text editor is sufficient; syntax highlighting is optional polish, not required for parity.
  - Reproduce the in-app **Format reference** (the YAML schema/expression docs) as a static help screen so users can author programs without leaving the app.
- **Settings** (`SettingsPage` → `SettingsView`)
  - Native diagnostics + data tools, set-timer start-delay control, and a Version/build-metadata screen.
  - **No web-style force-refresh control** in v1 (service-worker concern doesn't apply). Provide a separate, clearly-labeled "reset local data" only if desired (debug/destructive), distinct from the web's cache-refresh.

## Native iOS UI/UX adaptations (not web parity)

- Prefer iOS idioms: swipe actions, context menus, segmented controls, `Menu`, and **detented sheets** instead of custom modals.
- Haptics for success / caution / destructive confirmations (`UINotificationFeedbackGenerator`).
- Accessibility-first: Dynamic Type, VoiceOver labels (rotor-friendly), Reduce Motion, and **color-independent** status indicators in calendar/history (icons/shapes, not color alone).
- Distinguish planned vs. extra workouts with native visual hierarchy (badges/section grouping), not string-key conventions.
- Non-blocking toasts/banners for secondary confirmations ("Outcome moved to Apr 10").
- **Active Workout session** native equivalents (the most iOS-specific surface):
  - Replace web AudioContext pre-scheduling with **scheduled local notifications and/or `AVAudioEngine`** for the −15s warning and end-of-rest chord, so alerts fire when the app is backgrounded/locked.
  - Use `UIApplication.isIdleTimerDisabled` (or a wake assertion) during rest instead of the Web Wake Lock API.
  - Consider a **Live Activity / Dynamic Island** for the running workout + rest timer.
  - Timers must reconcile against wall-clock on `scenePhase` changes (replicate the web's visibility reconciliation) so backgrounding never loses elapsed time.
  - Crash-safe **session draft** persisted continuously (equivalent to `wpt_active_draft_*`) so an interrupted session can be resumed.
  - Numeric entry uses native keyboards with `±` stepper accessories rather than the web's custom keypad.

## Build Phases / Implementation Plan

1. **Domain + Persistence foundation**: entities, all controlled-vocabulary enums (lenient Codable), `LocalDate`/`WorkoutInstanceKey`, the extra→slot bridge, repositories, schema + migrations (incl. legacy slot normalization), bundled-resource loaders (exercise library JSON, program templates), transaction coordinator, dependency container, clock/timezone providers.
2. **Core services (pure)**: rotation resolver, month projection, history stats, run-adaptation engine + selectors, recommendation builder, expression evaluator, YAML import, CSV import/export. Port the web unit tests first (TDD parity).
3. **Plans feature**: list + sections, CRUD, activate/deactivate (with prior-active demotion), duplicate (deep clone), archive, delete (retention-aware), CSV import/export entry points.
4. **Today feature**: projection + insights, quick actions, outcome sheet, additional workouts/double-day, Active Workout shell (minimized affordance).
5. **Active Workout session**: full tracker — set/rest/workout timers, wall-clock reconciliation, notifications/audio, wake assertion, draft persistence, progression preview, add/replace exercise.
6. **Calendar feature**: month grid, day-detail sheet, retro jump anchor, clear-day, planned/extra outcome edits, collision UX, historical resume.
7. **History feature**: timeline, filters, notes, stats, PRs, weekly breakdown, CSV import/export.
8. **Plan Builder + Program Import + Vars**: form builder, YAML round-trip, template loading, program-var init/update, validation UX.
9. **Settings + hardening**: set-timer delay, version/build screen, diagnostics, performance tuning (large history), accessibility + QA gates, optional cloud-sync scaffolding.

## Testing Considerations

- **Unit tests (parity-critical)** — port from the web suites:
  - Rotation/day projection incl. override ordering and the "all actions advance +1 / past-unlogged stalls" rule (`rotationEngine.test.ts`).
  - Calendar month projection + pre-start clamping (`calendarProjection.test.ts`).
  - History stats: streaks, plan/cycle progress, weekly breakdown, type breakdown, PRs (`historyStats.test.ts`).
  - Run progression decision table (`run-adaptation/engine.test.ts`) and recommendation copy (`workout-outcomes`, `recommendation`).
  - Expression evaluator: arithmetic/comparison/logical/functions, update statements with paren-aware comma splitting, `resolveLoad`/`resolveQuantityString` (`expressionEval.test.ts`).
  - `WorkoutInstanceKey` round-trip (planned vs extra) (`workoutInstanceId.test.ts`).
  - CSV encode/decode + import dedupe/overwrite (`csv.test.ts`).
  - Last-session summary formatting (`sessionSummary.test.ts`).
- **Repository integration tests**: transactional date moves, clear-day, plan delete/archive cascade per retention policy, legacy slot migration, exercise-history sync, import staging/rollback.
- **UI tests**: create plan → activate → log outcome → edit in calendar → verify in history; collision confirmation; additional-workout + historical resume; double-day.
- **Non-functional**: timezone/DST + travel simulations (`LocalDate` + jump anchor), large-history scrolling, accessibility snapshots + VoiceOver navigation, and **Active Workout backgrounding** (timer reconciliation, notification delivery, draft recovery after force-quit).

## Open Questions / Ambiguities

Product direction is resolved for several of these; remaining decisions are flagged. These mirror `WEB_APP_INVENTORY.md` → Open Questions.

1. **Workout identity strategy** (open): persist web-compatible string keys directly, or internal relational IDs with a `WorkoutInstanceKey` adapter only at CSV import/export boundaries? (Recommendation: internal IDs + adapter.)
2. **Collision policy** (resolved): allow multiple logs/day; logging a non-planned workout defers the displaced planned workout to the next day (excluding day-off). Replaces the web's silent overwrite — needs explicit collision UX.
3. **Retro recompute** (resolved): progression state, program variables, and exercise-history indexes must recompute from the latest corrected history/outcomes. The web app only progresses forward per-log; iOS must replay/recompute after retro edits — confirm the recompute trigger boundaries (per edit vs. batched).
4. **Rotation-order controls** (resolved intent): expose user-visible controls to adjust rotation order (the semantics behind `swap_slot`).
5. **Timezone policy** (resolved): device-local timezone is canonical for date-only logging and jump anchoring; implement via `LocalDate` + explicit effective-date on overrides.
6. **Archive/delete retention** (resolved, contradicts current web): archive/delete must **not** remove completed workouts; historical workouts stay visible but are excluded from active-plan rotation metrics. ⚠ The web app currently cascade-deletes everything on plan delete (`PlansPage.tsx:332-337`) — confirm the exact iOS retention model (orphan history to a "no plan" bucket? keep `planName` snapshot only?).
7. **Extra import dedupe** (resolved direction): semantic dedupe keys (date + type + name/source + tie-break) instead of ID-only.
8. **Historical resume outcome saves** (resolved): allow outcome creation even when no matching planned/extra row exists — outcomes are first-class.
9. **Settings recovery** (resolved): no user-facing iOS equivalent of web force-refresh in v1.
10. **Set-timer start delay** (open): keep as a single global setting (web behavior) or move to per-plan/per-workout configuration?
11. **Second-slot attribution** (open): should stats/summaries account for both slots of a 2-slot day, where the web app counts only `slots[0]`?
12. **Active-session background guarantees** (open): must rest/workout timers and alerts survive app termination (not just backgrounding)? This determines whether to use scheduled local notifications + Live Activities vs. in-process timers only, and how aggressively to persist the draft.
13. **Storage engine** (open): GRDB vs. SwiftData — gate on a migration-safety spike before phase 1 lands.
14. **`ExtraWorkoutEntry.source` default** (open, needs decision): the web is internally inconsistent — the store migration backfills `undefined → 'history'` (keep on Undo) while the type comment and CSV `extraSource` cutover treat `undefined → 'double_day'` (remove on Undo). iOS must pick **one** canonical default and apply it to both import and Undo. (Recommendation: `'history'` for any record not created by the live double-day flow, so imports are never auto-deleted.)
15. **Bundled-resource update cadence** (open): how are the exercise library and program templates updated after ship — app-update only, or remotely refreshable? Affects whether they live in the bundle vs. a downloadable pack.
