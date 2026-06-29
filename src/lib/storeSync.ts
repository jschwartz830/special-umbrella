import { supabase } from './supabase'
import { useHistoryStore } from '../store/historyStore'
import { useOutcomeStore } from '../store/outcomeStore'
import { usePlanStore } from '../store/planStore'
import { useProgramStore } from '../store/programStore'
import { useExerciseHistoryStore } from '../store/exerciseHistoryStore'
import { useMobilityStore } from '../store/mobilityStore'
import { useSettingsStore } from '../store/settingsStore'

type AnyStore = {
  getState: () => Record<string, unknown>
  setState: (state: Record<string, unknown>) => void
  subscribe: (listener: (state: Record<string, unknown>) => void) => () => void
}

const STORES: { name: string; store: AnyStore }[] = [
  { name: 'wpt_history', store: useHistoryStore as unknown as AnyStore },
  { name: 'wpt_outcomes', store: useOutcomeStore as unknown as AnyStore },
  { name: 'wpt_plans', store: usePlanStore as unknown as AnyStore },
  { name: 'wpt_program_vars', store: useProgramStore as unknown as AnyStore },
  { name: 'wpt_exercise_history', store: useExerciseHistoryStore as unknown as AnyStore },
  { name: 'wpt_mobility', store: useMobilityStore as unknown as AnyStore },
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

  // Hydrate stores from Supabase (cloud wins over localStorage)
  for (const row of rows) {
    const entry = STORES.find(s => s.name === row.store_name)
    if (entry && row.data && typeof row.data === 'object') {
      entry.store.setState(row.data as Record<string, unknown>)
    }
  }
}

/** Subscribe to all stores and debounce-push changes to Supabase. */
export function subscribeStores(): () => void {
  const unsubscribers: (() => void)[] = []

  for (const { name, store } of STORES) {
    const timeouts = { id: undefined as ReturnType<typeof setTimeout> | undefined }

    const unsub = store.subscribe((state) => {
      clearTimeout(timeouts.id)
      timeouts.id = setTimeout(() => {
        pushStore(name, serializeState(state))
      }, 1500)
    })

    unsubscribers.push(unsub)
  }

  return () => unsubscribers.forEach(u => u())
}
