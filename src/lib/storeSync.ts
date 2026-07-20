import { supabase } from './supabase'
import { useHistoryStore, migrateHistoryState } from '../store/historyStore'
import { useOutcomeStore } from '../store/outcomeStore'
import { usePlanStore, migratePlanState } from '../store/planStore'
import { useProgramStore } from '../store/programStore'
import { useExerciseHistoryStore } from '../store/exerciseHistoryStore'
import { useMobilityStore } from '../store/mobilityStore'
import { useSettingsStore } from '../store/settingsStore'

type AnyStore = {
  getState: () => Record<string, unknown>
  setState: (state: Record<string, unknown>) => void
  subscribe: (listener: (state: Record<string, unknown>) => void) => () => void
}

type MigrateFn = (data: unknown) => unknown

const STORES: { name: string; store: AnyStore; migrate?: MigrateFn }[] = [
  {
    name: 'wpt_history',
    store: useHistoryStore as unknown as AnyStore,
    // Always apply from version 0 — idempotent for already-migrated data.
    // Extras that already have `source` defined are unchanged; only
    // undefined-source entries get patched to 'history', preventing the Undo
    // handler from silently deleting user-added extras.
    migrate: (data) => migrateHistoryState(data, 0),
  },
  { name: 'wpt_outcomes', store: useOutcomeStore as unknown as AnyStore },
  {
    name: 'wpt_plans',
    store: usePlanStore as unknown as AnyStore,
    // Normalises legacy slot types (weightlifting → weights, long_run → run,
    // recovery_run → run, rest → other) and derives location / focus from
    // deprecated `tags` field.
    migrate: (data) => migratePlanState(data),
  },
  { name: 'wpt_program_vars', store: useProgramStore as unknown as AnyStore },
  { name: 'wpt_exercise_history', store: useExerciseHistoryStore as unknown as AnyStore },
  {
    name: 'wpt_mobility',
    store: useMobilityStore as unknown as AnyStore,
    // v1 mobility state is missing `activeSession`; add it as null so the
    // tracker never receives undefined where null | MobilitySessionCheckpoint
    // is expected.
    migrate: (data) => {
      const s = data as Record<string, unknown>
      if (s && !('activeSession' in s)) return { ...s, activeSession: null }
      return data
    },
  },
  { name: 'wpt_settings', store: useSettingsStore as unknown as AnyStore },
]

function serializeState(state: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(state).filter(([, v]) => typeof v !== 'function'),
  )
}

async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function pushStore(storeName: string, data: Record<string, unknown>): Promise<void> {
  const userId = await getUserId()
  if (!userId) return
  const { error } = await supabase.from('user_store_data').upsert({
    user_id: userId,
    store_name: storeName,
    data,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.error('[storeSync] pushStore failed for', storeName, ':', error.message)
  }
}

/** Called on login. Pulls cloud data if it exists; otherwise uploads local data as the initial backup. */
export async function syncOnLogin(): Promise<void> {
  const userId = await getUserId()
  if (!userId) return

  const { data: rows, error: fetchError } = await supabase
    .from('user_store_data')
    .select('store_name, data')
    .eq('user_id', userId)

  if (fetchError) {
    console.error('[storeSync] syncOnLogin fetch failed:', fetchError.message)
    return
  }

  if (!rows || rows.length === 0) {
    // First-ever login: push local localStorage data up to Supabase
    await Promise.all(
      STORES.map(({ name, store }) =>
        pushStore(name, serializeState(store.getState())),
      ),
    )
    return
  }

  // Hydrate stores from Supabase (cloud wins over localStorage).
  // Apply store-specific migrations before setState so that cloud data stored
  // by an older app version is normalised to the current schema — the persist
  // middleware only runs migrate() on localStorage reads, not direct setState.
  for (const row of rows) {
    const entry = STORES.find(s => s.name === row.store_name)
    if (entry && row.data && typeof row.data === 'object') {
      const migratedData = entry.migrate
        ? entry.migrate(row.data as Record<string, unknown>)
        : row.data as Record<string, unknown>
      entry.store.setState(migratedData as Record<string, unknown>)
    }
  }
}

/** Subscribe to all stores and debounce-push changes to Supabase. */
export function subscribeStores(): () => void {
  const unsubscribers: (() => void)[] = []
  // Track pending debounced timeouts so we can flush them on page unload.
  const pendingByStore = new Map<string, ReturnType<typeof setTimeout>>()

  for (const { name, store } of STORES) {
    const unsub = store.subscribe((state) => {
      const prev = pendingByStore.get(name)
      if (prev !== undefined) clearTimeout(prev)
      pendingByStore.set(
        name,
        setTimeout(() => {
          pendingByStore.delete(name)
          pushStore(name, serializeState(state))
        }, 1500),
      )
    })

    unsubscribers.push(unsub)
  }

  // Flush any pending debounced writes immediately before the page is torn
  // down. Without this, a tab closed within 1.5s of a change loses that
  // write entirely — the debounced setTimeout never fires.
  function handleBeforeUnload() {
    for (const [timeoutStoreName, timeoutId] of pendingByStore.entries()) {
      clearTimeout(timeoutId)
      const entry = STORES.find(s => s.name === timeoutStoreName)
      if (entry) pushStore(timeoutStoreName, serializeState(entry.store.getState()))
    }
    pendingByStore.clear()
  }

  window.addEventListener('beforeunload', handleBeforeUnload)

  return () => {
    unsubscribers.forEach(u => u())
    window.removeEventListener('beforeunload', handleBeforeUnload)
    pendingByStore.forEach(id => clearTimeout(id))
    pendingByStore.clear()
  }
}
