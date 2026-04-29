# Workout YAML Schema (v1)

This project uses a standardized YAML schema for importable workout plans.

- **Schema file**: `src/programs/schema/workout-program.schema.json`
- **Current version**: `schemaVersion: 1`

## Goals

- Keep plans easy to read/edit by hand.
- Support all existing slot types and metadata currently used by the app.
- Keep progression, run segments, and detailed set-level prescriptions available.

## Required top-level fields

```yaml
schemaVersion: 1
name: "Program name"
duration:
  type: weeks # or rotations
  value: 12
days: []
```

Optional top-level fields:

- `description: string`
- `vars: { [name: string]: number }`

## Day/slot structure

Each day must include:

- `label: string`
- `slots: slot[]`

Each slot supports:

- `type`: `weights | run | swim | yoga | other` (+ legacy: `weightlifting | long_run | recovery_run | rest`)
- `name`, `subtype`, `location`, `notes`
- `durationMin`, `difficulty`, `focus`, `intent`
- `progress`
- Weights-specific: `warmup`, `exercises`
- Run-specific: `segments`

## Progressive overload rules

Anywhere `progress` exists (exercise or slot), it follows:

```yaml
progress:
  if: "all_reps"
  then: "bench += 2.5"
  else: "bench = round5(bench * 0.9)" # optional
```

## Authoring conventions for readability

- Prefer explicit strings with units for time/rest/distance, e.g. `"90s"`, `"5m"`, `"2.5 mi"`.
- Keep day labels short and descriptive (`"Upper A"`, `"Recovery"`).
- Use `vars` + expressions in `load`/`distance` for easy global edits.
- Use `sets: <number>` for simple prescriptions, and `sets: [ ... ]` only when set-by-set detail is needed.
