/**
 * Completion sound and confetti burst for finished tasks. The confetti comes
 * from party-js, imported lazily so it stays out of the initial chunk, and
 * every call is a no-op if it fails to load. party-js already skips the effect
 * for users who prefer reduced motion. The sound plays regardless, and is
 * silently dropped if the browser blocks playback.
 */

import completeSoundUrl from '@/assets/complete-sound.mp3'

// One shared element so repeat completions don't re-fetch the file.
let completeSound = null

const playCompleteSound = () => {
  try {
    if (!completeSound) completeSound = new Audio(completeSoundUrl)
    completeSound.currentTime = 0
    completeSound.play().catch(() => {})
  } catch {
    // sound is decoration too
  }
}

// Completions resolve after an API round-trip, by which time the click event
// is gone, so remember where the user last pressed and burst from there.
const POINTER_FRESH_MS = 5000
let lastPointer = null

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    event => {
      lastPointer = { x: event.clientX, y: event.clientY, at: Date.now() }
    },
    { capture: true, passive: true },
  )
}

export const celebrate = async () => {
  playCompleteSound()
  try {
    const party = await import('party-js')
    const fresh = lastPointer && Date.now() - lastPointer.at < POINTER_FRESH_MS
    const x = fresh ? lastPointer.x : window.innerWidth / 2
    const y = fresh ? lastPointer.y : window.innerHeight / 2
    party.confetti(new party.Circle(window.scrollX + x, window.scrollY + y), {
      count: party.variation.range(80, 100),
    })
  } catch {
    // confetti is decoration; never let it break a completion
  }
}
