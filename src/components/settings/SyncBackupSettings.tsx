import { useRef, useState } from 'react'
import { Download, Upload, CloudOff, Cloud, AlertTriangle, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Modal } from '../shared/Modal'
import { useSyncStatusStore, type SyncStatus } from '../../store/syncStatusStore'
import { getConflictBackup, clearConflictBackup } from '../../lib/storeSync'
import {
  applyBackup, backupFilename, buildBackup, downloadJson, parseBackup, type BackupFile,
} from '../../lib/backup'

const STATUS_COPY: Record<SyncStatus, { label: string; tone: string }> = {
  idle: { label: 'Connecting…', tone: 'text-slate-400' },
  syncing: { label: 'Syncing…', tone: 'text-sky-300' },
  synced: { label: 'All changes saved to the cloud', tone: 'text-emerald-400' },
  pending: { label: 'Saving changes…', tone: 'text-sky-300' },
  offline: { label: 'Offline — changes are saved on this device and will sync when you reconnect', tone: 'text-amber-300' },
  error: { label: 'Sync failed — retrying automatically', tone: 'text-red-400' },
}

export function SyncBackupSettings() {
  const { status, lastSyncedAt, lastError, conflictBackupAt } = useSyncStatusStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingRestore, setPendingRestore] = useState<BackupFile | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  // The conflict backup lives in localStorage; also check it directly so it
  // shows after a reload, not just in the session it was created.
  const [hasConflictBackup, setHasConflictBackup] = useState(() => getConflictBackup() !== null)
  const showConflict = hasConflictBackup || conflictBackupAt !== null

  const copy = STATUS_COPY[status]
  const StatusIcon = status === 'offline' ? CloudOff : status === 'error' ? AlertTriangle : status === 'synced' ? Cloud : RefreshCw

  const handleExport = () => {
    downloadJson(backupFilename(), buildBackup())
    setMessage({ text: 'Backup downloaded.' })
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setPendingRestore(parseBackup(await file.text()))
      setMessage(null)
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Could not read that file.', error: true })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const confirmRestore = () => {
    if (!pendingRestore) return
    // Safety net: download what's here now before it's replaced.
    downloadJson(backupFilename().replace('.json', '-before-restore.json'), buildBackup())
    applyBackup(pendingRestore)
    setPendingRestore(null)
    setMessage({ text: 'Backup restored.' })
  }

  const downloadConflict = () => {
    const conflict = getConflictBackup()
    if (!conflict) return
    downloadJson(backupFilename().replace('.json', '-sync-conflict.json'), buildBackup(conflict.stores, conflict.savedAt))
  }

  const dismissConflict = () => {
    clearConflictBackup()
    setHasConflictBackup(false)
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <h2 className="font-medium">Sync &amp; backup</h2>

      <div className={`flex items-start gap-2 text-sm ${copy.tone}`} role="status">
        <StatusIcon size={16} className="mt-0.5 flex-shrink-0" />
        <div>
          <p>{copy.label}</p>
          {lastSyncedAt && (
            <p className="text-xs text-slate-500 mt-0.5">
              Last synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
            </p>
          )}
          {status === 'error' && lastError && <p className="text-xs text-slate-500 mt-0.5">{lastError}</p>}
        </div>
      </div>

      {showConflict && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-sm">
          <p className="text-amber-200">
            This device and another one both changed your data before syncing. The newest changes were kept,
            and a copy of the other version was saved.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={downloadConflict}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
            >
              Download saved copy
            </button>
            <button
              type="button"
              onClick={dismissConflict}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <p className="text-sm text-slate-400">
        Download all your plans, history and settings as a file, or restore from one.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-600"
        >
          <Download size={16} />
          Export
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-600"
        >
          <Upload size={16} />
          Restore
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
      {message && (
        <p className={`text-sm ${message.error ? 'text-red-400' : 'text-emerald-400'}`} role={message.error ? 'alert' : undefined}>
          {message.text}
        </p>
      )}

      {pendingRestore && (
        <Modal
          title="Restore backup?"
          onClose={() => setPendingRestore(null)}
          footer={
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestore}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Replace my data
              </button>
            </div>
          }
        >
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              This replaces the data on this device and in the cloud with the backup
              {pendingRestore.exportedAt && !Number.isNaN(Date.parse(pendingRestore.exportedAt))
                ? ` from ${new Date(pendingRestore.exportedAt).toLocaleString()}`
                : ''}.
            </p>
            <p className="text-slate-400">A copy of your current data will be downloaded first, just in case.</p>
          </div>
        </Modal>
      )}
    </section>
  )
}
