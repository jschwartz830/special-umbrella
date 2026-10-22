import { create } from 'zustand'

/**
 * Live (non-persisted) cloud-sync status, written by lib/storeSync.ts and
 * shown in Settings.
 *
 * - `idle`     — sync has not run yet this session
 * - `syncing`  — a pull or push is in flight
 * - `synced`   — every local change has been saved to the cloud
 * - `pending`  — local changes are waiting to be pushed (debounce window)
 * - `offline`  — a push or pull failed while the device was offline; it will retry
 * - `error`    — a push or pull failed while online; it will retry
 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error'

interface SyncStatusState {
  status: SyncStatus
  lastSyncedAt: string | null
  lastError: string | null
  /** ISO time a conflict backup was saved (see storeSync conflict handling). */
  conflictBackupAt: string | null
}

export const useSyncStatusStore = create<SyncStatusState>()(() => ({
  status: 'idle',
  lastSyncedAt: null,
  lastError: null,
  conflictBackupAt: null,
}))
