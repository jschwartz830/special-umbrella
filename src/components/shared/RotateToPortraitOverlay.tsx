import { Smartphone } from 'lucide-react'

/**
 * Covers the screen when a phone is held sideways (the `ls` screen) on views
 * that only support portrait. iOS web apps can't lock orientation, so this is
 * the closest thing to a portrait lock. Pure CSS — renders nothing visible
 * outside landscape-phone viewports.
 */
export function RotateToPortraitOverlay() {
  return (
    <div className="hidden ls:flex fixed inset-0 z-[70] bg-slate-900 flex-col items-center justify-center gap-3 text-center px-6">
      <Smartphone size={36} className="text-slate-400" />
      <p className="text-base font-semibold text-white">Rotate to portrait</p>
      <p className="text-sm text-slate-500">This view is portrait-only. Landscape can be enabled for focus mode in Settings.</p>
    </div>
  )
}
