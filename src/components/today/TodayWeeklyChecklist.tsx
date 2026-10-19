import { CheckCircle2, Circle, MinusCircle } from 'lucide-react'
import type { ChecklistItem } from '../../engine/programWeeks'
import type { Weekday } from '../../types'

const DAY_LABEL: Record<Weekday, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

interface Props {
  items: ChecklistItem[]
  /** Session currently suggested for today (-1 when none). */
  todayIndex: number
  /** Today is already logged — picking another session isn't offered. */
  todayLogged: boolean
  onPick: (index: number) => void
}

/** This week's sessions: what's done, what's left, and "do this one today" (even off its usual days). */
export function TodayWeeklyChecklist({ items, todayIndex, todayLogged, onPick }: Props) {
  const required = items.filter(i => !i.day.optional)
  const doneCount = required.filter(i => i.status !== 'pending').length
  const optionalDone = items.filter(i => i.day.optional && i.status === 'done').length
  const optionalTotal = items.length - required.length

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">This week</h2>
        <span className="text-xs text-slate-500">
          {doneCount}/{required.length} done{optionalTotal > 0 ? ` · ${optionalDone}/${optionalTotal} optional` : ''}
        </span>
      </div>
      <ul className="space-y-1">
        {items.map(item => {
          const isToday = item.index === todayIndex && item.status === 'pending'
          const restricted = item.day.allowedDays?.length ? item.day.allowedDays.map(d => DAY_LABEL[d]).join('/') : null
          return (
            <li key={item.index} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isToday ? 'bg-sky-500/10 border border-sky-500/30' : ''}`}>
              {item.status === 'done'
                ? <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                : item.status === 'skipped'
                  ? <MinusCircle size={14} className="text-slate-500 flex-shrink-0" />
                  : <Circle size={14} className="text-slate-600 flex-shrink-0" />}
              <span className="flex-1 min-w-0">
                <span className={`block text-sm truncate ${item.status === 'pending' ? 'text-slate-200' : 'text-slate-500'}`}>
                  {item.day.slots.map(s => s.name).join(' + ') || item.day.label}
                </span>
                {(restricted || item.day.optional) && (
                  <span className="block text-[10px] text-slate-500">
                    {[restricted, item.day.optional ? 'optional' : null].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
              {isToday && <span className="text-[10px] text-sky-300 font-medium">Today</span>}
              {!isToday && item.status === 'pending' && !todayLogged && (
                <button
                  onClick={() => onPick(item.index)}
                  className="text-[11px] text-sky-400 hover:text-sky-300 font-medium whitespace-nowrap"
                >
                  {item.allowedToday ? 'Do today' : 'Do anyway'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
