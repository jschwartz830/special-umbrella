import { useRef, useState } from 'react'
import { Download, Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'

interface Props {
  exportLabel?: string
  importLabel?: string
  onExport: () => void
  /** Parse the file; return a human-readable result to show in the confirmation modal. */
  onImport: (file: File) => Promise<ImportResult>
  canExport: boolean
}

export interface ImportResult {
  summary: string
  warnings: string[]
}

export function CsvToolbar({
  exportLabel = 'Export CSV',
  importLabel = 'Import CSV',
  onExport,
  onImport,
  canExport,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const res = await onImport(file)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={onExport}
          disabled={!canExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs font-medium transition-colors"
        >
          <Download size={13} /> {exportLabel}
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-xs font-medium transition-colors"
        >
          <Upload size={13} /> {busy ? 'Importing…' : importLabel}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {result && (
        <Modal
          title="Import complete"
          onClose={() => setResult(null)}
          footer={
            <button
              onClick={() => setResult(null)}
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors"
            >
              Done
            </button>
          }
        >
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-emerald-400">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <p>{result.summary}</p>
            </div>
            {result.warnings.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-400 font-medium mb-1.5 flex items-center gap-1">
                  <AlertTriangle size={12} /> {result.warnings.length} warning{result.warnings.length === 1 ? '' : 's'}
                </p>
                <ul className="text-xs text-slate-400 space-y-1 max-h-60 overflow-y-auto">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="leading-snug">· {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Modal>
      )}

      {error && (
        <Modal title="Import failed" onClose={() => setError(null)}>
          <p className="text-sm text-slate-300">{error}</p>
        </Modal>
      )}
    </>
  )
}
