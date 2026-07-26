import { Info, PartyPopper, TrendingUp, X } from 'lucide-react'

export interface TodayBannersProps {
  // Expiry banner
  planExpired: boolean
  expiryBannerDismissed: boolean
  planDurationValue: number
  planDurationType: string
  onNavigateToPlans: () => void
  onDismissExpiry: () => void

  // Stall nudge
  showStallNudge: boolean
  unloggedCount: number
  hasUnloggedToday: boolean
  onOpenCatchup: () => void
  onNavigateToCalendar: () => void
  onDismissStall: () => void

  // Consecutive skips
  consecutiveSkips: number

  // Streak milestone
  streakMilestone: number | null
  streakMilestoneDismissed: boolean
  onDismissStreakMilestone: () => void

  // Adaptation + spacing
  todayAdaptationNote: string | null
  spacingWarning: string | null
}

export function TodayBanners({
  planExpired,
  expiryBannerDismissed,
  planDurationValue,
  planDurationType,
  onNavigateToPlans,
  onDismissExpiry,
  showStallNudge,
  unloggedCount,
  hasUnloggedToday,
  onOpenCatchup,
  onNavigateToCalendar,
  onDismissStall,
  consecutiveSkips,
  streakMilestone,
  streakMilestoneDismissed,
  onDismissStreakMilestone,
  todayAdaptationNote,
  spacingWarning,
}: TodayBannersProps) {
  return (
    <>
      {/* Plan completion / expiry banner */}
      {planExpired && !expiryBannerDismissed && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <PartyPopper size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-purple-300 font-medium">Plan complete!</p>
            <p className="text-xs text-purple-400/70 mt-0.5">
              You've finished all {planDurationValue} {planDurationType} of this plan.
              Consider activating a new plan or cycling this one.
            </p>
          </div>
          <button
            onClick={onNavigateToPlans}
            className="text-xs text-purple-400 hover:text-purple-200 font-medium flex-shrink-0 ml-1"
          >
            Plans →
          </button>
          <button
            onClick={onDismissExpiry}
            className="text-purple-400/60 hover:text-purple-200 flex-shrink-0 transition-colors"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Compact stalled-rotation nudge — dismissible */}
      {showStallNudge && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/50 border border-slate-600/50">
          <Info size={13} className="text-slate-400 flex-shrink-0" />
          <p className="flex-1 text-xs text-slate-400 min-w-0">
            Rotation may be stalled
            {unloggedCount > 0 && (
              <span className="text-slate-500">
                {' '}· {unloggedCount} unlogged day{unloggedCount === 1 ? '' : 's'}
              </span>
            )}
          </p>
          {hasUnloggedToday && (
            <button
              onClick={onOpenCatchup}
              className="text-xs text-amber-400 font-medium flex-shrink-0 hover:text-amber-300 transition-colors"
            >
              Fix
            </button>
          )}
          <button
            onClick={onNavigateToCalendar}
            className="text-xs text-sky-400 font-medium flex-shrink-0 hover:text-sky-300 transition-colors"
          >
            Review
          </button>
          <button
            onClick={onDismissStall}
            className="text-slate-500 hover:text-slate-300 flex-shrink-0 transition-colors"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Consecutive skips nudge */}
      {!planExpired && consecutiveSkips >= 3 && (
        <div className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Info size={13} className="text-amber-400 flex-shrink-0" />
          <p className="flex-1 text-xs text-amber-300">
            {consecutiveSkips} workout{consecutiveSkips === 1 ? '' : 's'} skipped in a row — you've got this!
          </p>
          <button
            onClick={onNavigateToCalendar}
            className="text-xs text-sky-400 font-medium flex-shrink-0 hover:text-sky-300 transition-colors"
          >
            Calendar →
          </button>
        </div>
      )}

      {/* Streak milestone celebration — shown once per milestone per plan */}
      {!planExpired && streakMilestone !== null && !streakMilestoneDismissed && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <span className="text-sm flex-shrink-0" role="img" aria-label="fire">🔥</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-300 font-medium">{streakMilestone}-day streak!</p>
            <p className="text-xs text-amber-400/70">
              {streakMilestone >= 365
                ? 'One full year of consistency — incredible.'
                : streakMilestone >= 90
                ? 'Three months strong. Keep it up!'
                : streakMilestone >= 30
                ? 'A full month of consistency!'
                : 'Keep the momentum going!'}
            </p>
          </div>
          <button
            onClick={onDismissStreakMilestone}
            className="text-amber-400/60 hover:text-amber-200 flex-shrink-0 transition-colors"
            aria-label="Dismiss streak milestone"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Adaptation note for today's run */}
      {todayAdaptationNote && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
          <TrendingUp size={14} className="text-sky-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-sky-300">{todayAdaptationNote}</p>
        </div>
      )}

      {/* Difficulty spacing warning */}
      {spacingWarning && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <Info size={14} className="text-orange-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-orange-300">{spacingWarning}</p>
        </div>
      )}
    </>
  )
}
