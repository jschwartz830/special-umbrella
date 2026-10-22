import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { DayOfWeekStat } from '../../lib/historyStats'

interface Props {
  days: DayOfWeekStat[]
  /** 0 = Sunday first, 1 = Monday first (Settings → Calendar week start). */
  weekStartsOn: 0 | 1
}

/** Order ISO-weekday stats (Mon…Sun) to match the user's week-start setting. */
export function orderDays(days: DayOfWeekStat[], weekStartsOn: 0 | 1): DayOfWeekStat[] {
  if (weekStartsOn === 1) return days
  const sunday = days.find(d => d.isoDay === 7)
  return sunday ? [sunday, ...days.filter(d => d.isoDay !== 7)] : days
}

/** Horizontal bar per weekday showing how many workouts landed on it. */
export function DayOfWeekSection({ days, weekStartsOn }: Props) {
  const [expanded, setExpanded] = useState(true)
  const ordered = orderDays(days, weekStartsOn)
  const max = Math.max(1, ...ordered.map(d => d.count))

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-1 py-1 text-left group"
        aria-expanded={expanded}
      >
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          By Day of Week
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
        ) : (
          <ChevronDown size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
        )}
      </button>

      {expanded && (
        <div className="mt-1 rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2 space-y-1.5">
          {ordered.map(d => (
            <div key={d.isoDay} className="grid grid-cols-[2.25rem_1fr_1.75rem] items-center gap-2">
              <span className="text-xs text-slate-400">{d.dayName}</span>
              <div className="h-2.5 rounded-full bg-slate-700/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500/80"
                  style={{ width: `${(d.count / max) * 100}%` }}
                />
              </div>
              <span className={`text-xs font-semibold text-right tabular-nums ${d.count === 0 ? 'text-slate-600' : 'text-emerald-400'}`}>
                {d.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
