# IOS_IMPLEMENTATION_SPEC

> Plan for rebuilding the workout-plan tracker **natively in SwiftUI**. This is not a line-by-line port of the React/Zustand code — it specifies how to reproduce the **product behavior** captured in `WEB_APP_INVENTORY.md` using native iOS idioms, while guaranteeing functional parity. Where the web app's behavior is web-specific (service workers, CSV-as-only-transport), the native adaptation is called out explicitly.
>
> Target: iOS 17+ (so `@Observable`, `NavigationStack`, SwiftData/Observation are available). Swift concurrency (`async/await`) throughout.
>
> **Scope note (this revision):** The web app has grown past the original inventory. This spec now also covers the features that shipped after the first draft — **account auth + cloud sync (Supabase, live today)**, the **Mobility routine feature**, a **dedicated Cardio/run session tracker** (separate from the weights tracker), **run-segment auto-advance**, the **streak-milestone celebration banner**, the **stalled-rotation nudge**, **share-workout-to-clipboard**, and the **auto-advance / sound settings**. It also adds a concrete **Design System & Visual Language** section so the native build can reproduce the exact layout, color, and typographic hierarchy without reverse-engineering the web CSS. Everything here is derived from the current `src/` tree, not just `WEB_APP_INVENTORY.md`.

## Product Summary (what the app is)

A local-first, single-user **workout-plan tracker** shaped like a native training app:

- You author or import **plans** (a rotation of days; each day has 1–2 workout **slots** typed weights/run/swim/yoga/other). One plan is **active** at a time; a rotation pointer projects "what's today" forward from a start date, advancing +1 for every logged day.
- **Today** shows the projected workout, quick log actions, coach insights, a stats/streak strip, a mobility card, and entry points to the live session trackers.
- Live **session trackers** capture rich outcomes: a weights set/rest tracker, a cardio segment tracker, and a mobility-routine tracker.
- **Calendar** and **History** let you review, retro-log, edit, move, and clear entries; **Plans** and **Plan Builder / Program Import** manage plan lifecycle and YAML authoring; **Settings** holds timer/sound prefs, account, and diagnostics.
- Data persists locally and **syncs to the cloud** per signed-in account (Google OAuth). CSV import/export remains a portability adapter.

## Architecture (SwiftUI-first)

- **Goal**: A native training tracker that preserves all product behavior in the inventory, expressed through native data, navigation, and interaction patterns.
- **Module boundaries**
  - `Domain`: entities/value objects + invariants (Plan, PlanDay, WorkoutSlot, HistoryEntry, ExtraWorkoutEntry, OverrideEntry, WorkoutOutcome, RunProgressionState, ProgramVars, ExerciseSessionRecord, ResolvedDay).
  - `Services`: deterministic engines — rotation projection, calendar projection, history stats, run-adaptation, recommendation, expression evaluation, YAML import, CSV import/export.
  - `Persistence`: repositories + schema/migrations + import/export adapters; storage engine swappable behind protocols.
  - `Features`: Today, Calendar, History, Plans, Plan Builder, Program Import, Settings, **Mobility**, and three live session surfaces (**Weights session**, **Cardio session**, **Mobility session**).
  - `Sync`: account/auth (`AuthService`), cloud replication (`StoreSyncService`) — see Persistence → Cloud Sync. This exists in the web app **today**; it is not future work.
  - `AppCore`: dependency container, `Clock`/`CalendarProvider`/`TimezonePolicy`, `UUIDGenerator`, logging/telemetry, feature flags.
- **Layering rules**
  1. SwiftUI views are declarative UI only.
  2. Feature view models (`@Observable`) own user intents + async workflows; they call domain use-cases, never persistence directly.
  3. Domain services are pure/deterministic where possible (mirror the web engines, which are already pure) so they are unit-testable in isolation.
  4. Persistence is behind protocols; the concrete store is swappable.
- **Determinism**: the web rotation/projection/stats/progression engines are already pure functions over their inputs. Reproduce them as pure Swift `struct`/free functions with identical decision tables (e.g. "all logged actions advance the pointer by +1"; run-progression thresholds 95% / effort≤3 / effort=5 / <80%). Port the test suites (`src/**/__tests__`) as Swift unit tests to lock parity.

## Navigation Structure

- **Auth gate first**: the entire app is wrapped in an auth gate (web: `AuthGate`). Before a session exists it renders a full-screen **sign-in screen** (app logo `🏋️`, title "Workout Tracker", subtitle "Sign in to sync your workouts across devices", a single **Continue with Google** button, and a privacy line). A spinner covers the initial auth-state resolution. Only after sign-in does the tab shell mount. Model this as a root branch: `.loading` → spinner, `.signedOut` → sign-in view, `.signedIn` → `TabView`.
- Root `TabView`: exactly **5 tabs — Today / Calendar / History / Plans / Settings** (mirror `BottomNav`; web icons: `Dumbbell`, `CalendarDays`, `History`, `ListChecks`, `Settings`; active tint sky-400). Each tab owns its own `NavigationStack`.
- **Mobility is not a tab.** It is reached from a card on **Today** (its routine editor is a pushed destination — web route `/mobility`; its live tracker opens as a full-screen surface in place). Preserve this: Mobility lives under the Today stack, not the tab bar.
- Stack destinations:
  - Today → Mobility routine editor (My Routine / Library / Presets tabs).
  - Plans → Plan Builder (new/edit), Program Import.
  - History → entry/extra detail editors.
- Presentation:
  - **Sheets (detented)** for outcome capture/edit and the calendar day-detail drill-down.
  - **Full-screen covers** for the three live session trackers: **Weights session**, **Cardio session**, **Mobility session**. Each supports a **minimized dock** (a fixed bottom bar with a live timer + pulsing status dot) so the user can navigate the app while a session runs; tapping the dock re-expands it. Only one session runs at a time in practice, but the Today screen can host a cardio-prompt hand-off (see Today).
  - **Confirmation dialogs** for destructive/conflict actions (delete plan, clear day, discard unsaved session, date-move collision, mobility preset replace vs append).
  - Optional deep link to a specific calendar date.

## Design System & Visual Language

The web app is a **dark, mobile-first, single-column** PWA built with Tailwind. Reproduce this look natively so screenshots match. All values below are the actual tokens in `src/` (Tailwind `slate`/accent scales) — map them to a native color asset catalog with light/dark variants (the app currently ships dark only; a light theme is a native addition, so define semantic names, not raw hex).

- **Layout container**: every screen is centered in a **max-width 512pt column** (`max-w-lg`) with ~16pt horizontal padding (`px-4`). On iPhone this is effectively full-width with safe-area insets; on iPad keep the centered column. Root background is near-black **slate-950**; default text white.
- **Bottom nav**: fixed, translucent **slate-900/95 with blur**, top hairline border slate-800, safe-area bottom padding. 5 equal tabs, icon (22pt) over a 10pt medium label. Active = sky-400, inactive = slate-500. Native: `TabView` with SF Symbols (`dumbbell`, `calendar`, `clock.arrow.circlepath`, `checklist`, `gearshape`).
- **Color roles** (semantic → Tailwind source):
  - Surfaces: page `slate-950`; cards `slate-900` / `slate-900/60` / `slate-800/60`; hairlines `slate-800` / `slate-700`.
  - Text: primary `white`/`slate-100`, secondary `slate-400`, tertiary/muted `slate-500`/`slate-600`.
  - **Accent (primary CTA / active)** = **sky-500/400**. Success/complete = **emerald-500/400**. Caution/day-off = **amber-400/500**. Destructive = **red/rose-400/500**.
  - **Per-workout-type identity** (`WORKOUT_META`, used for badges, icons, calendar dots): weights = **orange-500** (`dumbbell`), run = **emerald-500** (`figure.run`/footprints), swim = **sky-500** (`waves`/`figure.pool.swim`), yoga = **purple-500** (`figure.yoga`/flower), other = **slate-500** (`circle`). Each type has bg/border/text/ring variants.
  - **Difficulty badges** (`DIFFICULTY_META`): easy = emerald, moderate = yellow, hard = red — all rendered as translucent pill (`/15` bg, `/30` border, 400 text).
  - **Mobility categories** (`CATEGORY_COLORS`): scapula-shoulder = violet, ankle-achilles = amber, foot-arch = teal, posture = rose, general = sky — translucent pills.
  - **Run/cardio segment types** (`SEGMENT_CONFIG`): warmup = amber, easy = green, tempo = orange, interval = red, race_pace = purple, cooldown = sky, drills = cyan, rest = slate.
- **Shape & elevation**: cards use **rounded-xl/2xl** (12–16pt radius), 1pt translucent borders instead of shadows. Chips/badges are **rounded-full** or small rounded rects with tiny (10–12pt) uppercase-ish labels. Buttons are rounded-lg/xl, solid-accent for primary, bordered-slate for secondary, translucent-tinted for tertiary.
- **Typography scale** (map to Dynamic Type ramps): page title ~20pt bold (`text-xl font-bold`); section headers ~14–16pt medium; body 14pt; secondary 12–13pt; micro labels 10–11pt (often uppercase with wide tracking for eyebrow/section tags). **Timers and numeric metrics use a monospaced, tabular-nums face** (large session clocks up to ~48pt). Use `.monospacedDigit()` everywhere a counter or clock updates.
- **Iconography**: web uses `lucide-react`. Map to SF Symbols by meaning (documented inline per screen below). Keep icons small (13–22pt) and paired with text.
- **Motion & feedback**: pulsing dot on minimized session docks (`animate-pulse`); progress bars animate width over ~1s; `active:scale-95` press feedback on some buttons. Native: subtle scale on press, `withAnimation` on state transitions, and **haptics** for success/caution/destructive (a native upgrade over the web).
- **Empty states**: centered icon + title + description + optional CTA (web `EmptyState`). E.g. no active plan → "no plan" message + button to Plans.
- **Modals**: web `Modal` = **bottom sheet on mobile**, centered card on desktop, backdrop + escape to close, safe-area aware, optional footer. Native = detented sheets. Destructive/dirty closes show an inline confirm.
- **Accessibility target (native, exceeds web)**: Dynamic Type, VoiceOver labels, Reduce Motion, and **color-independent** status encoding (icons/shapes, not color alone) in calendar/history — the web already leans on icons (coffee cup for day-off, type glyphs on calendar cells), so preserve and extend that.

## Data Models

Model these as Swift `Codable` value types in `Domain` (and `@Model` SwiftData classes in `Persistence` if SwiftData is chosen — keep the two layers mapped, don't leak SwiftData into Domain).

- **Core entities**: `Plan`, `PlanDay`, `WorkoutSlot`, `PlanDuration` (`enum DurationType { rotations, weeks }` + value), `PlanStatus` (`active/inactive/archived`).
  - `WorkoutType` enum with the canonical cases `weights/run/swim/yoga/other` plus the legacy cases `weightlifting/long_run/recovery_run/rest` decoded for import compatibility and **normalized on load** (replicate `migrateSlot`).
  - `WorkoutSlot` retains the full optional surface (simple targets, metadata, `runConfig`, and the program/DSL fields `warmup`/`exercises`/`segments`/`slotProgress`).
- **Logging entities**: `HistoryEntry` (one per plan+date), `ExtraWorkoutEntry` (with `source: ExtraSource? { history, doubleDay }`), `OverrideEntry` (`advance/goBack/jump/swapSlot`).
- **Outcome entities**: `WorkoutOutcome` (completionState, completedAt, durationActualMin, perceivedEffort 1–5, notes, `runActual`/`weightsActual`/`swimActual`, `progressionRecommendation`), `RunProgressionState`, `ProgramVariables` (`[planId: [varName: Double]]`).
- **Derived**: `ExerciseSessionRecord` (per-exercise PR/volume index with `planName`/`workoutName` snapshots), `ResolvedDay` (computed, never persisted).
- **Mobility** (`store/mobilityStore.ts`, `lib/mobilityLibrary.ts`):
  - `MobilityExercise` (`id`, `name`, `durationSec`) — the user's editable routine (ordered).
  - `MobilityCompletion` (keyed by `date`: `completedAt`, `durationMin`, `completedExerciseIds[]`) — one per day; **counts toward the Today streak**.
  - `MobilitySessionCheckpoint` (crash-safe resume: `date`, `exerciseIds[]` snapshot, `currentIdx`, `completedIds[]`, `totalElapsedSec`, `exElapsedSec`) — persisted continuously; only valid if `date == today` and the routine order is unchanged.
  - Bundled **`MobilityLibraryExercise`** (`id`, `name`, `categories[]`, `durationSec`, `description`, `note?` injury caution, `bilateral?` — cues a "switch sides" alert at the halfway mark) and **`MobilityPreset`** (`id`, `name`, `description`, `categories[]`, `durationMin`, `exercises[{exerciseId,durationSec}]`). Ship the library (grouped by `MobilityCategory`) and the 6 presets (`preset-quick-5`, `preset-shoulder-scapula`, `preset-ankle-foot`, `preset-posture`, `preset-full-20`, `preset-full-12`) as bundled resources.
  - A **default routine** (7 exercises: Hip 90/90, World's Greatest Stretch, Cat-Cow, Thread the Needle, Pigeon Pose, Shoulder CARs, Ankle Circles) seeds a fresh install.
- **Settings** (`store/settingsStore.ts`): `startDelaySeconds` (set-timer countdown: 0/5/10/15/30) **and `autoAdvanceSegments` (Bool, default true)** — auto-advance for cardio segments. Mobility sound-on is a separate flag on the mobility store (`soundEnabled`, default true).
- **Account / sync** (`store/authStore.ts`, `lib/storeSync.ts`): a `User`/`Session` (id, email, display name) from the auth provider, and a per-store cloud row `{ user_id, store_name, data, updated_at }`. See Persistence → Cloud Sync.
- **Program/DSL**: `ExerciseSpec`, `SetSpec` (reps may be `Int` or `String` for "5+"/ranges — model as an enum `RepTarget { count(Int), expression(String) }`), `RunSegment`, `DrillSpec`, `ProgressionRule` (`if?`/`then`/`else?`), `ProgressionType`.
- **Enumerations** (port the exact case sets from `WEB_APP_INVENTORY.md` → "Controlled vocabularies / enums" — these are not optional; Plan Builder pickers, badges, recommendation logic, and CSV round-trips all depend on them):
  - `WorkoutType` (canonical `weights/run/swim/yoga/other`) + a separate decode-only `LegacyWorkoutType` (`weightlifting/long_run/recovery_run/rest`) normalized into the canonical enum + a subtype on load (replicate `migrateSlot`). Do **not** surface legacy cases in new UI.
  - `WorkoutDifficulty`, `WorkoutTag` (18 cases), `WorkoutLocation`, `WeightsFocusArea`, `WeightsTrainingIntent`, `RunWorkoutSubtype` (+ legacy aliases), `SwimWorkoutSubtype`, `YogaWorkoutSubtype`, `OtherWorkoutSubtype`.
  - `RunSegmentType` (`warmup`/`easy`/`tempo`/`interval`/`race_pace`/`cooldown`/`drills`/`rest`) — drives the Cardio session tracker's per-segment display + color.
  - `MobilityCategory` (`scapula-shoulder`/`ankle-achilles`/`foot-arch`/`posture`/`general`) — drives Mobility Library filter chips + category pills.
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
  - `PlanRepository`, `HistoryRepository` (entries + overrides + extras), `OutcomeRepository` (outcomes + progression states), `ProgramVarsRepository`, `ExerciseHistoryRepository`, `MobilityRepository` (routine + completions + active checkpoint), `SettingsRepository`, `ImportExportRepository`.
- **Mapping from web persistence**: the **seven** Zustand stores map to repositories above:
  - `wpt_plans` (persist v2), `wpt_history` (persist v1), `wpt_outcomes`, `wpt_program_vars`, `wpt_exercise_history`, **`wpt_mobility` (persist v2 — adds `activeSession`)**, `wpt_settings`.
  - The per-plan **dismissal flags** map to lightweight key-value storage (`UserDefaults`): expiry banner `wpt_expiry_dismissed_v1_*`, **stall nudge `wpt_stall_nudge_dismissed_v1_*`, streak milestone `wpt_streak_ms_v1_{planId}_{milestone}`** (per plan **and** per milestone — a 7-day dismissal must not suppress the later 14-day banner).
  - The **active-workout draft** (`wpt_active_draft_*`) and the **mobility checkpoint** (inside `wpt_mobility.activeSession`) are crash-safe session drafts (`DraftStore`).
- **Migration requirements**
  - Legacy slot-type normalization parity (`weightlifting`→`weights`, `long_run`/`recovery_run`→`run`+subtype, `rest`→`other`+subtype, tag-derived `location`/`focus`). Run this on import and as a one-time data migration.
  - Schema version table + migration tests; mirror the web `version: 2` plan migration as the starting baseline.
- **Atomicity requirements**: all multi-entity updates run in a single transaction; imports are staged/validated then committed atomically with rollback on failure.
- **Cloud Sync + Auth (shipped in web — reproduce, don't defer)**:
  - The web app gates the whole UI behind **Google OAuth** (Supabase Auth) and syncs each store to a Supabase table `user_store_data` keyed by `(user_id, store_name)`, storing the serialized store `data` blob + `updated_at`.
  - **Login sync policy** (`syncOnLogin`): on sign-in, fetch all cloud rows for the user. If **none exist**, push local state up as the initial backup. If they exist, **cloud wins** — hydrate every store from cloud, applying each store's schema migration *before* writing (because direct state-set bypasses the persist-middleware migrate step). Reproduce this "cloud-wins, migrate-on-hydrate" rule exactly.
  - **Live replication** (`subscribeStores`): subscribe to every store and **debounce-push** changes (~1.5s) to the cloud; **flush pending writes on app backgrounding/termination** (web uses `beforeunload`) so a change made moments before quit is not lost. Native: flush on `scenePhase` → `.background`.
  - The seven synced stores are exactly the seven local stores above (plans, history, outcomes, program-vars, exercise-history, mobility, settings). Dismissal flags and drafts are **local-only** (not synced).
  - **iOS auth choice**: keep Supabase (its Swift SDK supports OAuth + `ASWebAuthenticationSession`), **or** substitute Sign in with Apple / iCloud as the identity + CloudKit as the backing store. Either way, preserve the *product contract*: one account, cross-device sync, cloud-wins-on-login, migrate-on-hydrate, private-to-user. If keeping Supabase, the endpoint + publishable key currently live in `src/lib/supabase.ts` — move secrets to a build config, never hardcode in source under version control.
  - **Sign-out** clears the in-memory session and returns to the sign-in gate; local data remains for the next login (web `SettingsPage` exposes Sign out).
- **Cloud-ready record fields**: still include `updatedAt`, `deletedAt`/tombstone, `sourceDeviceId`, and a monotonic sync version on every record. The web sync is **whole-store-blob, last-write-wins** (coarse, can clobber concurrent edits from another device); a native rebuild should prefer **per-record** sync with tombstones + conflict resolution to fix that class of bug (see Known Bugs / Open Questions).
- **Settings store**: persist `startDelaySeconds` (set-timer countdown) — see Open Questions #10 for scope.
- **Bundled resources** (ship as app resources, not user data):
  - **Exercise library** (~336 entries from `src/lib/exerciseLibrary.ts`) — convert to a bundled JSON and load into an `ExerciseLibraryService` (case-insensitive lookup + autocomplete; keep `type`/`target`/`synergist` for classification). Versioned so it can be updated independently of user data.
  - **Program templates** (`src/programs/*.yaml`: `gzclp-5k.yaml`, `upper-lower-hybrid-12w.yaml`) — bundle the raw YAML as resources for the Program Import template picker, parsed through the same import service as user-pasted YAML.
  - **Mobility library + presets** (`src/lib/mobilityLibrary.ts`): the full mobility exercise library (grouped by `MobilityCategory`, each with description/note/bilateral flag) and the 6 built-in presets. Convert to bundled JSON loaded by a `MobilityLibraryService`. The seed default routine also lives here.
  - **Timer sounds** (`src/lib/timerSounds.ts`): the rest/segment chimes, "switch sides" cue, session-complete chord, and TTS `speak()` announcements used by the trackers. Native: reproduce with `AVAudioEngine`/`AVSpeechSynthesizer`; see Active-session adaptations.
- **CSV schema-version compatibility**: the import adapter must honor the web's additive-column cutovers (`entryKind` default `rotation`; missing `extraId` → fresh id, non-idempotent; missing `extraSource` → `undefined`). Decide the `undefined` `source` policy once (see Open Questions #14) and apply it consistently across import and Undo — the web currently disagrees with itself.

## Screen-by-Screen Mapping (web → iOS adaptation)

- **Today** (`TodayPage` → `TodayView`) — the busiest screen; a vertically scrolled card stack, top → bottom:
  - **Header**: today's date (derived from a `useToday()` string that resets at local midnight — don't cache `Date.now`), active plan name, and a progress line ("Day X of N in rotation", cycle progress, week progress, rotation-completion messages).
  - **Banners** (conditional, dismissible, stacked): **expiry banner** (plan past its duration, per-plan dismiss); **stalled-rotation nudge** (`showStallNudge` when there are past unlogged dates) with a batch **"Mark as Day Off"** action; **streak-milestone celebration** (amber card, e.g. "7-day streak!" with tiered copy at 30/90/365; per-plan-per-milestone dismiss; thresholds 7/14/21/30/60/90/180/365).
  - **Stats row + 7-day activity strip**: current streak / 7-day count / total; a dot row for the last 7 days showing complete/skip/day-off. **Mobility completions count toward the streak.**
  - **Today's workout card**: `WorkoutDayCard` + stacked `WorkoutSlotDetails` (type/difficulty badges, deload flag, progression-aware resolved targets with a `TrendingUp` marker when adapted, exercise prescription lines resolving load/reps expressions against program vars, notes). A **Share** action copies a formatted plain-text summary of the day to the clipboard (`formatWorkoutForClipboard`) — native: share sheet / `UIPasteboard`.
  - **Quick actions**: Complete (opens outcome sheet) / Skip / Day Off; **Start session** launches the appropriate live tracker (weights vs cardio, see below); a separate CTA for an **additional (ad-hoc) workout**; an **Override menu** (advance / go back / jump-to-day picker).
  - **Coach Insights**: run adaptation note (`generateRunAdaptationNote`), difficulty-spacing warning (back-to-back `hard`), cycle/week progress, and last-session summary (`buildLastSessionSummary` — most recent *complete* session for this plan-day, with derived pace + PB detection).
  - **Completed-today / double-day**: after logging, a completed section; the **double-day** bonus flow logs a primary planned entry **plus** a bonus extra (advancing the rotation) — native card for the bonus.
  - **Mobility card** (eyebrow "⚡ Mobility"): if mobility is already done today, a teal "Mobility done" state with an undo (removes the day's completion); otherwise a "Daily Mobility" card that **opens the Mobility session tracker in place**. A separate affordance pushes the Mobility **routine editor** (`/mobility`).
  - **Upcoming preview**: next-7-days cards, each tappable to log a future/other day. Logging "complete" on a future date is **redirected to today**; if today already has an entry it is logged as an **extra**.
  - **Cardio hand-off prompt**: when a weights session is running on a day that *also* has a run slot, on weights-complete the app can prompt "Start {run} now, or skip and log the lifts" — starting opens the Cardio tracker, skipping logs lifts only. Reproduce this two-tracker, one-day flow.
  - **Minimized session dock**: while any tracker is minimized, a fixed bottom bar shows a pulsing status dot + name + live timer; tap to re-expand. Consider a **Live Activity / Dynamic Island** here.
  - Treat plan as guidance: logging a non-planned workout defers the displaced planned workout to the next day by default (per product direction #2).
- **Calendar** (`CalendarPage` → `CalendarView`)
  - Pageable **6×7 month grid** (`buildMonthGrid`) with month nav + a "Today" button. Cells are colored by `DayStatus`; pre-start cells (before the plan's start date) render neutral.
  - **Cell markers** (color-independent): small **workout-type glyphs** per slot (using `WORKOUT_META[type].icon`, ~8pt — emerald tint for rotation slots, sky tint for extras), a **coffee cup** for day-off, and an **amber streak dot** on days that are part of the current streak. A legend explains day-off / streak / status.
  - Day-detail **detented sheet** with the 3-level structure (overview → rotation detail / extra detail): log actions, adjust the plan-day for retro entries (drives the noon jump-anchor override), manage extras, edit outcomes, clear day (removes entry + outcome + retro jump), resume a historical session.
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
- **Settings** (`SettingsPage` → `SettingsView`) — sectioned card list:
  - **Set-timer start delay**: segmented control Off / 5s / 10s / 15s / 30s (`startDelaySeconds`).
  - **Auto-advance run segments**: a toggle (`autoAdvanceSegments`, default on) — "when a timed segment ends, chime, announce the next segment's pace/duration, and move on."
  - **Account**: shows the signed-in email/name and a **Sign out** button.
  - **Version / build metadata**: a tappable version stamp opening a modal with the latest merge title (web injects `__LATEST_COMMIT_ISO_DATE__`/`__LATEST_COMMIT_TITLE__`, formatted to EST). Native: show app version/build.
  - **No web-style force-refresh control** in v1 (service-worker concern doesn't apply). Provide a separate, clearly-labeled "reset local data" only if desired (debug/destructive), distinct from the web's cache-refresh. (A mobility **sound toggle** also exists — it lives on the Mobility session tracker in the web app; a native build may surface it in Settings too.)
- **Mobility** (`MobilityPage` → `MobilityView`, pushed from Today; not a tab) — a header (back button + "Mobility Routine") over a **3-tab segmented control**:
  - **My Routine**: the ordered, editable list (drag-to-reorder, per-item duration, swipe/delete), a summary line ("N exercises · ~M min"), and an **add-custom-exercise** inline form (name + duration seconds). Empty state prompts to add from Library/Presets.
  - **Library**: category filter **chips** (All + the 5 `MobilityCategory` values), a list of library exercises each with duration, category pills, an **info/expand** disclosure (description + amber caution note), and an **add/remove-to-routine** toggle (in-routine rows tinted emerald with a check).
  - **Presets**: cards (name, description, category pills, duration, exercise count) each with a **Load Routine** action that expands to a **Replace vs Append vs Cancel** confirm.
  - The live **Mobility session tracker** launches from the Today mobility card (see Active Session surfaces).

## Native iOS UI/UX adaptations (not web parity)

- Prefer iOS idioms: swipe actions, context menus, segmented controls, `Menu`, and **detented sheets** instead of custom modals.
- Haptics for success / caution / destructive confirmations (`UINotificationFeedbackGenerator`).
- Accessibility-first: Dynamic Type, VoiceOver labels (rotor-friendly), Reduce Motion, and **color-independent** status indicators in calendar/history (icons/shapes, not color alone).
- Distinguish planned vs. extra workouts with native visual hierarchy (badges/section grouping), not string-key conventions.
- Non-blocking toasts/banners for secondary confirmations ("Outcome moved to Apr 10").
- **Live session surfaces** — there are **three** distinct full-screen trackers; each has a minimized dock, wall-clock-reconciled timers, and a crash-safe draft. Shared native concerns:
  - Replace web AudioContext pre-scheduling with **scheduled local notifications and/or `AVAudioEngine`** for the −15s warning, end-of-rest chord, segment/exercise-end chime, "switch sides" cue, and session-complete chord, so alerts fire when the app is backgrounded/locked. TTS announcements use `AVSpeechSynthesizer`.
  - Use `UIApplication.isIdleTimerDisabled` (or a wake assertion) during active timing instead of the Web Wake Lock API.
  - Consider a **Live Activity / Dynamic Island** for the running session + timer.
  - Timers must reconcile against wall-clock on `scenePhase`/visibility changes (replicate the web's reconciliation — the trackers derive elapsed from a stored `{elapsed, timestamp}` base rather than incrementing, so backgrounded ticks self-correct) so backgrounding never loses elapsed time.
  - Continuously persist the draft/checkpoint so an interrupted session resumes.

  1. **Weights session** (`ActiveWorkoutTracker`): per-set reps/load/done grid with warmup vs working-set numbering and previous-set baselines, **swipe-to-delete** sets, **add/replace exercise** (optionally saved back to the plan template), workout/rest/set timers, the `startDelaySeconds` countdown before the set timer, rest tones (−15s warning + end chord) + wake lock during rest, progression preview with a suppression toggle, and draft persistence keyed by `workoutInstanceId`. Emits `LoggedExerciseActual[]` + session meta (`startTime`/`endTime`/`pausePeriods`/`totalElapsedSeconds`), which **prefills the outcome sheet** on complete. Numeric entry uses native keyboards with `±` stepper accessories rather than the web's custom keypad.
  2. **Cardio session** (`CardioWorkoutTracker`): a **segment-based** runner. Header (minimize / title / **Auto** toggle / end-X); segment **progress pills**; a large monospace **total-time clock**; a current-segment card showing segment label+color, target distance or a **duration countdown with progress bar**, **pace → treadmill mph range** (parsed from named paces like `easy`/`tempo`/`5K` or `MM:SS/mi`), a **drills list** for drill segments, and notes; Prev / Pause-Resume / Next controls (Next becomes **Done** on the last segment) plus a **Finish early** button. **Auto-advance** (setting-gated): when a timed segment ends, chime + `speak()` the next segment's name/pace/duration, then advance after ~1.5s (never auto-finishes the last segment). If a slot has no `segments`, synthesize a single easy segment from its duration/distance. Emits a duration to the outcome sheet.
  3. **Mobility session** (`MobilityTracker`): steps through the routine one exercise at a time with a per-exercise countdown, a **total-time clock**, and a per-exercise **drag/scroll-to-adjust-duration** gesture. **Bilateral** library exercises fire a **"switch sides"** cue + overlay at the halfway mark. A **sound toggle** (persisted). Auto-advances on countdown-zero with a chime; jump menu to any exercise; **swipe** left/right to move between exercises. On finish, plays the session-complete chord and writes a `MobilityCompletion` for today (which feeds the streak). A **checkpoint** (`MobilitySessionCheckpoint`) is saved on unmount for same-day resume (invalidated if the routine order changed). Also locks background scroll while open.

## Build Phases / Implementation Plan

1. **Domain + Persistence foundation**: entities (incl. mobility + settings), all controlled-vocabulary enums (lenient Codable), `LocalDate`/`WorkoutInstanceKey`, the extra→slot bridge, repositories, schema + migrations (incl. legacy slot normalization + mobility v1→v2 `activeSession`), bundled-resource loaders (exercise library JSON, program templates, **mobility library + presets**), transaction coordinator, dependency container, clock/timezone providers.
2. **Core services (pure)**: rotation resolver, month projection, history stats (incl. mobility-aware streak), run-adaptation engine + selectors, recommendation builder, expression evaluator, YAML import, CSV import/export, share-text formatter. Port the web unit tests first (TDD parity).
3. **Plans feature**: list + sections, CRUD, activate/deactivate (with prior-active demotion), duplicate (deep clone), archive, delete (retention-aware), CSV import/export entry points.
4. **Today feature**: projection + insights, quick actions, outcome sheet, additional workouts/double-day, banners (expiry / stall nudge / streak milestone), mobility card, share, session dock/minimized affordances.
5. **Live session trackers**: (a) **Weights** — set/rest/workout timers, wall-clock reconciliation, notifications/audio, wake assertion, draft persistence, progression preview, add/replace exercise; (b) **Cardio** — segment runner, pace→mph, auto-advance + TTS; (c) **Mobility** — countdown stepper, bilateral cue, sound, checkpoint resume.
6. **Calendar feature**: month grid with type glyphs + streak dots, day-detail sheet, retro jump anchor, clear-day, planned/extra outcome edits, collision UX, historical resume.
7. **History feature**: timeline, filters, notes, stats, PRs, weekly breakdown, CSV import/export.
8. **Plan Builder + Program Import + Vars**: form builder, YAML round-trip, template loading, program-var init/update, validation UX, Format-reference help screen.
9. **Mobility feature**: routine editor (My Routine / Library / Presets), preset replace/append, completions.
10. **Account + Cloud Sync**: auth gate + sign-in, sign-out, login sync (cloud-wins + migrate-on-hydrate), debounced live replication with background flush. Decide Supabase vs Apple/CloudKit early (gate phase 1 schema on it).
11. **Settings + hardening**: set-timer delay, auto-advance + sound toggles, version/build screen, diagnostics, performance tuning (large history), accessibility + QA gates.

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
- **Repository integration tests**: transactional date moves, clear-day, plan delete/archive cascade per retention policy, legacy slot migration, mobility v1→v2 migration, exercise-history sync, import staging/rollback.
- **Cloud sync tests**: first-login upload path, cloud-wins hydration with migrate-on-hydrate, debounced push + background/termination flush, and multi-device conflict behavior (document the last-write-wins limitation or the per-record resolution if upgraded).
- **UI tests**: sign-in gate → tab shell; create plan → activate → log outcome → edit in calendar → verify in history; collision confirmation; additional-workout + historical resume; double-day; **mobility session** (start → bilateral switch cue → finish → completion feeds streak; checkpoint resume after interruption); **cardio session** (segment advance, auto-advance + TTS, pace→mph, finish-early); weights→cardio hand-off prompt.
- **Non-functional**: timezone/DST + travel simulations (`LocalDate` + jump anchor + midnight header reset), large-history scrolling, accessibility snapshots + VoiceOver navigation, and **session backgrounding** across all three trackers (timer reconciliation, notification/audio delivery, draft/checkpoint recovery after force-quit).

## Open Questions / Ambiguities

Product direction is resolved for several of these; remaining decisions are flagged. These mirror `WEB_APP_INVENTORY.md` → Open Questions. **Note:** the cloud-sync/auth items that earlier drafts listed as "future extension points" are **already shipped in the web app** — the open decisions there are now about *iOS identity provider and sync granularity*, not whether to sync.

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
15. **Bundled-resource update cadence** (open): how are the exercise library, **mobility library/presets**, and program templates updated after ship — app-update only, or remotely refreshable? Affects whether they live in the bundle vs. a downloadable pack.
16. **iOS identity provider** (open, decide before phase 1): keep **Supabase** (Google OAuth via `ASWebAuthenticationSession`, existing `user_store_data` schema, cross-platform parity with the web) **or** adopt **Sign in with Apple + CloudKit** (native, no third-party dependency, App Store-friendly). Preserve the contract either way: one private account, cloud-wins-on-login, migrate-on-hydrate.
17. **Sync granularity** (open, recommended upgrade): the web syncs **whole-store blobs, last-write-wins**, which can clobber concurrent edits from another device. Recommend moving to **per-record sync + tombstones + conflict resolution** natively. Requires the cloud-ready record fields (`updatedAt`/`deletedAt`/`sourceDeviceId`/sync version) from Persistence.
18. **Mobility scope** (open): should mobility completions become first-class calendar/history entries (they currently live in their own store and only feed the streak + Today card), and should the routine/library be user-extensible and synced (routine is synced today; the library is bundled)?
19. **Set-timer / auto-advance / sound settings placement** (open): the web keeps `startDelaySeconds` + `autoAdvanceSegments` in Settings but mobility `soundEnabled` on the tracker. Decide whether to unify these under Settings and whether any should be per-plan/per-workout (ties to #10).
