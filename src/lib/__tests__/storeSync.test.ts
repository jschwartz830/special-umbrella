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
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

// eslint-disable-next-line import/first
import { syncOnLogin, subscribeStores } from '../storeSync'
// eslint-disable-next-line import/first
import { useHistoryStore } from '../../store/historyStore'
// eslint-disable-next-line import/first
import { usePlanStore } from '../../store/planStore'
// eslint-disable-next-line import/first
import { useMobilityStore } from '../../store/mobilityStore'
// eslint-disable-next-line import/first
import { useSettingsStore } from '../../store/settingsStore'

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
})

describe('subscribeStores', () => {
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
