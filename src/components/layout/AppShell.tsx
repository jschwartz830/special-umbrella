import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <main className="flex-1 pb-20 overflow-y-auto">
        <div className="max-w-lg mx-auto">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
