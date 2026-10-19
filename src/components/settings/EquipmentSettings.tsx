import { useState } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import type { EquipmentLocation, EquipmentProfile } from '../../lib/equipment'

const LOCATIONS: { value: EquipmentLocation; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'gym', label: 'Gym' },
]

const inputCls = 'w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white'

function NumField({ label, value, step = 1, onChange }: {
  label: string
  value: number
  step?: number
  onChange: (n: number) => void
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value}
        onChange={e => {
          const n = parseFloat(e.target.value)
          if (Number.isFinite(n) && n >= 0) onChange(n)
        }}
        className={inputCls}
      />
    </label>
  )
}

/** Per-location equipment: drives which weights are pre-filled, stepped, and used for warmups. */
export function EquipmentSettings() {
  const { equipment, setEquipment, defaultEquipmentLocation, setDefaultEquipmentLocation } = useSettingsStore()
  const [location, setLocation] = useState<EquipmentLocation>(defaultEquipmentLocation)
  const profile = equipment[location]
  const patch = (p: Partial<EquipmentProfile>) => setEquipment(location, p)

  function setPlatePairs(weight: number, pairs: number) {
    patch({ plates: profile.plates.map(pl => (pl.weight === weight ? { ...pl, pairs } : pl)) })
  }

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
      active
        ? 'bg-sky-500 border-sky-500 text-slate-950'
        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
    }`

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
      <div>
        <h2 className="font-medium">Equipment</h2>
        <p className="text-sm text-slate-400 mt-1">
          Pre-filled weights, warmups, and the +/− buttons only use weights this equipment can actually load.
        </p>
      </div>

      <div className="flex gap-2">
        {LOCATIONS.map(l => (
          <button key={l.value} type="button" onClick={() => setLocation(l.value)} className={tabCls(location === l.value)}>
            {l.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumField label="Barbell (lb)" value={profile.barWeight} step={5} onChange={n => patch({ barWeight: n })} />
        <NumField label="EZ bar (lb)" value={profile.ezBarWeight} step={5} onChange={n => patch({ ezBarWeight: n })} />
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-400">Plates — pairs owned (0 = don't have)</p>
        <div className="grid grid-cols-4 gap-2">
          {profile.plates.map(pl => (
            <NumField key={pl.weight} label={`${pl.weight} lb`} value={pl.pairs} onChange={n => setPlatePairs(pl.weight, Math.floor(n))} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-400">Dumbbells (lb, each)</p>
        <div className="grid grid-cols-3 gap-2">
          <NumField label="Lightest" value={profile.dumbbellMin} onChange={n => patch({ dumbbellMin: n })} />
          <NumField label="Heaviest" value={profile.dumbbellMax} onChange={n => patch({ dumbbellMax: n })} />
          <NumField label="Jump" value={profile.dumbbellStep} step={2.5} onChange={n => patch({ dumbbellStep: n })} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-400">Cable / machine stack (lb)</p>
        <div className="grid grid-cols-3 gap-2">
          <NumField label="Lightest" value={profile.stackMin} onChange={n => patch({ stackMin: n })} />
          <NumField label="Heaviest" value={profile.stackMax} onChange={n => patch({ stackMax: n })} />
          <NumField label="Jump" value={profile.stackStep} step={2.5} onChange={n => patch({ stackStep: n })} />
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <p className="text-xs text-slate-400">Use for workouts with no location set</p>
        <div className="flex gap-2">
          {LOCATIONS.map(l => (
            <button
              key={l.value}
              type="button"
              onClick={() => setDefaultEquipmentLocation(l.value)}
              className={tabCls(defaultEquipmentLocation === l.value)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
