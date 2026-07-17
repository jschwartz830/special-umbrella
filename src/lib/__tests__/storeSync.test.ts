/**
 * Tests for storeSync.ts — cloud sync module.
 *
 * Covers syncOnLogin (push on first login, hydrate with migrations), subscribeStores
 * (debounced push, beforeunload flush), and unauthenticated no-op paths.
 *
 * Supabase is mocked so no network requests are made. A minimal window stub is
 * installed globally so subscribeStores can register its beforeunload handler
 * without requiring a jsdom environment.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'

// ── Hoist mocks ───────────────────────────────────────────────────────────────
// These must appear before any store or storeSync imports so the mocks are in
// place when those modules initialise.

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

vi.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

// ── Imports ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line import/first
import { supabase } from '../supabase'
// eslint-disable-next-line import/first
import { syncOnLogin, subscribeStores } from '../storeSync'
// eslint-disable-next-line import/first
import { usePlanStore } from '../../store/planStore'
// eslint-disable-next-line import/first
import { useHistoryStore } from '../../store/historyStore'
// eslint-disable-next-line import/first
import { useMobilityStore } from '../../store/mobilityStore'
// eslint-disable-next-line import/first
import type { ExtraWorkoutEntry } from '../../types'

// ── Window stub ───────────────────────────────────────────────────────────────
// subscribeStores calls window.addEventListener / removeEventListener to flush
// on beforeunload. Install a minimal stub so these tests run in Node.

type Listener = (ev: Event) => void
let windowListeners: Map<string, Set<Listener>>

beforeAll(() => {
  windowListeners = new Map()
  ;(globalThis as Record<string, unknown>).window = {
    addEventListener: (type: string, fn: Listener) => {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set())
      windowListeners.get(type)!.add(fn)
    },
    removeEventListener: (type: string, fn: Listener) => {
      windowListeners.get(type)?.delete(fn)
    },
    dispatchEvent: (ev: Event) => {
      windowListeners.get(ev.type)?.forEach(fn => fn(ev))
    },
  }
})

afterAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete (globalThis as Record<string, unknown>).window
})

// ── Chain mock helper ─────────────────────────────────────────────────────────

type CloudRow = { store_name: string; data: Record<string, unknown> }

function setupFromMock(cloudRows: CloudRow[] = []) {
  const upsertMock = vi.fn().mockResolvedValue({ error: null })
  const eqMock = vi.fn().mockResolvedValue({ data: cloudRows, error: null })
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
  vi.mocked(supabase.from).mockReturnValue({
    select: selectMock,
    upsert: upsertMock,
  } as unknown as ReturnType<typeof supabase.from>)
  return { upsertMock, selectMock, eqMock }
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: 'user-test' } },
  } as Awaited<ReturnType<typeof supabase.auth.getUser>>)

  usePlanStore.setState({ plans: {}, activePlanId: null })
  useHistoryStore.setState({ entries: [], overrides: [], extraEntries: [] })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  windowListeners.clear()
})

// ── syncOnLogin ───────────────────────────────────────────────────────────────

describe('syncOnLogin', () => {
  it('does nothing when user is not authenticated', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>)
    const { upsertMock } = setupFromMock([])

    await syncOnLogin()

    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('pushes all local stores when no cloud data exists (first login)', async () => {
    const { upsertMock } = setupFromMock([]) // empty rows = first login

    await syncOnLogin()

    // 7 stores should have been pushed
    expect(upsertMock).toHaveBeenCalledTimes(7)
    const calledNames = upsertMock.mock.calls.map(([row]) => row.store_name)
    expect(calledNames).toContain('wpt_history')
    expect(calledNames).toContain('wpt_plans')
    expect(calledNames).toContain('wpt_outcomes')
    expect(calledNames).toContain('wpt_mobility')
    expect(calledNames).toContain('wpt_settings')
  })

  it('hydrates stores from cloud data when rows exist', async () => {
    const planData = {
      plans: {
        'plan-cloud': {
          id: 'plan-cloud',
          name: 'Cloud Plan',
          status: 'inactive',
          days: [],
          duration: { type: 'rotations', value: 4 },
          startDate: '2026-01-01',
          startDayIndex: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      activePlanId: null,
    }
    setupFromMock([{ store_name: 'wpt_plans', data: planData }])

    await syncOnLogin()

    expect(usePlanStore.getState().plans['plan-cloud']?.name).toBe('Cloud Plan')
  })

  it('does not push on hydration when cloud rows exist', async () => {
    const { upsertMock } = setupFromMock([
      { store_name: 'wpt_plans', data: { plans: {}, activePlanId: null } },
    ])

    await syncOnLogin()

    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('skips rows with unknown store names gracefully', async () => {
    setupFromMock([{ store_name: 'wpt_unknown_store', data: { foo: 'bar' } }])

    // Should not throw
    await expect(syncOnLogin()).resolves.toBeUndefined()
  })

  // ── BUG-4: migration applied during cloud hydration ──────────────────────

  it('applies plan migration on cloud hydration: weightlifting → weights', async () => {
    const staleCloudData = {
      plans: {
        'p1': {
          id: 'p1',
          name: 'Legacy Plan',
          status: 'inactive',
          days: [
            {
              id: 'd1',
              label: 'Day 1',
              slots: [
                { id: 's1', type: 'weightlifting', name: 'Weightlifting' },
              ],
            },
          ],
          duration: { type: 'rotations', value: 4 },
          startDate: '2026-01-01',
          startDayIndex: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      activePlanId: null,
    }
    setupFromMock([{ store_name: 'wpt_plans', data: staleCloudData }])

    await syncOnLogin()

    const slot = usePlanStore.getState().plans['p1']?.days[0]?.slots[0]
    expect(slot?.type).toBe('weights')
    expect(slot?.name).toBe('Weights')
  })

  it('applies plan migration on cloud hydration: long_run → run + subtype long', async () => {
    const staleCloudData = {
      plans: {
        'p2': {
          id: 'p2',
          name: 'Runner Plan',
          status: 'inactive',
          days: [
            {
              id: 'd1',
              label: 'Long Day',
              slots: [{ id: 's1', type: 'long_run', name: 'Long Run' }],
            },
          ],
          duration: { type: 'weeks', value: 8 },
          startDate: '2026-01-01',
          startDayIndex: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      activePlanId: null,
    }
    setupFromMock([{ store_name: 'wpt_plans', data: staleCloudData }])

    await syncOnLogin()

    const slot = usePlanStore.getState().plans['p2']?.days[0]?.slots[0]
    expect(slot?.type).toBe('run')
    expect(slot?.subtype).toBe('long')
  })

  it('applies history migration on cloud hydration: extras without source get source=history', async () => {
    const extraWithoutSource: ExtraWorkoutEntry = {
      id: 'extra-1',
      planId: 'p1',
      calendarDate: '2026-01-01',
      workoutType: 'run',
      workoutName: 'Run',
      createdAt: '2026-01-01T00:00:00.000Z',
      // source intentionally omitted (pre-v1 record)
    }
    const historyData = {
      entries: [],
      overrides: [],
      extraEntries: [extraWithoutSource],
    }
    setupFromMock([{ store_name: 'wpt_history', data: historyData }])

    await syncOnLogin()

    const extras = useHistoryStore.getState().extraEntries
    expect(extras[0].source).toBe('history')
  })

  it('applies mobility migration on cloud hydration: adds activeSession when missing', async () => {
    const staleCloudData = {
      routine: [],
      completions: {},
      soundEnabled: true,
      // activeSession intentionally omitted (pre-v2 record)
    }
    setupFromMock([{ store_name: 'wpt_mobility', data: staleCloudData }])

    await syncOnLogin()

    expect(useMobilityStore.getState().activeSession).toBe(null)
  })

  it('does NOT overwrite an existing activeSession in v2+ cloud data', async () => {
    const liveSession = {
      date: '2026-07-17',
      exerciseIds: ['ex-1'],
      currentIdx: 0,
      completedIds: [] as string[],
      totalElapsedSec: 30,
      exElapsedSec: 30,
    }
    const v2CloudData = {
      routine: [],
      completions: {},
      soundEnabled: true,
      activeSession: liveSession,
    }
    setupFromMock([{ store_name: 'wpt_mobility', data: v2CloudData }])

    await syncOnLogin()

    expect(useMobilityStore.getState().activeSession).toEqual(liveSession)
  })
})

// ── subscribeStores ───────────────────────────────────────────────────────────

describe('subscribeStores', () => {
  it('returns an unsubscribe function', () => {
    const { upsertMock } = setupFromMock()
    vi.useFakeTimers()

    const unsub = subscribeStores()
    expect(typeof unsub).toBe('function')

    unsub()
    void upsertMock
  })

  it('debounces store changes and pushes after 1500ms', async () => {
    const { upsertMock } = setupFromMock()
    vi.useFakeTimers()

    const unsub = subscribeStores()

    // Trigger a state change in the plan store
    usePlanStore.setState({ activePlanId: null })

    // No push yet
    expect(upsertMock).not.toHaveBeenCalled()

    // Advance past the debounce window
    await vi.advanceTimersByTimeAsync(1500)

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ store_name: 'wpt_plans' }),
    )

    unsub()
  })

  it('coalesces rapid changes into a single push', async () => {
    const { upsertMock } = setupFromMock()
    vi.useFakeTimers()

    const unsub = subscribeStores()

    // Three rapid changes
    usePlanStore.setState({ activePlanId: null })
    usePlanStore.setState({ activePlanId: null })
    usePlanStore.setState({ activePlanId: null })

    await vi.advanceTimersByTimeAsync(1500)

    // Only one push for wpt_plans despite three changes
    const planPushes = upsertMock.mock.calls.filter(([r]) => r.store_name === 'wpt_plans')
    expect(planPushes.length).toBe(1)

    unsub()
  })

  it('flushes pending push immediately on beforeunload', async () => {
    const { upsertMock } = setupFromMock()
    vi.useFakeTimers()

    const unsub = subscribeStores()

    // Trigger a change — debounce timer is now pending
    usePlanStore.setState({ activePlanId: null })
    expect(upsertMock).not.toHaveBeenCalled()

    // Fire beforeunload before the 1500ms debounce expires
    window.dispatchEvent(new Event('beforeunload'))

    // pushStore is async (two awaits inside: getUserId + upsert). Flush the
    // microtask queue so the async chain completes within this test, both so
    // the assertion is correct and so no async operations bleed into the next test.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ store_name: 'wpt_plans' }),
    )

    unsub()
  })

  it('stops pushing after unsubscribe', async () => {
    const { upsertMock } = setupFromMock()
    vi.useFakeTimers()

    const unsub = subscribeStores()
    unsub()

    usePlanStore.setState({ activePlanId: null })
    await vi.advanceTimersByTimeAsync(1500)

    expect(upsertMock).not.toHaveBeenCalled()
  })
})
