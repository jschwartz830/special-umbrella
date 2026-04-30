# IOS_IMPLEMENTATION_SPEC

## Architecture (SwiftUI-first)
- **App style**: Native SwiftUI app, domain-first design, with modules by capability (not by web component parity):
  - `CoreDomain` (models, value types, domain rules)
  - `CoreDataAccess` (repositories + migrations)
  - `CoreServices` (projection/progression/stat engines)
  - `Features/Today`, `Features/Calendar`, `Features/History`, `Features/Plans`, `Features/Settings`, `Features/ProgramImport`
- **Primary principle**: Reconstruct behavior semantics from product/domain rules; do not mirror React state/store structure mechanically.
- **Layering**
  1. **SwiftUI Presentation**: screens, sheets, alerts, toolbar actions, accessibility labels.
  2. **Feature State**: `@Observable` view models per feature with explicit intents and async-safe side effects.
  3. **Domain Services**: pure services for rotation resolution, calendar projection, progression, and conflict policy.
  4. **Persistence**: repository protocol layer + local storage implementation + migration strategy.
- **Dependency management**
  - AppContainer injected via SwiftUI Environment.
  - Include abstractions for clock/date/timezone, UUID factory, import/export adapters, and logger.

## Navigation Structure
- Root `TabView` with five tabs: Today, Calendar, History, Plans, Settings.
- `NavigationStack` inside each tab to preserve independent back stacks.
- Planned deep links:
  - `app://plans/new`
  - `app://plans/{id}/edit`
  - `app://plans/import`
  - (Optional) `app://calendar/{yyyy-MM-dd}`
- Modal structure:
  - Outcome capture/edit sheet (detents: medium/large).
  - Active Workout full-screen cover, with resumable mini-player dock behavior.
  - Confirmation dialogs for destructive and collision actions.

## Data Models
Define Swift-native models that preserve current behavior:
- **Core entities**
  - `Plan`, `PlanDay`, `WorkoutSlot`, `PlanDuration`, `PlanStatus`
  - `HistoryEntry`, `ExtraWorkoutEntry`, `OverrideEntry`
  - `WorkoutOutcome`, `RunProgressionState`, `ProgramVariableState`
- **Identifiers and keys**
  - Keep stable entity IDs (`UUID`-backed strings recommended).
  - Support current web identity semantics for outcomes:
    - planned: `{planId}_{calendarDate}`
    - extra: `{planId}_{calendarDate}_extra_{extraId}`
  - Optionally wrap this in a typed `WorkoutInstanceKey` parser/formatter.
- **Date semantics**
  - Model `calendarDate` as date-only value type (not bare `Date`).
  - Preserve jump override timestamp behavior logically, but implement as explicit day anchor field in persistence to avoid timezone drift.
- **Program-compatible fields**
  - Keep optional run/weights/swim actuals and structured workout fields needed by imported YAML programs.

## State Management Approach
- Use feature-scoped observable state:
  - `TodayViewModel`, `CalendarViewModel`, `HistoryViewModel`, `PlansViewModel`, etc.
- Keep side effects in intent handlers (e.g., `logCompletion()`, `moveOutcomeDate()`, `archivePlan()`).
- Use repository-level transactional APIs for cross-entity mutations:
  - Move planned entry date + move associated outcome key.
  - Move extra entry date + move associated outcome key.
  - Delete/Archive plan with optional cascades.
- Maintain deterministic calculations by injecting `DateProvider` and `TimezonePolicy`.
- Keep derived UI state as computed projections (today status, upcoming, monthly cells, history summaries), not duplicated persisted flags.

## Persistence Strategy (local first, extensible to cloud)
- **Baseline**: local-only storage in v1 using SwiftData or SQLite (GRDB preferred if strong migration control is required).
- **Repository interfaces**
  - `PlanRepository`
  - `HistoryRepository`
  - `OutcomeRepository`
  - `ProgramVarsRepository`
  - `ImportExportRepository`
- **Schema/versioning**
  - Explicit app schema version and migration tests.
  - Add migration utilities equivalent to web slot normalization behavior (legacy workout types/tag derivation).
- **Atomic write requirements**
  - Date-move operations must commit entry + outcome key updates atomically.
  - Retro jump replacement should be single transaction (remove stale + add replacement when needed).
  - Plan delete/archive should consistently apply retention policy across related entities.
- **Cloud readiness**
  - Prepare metadata fields (`updatedAt`, tombstones, lastWriter/sourceDevice, syncVersion).
  - Keep conflict policy extension points but default to local-authoritative v1.

## Screen-by-Screen Mapping (web → iOS adaptation)
- **Today** (`TodayPage` behavior source)
  - Active plan summary + today card + quick actions (Complete / Skip / Day Off).
  - Additional workout logging as explicit native CTA (“Log Additional Workout”).
  - Adaptation insights and spacing warning in concise expandable card.
  - Active workout launch/resume entry point with native session UI.
- **Calendar** (`CalendarPage` behavior source)
  - Native month grid (lazy, pageable month view) + date detail sheet.
  - Date actions: complete/skip/day-off, retro plan-day selection, clear day.
  - Extra workout management and outcome edit.
  - Outcome date edit with explicit collision UX.
- **History** (`HistoryPage` behavior source)
  - Chronological timeline with filters and scoped summary stats.
  - Inline note editing and detail drill-in.
  - CSV export/share and CSV import conflict summary.
- **Plans** (`PlansPage` + `PlanBuilderPage`)
  - Sectioned list for Active/Inactive/Archived with swipe/context actions.
  - Plan editor as multi-step form (plan metadata → days → slot details).
  - Duplicate/activate/archive/delete actions with clear consequence copy.
- **Program Import** (`ProgramImportPage`)
  - Document picker ingest, parse-validation result screen, and import preview.
  - Show warnings for unsupported or partially mapped fields.
- **Settings** (`SettingsPage`)
  - Data reset/export/import, diagnostics, and feature flags/developer tools.

## Native iOS UI/UX adaptations (not web parity)
- Use SF Symbols + iOS tab semantics rather than icon-only bottom-nav web styling.
- Prefer sheets and confirmation dialogs over nested modal stacks.
- Use haptics for key state transitions (completed, skipped, day off, destructive confirms).
- Accessibility-first behavior:
  - Dynamic Type support at all breakpoints.
  - VoiceOver labels for workouts, outcomes, and calendar status badges.
  - High contrast and reduced motion support.
- Use contextual swipe actions for common row actions (archive, duplicate, delete).
- Present conflict/overwrite decisions explicitly when editing dates or importing data.

## Build Phases / Implementation Plan
1. **Domain & Storage Foundation**
   - Implement core models, repositories, migrations, typed date key strategy.
2. **Domain Services Parity**
   - Implement rotation resolver, month projection, history stats, progression services with fixtures.
3. **Plans Vertical Slice**
   - Plans list, create/edit, activate/deactivate, duplicate, archive/delete.
4. **Today Vertical Slice**
   - Today projection, quick actions, outcome sheet, adaptation insights, extra workouts.
5. **Calendar Vertical Slice**
   - Month/day interactions, retro jumps, clear-day, outcome date move, extra workflows.
6. **History Vertical Slice**
   - Timeline, filters, notes, CSV import/export.
7. **Program Import + Vars**
   - YAML ingest mapping, vars initialization, progression rule updates.
8. **Hardening & Release Prep**
   - Accessibility, performance, migration validation, backup/restore checks, telemetry hooks.

## Testing Considerations
- **Unit Tests**
  - Rotation/day resolution fixtures.
  - Calendar projection correctness across month boundaries and leap years.
  - Progression recommendation + run adaptation + program-rule evaluation.
- **Repository / Integration Tests**
  - Transaction atomicity for multi-entity mutations.
  - Migration tests including legacy slot-type normalization.
  - Import dedupe behavior (planned entries by date key, extras by chosen policy).
- **UI Tests**
  - Critical path: create plan → activate → log today completion → edit in calendar.
  - Date move collision flows.
  - Additional workout + extra outcome flow.
- **Accessibility / Snapshot**
  - Dynamic Type, dark mode, VoiceOver traversal, reduced motion.

## Open Questions / Ambiguities
1. Should iOS preserve the exact web outcome instance-id string format, or use internal relational keys with a compatibility adapter?
2. For date move collisions (planned and extra), what UX is required: silent replace, prompt, or merge workflow?
3. When historical outcomes are edited/deleted, should progression state and program variables be recomputed retroactively?
4. Should `swap_slot` overrides ship in v1 iOS UI, or remain model-only pending product validation?
5. What canonical timezone policy should govern date-only logging, retro jumps, and travel/DST behavior?
6. What is the required cascade/retention policy when plans are archived vs permanently deleted?
7. Should extra-workout dedupe remain ID-only, or move to semantic dedupe (date/type/name/source) on import?
8. Is historical Active Workout resume a required v1 capability or optional enhancement?
