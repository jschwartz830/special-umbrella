import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Modal } from '../components/shared/Modal'

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
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false)

  const latestCommitDate =
    __LATEST_COMMIT_ISO_DATE__ !== 'unknown' ? new Date(__LATEST_COMMIT_ISO_DATE__) : null

  const versionStamp = latestCommitDate
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
        .formatToParts(latestCommitDate)
        .reduce<Record<string, string>>((acc, part) => {
          if (part.type !== 'literal') acc[part.type] = part.value
          return acc
        }, {})
    : null

  const versionLabel = versionStamp
    ? `Version ${versionStamp.year}.${versionStamp.month}.${versionStamp.day}.${versionStamp.hour}${versionStamp.minute}`
    : 'Version unavailable'

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
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-slate-400 mt-1">Troubleshoot app updates and cache issues.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsVersionModalOpen(true)}
          className="text-xs sm:text-sm text-sky-300 hover:text-sky-200 underline underline-offset-2 text-right"
        >
          {versionLabel}
        </button>
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

      {isVersionModalOpen && (
        <Modal title="Latest merged version" onClose={() => setIsVersionModalOpen(false)}>
          <div className="space-y-3 text-sm text-slate-200">
            <p>
              <span className="text-slate-400">Version stamp:</span>{' '}
              <span className="font-medium text-white">{versionLabel}</span>
            </p>
            <p>
              <span className="text-slate-400">Latest merge/change title:</span>{' '}
              <span className="font-medium text-white">{__LATEST_COMMIT_TITLE__}</span>
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
