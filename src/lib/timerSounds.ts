// Lightweight Web Audio cues for the mobility timer.
//
// Uses short scheduled oscillator tones (same technique as the workout rest
// timer in ActiveWorkoutTracker) so no audio assets need to ship. All entry
// points are no-ops when the Web Audio API is unavailable, so callers don't
// need to guard for unsupported environments.

let sharedContext: AudioContext | null = null

// Lazily create (and resume) a single shared AudioContext. Must first be called
// from within a user gesture — e.g. tapping "Start" — or iOS Safari keeps it
// suspended and the scheduled tones never play.
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextCtor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return null
  if (!sharedContext) sharedContext = new AudioContextCtor()
  if (sharedContext.state === 'suspended') void sharedContext.resume()
  return sharedContext
}

// Warm the AudioContext from a user gesture so later scheduled cues can fire.
export function primeAudio(): void {
  getAudioContext()
}

function scheduleTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  peakGain: number,
  type: OscillatorType = 'sine',
): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.03)
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(pattern) } catch { /* unsupported / blocked */ }
  }
}

// Rising three-note chime — an exercise timer has run out, advancing to the next.
export function playExerciseEndSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime + 0.02
  scheduleTone(ctx, 660, now, 0.16, 0.4)
  scheduleTone(ctx, 880, now + 0.15, 0.16, 0.4)
  scheduleTone(ctx, 1174.7, now + 0.30, 0.26, 0.4)
  vibrate(180)
}

// Two quick equal beeps — halfway through a bilateral exercise, time to switch sides.
// Deliberately different in shape from the end chime so it's unmistakable mid-set.
export function playSwitchSidesSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime + 0.02
  scheduleTone(ctx, 784, now, 0.11, 0.42, 'triangle')
  scheduleTone(ctx, 784, now + 0.19, 0.11, 0.42, 'triangle')
  vibrate([90, 60, 90])
}

// Four-note ascending flourish — the whole routine is finished.
export function playSessionCompleteSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime + 0.02
  scheduleTone(ctx, 659.3, now, 0.16, 0.4)
  scheduleTone(ctx, 784, now + 0.15, 0.16, 0.4)
  scheduleTone(ctx, 987.8, now + 0.30, 0.16, 0.4)
  scheduleTone(ctx, 1318.5, now + 0.45, 0.34, 0.4)
  vibrate([120, 60, 120, 60, 200])
}
