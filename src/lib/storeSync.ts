import { supabase } from './supabase'
import { useHistoryStore, migrateHistoryState } from '../store/historyStore'
import { useOutcomeStore, migrateOutcomeState } from '../store/outcomeStore'
import { usePlanStore, migratePlanState } from '../store/planStore'
import { useProgramStore, migrateProgramState } from '../store/programStore'
import { useExerciseHistoryStore, migrateExerciseHistoryState } from '../store/exerciseHistoryStore'
import { migrateMobilityState, useMobilityStore } from '../store/mobilityStore'
import { useSettingsStore, migrateSettingsState } from '../store/settingsStore'
import { useSyncStatusStore, type SyncStatus } from '../store/syncStatusStore'

type AnyStore = {
  getState: () => Record<string, unknown>
  setState: (state: Record<string, unknown>) => void
  subscribe: (listener: (state: Record<string, unknown>) => void) => () => void
}

type MigrateFn = (data: unknown) => unknown

export const STORES: { name: string; store: AnyStore; migrate?: MigrateFn }[] = [
  {
    name: 'wpt_history',
    store: useHistoryStore as unknown as AnyStore,
    // Always apply from version 0 — idempotent for already-migrated data.
    // Extras that already have `source` defined are unchanged; only
    // undefined-source entries get patched to 'history', preventing the Undo
    // handler from silently deleting user-added extras.
    migrate: (data) => migrateHistoryState(data, 0),
  },
  {
    name: 'wpt_outcomes',
    store: useOutcomeStore as unknown as AnyStore,
    // Backfills outcomes and progressionStates to their empty-object defaults
    // when cloud data predates one of those fields being added to the schema.
    migrate: (data) => migrateOutcomeState(data, 0),
  },
  {
    name: 'wpt_plans',
    store: usePlanStore as unknown as AnyStore,
    // Normalises legacy slot types (weightlifting → weights, long_run → run,
    // recovery_run → run, rest → other) and derives location / focus from
    // deprecated `tags` field.
    migrate: (data) => migratePlanState(data),
  },
  {
    name: 'wpt_program_vars',
    store: useProgramStore as unknown as AnyStore,
    // Backfills vars to its empty-object default when cloud data predates the
    // field or was saved by an older version before migrateProgramState existed.
    migrate: (data) => migrateProgramState(data, 0),
  },
  {
    name: 'wpt_exercise_history',
    store: useExerciseHistoryStore as unknown as AnyStore,
    // Backfills records to its empty-array default when cloud data predates the
    // field or was saved by an older version before migrateExerciseHistoryState existed.
    migrate: (data) => migrateExerciseHistoryState(data, 0),
  },
  {
    name: 'wpt_mobility',
    store: useMobilityStore as unknown as AnyStore,
    // Cloud data bypasses Zustand persist's migration hook, so run the full
    // mobility migration before hydrating the live store.
    migrate: (data) => migrateMobilityState(data, 0),
  },
  {
    name: 'wpt_settings',
    store: useSettingsStore as unknown as AnyStore,
    // Backfills any new settings fields that weren't present in older cloud
    // snapshots. The persist middleware only runs migrate() on localStorage
    // reads; direct setState (used here after cloud hydration) bypasses it,
    // so we run the same migration explicitly.
    migrate: (data) => migrateSettingsState(data, 0),
  },
]


export function serializeState(state: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(state).filter(([, v]) => typeof v !== 'function'),
  )
}

// ─── Sync metadata ──────────────────────────────────────────────────────────
//
// Persisted per device so unsynced changes survive a closed tab or a killed
// PWA (iOS rarely fires beforeunload). For each store we remember:
//   dirty     — local has changes the cloud doesn't have yet
//   changedAt — when the most recent local change happened
//   cloudAt   — the cloud row's updated_at as of our last successful pull/push
//
// cloudAt lets us tell "cloud changed on another device since we last synced"
// apart from "cloud is just our own last write", which decides whether a
// dirty local copy can be pushed as-is or is in conflict.

const META_KEY = 'wpt_sync_meta'
const CONFLICT_BACKUP_KEY = 'wpt_sync_conflict_backup'

interface StoreMeta {
  dirty: boolean
  changedAt?: string
  cloudAt?: string
}

interface SyncMeta {
  userId?: string
  stores: Record<string, StoreMeta>
}

// Fallback when localStorage is unavailable (tests, private mode).
const memoryStorage = new Map<string, string>()

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key)
  } catch { /* blocked */ }
  return memoryStorage.get(key) ?? null
}

function writeStorage(key: string, value: string): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value)
      return true
    }
  } catch {
    return false
  }
  memoryStorage.set(key, value)
  return true
}

function loadMeta(): SyncMeta {
  try {
    const raw = readStorage(META_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SyncMeta
      if (parsed && typeof parsed === 'object' && parsed.stores) return parsed
    }
  } catch { /* corrupt — start fresh */ }
  return { stores: {} }
}

function saveMeta(meta: SyncMeta): void {
  writeStorage(META_KEY, JSON.stringify(meta))
}

function updateStoreMeta(name: string, patch: Partial<StoreMeta>): void {
  const meta = loadMeta()
  meta.stores[name] = { ...(meta.stores[name] ?? { dirty: false }), ...patch }
  saveMeta(meta)
}

function parseTime(iso: string | undefined | null): number {
  if (!iso) return NaN
  return Date.parse(iso)
}

export interface ConflictBackup {
  savedAt: string
  stores: Record<string, unknown>
}

/** The losing side of the most recent sync conflict, if one was saved. */
export function getConflictBackup(): ConflictBackup | null {
  try {
    const raw = readStorage(CONFLICT_BACKUP_KEY)
    return raw ? (JSON.parse(raw) as ConflictBackup) : null
  } catch {
    return null
  }
}

export function clearConflictBackup(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(CONFLICT_BACKUP_KEY)
  } catch { /* blocked */ }
  memoryStorage.delete(CONFLICT_BACKUP_KEY)
  useSyncStatusStore.setState({ conflictBackupAt: null })
}

/**
 * When a whole-store conflict forces us to discard one side, keep a copy of
 * the discarded data so it can be downloaded from Settings and re-imported.
 */
function saveConflictBackup(name: string, data: unknown): void {
  const existing = getConflictBackup()
  const savedAt = new Date().toISOString()
  const backup: ConflictBackup = {
    savedAt,
    stores: { ...(existing?.stores ?? {}), [name]: data },
  }
  if (writeStorage(CONFLICT_BACKUP_KEY, JSON.stringify(backup))) {
    useSyncStatusStore.setState({ conflictBackupAt: savedAt })
  } else {
    console.error('[storeSync] could not save conflict backup for', name)
  }
}

// ─── Module state ───────────────────────────────────────────────────────────

/** True while cloud data is being applied, so it isn't marked as a local change. */
let hydrating = false
/** True once a pull has succeeded this session; pushes wait for it. */
let reconciled = false
/** Bumped on every local change, so a push only clears `dirty` if nothing changed meanwhile. */
const changeSeq = new Map<string, number>()
/** Serialises pushes per store so writes land in order. */
const pushChain = new Map<string, Promise<boolean>>()
let retryTimer: ReturnType<typeof setTimeout> | undefined
let retryAttempt = 0
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000]

/** Test-only: reset module state between tests. */
export function __resetSyncStateForTests(): void {
  hydrating = false
  reconciled = false
  changeSeq.clear()
  pushChain.clear()
  if (retryTimer !== undefined) clearTimeout(retryTimer)
  retryTimer = undefined
  retryAttempt = 0
  syncQueue = Promise.resolve()
  memoryStorage.clear()
  useSyncStatusStore.setState({ status: 'idle', lastSyncedAt: null, lastError: null, conflictBackupAt: null })
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function setStatus(status: SyncStatus, lastError: string | null = null): void {
  useSyncStatusStore.setState(
    status === 'synced'
      ? { status, lastError: null, lastSyncedAt: new Date().toISOString() }
      : { status, lastError },
  )
}

function anyDirty(): boolean {
  return Object.values(loadMeta().stores).some(m => m.dirty)
}

function setFailureStatus(message: string): void {
  setStatus(isOffline() ? 'offline' : 'error', message)
}

async function getUserId(): Promise<string | null> {
  // getSession() reads the locally cached session, so it works offline;
  // getUser() makes a network round-trip and returns null when offline,
  // which used to make pushes silently no-op.
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

/** Returns true when the row was written. Never throws. */
async function pushStore(storeName: string, data: Record<string, unknown>): Promise<boolean> {
  const seqAtStart = changeSeq.get(storeName) ?? 0
  try {
    const userId = await getUserId()
    if (!userId) return false
    const updatedAt = new Date().toISOString()
    const { error } = await supabase.from('workout_user_store_data').upsert({
      user_id: userId,
      store_name: storeName,
      data,
      updated_at: updatedAt,
    })
    if (error) {
      console.error('[storeSync] pushStore failed for', storeName, ':', error.message)
      setFailureStatus(error.message)
      return false
    }
    const stillClean = (changeSeq.get(storeName) ?? 0) === seqAtStart
    updateStoreMeta(storeName, stillClean ? { dirty: false, cloudAt: updatedAt } : { cloudAt: updatedAt })
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[storeSync] pushStore threw for', storeName, ':', message)
    setFailureStatus(message)
    return false
  }
}

/** Queue a push of the store's *current* state behind any in-flight push for it. */
function enqueuePush(name: string): Promise<boolean> {
  const entry = STORES.find(s => s.name === name)
  if (!entry) return Promise.resolve(false)
  const prev = pushChain.get(name) ?? Promise.resolve(true)
  const next = prev.then(() => pushStore(name, serializeState(entry.store.getState())))
  pushChain.set(name, next)
  return next
}

function scheduleRetry(): void {
  if (retryTimer !== undefined) return
  const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)]
  retryAttempt++
  retryTimer = setTimeout(() => {
    retryTimer = undefined
    void syncNow()
  }, delay)
}

function cancelRetry(): void {
  if (retryTimer !== undefined) clearTimeout(retryTimer)
  retryTimer = undefined
}

/** Push every store flagged dirty. Resolves true when all pushes succeed. */
async function pushDirtyStores(): Promise<boolean> {
  const dirty = Object.entries(loadMeta().stores).filter(([, m]) => m.dirty).map(([n]) => n)
  const results = await Promise.all(dirty.map(enqueuePush))
  return results.every(Boolean)
}

/**
 * Pull cloud rows and reconcile them with local state, per store:
 *  - cloud row missing        → push local only if it has unsynced changes
 *  - local clean              → take the cloud copy if it changed since our last sync
 *  - local dirty, cloud same  → push local (nobody else wrote)
 *  - local dirty, cloud newer → conflict: newest write wins; the loser is
 *                               saved as a conflict backup (Settings → Backup)
 * Returns false if the pull failed.
 */
async function reconcile(): Promise<boolean> {
  const userId = await getUserId()
  if (!userId) return false

  setStatus('syncing')
  let rows: { store_name: string; data: unknown; updated_at?: string | null }[] | null
  try {
    const { data, error: fetchError } = await supabase
      .from('workout_user_store_data')
      .select('store_name, data, updated_at')
      .eq('user_id', userId)
    if (fetchError) {
      console.error('[storeSync] reconcile fetch failed:', fetchError.message)
      setFailureStatus(fetchError.message)
      return false
    }
    rows = data
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[storeSync] reconcile fetch threw:', message)
    setFailureStatus(message)
    return false
  }

  // Metadata from a different account says nothing about this one.
  let meta = loadMeta()
  // Unowned metadata (written before the first successful pull) is adopted.
  if (meta.userId !== userId) {
    meta = meta.userId === undefined ? { ...meta, userId } : { userId, stores: {} }
    saveMeta(meta)
  }

  if (!rows || rows.length === 0) {
    // First-ever login: push local localStorage data up as the initial backup.
    const results = await Promise.all(STORES.map(({ name }) => enqueuePush(name)))
    reconciled = true
    return results.every(Boolean)
  }

  const pushes: Promise<boolean>[] = []
  for (const entry of STORES) {
    const row = rows.find(r => r.store_name === entry.name)
    const local = meta.stores[entry.name] ?? { dirty: false }

    if (!row || !row.data || typeof row.data !== 'object') {
      if (local.dirty) pushes.push(enqueuePush(entry.name))
      continue
    }

    const cloudTime = parseTime(row.updated_at)
    const knownCloudTime = parseTime(local.cloudAt)
    // Unknown timestamps count as "changed" so we fall back to the
    // historical behaviour (cloud wins).
    const cloudChanged = Number.isNaN(cloudTime) || Number.isNaN(knownCloudTime) || cloudTime > knownCloudTime

    if (local.dirty) {
      if (!cloudChanged) {
        pushes.push(enqueuePush(entry.name))
        continue
      }
      const localTime = parseTime(local.changedAt)
      if (!Number.isNaN(localTime) && !Number.isNaN(cloudTime) && localTime > cloudTime) {
        // Local edit is newer — keep it, back up the cloud copy.
        saveConflictBackup(entry.name, row.data)
        pushes.push(enqueuePush(entry.name))
        continue
      }
      // Cloud is newer — keep a copy of the unsynced local data before replacing it.
      saveConflictBackup(entry.name, serializeState(entry.store.getState()))
    } else if (!cloudChanged) {
      continue
    }

    // Apply store-specific migrations before setState so that cloud data stored
    // by an older app version is normalised to the current schema — the persist
    // middleware only runs migrate() on localStorage reads, not direct setState.
    const migratedData = entry.migrate
      ? entry.migrate(row.data as Record<string, unknown>)
      : row.data as Record<string, unknown>
    hydrating = true
    try {
      entry.store.setState(migratedData as Record<string, unknown>)
    } finally {
      hydrating = false
    }
    changeSeq.set(entry.name, (changeSeq.get(entry.name) ?? 0) + 1)
    updateStoreMeta(entry.name, { dirty: false, cloudAt: row.updated_at ?? undefined })
  }

  reconciled = true
  const results = await Promise.all(pushes)
  return results.every(Boolean)
}

/**
 * Reconcile if we haven't yet this session, otherwise push anything dirty.
 * Sets the status indicator and schedules a retry on failure.
 */
/** Runs are serialised so two reconciles never race each other. */
let syncQueue: Promise<void> = Promise.resolve()
function syncNow(): Promise<void> {
  syncQueue = syncQueue.then(runSync, runSync)
  return syncQueue
}

async function runSync(): Promise<void> {
  const ok = reconciled ? await pushDirtyStores() : await reconcile()
  if (ok) {
    retryAttempt = 0
    cancelRetry()
    // Still dirty only if an edit landed mid-push; its debounce timer will push it.
    setStatus(anyDirty() ? 'pending' : 'synced')
    return
  }
  const { status, lastError } = useSyncStatusStore.getState()
  if (status !== 'offline' && status !== 'error') setFailureStatus(lastError ?? 'Sync incomplete')
  scheduleRetry()
}

/** Called on login. Pulls cloud data and reconciles it with local data. */
export async function syncOnLogin(): Promise<void> {
  const ok = await reconcile()
  if (ok) {
    setStatus(anyDirty() ? 'pending' : 'synced')
  } else {
    // e.g. offline at launch — keep trying so we pull before pushing.
    scheduleRetry()
  }
}

const FOREGROUND_RECONCILE_MIN_MS = 30_000

/** Subscribe to all stores, debounce-push changes, and keep in step with the cloud. */
export function subscribeStores(): () => void {
  const unsubscribers: (() => void)[] = []
  // Track pending debounced timeouts so we can flush them on page hide/unload.
  const pendingByStore = new Map<string, ReturnType<typeof setTimeout>>()
  let lastReconcileAt = Date.now()
  let active = true

  for (const { name, store } of STORES) {
    const unsub = store.subscribe(() => {
      if (hydrating) return
      // Mark dirty synchronously so the change is remembered even if the
      // page dies before the debounced push fires.
      changeSeq.set(name, (changeSeq.get(name) ?? 0) + 1)
      updateStoreMeta(name, { dirty: true, changedAt: new Date().toISOString() })
      if (useSyncStatusStore.getState().status !== 'offline') setStatus('pending')

      const prev = pendingByStore.get(name)
      if (prev !== undefined) clearTimeout(prev)
      pendingByStore.set(
        name,
        setTimeout(() => {
          pendingByStore.delete(name)
          void syncNow()
        }, 1500),
      )
    })

    unsubscribers.push(unsub)
  }

  /** Push pending changes immediately (page hidden/unloading, back online). */
  function flushPending(): Promise<unknown> {
    if (!active) return Promise.resolve()
    if (pendingByStore.size === 0 && !anyDirty()) return Promise.resolve()
    pendingByStore.forEach(id => clearTimeout(id))
    pendingByStore.clear()
    return syncNow()
  }
  const handleHide = () => { void flushPending() }

  function handleVisibility() {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'hidden') {
      void flushPending()
    } else if (Date.now() - lastReconcileAt >= FOREGROUND_RECONCILE_MIN_MS) {
      // Back in the foreground: pick up changes made on other devices.
      lastReconcileAt = Date.now()
      void pullFresh()
    }
  }

  async function pullFresh() {
    if (!active) return
    await flushPending()
    await Promise.all(pushChain.values())
    if (!active) return
    reconciled = false
    await syncNow()
  }

  function handleOnline() {
    lastReconcileAt = Date.now()
    void pullFresh()
  }

  // beforeunload is unreliable on iOS/PWAs; pagehide and visibilitychange
  // are the events that actually fire when the app is backgrounded or closed.
  window.addEventListener('beforeunload', handleHide)
  window.addEventListener('pagehide', handleHide)
  window.addEventListener('online', handleOnline)
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibility)

  // Anything left dirty from a previous session (e.g. app killed offline)
  // goes up now rather than waiting for the next edit.
  if (anyDirty()) void syncNow()

  return () => {
    active = false
    unsubscribers.forEach(u => u())
    window.removeEventListener('beforeunload', handleHide)
    window.removeEventListener('pagehide', handleHide)
    window.removeEventListener('online', handleOnline)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibility)
    pendingByStore.forEach(id => clearTimeout(id))
    pendingByStore.clear()
    cancelRetry()
  }
}
