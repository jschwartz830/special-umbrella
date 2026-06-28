import { useState } from 'react'
import { RotateCcw, LogOut } from 'lucide-react'
import { Modal } from '../components/shared/Modal'
import { useSettingsStore } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'

const REFRESH_TIMEOUT_MS = 3000

function waitForServiceWorkerState(
  worker: ServiceWorker,
  targetState: ServiceWorkerState,
  timeoutMs = REFRESH_TIMEOUT_MS,
) {
  if (worker.state === targetState) return Promise.resolve()

  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(cleanup, timeoutMs)

    function cleanup() {
      window.clearTimeout(timeout)
      worker.removeEventListener('statechange', handleStateChange)
      resolve()
    }

    function handleStateChange() {
      if (worker.state === targetState) cleanup()
    }

    worker.addEventListener('statechange', handleStateChange)
  })
}

function waitForControllerChange(timeoutMs = REFRESH_TIMEOUT_MS) {
  if (!navigator.serviceWorker.controller) return Promise.resolve()

  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(cleanup, timeoutMs)

    function cleanup() {
      window.clearTimeout(timeout)
      navigator.serviceWorker.removeEventListener('controllerchange', cleanup)
      resolve()
    }

    navigator.serviceWorker.addEventListener('controllerchange', cleanup)
  })
}

async function activateUpdatedWorker(registration: ServiceWorkerRegistration) {
  await registration.update()

  if (registration.installing) {
    await waitForServiceWorkerState(registration.installing, 'installed')
  }

  const worker = registration.waiting
  if (!worker) return

  worker.postMessage({ type: 'SKIP_WAITING' })
  await waitForControllerChange()
}

async function forceRefreshApp() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => activateUpdatedWorker(registration)))
    await Promise.all(registrations.map((registration) => registration.unregister()))
    await waitForControllerChange()
  }

  if ('caches' in window) {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
  }

  const url = new URL(window.location.href)
  url.searchParams.set('refresh', Date.now().toString())
  window.location.assign(url.toString())
}

const DELAY_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
]

export function SettingsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false)
  const { startDelaySeconds, setStartDelay } = useSettingsStore()
  const { user, signOut } = useAuthStore()

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
        <h2 className="font-medium">Set timer start delay</h2>
        <p className="text-sm text-slate-400">
          Countdown before the set timer starts — tap play, then get to your weights before the clock starts.
        </p>
        <div className="flex gap-2 flex-wrap">
          {DELAY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStartDelay(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                startDelaySeconds === opt.value
                  ? 'bg-sky-500 border-sky-500 text-slate-950'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

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

      <section className="space-y-3 rounded-xl bg-slate-800/50 p-4">
        <div>
          <h2 className="font-medium">Account</h2>
          {user && (
            <p className="text-sm text-slate-400 mt-1">{user.email ?? user.user_metadata?.full_name ?? 'Signed in'}</p>
          )}
        </div>
        <button
          type="button"
          onClick={signOut}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-600"
        >
          <LogOut size={16} />
          Sign out
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
