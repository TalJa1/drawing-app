import confetti from 'canvas-confetti'

const PIGMENTS = ['#E4572E', '#F2A93B', '#2E8B6F', '#2F80C4', '#C93C6B', '#D4AF37']
const GOLD = ['#D4AF37', '#F1D47A', '#FFF1B8', '#9C7C17', '#F2A93B']

function reduced(): boolean {
  const m = document.documentElement.dataset.motion
  if (m === 'reduce') return true
  if (m === 'full') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** A pigment burst from a point (0–1 viewport coords). */
export function burst(x = 0.5, y = 0.5, gold = false): void {
  if (reduced()) return
  void confetti({
    particleCount: gold ? 140 : 90,
    spread: 80,
    startVelocity: 42,
    origin: { x, y },
    colors: gold ? GOLD : PIGMENTS,
    scalar: 1.05,
    zIndex: 200,
    disableForReducedMotion: true,
  })
}

/** The big golden "masterpiece" celebration: side cannons + paint drops. */
export function celebrate(): void {
  if (reduced()) return
  const end = Date.now() + 1400
  const frame = () => {
    void confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: GOLD, zIndex: 200 })
    void confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: GOLD, zIndex: 200 })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
  setTimeout(() => burst(0.5, 0.35, true), 250)
}
