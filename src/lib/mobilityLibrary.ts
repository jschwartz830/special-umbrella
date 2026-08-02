export type MobilityCategory =
  | 'scapula-shoulder'
  | 'ankle-achilles'
  | 'foot-arch'
  | 'posture'
  | 'general'

export const CATEGORY_LABELS: Record<MobilityCategory, string> = {
  'scapula-shoulder': 'Scapula & Shoulder',
  'ankle-achilles': 'Ankle & Achilles',
  'foot-arch': 'Foot & Arch',
  'posture': 'Posture & Neck',
  'general': 'General Mobility',
}

export const CATEGORY_COLORS: Record<MobilityCategory, string> = {
  'scapula-shoulder': 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'ankle-achilles': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'foot-arch': 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  'posture': 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  'general': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
}

export interface MobilityLibraryExercise {
  id: string
  name: string
  categories: MobilityCategory[]
  durationSec: number
  description: string
  note?: string // injury/caution note
  bilateral?: boolean // performed one side at a time — cue a switch at the halfway mark
}

// ── Routine exercise (per-instance, editable dosing) ────────────────────────
// Used both by the standalone global routine (mobilityStore) and by a
// program day's `mobility` slot (WorkoutSlot.mobilityExercises). A set is
// either a timed hold (durationSec) or rep-based (reps) — never both.

export interface MobilitySet {
  durationSec?: number
  reps?: number
}

export interface MobilityRoutineExercise {
  id: string // MOBILITY_LIBRARY id, or generated for custom entries
  name: string
  sets: MobilitySet[] // always >=1; independently editable, not inherited from the library
  restSec?: number // optional rest between sets
  notes?: string
}

/** A single timed-hold set — the common case, and the shape used before sets existed. */
export function singleTimedSet(durationSec: number): MobilitySet[] {
  return [{ durationSec }]
}

/** Formats a duration in seconds as "45s" / "2m" / "2m 15s". */
export function formatMobilityDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const r = sec % 60
  if (m === 0) return `${r}s`
  if (r === 0) return `${m}m`
  return `${m}m ${r}s`
}

/**
 * Total duration of a routine exercise's timed sets, in seconds (rep-only sets contribute 0).
 * Tolerates missing/malformed `sets` (e.g. stale cached data from before the sets-based
 * routine model shipped) by treating it as empty rather than throwing.
 */
export function totalTimedSec(sets: MobilitySet[] | undefined | null): number {
  if (!Array.isArray(sets)) return 0
  return sets.reduce((sum, s) => sum + (s?.durationSec ?? 0), 0)
}

/**
 * Guarantees every exercise in a routine has a valid, non-empty `sets` array — defends
 * against stale/malformed data (e.g. localStorage written before the sets-based routine
 * model shipped, or a mid-deploy cache skew) reaching code that assumes the current shape.
 */
export function normalizeMobilityRoutine(
  routine: MobilityRoutineExercise[] | undefined | null,
): MobilityRoutineExercise[] {
  if (!Array.isArray(routine)) return []
  return routine.map(ex => {
    if (Array.isArray(ex.sets) && ex.sets.length > 0) return ex
    const legacyDurationSec = (ex as unknown as { durationSec?: number }).durationSec
    return { ...ex, sets: singleTimedSet(legacyDurationSec ?? 30) }
  })
}

/**
 * Short human summary of a routine exercise's dosing, e.g. "3 sets · 45s hold" or "2 sets × 10 reps".
 * Tolerates missing/malformed `sets` — see totalTimedSec.
 */
export function summarizeMobilitySets(sets: MobilitySet[] | undefined | null): string {
  if (!Array.isArray(sets) || sets.length === 0) return ''
  const allTimed = sets.every(s => s.durationSec != null)
  const allReps = sets.every(s => s.reps != null)
  const setLabel = `${sets.length} set${sets.length === 1 ? '' : 's'}`
  if (sets.length === 1) {
    const s = sets[0]
    if (s.durationSec != null) return formatMobilityDuration(s.durationSec)
    if (s.reps != null) return `${s.reps} reps`
    return setLabel
  }
  if (allTimed) {
    const same = sets.every(s => s.durationSec === sets[0].durationSec)
    return same ? `${setLabel} · ${formatMobilityDuration(sets[0].durationSec!)} hold` : setLabel
  }
  if (allReps) {
    const same = sets.every(s => s.reps === sets[0].reps)
    return same ? `${setLabel} × ${sets[0].reps} reps` : setLabel
  }
  return setLabel
}

export const MOBILITY_LIBRARY: MobilityLibraryExercise[] = [
  // ── Scapula & Shoulder ──────────────────────────────────────────────────
  {
    id: 'lib-wall-slides',
    name: 'Wall Slides',
    categories: ['scapula-shoulder', 'posture'],
    durationSec: 45,
    description: 'Stand with back flat against wall. Arms bent 90°, slide up overhead keeping contact. Trains upward rotation & serratus.',
  },
  {
    id: 'lib-prone-ytw',
    name: 'Prone Y-T-W',
    categories: ['scapula-shoulder'],
    durationSec: 60,
    description: 'Lie face down, arms extended. Lift into Y, T, then W shapes. Targets mid/lower trap and rotator cuff.',
    note: 'Keep movement pain-free — avoid if AC joint is flared.',
  },
  {
    id: 'lib-scapular-pushup',
    name: 'Scapular Push-Ups',
    categories: ['scapula-shoulder'],
    durationSec: 30,
    description: 'Plank position, arms locked. Protract then retract shoulder blades without bending elbows. Isolates serratus anterior.',
  },
  {
    id: 'lib-band-pull-apart',
    name: 'Band Pull-Aparts',
    categories: ['scapula-shoulder', 'posture'],
    durationSec: 45,
    description: 'Hold band at shoulder height. Pull apart horizontally, squeezing shoulder blades together. Strengthens rhomboids and rear delts.',
  },
  {
    id: 'lib-shoulder-cars',
    name: 'Shoulder CARs',
    categories: ['scapula-shoulder'],
    durationSec: 60,
    description: 'Slow, full-range circular rotation of the shoulder. Keep core braced, limit thoracic compensation. Both directions, both sides.',
    note: 'Perform at pain-free range; never push into AC joint discomfort.',
    bilateral: true,
  },
  {
    id: 'lib-sleeper-stretch',
    name: 'Sleeper Stretch',
    categories: ['scapula-shoulder'],
    durationSec: 60,
    description: 'Lie on affected side, elbow at 90°. Use opposite hand to gently rotate arm toward floor. Stretches posterior capsule.',
    note: 'Light pressure only — important for AC joint patients. Stop if sharp pain.',
  },
  {
    id: 'lib-doorway-pec',
    name: 'Doorway Pec Stretch',
    categories: ['scapula-shoulder', 'posture'],
    durationSec: 45,
    description: 'Arm on doorframe at 90°. Gently rotate body away. Reduces anterior shoulder tension that stresses AC joint.',
    bilateral: true,
  },
  {
    id: 'lib-cross-body-stretch',
    name: 'Cross-Body Shoulder Stretch',
    categories: ['scapula-shoulder'],
    durationSec: 45,
    description: 'Pull arm across chest at shoulder height. Gentle posterior shoulder stretch. Keep shoulder down, not shrugged.',
    note: 'Avoid overpressure on the AC joint side.',
    bilateral: true,
  },
  {
    id: 'lib-thoracic-rotation',
    name: 'Thoracic Rotation (Side-Lying)',
    categories: ['scapula-shoulder', 'general', 'posture'],
    durationSec: 60,
    description: 'Lie on side, knees stacked. Rotate top arm open toward ceiling, following with eyes. Opens thoracic spine for shoulder health.',
    bilateral: true,
  },
  {
    id: 'lib-shoulder-iso-er',
    name: 'Shoulder Isometric External Rotation',
    categories: ['scapula-shoulder'],
    durationSec: 100,
    description: 'Elbow tucked at side, bent 90°. Press forearm outward into a wall or immovable hand resistance without moving the arm. Hold 5 sec, 10 reps, 2 sets. Builds rotator cuff (infraspinatus/teres minor) strength pain-free.',
  },
  {
    id: 'lib-shoulder-iso-ir',
    name: 'Shoulder Isometric Internal Rotation',
    categories: ['scapula-shoulder'],
    durationSec: 100,
    description: 'Elbow tucked at side, bent 90°. Press forearm inward into a wall or immovable hand resistance without moving the arm. Hold 5 sec, 10 reps, 2 sets. Builds rotator cuff (subscapularis) strength pain-free.',
  },
  {
    id: 'lib-shoulder-iso-er-elevated',
    name: 'Shoulder Isometric External Rotation — Elevated',
    categories: ['scapula-shoulder'],
    durationSec: 100,
    description: 'Arm elevated to about 90° (shoulder height), elbow bent 90°. Press forearm outward into resistance without moving the arm. Hold 5 sec, 10 reps, 2 sets. Same cuff activation as the standard version, trained at a more functional overhead angle.',
    note: 'Only progress to the elevated angle once the standard version is pain-free.',
  },
  {
    id: 'lib-wall-slides-serratus',
    name: 'Side Wall Slides (Serratus)',
    categories: ['scapula-shoulder'],
    durationSec: 60,
    description: 'Stand sideways to a wall, arm against it at shoulder height. Slide the arm up and down the wall, driving the shoulder blade around the rib cage. 10 reps, 2 sets. Isolates serratus anterior for scapular control.',
    bilateral: true,
  },
  {
    id: 'lib-lacrosse-ball-rotator-cuff',
    name: 'Lacrosse Ball to Rotator Cuff',
    categories: ['scapula-shoulder'],
    durationSec: 600,
    description: 'Pin a lacrosse ball between the back of the shoulder (rotator cuff/posterior capsule) and a wall or the floor. Apply sustained pressure and roll slowly to release tension. 5 minutes per side.',
    bilateral: true,
  },
  {
    id: 'lib-banded-wall-slide-w-to-y',
    name: 'Banded Wall Slide (W to Y)',
    categories: ['scapula-shoulder', 'posture'],
    durationSec: 45,
    description: 'Loop a flat band around both wrists, palms facing each other, elbows bent 90° in a "W." Slide hands up the wall against band resistance, opening arms into a V and finishing overhead in a Y. Builds lower trap/serratus strength with external-rotation resistance.',
  },
  {
    id: 'lib-overhead-kb-carry',
    name: 'Single-Arm Overhead Kettlebell Carry',
    categories: ['scapula-shoulder'],
    durationSec: 60,
    description: 'Press a kettlebell overhead with arm locked straight and shoulder actively retracted/depressed. Walk while keeping the bell stacked over the shoulder without shrugging. Builds overhead shoulder stability and scapular control under load.',
    bilateral: true,
  },
  {
    id: 'lib-kb-arm-bar',
    name: 'Bottoms-Up Kettlebell Arm Bar Roll',
    categories: ['scapula-shoulder'],
    durationSec: 60,
    description: 'Lie on back, knees bent, holding a kettlebell bottoms-up directly over the shoulder with arm straight and shoulder retracted. Roll toward the opposite side, keeping the arm vertical by actively repacking/retracting the shoulder blade as you move. Trains shoulder stability and control through rotation.',
    note: 'Move slowly and only as far as the shoulder stays pain-free and the arm stays vertical.',
    bilateral: true,
  },

  // ── Ankle & Achilles ──────────────────────────────────────────────────
  {
    id: 'lib-ankle-cars',
    name: 'Ankle CARs',
    categories: ['ankle-achilles'],
    durationSec: 60,
    description: 'Seated or standing. Slow, full-range ankle circles in both directions. Builds tendon tolerance and synovial fluid flow.',
    note: 'Right side focus post-Achilles — respect current ROM limits, no forced end-range.',
  },
  {
    id: 'lib-ankle-dorsiflexion-wall',
    name: 'Ankle Dorsiflexion Wall Stretch',
    categories: ['ankle-achilles'],
    durationSec: 60,
    description: 'Stand facing wall. Drive front knee toward wall while keeping heel flat. Most functional dorsiflexion drill.',
    note: 'Right ankle — start with foot close to wall and gradually work further. Never force.',
  },
  {
    id: 'lib-eccentric-heel-drop',
    name: 'Eccentric Heel Drops',
    categories: ['ankle-achilles'],
    durationSec: 60,
    description: 'Rise on both feet, lower slowly on affected foot. Gold standard for Achilles tendon remodeling. 3 sets of 15 reps.',
    note: 'Right side only for the eccentric phase. Progress load/range over time. Pain level 3–4/10 OK during rehab.',
  },
  {
    id: 'lib-soleus-stretch',
    name: 'Seated Soleus Stretch',
    categories: ['ankle-achilles'],
    durationSec: 45,
    description: 'Sitting, knee bent over ankle. Pull toes back. Soleus is deeper calf, most relevant to Achilles tension.',
    note: 'Bent-knee position targets soleus specifically — more relevant than straight-leg for Achilles rehab.',
  },
  {
    id: 'lib-standing-calf-stretch',
    name: 'Standing Gastroc Stretch',
    categories: ['ankle-achilles'],
    durationSec: 45,
    description: 'Straight leg against wall or step. Full gastrocnemius length. Hold at comfortable tension, not aggressive pull.',
    note: 'Right side — lighter stretch than left. Avoid yanking on the tendon.',
  },
  {
    id: 'lib-single-leg-balance',
    name: 'Single-Leg Balance Hold',
    categories: ['ankle-achilles', 'foot-arch'],
    durationSec: 60,
    description: 'Balance on one foot, soft knee. Progress: eyes closed, uneven surface, slight knee bend. Rebuilds proprioception.',
    note: 'Right leg is the rehab leg. Start on flat surface with eyes open.',
  },
  {
    id: 'lib-banded-ankle-mob',
    name: 'Banded Ankle Mobilization',
    categories: ['ankle-achilles'],
    durationSec: 60,
    description: 'Band around lower leg above ankle joint. Drive knee forward while band distracts joint. Restores dorsiflexion ROM.',
    note: 'Right ankle priority. Band pulls posteriorly to gap the joint — very effective post-injury.',
  },
  {
    id: 'lib-tib-anterior',
    name: 'Tibialis Anterior Raises',
    categories: ['ankle-achilles', 'foot-arch'],
    durationSec: 30,
    description: 'Back against wall, heels 12" from wall. Raise toes and front of foot repeatedly. Balances the calf-dominant lower leg.',
  },

  // ── Foot & Arch ──────────────────────────────────────────────────────
  {
    id: 'lib-short-foot',
    name: 'Short Foot (Arch Doming)',
    categories: ['foot-arch'],
    durationSec: 45,
    description: 'Seated or standing. Without curling toes, draw the ball of the foot toward the heel to dome the arch. Core exercise for flat feet.',
    note: 'Start seated, progress to standing, then single-leg. This is the #1 intrinsic foot drill.',
  },
  {
    id: 'lib-toe-splay',
    name: 'Toe Splay',
    categories: ['foot-arch'],
    durationSec: 30,
    description: 'Spread all toes apart as wide as possible, hold 5 sec. Activates intrinsic muscles and restores toe independence.',
  },
  {
    id: 'lib-big-toe-extension',
    name: 'Big Toe Extension & Flexion',
    categories: ['foot-arch'],
    durationSec: 30,
    description: 'Alternate lifting big toe while other toes stay down, then press big toe down while lifting other toes. Builds hallux control.',
  },
  {
    id: 'lib-calf-raise-arch',
    name: 'Calf Raises with Arch Awareness',
    categories: ['foot-arch', 'ankle-achilles'],
    durationSec: 45,
    description: 'Rise onto ball of foot while maintaining arch dome (short foot). Integrates intrinsic strength with calf function.',
    note: 'Right side — use both feet initially. Focus on arch engagement, not just height.',
  },
  {
    id: 'lib-towel-scrunch',
    name: 'Towel Scrunches',
    categories: ['foot-arch'],
    durationSec: 30,
    description: 'Towel on the floor, scrunch toward you using toes only. Fatigues the intrinsic foot muscles quickly — keep sets short.',
  },
  {
    id: 'lib-foot-rolling',
    name: 'Foot Rolling (Ball/Bottle)',
    categories: ['foot-arch'],
    durationSec: 60,
    description: 'Roll a lacrosse ball or frozen water bottle under the arch. Releases plantar fascia tension and improves tissue mobility.',
  },

  // ── Posture & Neck ──────────────────────────────────────────────────────
  {
    id: 'lib-chin-tuck',
    name: 'Chin Tucks',
    categories: ['posture'],
    durationSec: 30,
    description: 'Sitting or standing. Draw chin straight back (not down) to create a "double chin." Retrains deep cervical flexors lost to forward head.',
    note: 'This is the single most effective exercise for forward head posture — do it throughout the day.',
  },
  {
    id: 'lib-deep-neck-flexor',
    name: 'Deep Neck Flexor Strengthening',
    categories: ['posture'],
    durationSec: 45,
    description: 'Lie on back, chin tuck, lift head 1" off floor. Hold 10 sec, repeat. Strengthens longus colli — the deep cervical stabilizer.',
  },
  {
    id: 'lib-wall-angel',
    name: 'Wall Angels',
    categories: ['posture', 'scapula-shoulder'],
    durationSec: 45,
    description: 'Stand with back to wall, arms at 90°. Slide arms up and down keeping back, head, and arms all in contact. Combines scapular + cervical correction.',
  },
  {
    id: 'lib-upper-trap-stretch',
    name: 'Upper Trap Stretch',
    categories: ['posture'],
    durationSec: 45,
    description: 'Tilt ear to shoulder, apply gentle hand pressure. Hold 30 sec per side. Releases chronically tight upper trap from forward head.',
    bilateral: true,
  },
  {
    id: 'lib-upper-trap-stretch-seated',
    name: 'Upper Trap Stretch — Seated',
    categories: ['posture', 'scapula-shoulder'],
    durationSec: 180,
    description: 'Seated, hold the seat with one hand for stability. With the other hand, gently bend the head toward the opposite direction until a stretch is felt along the top of the shoulder. Hold 30 sec, 3 sets per side.',
    bilateral: true,
  },
  {
    id: 'lib-levator-stretch',
    name: 'Levator Scapulae Stretch',
    categories: ['posture', 'scapula-shoulder'],
    durationSec: 45,
    description: 'Turn head 45° to side, chin toward armpit, apply gentle pressure. Targets levator scapulae — key neck-shoulder tension link.',
    bilateral: true,
  },
  {
    id: 'lib-thoracic-extension',
    name: 'Thoracic Extension (Chair or Roller)',
    categories: ['posture', 'general'],
    durationSec: 60,
    description: 'Place foam roller or chair back across mid-upper back. Extend gently over it with hands behind head. Reverses flexion bias of forward head posture.',
  },
  {
    id: 'lib-neck-rotation',
    name: 'Neck Rotations (Slow)',
    categories: ['posture'],
    durationSec: 30,
    description: 'Slow, controlled rotation side to side. Maintain chin tuck throughout. Do not roll forward — keep in neutral plane.',
  },

  // ── General Mobility ──────────────────────────────────────────────────
  {
    id: 'lib-hip-9090',
    name: 'Hip 90/90',
    categories: ['general'],
    durationSec: 60,
    description: 'Sit with front and back leg at 90°. Tall spine, lean over front shin. Switch sides. Hip rotation and capsule mobility.',
    bilateral: true,
  },
  {
    id: 'lib-worlds-greatest',
    name: "World's Greatest Stretch",
    categories: ['general'],
    durationSec: 60,
    description: 'Lunge with same-side elbow to floor, rotate top arm to sky, extend to hamstring stretch. Full-body movement chain.',
    bilateral: true,
  },
  {
    id: 'lib-cat-cow',
    name: 'Cat-Cow',
    categories: ['general', 'posture'],
    durationSec: 60,
    description: 'On hands and knees. Alternate arching spine (cow) and rounding (cat) with breath. Warms the whole spinal column.',
  },
  {
    id: 'lib-thread-needle',
    name: 'Thread the Needle',
    categories: ['general', 'posture'],
    durationSec: 60,
    description: 'On all fours. Slide one arm under body to rotate thoracic spine. Great thoracic mobility and shoulder opener.',
    bilateral: true,
  },
  {
    id: 'lib-pigeon-pose',
    name: 'Pigeon Pose',
    categories: ['general'],
    durationSec: 60,
    description: 'Front leg bent at 90°, back leg extended. Deep hip external rotator and flexor stretch. Hold each side.',
    bilateral: true,
  },
  {
    id: 'lib-couch-stretch',
    name: 'Couch Stretch',
    categories: ['general'],
    durationSec: 60,
    description: 'Foot up on couch/wall behind, front knee on floor. Intense hip flexor and quad stretch. Counteracts sitting.',
    bilateral: true,
  },
  {
    id: 'lib-deep-squat',
    name: 'Deep Squat Hold',
    categories: ['general', 'ankle-achilles'],
    durationSec: 60,
    description: 'Full squat with heels down (or elevated). Hold with chest up. Combines hip, ankle, and thoracic mobility.',
    note: 'Right ankle may limit depth — elevate heels on plates or wedge as needed.',
  },
  {
    id: 'lib-hip-cars',
    name: 'Hip CARs',
    categories: ['general'],
    durationSec: 60,
    description: 'Standing on one leg. Slow, controlled full-range hip circles. Maintains hip joint health and ROM.',
    bilateral: true,
  },
]

export interface MobilityPreset {
  id: string
  name: string
  description: string
  durationMin: number
  categories: MobilityCategory[]
  exercises: Array<{ exerciseId: string; durationSec: number }>
}

/**
 * A user-saved routine template — full per-set dosing (reps, timed holds, rest),
 * unlike the fixed MOBILITY_PRESETS above which only carry a single durationSec
 * per exercise. Reusable across the standalone daily routine and a plan day's
 * mobility slot.
 */
export interface MobilityUserTemplate {
  id: string
  name: string
  exercises: MobilityRoutineExercise[]
  createdAt: string
}

export const MOBILITY_PRESETS: MobilityPreset[] = [
  {
    id: 'preset-quick-5',
    name: 'Quick 5-Min',
    description: 'Minimum effective dose — hits all your key areas fast.',
    durationMin: 5,
    categories: ['posture', 'scapula-shoulder', 'ankle-achilles', 'general'],
    exercises: [
      { exerciseId: 'lib-chin-tuck', durationSec: 30 },
      { exerciseId: 'lib-wall-slides', durationSec: 45 },
      { exerciseId: 'lib-ankle-cars', durationSec: 45 },
      { exerciseId: 'lib-short-foot', durationSec: 45 },
      { exerciseId: 'lib-cat-cow', durationSec: 60 },
      { exerciseId: 'lib-thoracic-extension', durationSec: 60 },
    ],
  },
  {
    id: 'preset-shoulder-scapula',
    name: 'Shoulder & Scapula',
    description: 'AC joint care + scapular stability work.',
    durationMin: 10,
    categories: ['scapula-shoulder'],
    exercises: [
      { exerciseId: 'lib-doorway-pec', durationSec: 45 },
      { exerciseId: 'lib-scapular-pushup', durationSec: 30 },
      { exerciseId: 'lib-wall-slides', durationSec: 45 },
      { exerciseId: 'lib-prone-ytw', durationSec: 60 },
      { exerciseId: 'lib-band-pull-apart', durationSec: 45 },
      { exerciseId: 'lib-sleeper-stretch', durationSec: 60 },
      { exerciseId: 'lib-shoulder-cars', durationSec: 60 },
      { exerciseId: 'lib-thoracic-rotation', durationSec: 60 },
    ],
  },
  {
    id: 'preset-ankle-foot',
    name: 'Ankle & Foot Rehab',
    description: 'Post-Achilles recovery + flat foot strengthening.',
    durationMin: 10,
    categories: ['ankle-achilles', 'foot-arch'],
    exercises: [
      { exerciseId: 'lib-ankle-cars', durationSec: 60 },
      { exerciseId: 'lib-ankle-dorsiflexion-wall', durationSec: 60 },
      { exerciseId: 'lib-banded-ankle-mob', durationSec: 60 },
      { exerciseId: 'lib-short-foot', durationSec: 45 },
      { exerciseId: 'lib-toe-splay', durationSec: 30 },
      { exerciseId: 'lib-tib-anterior', durationSec: 30 },
      { exerciseId: 'lib-eccentric-heel-drop', durationSec: 60 },
      { exerciseId: 'lib-single-leg-balance', durationSec: 60 },
      { exerciseId: 'lib-foot-rolling', durationSec: 60 },
    ],
  },
  {
    id: 'preset-posture',
    name: 'Posture Reset',
    description: 'Forward head posture correction — neck, upper back, chest.',
    durationMin: 8,
    categories: ['posture'],
    exercises: [
      { exerciseId: 'lib-chin-tuck', durationSec: 30 },
      { exerciseId: 'lib-deep-neck-flexor', durationSec: 45 },
      { exerciseId: 'lib-upper-trap-stretch', durationSec: 45 },
      { exerciseId: 'lib-levator-stretch', durationSec: 45 },
      { exerciseId: 'lib-wall-angel', durationSec: 45 },
      { exerciseId: 'lib-thoracic-extension', durationSec: 60 },
      { exerciseId: 'lib-doorway-pec', durationSec: 45 },
      { exerciseId: 'lib-neck-rotation', durationSec: 30 },
    ],
  },
  {
    id: 'preset-full-20',
    name: 'Full Session — 20 Min',
    description: 'Covers all your focus areas: shoulder, ankle, foot, posture, and general.',
    durationMin: 20,
    categories: ['posture', 'scapula-shoulder', 'ankle-achilles', 'foot-arch', 'general'],
    exercises: [
      // Posture & neck
      { exerciseId: 'lib-chin-tuck', durationSec: 30 },
      { exerciseId: 'lib-thoracic-extension', durationSec: 60 },
      // Shoulder & scapula
      { exerciseId: 'lib-doorway-pec', durationSec: 45 },
      { exerciseId: 'lib-wall-slides', durationSec: 45 },
      { exerciseId: 'lib-prone-ytw', durationSec: 60 },
      { exerciseId: 'lib-shoulder-cars', durationSec: 60 },
      // General spine & hips
      { exerciseId: 'lib-cat-cow', durationSec: 60 },
      { exerciseId: 'lib-thread-needle', durationSec: 60 },
      { exerciseId: 'lib-hip-9090', durationSec: 60 },
      { exerciseId: 'lib-worlds-greatest', durationSec: 60 },
      { exerciseId: 'lib-pigeon-pose', durationSec: 60 },
      // Ankle & Achilles
      { exerciseId: 'lib-ankle-cars', durationSec: 60 },
      { exerciseId: 'lib-ankle-dorsiflexion-wall', durationSec: 60 },
      { exerciseId: 'lib-eccentric-heel-drop', durationSec: 60 },
      { exerciseId: 'lib-soleus-stretch', durationSec: 45 },
      // Foot
      { exerciseId: 'lib-short-foot', durationSec: 45 },
      { exerciseId: 'lib-toe-splay', durationSec: 30 },
      { exerciseId: 'lib-single-leg-balance', durationSec: 60 },
    ],
  },
  {
    id: 'preset-pt-shoulder-rotator-cuff',
    name: 'PT: Shoulder & Rotator Cuff',
    description: 'Post-PT rotator cuff isometrics, serratus activation, upper trap release, and soft tissue work.',
    durationMin: 19,
    categories: ['scapula-shoulder', 'posture'],
    exercises: [
      { exerciseId: 'lib-shoulder-iso-er', durationSec: 100 },
      { exerciseId: 'lib-shoulder-iso-ir', durationSec: 100 },
      { exerciseId: 'lib-shoulder-iso-er-elevated', durationSec: 100 },
      { exerciseId: 'lib-upper-trap-stretch-seated', durationSec: 180 },
      { exerciseId: 'lib-wall-slides-serratus', durationSec: 60 },
      { exerciseId: 'lib-lacrosse-ball-rotator-cuff', durationSec: 600 },
    ],
  },
  {
    id: 'preset-full-12',
    name: 'Full Session — 12 Min',
    description: 'Balanced coverage when you have limited time.',
    durationMin: 12,
    categories: ['posture', 'scapula-shoulder', 'ankle-achilles', 'foot-arch', 'general'],
    exercises: [
      { exerciseId: 'lib-chin-tuck', durationSec: 30 },
      { exerciseId: 'lib-wall-angel', durationSec: 45 },
      { exerciseId: 'lib-thoracic-rotation', durationSec: 60 },
      { exerciseId: 'lib-scapular-pushup', durationSec: 30 },
      { exerciseId: 'lib-worlds-greatest', durationSec: 60 },
      { exerciseId: 'lib-hip-9090', durationSec: 60 },
      { exerciseId: 'lib-ankle-dorsiflexion-wall', durationSec: 60 },
      { exerciseId: 'lib-ankle-cars', durationSec: 60 },
      { exerciseId: 'lib-short-foot', durationSec: 45 },
      { exerciseId: 'lib-tib-anterior', durationSec: 30 },
      { exerciseId: 'lib-single-leg-balance', durationSec: 60 },
      { exerciseId: 'lib-couch-stretch', durationSec: 60 },
    ],
  },
]

export function getLibraryExerciseById(id: string): MobilityLibraryExercise | undefined {
  return MOBILITY_LIBRARY.find(e => e.id === id)
}

// Resolve a completed exercise id to a display name. Prefers the current routine
// (in case it was renamed or is a hand-added custom exercise) and falls back to
// the library, then the raw id if the exercise no longer exists anywhere.
export function mobilityExerciseName(id: string, routine: { id: string; name: string }[]): string {
  return routine.find(e => e.id === id)?.name
    ?? getLibraryExerciseById(id)?.name
    ?? id
}

// Whether a routine exercise is done one side at a time (so a "switch sides" cue
// makes sense at its halfway point). Library exercises carry an explicit flag;
// the built-in default routine and hand-added exercises use their own ids, so we
// fall back to matching the library by name.
export function isBilateralExercise(exercise: { id: string; name: string }): boolean {
  const byId = MOBILITY_LIBRARY.find(e => e.id === exercise.id)
  if (byId) return byId.bilateral === true
  const byName = MOBILITY_LIBRARY.find(
    e => e.name.toLowerCase() === exercise.name.trim().toLowerCase(),
  )
  return byName?.bilateral === true
}
