# IOS_IMPLEMENTATION_SPEC

## Architecture (SwiftUI-first)
- **Goal**: Build a native iOS training-tracker app that preserves product behavior, not React/Zustand implementation details.
- **Proposed module boundaries**
  - `Domain`: entities/value objects, invariants, business rules.
  - `Services`: rotation projection, calendar projection, stats, progression engines.
  - `Persistence`: repositories, schema/migrations, import/export adapters.
  - `Features`: Today, Calendar, History, Plans, Program Import, Settings.
  - `AppCore`: dependency container, logging, date/time providers, feature flags.
- **Layering rules**
  1. SwiftUI views are declarative UI only.
  2. Feature view models own user intents + async workflows.
  3. Domain services are deterministic/pure where possible.
  4. Persistence is behind protocols; storage engine is swappable.
- **Cross-cutting dependencies**
  - `Clock`, `CalendarProvider`, `TimezonePolicy`, `UUIDGenerator`, `ImportExportService`, `Telemetry`.

## Navigation Structure
- Root `TabView`: Today / Calendar / History / Plans / Settings.
- Separate `NavigationStack` per tab.
- Route destinations:
  - Plan create/edit flow.
  - Program import flow.
  - Outcome edit/capture sheets.
  - Optional direct calendar-date deep link.
- Presentation style
  - Sheets for outcome and detail editors.
  - Full-screen cover for Active Workout session.
  - Confirmation dialogs for destructive/conflict actions.

## Data Models
- **Core entities**
  - `Plan`, `PlanDay`, `WorkoutSlot`, `PlanDuration`, `PlanStatus`.
  - `HistoryEntry`, `ExtraWorkoutEntry`, `OverrideEntry`.
  - `WorkoutOutcome`, `RunProgressionState`, `ProgramVariables`.
  - `ExerciseHistoryEntry` (derived, query-optimized).
- **Identifiers**
  - Stable string IDs (UUID-backed) for plans/days/slots/extras/entries.
  - Introduce typed `WorkoutInstanceKey` with planned/extra cases.
- **Date modeling**
  - Use explicit date-only type (`LocalDate`) for `calendarDate`.
  - Store jump-anchor effective date explicitly (avoid parsing local time from arbitrary ISO strings).
- **Compatibility constraints**
  - Preserve semantics of planned vs extra outcomes.
  - Preserve nullable metrics fields and modality-specific actual payloads.

## State Management Approach
- Feature-specific `@Observable` view models (or equivalent) with explicit intent methods.
- Domain actions should be use-case oriented:
  - `logPlannedAction`, `logExtraWorkout`, `saveOutcome`, `moveOutcomeDate`, `clearDate`, `activatePlan`, `archivePlan`, etc.
- Use a transaction coordinator at repository layer for cross-entity writes:
  - Planned date move (history + outcome + downstream indexes).
  - Extra date move (extra + outcome + downstream indexes).
  - Retro jump replacement (remove stale + add new).
- Derived UI state should be computed from repositories/services, not persisted as extra flags.

## Persistence Strategy (local first, extensible to cloud)
- **v1 local store**: SQLite-backed persistence (SwiftData acceptable if migration controls are proven; GRDB preferred for explicit transactions/migrations).
- **Repository protocols**
  - `PlanRepository`, `HistoryRepository`, `OutcomeRepository`, `ProgramVarsRepository`, `ExerciseHistoryRepository`, `ImportExportRepository`.
- **Migration requirements**
  - Slot-type legacy normalization parity.
  - Tag-derived metadata mapping parity.
  - Schema version table + migration tests.
- **Atomicity requirements**
  - Multi-entity updates must be transactional.
  - Import should be staged/validated before commit with rollback on failure.
- **Cloud-ready extension points**
  - Include `updatedAt`, `deletedAt/tombstone`, `sourceDeviceId`, conflict metadata, and monotonic sync versions.

## Screen-by-Screen Mapping (web → iOS adaptation)
- **Today**
  - Native card stack: current workout, upcoming preview, progress insights.
  - Quick actions for complete/skip/day off; separate CTA for additional workout.
  - Active workout entry point with minimized dock-like affordance.
  - Adaptation notes/cautions in collapsible “Coach Insights” section.
- **Calendar**
  - Pageable month with accessible day cells and status markers.
  - Day detail sheet: log actions, adjust plan-day selection for retro entries, manage extras, edit outcomes.
  - Explicit UX for date-move collisions (do not silently hide overwrite effects).
- **History**
  - Timeline with filter chips/scope picker and summary cards.
  - Notes editing and read-friendly workout detail drill-in.
  - Share-sheet driven CSV export; file-import flow for CSV ingest with pre-commit summary.
- **Plans**
  - Sectioned list (active/inactive/archived), contextual swipe actions.
  - Native form-based plan builder (metadata, day templates, slot details).
  - Import entry point co-located with plan creation actions.
- **Program Import**
  - Document picker, parse results, schema errors/warnings list, import preview.
- **Settings**
  - Native diagnostics + data tools.
  - “App refresh recovery” adapted from web force-refresh intent (clear app caches/local DB only when user confirms).
  - Version/build metadata screen.

## Native iOS UI/UX adaptations (not web parity)
- Prefer iOS interaction idioms: swipe actions, menus, segmented controls, and detented sheets.
- Haptics for success, caution, and destructive confirmations.
- Accessibility-first:
  - Dynamic Type, VoiceOver rotor-friendly labels, reduced motion support.
  - Color-independent status indicators in calendar/history.
- Distinguish planned vs extra workouts with native visual hierarchy instead of string key conventions.
- Use non-blocking banners/toasts for secondary confirmations (e.g., “Outcome moved to Apr 10”).

## Build Phases / Implementation Plan
1. **Domain/Persistence Foundation**
   - Implement entities, repositories, migrations, date/time policy, transaction coordinator.
2. **Core Services**
   - Rotation resolver, month projection, stats, progression/recommendation engines.
3. **Plans Feature**
   - CRUD + activate/deactivate + archive/delete + import entry integration.
4. **Today Feature**
   - Projection/UI, quick actions, outcome editor, additional workouts, active session shell.
5. **Calendar Feature**
   - Month/day interactions, retro jumps, clear-day flow, planned/extra outcome edits.
6. **History Feature**
   - Timeline, filters, notes, stats, CSV import/export.
7. **Program Import & Vars**
   - YAML mapping pipeline, vars init/update, validation UX.
8. **Settings + Hardening**
   - Diagnostics, data recovery/reset, performance tuning, accessibility and QA gates.

## Testing Considerations
- **Unit tests**
  - Rotation/day projection, retro jump behavior, stats computations.
  - Progression recommendation + run progression + program variable rule updates.
  - Instance-key parser/formatter correctness (planned vs extra).
- **Repository integration tests**
  - Transactional date moves and clear-day operations.
  - Migration tests for legacy slot normalization.
  - Import dedupe and overwrite policies.
  - Exercise-history synchronization from outcomes.
- **UI tests**
  - End-to-end: create plan → activate → log outcome → edit in calendar → verify history.
  - Collision prompts and destructive confirmation flows.
  - Additional workout and historical resume paths.
- **Non-functional tests**
  - Timezone/DST simulations.
  - Large history dataset scrolling/performance.
  - Accessibility snapshots and VoiceOver navigation.

## Open Questions / Ambiguities
1. Should iOS persist web-compatible outcome key strings directly, or use internal relational IDs with a compatibility adapter at import/export boundaries?
2. What exact collision policy is required when moving planned outcomes to dates that already contain planned entries?
3. Are progression state, program variables, and exercise-history indexes required to recompute on retro edits/deletes?
4. Should `swap_slot` be exposed in iOS v1 UX, or deferred to model-only support?
5. What is the canonical timezone policy for date-only logging across travel and DST transitions?
6. What archive/delete retention policy is desired for linked history, extras, outcomes, overrides, and program vars?
7. Should extra-workout import dedupe remain ID-based or become semantic?
8. Is historical Active Workout resume mandatory for v1, including cases where matching history rows are missing?
9. What is the iOS equivalent of web “force refresh” (cache/service-worker reset), and should it be end-user visible or debug-only?
