import { STORES, serializeState } from './storeSync'

/**
 * Full-data backup: every synced store serialised into one JSON file that
 * can be downloaded from Settings and restored later (or on another device).
 */

export const BACKUP_FORMAT = 'workout-plan-tracker-backup'
export const BACKUP_VERSION = 1

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  stores: Record<string, Record<string, unknown>>
}

export function buildBackup(
  stores: Record<string, unknown> = Object.fromEntries(
    STORES.map(({ name, store }) => [name, serializeState(store.getState())]),
  ),
  exportedAt = new Date().toISOString(),
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    stores: stores as Record<string, Record<string, unknown>>,
  }
}

/** Parse and validate a backup file's text. Throws with a user-facing message. */
export function parseBackup(text: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  const b = parsed as Partial<BackupFile> | null
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT) {
    throw new Error('This file is not a Workout Tracker backup.')
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app. Refresh the app and try again.')
  }
  if (!b.stores || typeof b.stores !== 'object') {
    throw new Error('This backup contains no data.')
  }
  const known = new Set(STORES.map(s => s.name))
  const stores = Object.fromEntries(
    Object.entries(b.stores).filter(([name, data]) => known.has(name) && data && typeof data === 'object'),
  ) as BackupFile['stores']
  if (Object.keys(stores).length === 0) {
    throw new Error('This backup contains no data.')
  }
  return { format: BACKUP_FORMAT, version: b.version, exportedAt: String(b.exportedAt ?? ''), stores }
}

/**
 * Replace local data with the backup's. Stores missing from the backup are
 * left untouched. Each store's migration runs first so older backups load
 * into the current schema; the sync subscription then pushes the restored
 * data to the cloud.
 */
export function applyBackup(backup: BackupFile): string[] {
  const restored: string[] = []
  for (const entry of STORES) {
    const data = backup.stores[entry.name]
    if (!data) continue
    const migrated = entry.migrate ? entry.migrate(data) : data
    entry.store.setState(migrated as Record<string, unknown>)
    restored.push(entry.name)
  }
  return restored
}

export function backupFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `workout-tracker-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
