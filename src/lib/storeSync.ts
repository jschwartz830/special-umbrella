import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase'
import { useHistoryStore, migrateHistoryState } from '../store/historyStore'
import { useOutcomeStore, migrateOutcomeState } from '../store/outcomeStore'
import { usePlanStore, migratePlanState } from '../store/planStore'
import { useProgramStore, migrateProgramState } from '../store/programStore'
import { useExerciseHistoryStore, migrateExerciseHistoryState } from '../store/exerciseHistoryStore'
import { migrateMobilityState, useMobilityStore } from '../store/mobilityStore'
import { useSettingsStore, migrateSettingsState } from '../store/settingsStore'

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
  const { error } = await supabase.from('workout_user_store_data').upsert({
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
    .from('workout_user_store_data')
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

  // Cache the current user's credentials for use in the synchronous
  // beforeunload handler. The Supabase client's fetch wrapper doesn't support
  // keepalive, so we need direct fetch() calls with the raw token. We prime
  // from the current session and keep it updated via onAuthStateChange.
  let cachedUserId: string | null = null
  let cachedAccessToken: string | null = null

  supabase.auth.getSession().then(({ data: { session } }) => {
    cachedUserId = session?.user?.id ?? null
    cachedAccessToken = session?.access_token ?? null
  })

  const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    cachedUserId = session?.user?.id ?? null
    cachedAccessToken = session?.access_token ?? null
  })

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
  // down. The async pushStore() path is cancelled by the browser during
  // page teardown, so we use fetch() with keepalive:true directly against
  // the Supabase REST API instead — browsers guarantee keepalive requests
  // survive tab close for payloads under 64 KB.
  function handleBeforeUnload() {
    if (!cachedUserId || !cachedAccessToken) return
    for (const [timeoutStoreName, timeoutId] of pendingByStore.entries()) {
      clearTimeout(timeoutId)
      const entry = STORES.find(s => s.name === timeoutStoreName)
      if (!entry) continue
      const data = serializeState(entry.store.getState())
      void fetch(`${SUPABASE_URL}/rest/v1/workout_user_store_data`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cachedAccessToken}`,
          'apikey': SUPABASE_ANON_KEY,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          user_id: cachedUserId,
          store_name: timeoutStoreName,
          data,
          updated_at: new Date().toISOString(),
        }),
      })
    }
    pendingByStore.clear()
  }

  window.addEventListener('beforeunload', handleBeforeUnload)

  return () => {
    unsubscribers.forEach(u => u())
    authSubscription.unsubscribe()
    window.removeEventListener('beforeunload', handleBeforeUnload)
    pendingByStore.forEach(id => clearTimeout(id))
    pendingByStore.clear()
  }
}
