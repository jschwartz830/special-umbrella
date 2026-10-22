/**
 * Tests for storeSync.ts — the localStorage <-> Supabase cloud-sync bridge.
 *
 * This module had zero test coverage across many overnight audit passes
 * (TEST-1, carried forward since pass 78). It is the highest-risk untested
 * module: a regression here silently loses or overwrites user data.
 *
 * The persist middleware is mocked as a pass-through (same pattern as
 * historyStore.test.ts / planDeleteCleanup.test.ts) so the real store
 * singletons work in Node without localStorage. Supabase is mocked at the
 * module boundary so no network calls are made.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

const mockGetUser = vi.fn()
const mockUpsert = vi.fn()
const mockEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      // storeSync reads the cached session (works offline); derive it from
      // the same mock so tests only configure the user once.
      getSession: async () => {
        const res = await mockGetUser()
        const user = res?.data?.user ?? null
        return { data: { session: user ? { user } : null } }
      },
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

import { syncOnLogin, subscribeStores, __resetSyncStateForTests, getConflictBackup } from '../storeSync'
import { useSyncStatusStore } from '../../store/syncStatusStore'
import { useHistoryStore } from '../../store/historyStore'
import { usePlanStore } from '../../store/planStore'
import { useMobilityStore } from '../../store/mobilityStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useOutcomeStore } from '../../store/outcomeStore'
import { useProgramStore } from '../../store/programStore'
import { useExerciseHistoryStore } from '../../store/exerciseHistoryStore'

function makeFakeWindow() {
  const listeners: Record<string, Array<() => void>> = {}
  return {
    addEventListener: (type: string, cb: () => void) => {
      ;(listeners[type] ??= []).push(cb)
    },
    removeEventListener: (type: string, cb: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter(l => l !== cb)
    },
    fire: (type: string) => {
      ;(listeners[type] ?? []).forEach(cb => cb())
    },
  }
}

let fakeWindow: ReturnType<typeof makeFakeWindow>

beforeEach(() => {
  vi.clearAllMocks()
  __resetSyncStateForTests()
  mockFrom.mockImplementation(() => ({
    upsert: mockUpsert,
    select: () => ({ eq: mockEq }),
  }))
  mockUpsert.mockResolvedValue({ error: null })

  // Reset only the fields these tests touch — the stores are real global
  // singletons shared across the whole file.
  useHistoryStore.setState({ entries: [], overrides: [], extraEntries: [] })
  usePlanStore.setState({ plans: {}, activePlanId: null })
  useMobilityStore.setState({ activeSession: null })
  useOutcomeStore.setState({ outcomes: {}, progressionStates: {} })
  useProgramStore.setState({ vars: {} })
  useExerciseHistoryStore.setState({ records: [] })

  fakeWindow = makeFakeWindow()
  vi.stubGlobal('window', fakeWindow)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('syncOnLogin', () => {
  it('does nothing when there is no signed-in user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await syncOnLogin()

    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('pushes local state for every store on first-ever login (no cloud rows)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({ data: [], error: null })

    await syncOnLogin()

    const pushedStoreNames = mockUpsert.mock.calls.map(([arg]) => arg.store_name)
    expect(pushedStoreNames.sort()).toEqual(
      [
        'wpt_exercise_history',
        'wpt_history',
        'wpt_mobility',
        'wpt_outcomes',
        'wpt_plans',
        'wpt_program_vars',
        'wpt_settings',
      ].sort(),
    )
  })

  it('stops after a fetch error without pushing or hydrating', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({ data: null, error: { message: 'network down' } })

    await syncOnLogin()

    expect(mockUpsert).not.toHaveBeenCalled()
    expect(useHistoryStore.getState().entries).toEqual([])
  })

  it('hydrates a store from cloud data when rows exist (cloud wins)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({
      data: [
        {
          store_name: 'wpt_settings',
          data: { startDelaySeconds: 30, autoAdvanceSegments: true },
        },
      ],
      error: null,
    })

    await syncOnLogin()

    // No local rows existed, so this is the hydrate branch, not the
    // first-login push branch — nothing should be pushed back up.
    expect(mockUpsert).not.toHaveBeenCalled()
    expect(useSettingsStore.getState().startDelaySeconds).toBe(30)
    expect(useSettingsStore.getState().autoAdvanceSegments).toBe(true)
  })

  it('backfills weekStartsOn via migrateSettingsState when missing from old cloud data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({
      data: [
        {
          store_name: 'wpt_settings',
          // Simulates a cloud snapshot saved before weekStartsOn was added.
          data: { startDelaySeconds: 10, autoAdvanceSegments: false, focusMode: true },
        },
      ],
      error: null,
    })

    await syncOnLogin()

    // migrateSettingsState must backfill weekStartsOn to its default (0 = Sunday).
    expect(useSettingsStore.getState().weekStartsOn).toBe(0)
    // Existing fields must pass through unchanged.
    expect(useSettingsStore.getState().startDelaySeconds).toBe(10)
    expect(useSettingsStore.getState().focusMode).toBe(true)
  })

  it('applies the wpt_history migrate function to cloud data (extras without source)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({
      data: [
        {
          store_name: 'wpt_history',
          data: {
            entries: [],
            overrides: [],
            extraEntries: [
              { id: 'e1', planId: 'p1', calendarDate: '2026-01-01', workoutType: 'run', createdAt: 'x' },
            ],
          },
        },
      ],
      error: null,
    })

    await syncOnLogin()

    // migrateHistoryState(data, 0) patches undefined `source` to 'history'
    // so the Undo handler doesn't silently delete cloud-synced extras.
    expect(useHistoryStore.getState().extraEntries[0].source).toBe('history')
  })

  it('applies the wpt_mobility migrate function to backfill missing activeSession', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({
      data: [
        {
          store_name: 'wpt_mobility',
          // Legacy (v1) cloud row predates the activeSession field entirely.
          data: { routine: [], completions: {} },
        },
      ],
      error: null,
    })

    await syncOnLogin()

    expect(useMobilityStore.getState().activeSession).toBeNull()
  })

  it('ignores rows for unknown/renamed store names instead of throwing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({
      data: [{ store_name: 'wpt_does_not_exist', data: { foo: 'bar' } }],
      error: null,
    })

    await expect(syncOnLogin()).resolves.not.toThrow()
  })

  it('skips a row whose data is not an object', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({
      data: [{ store_name: 'wpt_plans', data: null }],
      error: null,
    })

    await syncOnLogin()

    expect(usePlanStore.getState().plans).toEqual({})
  })

  it('backfills progressionStates via migrateOutcomeState when missing from old cloud data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({
      data: [
        {
          store_name: 'wpt_outcomes',
          // Simulates a cloud snapshot saved before progressionStates was added.
          data: { outcomes: { 'plan-1_2026-01-01': { workoutInstanceId: 'plan-1_2026-01-01' } } },
        },
      ],
      error: null,
    })

    await syncOnLogin()

    // migrateOutcomeState must backfill progressionStates to its empty-object default.
    expect(useOutcomeStore.getState().progressionStates).toEqual({})
    // Existing outcomes must pass through unchanged.
    expect(useOutcomeStore.getState().outcomes['plan-1_2026-01-01']).toBeDefined()
  })

  it('backfills vars via migrateProgramState when missing from old cloud data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({
      data: [
        {
          store_name: 'wpt_program_vars',
          // Simulates a cloud snapshot saved before the vars field existed.
          data: {},
        },
      ],
      error: null,
    })

    await syncOnLogin()

    // migrateProgramState must backfill vars to its empty-object default.
    expect(useProgramStore.getState().vars).toEqual({})
  })

  it('backfills records via migrateExerciseHistoryState when missing from old cloud data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({
      data: [
        {
          store_name: 'wpt_exercise_history',
          // Simulates a cloud snapshot saved before the records field existed.
          data: {},
        },
      ],
      error: null,
    })

    await syncOnLogin()

    // migrateExerciseHistoryState must backfill records to its empty-array default.
    expect(useExerciseHistoryStore.getState().records).toEqual([])
  })
})

describe('subscribeStores', () => {
  // Pushes wait for a successful pull, as they do in the app (AuthGate runs
  // syncOnLogin before subscribeStores).
  beforeEach(async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({
      data: [{ store_name: 'wpt_settings', data: { startDelaySeconds: 0 }, updated_at: '2026-01-01T00:00:00Z' }],
      error: null,
    })
    await syncOnLogin()
    mockUpsert.mockClear()
  })

  it('debounces rapid successive changes to the same store into a single push', async () => {
    vi.useFakeTimers()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })

    const unsubscribe = subscribeStores()
    useHistoryStore.setState({ entries: [] })
    await vi.advanceTimersByTimeAsync(500)
    useHistoryStore.setState({ overrides: [] }) // resets the 1500ms debounce window
    await vi.advanceTimersByTimeAsync(1500)

    const historyPushes = mockUpsert.mock.calls.filter(([arg]) => arg.store_name === 'wpt_history')
    expect(historyPushes).toHaveLength(1)

    unsubscribe()
  })

  it('does not push when there is no signed-in user', async () => {
    vi.useFakeTimers()
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const unsubscribe = subscribeStores()
    useHistoryStore.setState({ entries: [] })
    await vi.advanceTimersByTimeAsync(1500)

    expect(mockUpsert).not.toHaveBeenCalled()

    unsubscribe()
  })

  it('flushes a pending debounced write immediately on beforeunload', async () => {
    vi.useFakeTimers()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })

    const unsubscribe = subscribeStores()
    useHistoryStore.setState({ entries: [] })
    // Push has not fired yet — well inside the 1500ms debounce window.
    fakeWindow.fire('beforeunload')
    await vi.advanceTimersByTimeAsync(0)

    const historyPushes = mockUpsert.mock.calls.filter(([arg]) => arg.store_name === 'wpt_history')
    expect(historyPushes).toHaveLength(1)

    // The debounced timer must not also fire and double-push.
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockUpsert.mock.calls.filter(([arg]) => arg.store_name === 'wpt_history')).toHaveLength(1)

    unsubscribe()
  })

  it('cancels pending debounced writes on unsubscribe without pushing', async () => {
    vi.useFakeTimers()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })

    const unsubscribe = subscribeStores()
    useHistoryStore.setState({ entries: [] })
    unsubscribe()
    await vi.advanceTimersByTimeAsync(2000)

    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('removes the beforeunload listener on unsubscribe', () => {
    const unsubscribe = subscribeStores()
    unsubscribe()

    // A second fire after unsubscribe should be a no-op (no listeners left).
    expect(() => fakeWindow.fire('beforeunload')).not.toThrow()
  })
})

describe('offline resilience and conflicts', () => {
  const T0 = '2026-01-01T00:00:00Z'

  function historyPushes() {
    return mockUpsert.mock.calls.filter(([arg]) => arg.store_name === 'wpt_history')
  }

  async function loginWithHistoryRow(updatedAt: string, data: Record<string, unknown> = { entries: [], overrides: [], extraEntries: [] }) {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({ data: [{ store_name: 'wpt_history', data, updated_at: updatedAt }], error: null })
    await syncOnLogin()
  }

  it('keeps a change whose push failed and retries it later', async () => {
    vi.useFakeTimers()
    await loginWithHistoryRow(T0)
    const unsubscribe = subscribeStores()

    mockUpsert.mockResolvedValueOnce({ error: { message: 'timeout' } })
    useHistoryStore.setState({ overrides: [] })
    await vi.advanceTimersByTimeAsync(1500)
    expect(historyPushes()).toHaveLength(1)
    expect(useSyncStatusStore.getState().status).toBe('error')

    // First retry fires after 5s and succeeds.
    await vi.advanceTimersByTimeAsync(5000)
    expect(historyPushes()).toHaveLength(2)
    expect(useSyncStatusStore.getState().status).toBe('synced')

    unsubscribe()
  })

  it('pushes unsynced local changes on next login instead of overwriting them', async () => {
    vi.useFakeTimers()
    await loginWithHistoryRow(T0)
    const unsubscribe = subscribeStores()

    // Change made, but the app is killed before the push lands.
    mockUpsert.mockResolvedValue({ error: { message: 'offline' } })
    useHistoryStore.setState({ extraEntries: [{ id: 'local-1' } as never] })
    await vi.advanceTimersByTimeAsync(1500)
    unsubscribe()
    mockUpsert.mockResolvedValue({ error: null })
    mockUpsert.mockClear()

    // Next launch: cloud row is unchanged since our last sync.
    await loginWithHistoryRow(T0)

    expect(useHistoryStore.getState().extraEntries).toEqual([{ id: 'local-1' }])
    expect(historyPushes()).toHaveLength(1)
    expect(historyPushes()[0][0].data.extraEntries).toEqual([{ id: 'local-1' }])
  })

  it('takes newer cloud data and backs up conflicting local changes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
    await loginWithHistoryRow(T0)
    const unsubscribe = subscribeStores()
    mockUpsert.mockResolvedValue({ error: { message: 'offline' } })
    useHistoryStore.setState({ extraEntries: [{ id: 'local-1' } as never] })
    await vi.advanceTimersByTimeAsync(1500)
    unsubscribe()
    mockUpsert.mockResolvedValue({ error: null })

    // Another device wrote after our local edit.
    await loginWithHistoryRow('2026-01-03T00:00:00Z', {
      entries: [], overrides: [], extraEntries: [{ id: 'remote-1', source: 'history' }],
    })

    expect(useHistoryStore.getState().extraEntries.map(e => e.id)).toEqual(['remote-1'])
    const backup = getConflictBackup()
    expect((backup?.stores.wpt_history as { extraEntries: { id: string }[] }).extraEntries[0].id).toBe('local-1')
  })

  it('keeps newer local changes and backs up the older cloud copy', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T00:00:00Z'))
    await loginWithHistoryRow(T0)
    const unsubscribe = subscribeStores()
    mockUpsert.mockResolvedValue({ error: { message: 'offline' } })
    useHistoryStore.setState({ extraEntries: [{ id: 'local-1' } as never] })
    await vi.advanceTimersByTimeAsync(1500)
    unsubscribe()
    mockUpsert.mockResolvedValue({ error: null })
    mockUpsert.mockClear()

    // Another device wrote, but before our local edit.
    await loginWithHistoryRow('2026-01-03T00:00:00Z', {
      entries: [], overrides: [], extraEntries: [{ id: 'remote-1' }],
    })

    expect(useHistoryStore.getState().extraEntries).toEqual([{ id: 'local-1' }])
    expect(historyPushes()).toHaveLength(1)
    const backup = getConflictBackup()
    expect((backup?.stores.wpt_history as { extraEntries: { id: string }[] }).extraEntries[0].id).toBe('remote-1')
  })

  it('does not push before a pull has succeeded (offline at launch)', async () => {
    vi.useFakeTimers()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockEq.mockResolvedValue({ data: null, error: { message: 'network down' } })
    await syncOnLogin()
    const unsubscribe = subscribeStores()

    useHistoryStore.setState({ extraEntries: [{ id: 'offline-1' } as never] })
    await vi.advanceTimersByTimeAsync(1500)
    expect(mockUpsert).not.toHaveBeenCalled()

    // Connectivity returns: the retry pulls first, then pushes the dirty store.
    mockEq.mockResolvedValue({ data: [{ store_name: 'wpt_history', data: { entries: [] }, updated_at: T0 }], error: null })
    fakeWindow.fire('online')
    await vi.advanceTimersByTimeAsync(0)

    expect(useHistoryStore.getState().extraEntries).toEqual([{ id: 'offline-1' }])
    expect(historyPushes()).toHaveLength(1)

    unsubscribe()
  })

  it('flushes a pending write on pagehide (iOS does not fire beforeunload)', async () => {
    vi.useFakeTimers()
    await loginWithHistoryRow(T0)
    const unsubscribe = subscribeStores()
    useHistoryStore.setState({ overrides: [] })
    fakeWindow.fire('pagehide')
    await vi.advanceTimersByTimeAsync(0)
    expect(historyPushes()).toHaveLength(1)
    unsubscribe()
  })

  it('picks up another device\'s changes when coming back online', async () => {
    vi.useFakeTimers()
    await loginWithHistoryRow(T0)
    const unsubscribe = subscribeStores()

    mockEq.mockResolvedValue({
      data: [{ store_name: 'wpt_history', data: { entries: [], overrides: [], extraEntries: [{ id: 'remote-2' }] }, updated_at: '2026-02-01T00:00:00Z' }],
      error: null,
    })
    fakeWindow.fire('online')
    await vi.advanceTimersByTimeAsync(0)

    expect(useHistoryStore.getState().extraEntries.map(e => e.id)).toEqual(['remote-2'])
    // Applying cloud data must not be echoed back up as a local change.
    await vi.advanceTimersByTimeAsync(2000)
    expect(historyPushes()).toHaveLength(0)

    unsubscribe()
  })
})
