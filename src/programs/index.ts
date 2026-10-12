// ── Program template library ─────────────────────────────────────────────────
// Ready-made YAML programs offered on the Import Program page. Lifting
// templates follow well-known programs (the kind Liftosaur hosts); running
// templates follow a Runna-style easy / quality / long structure with
// effort-gated progression.

import basicBeginner from './basic-beginner.yaml?raw'
import stronglifts from './stronglifts-5x5.yaml?raw'
import gzclp from './gzclp.yaml?raw'
import fiveThreeOneBeginners from './531-beginners.yaml?raw'
import fiveThreeOneBbb from './531-bbb.yaml?raw'
import redditPpl from './reddit-ppl.yaml?raw'
import phul from './phul.yaml?raw'
import dumbbellFullBody from './dumbbell-full-body.yaml?raw'
import bodyweightRr from './bodyweight-rr.yaml?raw'
import couchTo5k from './couch-to-5k.yaml?raw'
import tenKBuilder from './10k-builder.yaml?raw'
import halfMarathon from './half-marathon.yaml?raw'
import hybridStrengthRun from './gzclp-5k.yaml?raw'
import upperLowerHybrid from './upper-lower-hybrid-12w.yaml?raw'
import mobilityRecovery from './mobility-recovery.yaml?raw'
import shoulderPt from './shoulder-pt.yaml?raw'
import ptHomeProgram from './pt-home-program.yaml?raw'

export type ProgramCategory = 'Strength' | 'Hypertrophy' | 'Home & Bodyweight' | 'Running' | 'Hybrid' | 'Mobility & Rehab'

export const PROGRAM_CATEGORIES: ProgramCategory[] = [
  'Strength', 'Hypertrophy', 'Home & Bodyweight', 'Running', 'Hybrid', 'Mobility & Rehab',
]

export interface ProgramTemplate {
  id: string
  label: string
  category: ProgramCategory
  level: 'Beginner' | 'Intermediate' | 'All levels'
  daysPerWeek: string
  yaml: string
}

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  { id: 'basic-beginner', label: 'Basic Beginner Routine', category: 'Strength', level: 'Beginner', daysPerWeek: '3', yaml: basicBeginner },
  { id: 'stronglifts-5x5', label: 'StrongLifts 5x5', category: 'Strength', level: 'Beginner', daysPerWeek: '3', yaml: stronglifts },
  { id: 'gzclp', label: 'GZCLP', category: 'Strength', level: 'Beginner', daysPerWeek: '3-4', yaml: gzclp },
  { id: '531-beginners', label: '5/3/1 for Beginners', category: 'Strength', level: 'Beginner', daysPerWeek: '3', yaml: fiveThreeOneBeginners },
  { id: '531-bbb', label: '5/3/1 Boring But Big', category: 'Strength', level: 'Intermediate', daysPerWeek: '4', yaml: fiveThreeOneBbb },
  { id: 'reddit-ppl', label: 'Reddit PPL', category: 'Hypertrophy', level: 'Beginner', daysPerWeek: '6', yaml: redditPpl },
  { id: 'phul', label: 'PHUL Upper/Lower', category: 'Hypertrophy', level: 'Intermediate', daysPerWeek: '4', yaml: phul },
  { id: 'dumbbell-full-body', label: 'Dumbbell Full Body', category: 'Home & Bodyweight', level: 'All levels', daysPerWeek: '3', yaml: dumbbellFullBody },
  { id: 'bodyweight-rr', label: 'Bodyweight Recommended Routine', category: 'Home & Bodyweight', level: 'Beginner', daysPerWeek: '3', yaml: bodyweightRr },
  { id: 'couch-to-5k', label: 'Couch to 5K', category: 'Running', level: 'Beginner', daysPerWeek: '3', yaml: couchTo5k },
  { id: '10k-builder', label: '5K to 10K Builder', category: 'Running', level: 'Beginner', daysPerWeek: '3', yaml: tenKBuilder },
  { id: 'half-marathon', label: 'Half Marathon — 12 Weeks', category: 'Running', level: 'Intermediate', daysPerWeek: '4', yaml: halfMarathon },
  { id: 'gzclp-5k', label: 'Hybrid Strength + Run Base', category: 'Hybrid', level: 'Intermediate', daysPerWeek: '7', yaml: hybridStrengthRun },
  { id: 'upper-lower-12w', label: 'Upper/Lower Hybrid 12-Week', category: 'Hybrid', level: 'Intermediate', daysPerWeek: '7', yaml: upperLowerHybrid },
  { id: 'mobility-recovery', label: 'Mobility & Recovery Week', category: 'Mobility & Rehab', level: 'All levels', daysPerWeek: '2-4', yaml: mobilityRecovery },
  { id: 'pt-home-program', label: 'PT Home Exercise Program', category: 'Mobility & Rehab', level: 'All levels', daysPerWeek: '3', yaml: ptHomeProgram },
  { id: 'shoulder-pt', label: 'Shoulder PT', category: 'Mobility & Rehab', level: 'All levels', daysPerWeek: '3', yaml: shoulderPt },
]
