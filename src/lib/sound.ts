import { useSettings } from '@/store/settings'

let ctx: AudioContext | null = null

/** Tiny synthesized chimes (no audio files). Off unless enabled in settings. */
export function playChime(kind: 'badge' | 'level' | 'masterpiece' | 'tap' = 'badge'): void {
  if (!useSettings.getState().sound) return
  try {
    ctx ??= new AudioContext()
    const notes =
      kind === 'masterpiece'
        ? [523.25, 659.25, 783.99, 1046.5]
        : kind === 'level'
          ? [392, 523.25, 659.25]
          : kind === 'tap'
            ? [880]
            : [659.25, 987.77]
    const t0 = ctx.currentTime
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator()
      const g = ctx!.createGain()
      o.type = 'triangle'
      o.frequency.value = f
      const start = t0 + i * 0.11
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(0.12, start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.6)
      o.connect(g).connect(ctx!.destination)
      o.start(start)
      o.stop(start + 0.65)
    })
  } catch {
    // Audio not available — stay silent.
  }
}
