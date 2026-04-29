import { useState } from 'react'
import { RotateCcw } from 'lucide-react'

async function forceRefreshApp() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.update()))
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }

  if ('caches' in window) {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
  }

  const url = new URL(window.location.href)
  url.searchParams.set('refresh', Date.now().toString())
  window.location.replace(url.toString())
}

export function SettingsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefreshClick = async () => {
    setIsRefreshing(true)
    try {
      await forceRefreshApp()
    } catch (error) {
      console.error('Failed to force refresh app', error)
      window.location.reload()
    }
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Troubleshoot app updates and cache issues.</p>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h2 className="font-medium">App version refresh</h2>
        <p className="text-sm text-slate-400">
          If this device is stuck on an old version, tap below to clear saved web app files and reload.
        </p>
        <button
          type="button"
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw size={16} />
          {isRefreshing ? 'Refreshing…' : 'Force refresh app'}
        </button>
      </section>
    </div>
  )
}
