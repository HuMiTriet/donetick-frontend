/**
 * Completion sound and confetti burst for finished tasks. The confetti comes
 * from party-js, imported lazily so it stays out of the initial chunk, and
 * every call is a no-op if it fails to load. party-js already skips the effect
 * for users who prefer reduced motion. The sound plays regardless, and is
 * silently dropped if the browser blocks playback.
 */

import completeSoundUrl from '@/assets/complete-sound.mp3'

type PointerSnapshot = {
  x: number
  y: number
  at: number
}

let completeSound: HTMLAudioElement | null = null

const playCompleteSound = (): void => {
  try {
    completeSound ??= new Audio(completeSoundUrl)
    completeSound.currentTime = 0
    completeSound.play().catch(() => {})
  } catch {}
}

const POINTER_FRESH_MS = 5000
let lastPointer: PointerSnapshot | null = null

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    event => {
      lastPointer = { x: event.clientX, y: event.clientY, at: Date.now() }
    },
    { capture: true, passive: true },
  )
}

export const celebrate = async (): Promise<void> => {
  playCompleteSound()
  try {
    const party = await import('party-js')
    const pointer =
      lastPointer && Date.now() - lastPointer.at < POINTER_FRESH_MS
        ? lastPointer
        : null
    const x = pointer ? pointer.x : window.innerWidth / 2
    const y = pointer ? pointer.y : window.innerHeight / 2
    party.confetti(new party.Circle(window.scrollX + x, window.scrollY + y), {
      count: party.variation.range(80, 100),
    })
  } catch {
    // confetti is decoration; never let it break a completion
  }
}
