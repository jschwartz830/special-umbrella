import { WORKOUT_META } from '../../lib/constants'
import type { WorkoutType } from '../../types'

interface Props {
  type: WorkoutType
  size?: 'sm' | 'md'
}

export function WorkoutBadge({ type, size = 'md' }: Props) {
  const meta = WORKOUT_META[type]
  const Icon = meta.icon

  if (size === 'sm') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${meta.bgColor}`}
      >
        <Icon size={10} />
        {meta.label}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white ${meta.bgColor}`}
    >
      <Icon size={14} />
      {meta.label}
    </span>
  )
}
