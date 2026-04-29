export interface ExerciseLibraryItem {
  name: string
  type: string[]
  target: string[]
  synergist: string[]
}

export const EXERCISE_LIBRARY: ExerciseLibraryItem[] = [
  { name: 'Bench Press', type: ['upper', 'push'], target: ['chest'], synergist: ['shoulders', 'triceps'] },
  { name: 'Incline Bench Press, Dumbbell', type: ['upper', 'push'], target: ['chest'], synergist: ['shoulders', 'triceps'] },
  { name: 'Overhead Press', type: ['upper', 'push'], target: ['shoulders'], synergist: ['triceps', 'chest'] },
  { name: 'Lateral Raise', type: ['upper'], target: ['shoulders'], synergist: ['traps'] },
  { name: 'Triceps Pushdown', type: ['upper', 'push'], target: ['triceps'], synergist: ['shoulders'] },
  { name: 'Pull Up', type: ['upper', 'pull'], target: ['back'], synergist: ['biceps', 'forearms'] },
  { name: 'Lat Pulldown', type: ['upper', 'pull'], target: ['back'], synergist: ['biceps', 'forearms'] },
  { name: 'Seated Row', type: ['upper', 'pull'], target: ['back'], synergist: ['biceps', 'rear_delts'] },
  { name: 'Bent Over One Arm Row', type: ['upper', 'pull'], target: ['back'], synergist: ['biceps', 'forearms'] },
  { name: 'Inverted Row', type: ['upper', 'pull'], target: ['back'], synergist: ['biceps', 'rear_delts'] },
  { name: 'Bicep Curl', type: ['upper', 'pull'], target: ['biceps'], synergist: ['forearms'] },
  { name: 'Squat', type: ['lower', 'legs'], target: ['quadriceps', 'glutes'], synergist: ['hamstrings', 'core'] },
  { name: 'Barbell Squat', type: ['lower', 'legs'], target: ['quadriceps', 'glutes'], synergist: ['hamstrings', 'core'] },
  { name: 'Deadlift', type: ['lower', 'pull'], target: ['glutes', 'hamstrings', 'back'], synergist: ['quadriceps', 'forearms', 'core'] },
  { name: 'Barbell Deadlift', type: ['lower', 'pull'], target: ['glutes', 'hamstrings', 'back'], synergist: ['quadriceps', 'forearms', 'core'] },
  { name: 'Romanian Deadlift', type: ['lower', 'legs'], target: ['hamstrings', 'glutes'], synergist: ['back', 'core'] },
  { name: 'Romanian Deadlift, Barbell', type: ['lower', 'legs'], target: ['hamstrings', 'glutes'], synergist: ['back', 'core'] },
  { name: 'Hip Thrust', type: ['lower', 'legs'], target: ['glutes'], synergist: ['hamstrings', 'core'] },
  { name: 'Bulgarian Split Squat', type: ['lower', 'legs'], target: ['quadriceps', 'glutes'], synergist: ['hamstrings', 'core'] },
  { name: 'Nordic Curl', type: ['lower', 'legs'], target: ['hamstrings'], synergist: ['glutes', 'calves'] },
  { name: "Farmer's Walk", type: ['upper', 'lower'], target: ['forearms', 'traps'], synergist: ['core', 'legs'] },
  { name: 'Standing Calf Raise, Bodyweight', type: ['lower', 'legs'], target: ['calves'], synergist: ['hamstrings'] },
  { name: 'Ab Wheel', type: ['core'], target: ['abs'], synergist: ['shoulders', 'lats'] },
]

export function findExerciseByName(name: string): ExerciseLibraryItem | undefined {
  return EXERCISE_LIBRARY.find(ex => ex.name.toLowerCase() === name.trim().toLowerCase())
}
