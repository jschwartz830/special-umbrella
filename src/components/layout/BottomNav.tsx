import { NavLink } from 'react-router-dom'
import { Dumbbell, CalendarDays, History, ListChecks } from 'lucide-react'

const tabs = [
  { to: '/today', icon: Dumbbell, label: 'Today' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/plans', icon: ListChecks, label: 'Plans' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 pb-safe">
      <div className="flex max-w-lg mx-auto">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                isActive ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
