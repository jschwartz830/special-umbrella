import type { WorkoutDifficulty } from '../../modules/workout-metadata/types'
import { DIFFICULTY_META } from '../../lib/constants'

interface Props {
  difficulty: WorkoutDifficulty
  size?: 'xs' | 'sm'
}

export function DifficultyBadge({ difficulty, size = 'xs' }: Props) {
  const meta = DIFFICULTY_META[difficulty]
  const textSize = size === 'xs' ? 'text-[10px]' : 'text-xs'
  const px = size === 'xs' ? 'px-1.5 py-0.5' : 'px-2 py-0.5'

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-wide ${textSize} ${px} ${meta.bgColor} ${meta.textColor} ${meta.borderColor}`}
    >
      {meta.label}
    </span>
  )
}
