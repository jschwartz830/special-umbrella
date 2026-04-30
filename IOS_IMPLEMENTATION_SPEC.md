# IOS_IMPLEMENTATION_SPEC

## Architecture (SwiftUI-first)
- **App style**: SwiftUI app with feature-first modularization (e.g., `Features/Today`, `Features/Calendar`, `Features/Plans`, `Features/History`, `Features/Settings`, `Core/Models`, `Core/Persistence`, `Core/Domain`).
- **Design principle**: Rebuild product behavior natively; do not mirror React component structure. Preserve domain semantics from stores/engines.
- **Layers**:
  1. **UI layer (SwiftUI Views)**: declarative screens, sheets, alerts, and toolbars.
  2. **State layer**: `@Observable` / `ObservableObject` feature view models with explicit intents.
  3. **Domain layer**: pure Swift services for rotation projection, progression, stats, and conflict resolution.
  4. **Persistence layer**: local database/repository abstraction (local-first) with migration support.
- **Dependency injection**: environment container injected at app root (repositories, services, clock/date provider, analytics logger).

## Navigation Structure
- Root `TabView` with five tabs: Today, Calendar, History, Plans, Settings.
- Deep links / routes:
  - Plans list → Create plan flow.
  - Plans list → Edit existing plan.
  - Plans list → Import program flow.
- Modals/sheets:
  - Outcome capture/edit sheet.
  - Active workout tracker full-screen flow with collapsible mini-player behavior.
  - Generic confirmation dialogs (delete/archive/deactivate/conflict).

## Data Models
Define native Swift structs/entities equivalent to domain behavior (not 1:1 TS translation required):
- `Plan`, `PlanDay`, `WorkoutSlot`, `PlanDuration`, `PlanStatus`.
- `HistoryEntry`, `ExtraWorkoutEntry`, `OverrideEntry`.
- `WorkoutOutcome`, `RunProgressionState`, `ProgramVariableState`.
- Derived read models:
  - `ResolvedDay` for projections.
  - `DayStatus` classification.
  - `PlanProgressSummary` and `HistoryStatsSummary`.

Model requirements:
- Preserve date-keyed identity conventions currently used by web app (`plan + date`, plus extra suffix behavior) unless product decides to change globally.
- Keep optional fields for run/weights programming and imported structured workout data.
- Capture entry provenance (`source`) for extra workouts.

## State Management Approach
- Use unidirectional feature state with intent methods:
  - `TodayViewModel`, `CalendarViewModel`, `PlansViewModel`, etc.
- Keep domain services pure and testable:
  - `RotationService`, `CalendarProjectionService`, `ProgressionService`, `HistoryStatsService`, `ProgramRuleService`.
- Cross-feature consistency:
  - Use transaction-like repository operations for multi-entity updates (e.g., move history date + move outcome in one atomic call).
- Date/time determinism:
  - Central `DateProvider` + locale/timezone strategy to avoid drift in day-boundary behavior.

## Persistence Strategy (local first, extensible to cloud)
- Local persistence baseline:
  - Prefer SwiftData or SQLite-backed repository (GRDB/CoreData acceptable) with explicit schema versioning.
- Repositories:
  - `PlanRepository`, `HistoryRepository`, `OutcomeRepository`, `ProgramVarsRepository`.
- Atomic operations required:
  - Delete plan + cascade related history/extras/outcomes/vars.
  - Move completion date and remap associated outcome key.
  - Retroactive jump rewrite (remove stale + write replacement).
- Cloud extension readiness:
  - Add sync metadata (`updatedAt`, tombstones, source-of-truth IDs, conflict policy hooks).
  - Keep domain IDs stable UUID strings for future cross-device merge.

## Screen-by-Screen Mapping (web → iOS adaptation)
- **Today** (from `TodayPage`)
  - Show active plan day card, quick actions (complete/skip/day off/overrides), adaptation note, spacing warning, progress widgets.
  - Use native cards, segmented controls, bottom sheets.
  - Include active workout tracker launch + inline “resume session” affordance.
- **Calendar** (from `CalendarPage`)
  - Native month pager (swipe + header arrows), day detail sheet, action chips.
  - Logging complete opens outcome sheet.
  - Retroactive plan-day selection represented with native picker wheel/menu.
- **History**
  - Timeline/list with filter scope, drill-down details, edit notes, import/export entry points.
- **Plans**
  - Sectioned list (Active, Inactive, Archived), contextual row actions.
  - Dedicated plan editor flow for days/slots and duration.
- **Plan Builder**
  - Form-based editor using `NavigationStack` drill-ins for slot details and structured exercises/segments.
- **Program Import**
  - Document picker import + parse validation summary screen + import preview diff.
- **Settings**
  - Data management, diagnostics, and feature toggles.

## Native iOS UI/UX adaptations (not web parity)
- Replace bottom-nav web affordances with iOS tab bar semantics and SF Symbols.
- Use `sheet` detents for Outcome capture and day detail editing.
- Use haptics for completion/skip/day-off confirmation.
- Support Dynamic Type, VoiceOver labels, and reduced motion.
- Use swipe actions in lists for archive/delete/duplicate where appropriate.
- Inline error banners and recovery actions for parse/import failures.
- Keep “double-day” as intentional workflow but express via clear native labels (e.g., “Log Additional Workout”).

## Build Phases / Implementation Plan
1. **Foundation**
   - Create domain models, repositories, migration scaffolding, and deterministic date utilities.
2. **Core engines in Swift**
   - Implement rotation projection, calendar grid, history stats, and progression services.
3. **Plans + Activation flows**
   - Build Plans tab, Plan editor, activation/deactivation, archive/delete, duplication.
4. **Today flow**
   - Implement daily card, quick actions, outcome capture, active workout tracking surface.
5. **Calendar flow**
   - Implement month grid, day detail, retro logging, extra workouts, outcome edit/move date.
6. **History flow**
   - Build timeline/filtering, notes editing, CSV share/import endpoints.
7. **Program import + progression vars**
   - YAML parse pipeline, var initialization, rule execution integration.
8. **Hardening**
   - Accessibility, performance profiling, edge-case QA, migration tests, backup/restore path.

## Testing Considerations
- Unit tests:
  - Rotation and projection equivalence with known fixtures.
  - Progression rule evaluation and run adaptation state transitions.
  - Date-move conflict resolution and cascade delete integrity.
- Repository tests:
  - Migration tests from legacy schemas.
  - Transaction atomicity for multi-entity operations.
- UI tests:
  - Critical journeys (new plan → activate → log today → edit in calendar).
  - Import parse errors and user recovery paths.
- Snapshot/accessibility tests:
  - Dynamic Type, dark mode, VoiceOver focus order.

## Open Questions / Ambiguities
1. Should iOS preserve exact instance-id string format used on web, or introduce opaque IDs with relational links while maintaining behavior?
2. For same-day collisions when moving history/outcomes, should iOS silently replace (current web tendency) or require user confirmation?
3. How should progression recalculation behave after editing/deleting historical outcomes?
4. Is `swap_slot` override expected in v1 iOS UX, or can it remain data-model-only until a later phase?
5. What is desired long-term timezone policy for date-only workout logs across travel/daylight changes?
6. Should archived plans be read-only with visible history, or hidden by default with explicit reveal?
