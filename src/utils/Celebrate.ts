/**
 * Completion sound and confetti burst for finished tasks. party-js already
 * skips the effect for users who prefer reduced motion. The sound plays
 * regardless, and is silently dropped if the browser blocks playback.
 */

import { confetti, range } from 'party-js'

import completeSoundUrl from '@/assets/complete-sound.mp3'
import type { Chore } from '@/types/models'

type PointerSnapshot = {
  x: number
  y: number
  at: number
}

let completeSound: HTMLAudioElement | null = null

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

export const celebrateTask = async (
  chore: Partial<Pick<Chore, 'priority' | 'subTasks'>>,
  isSubtask = false,
): Promise<void> => {
  try {
    completeSound ??= new Audio(completeSoundUrl)
    completeSound.currentTime = 0
    completeSound.play().catch(() => {})
  } catch {
    completeSound = null
  }
  if (isSubtask) return
  const priority = chore.priority ?? 0
  const priority_weight = priority >= 1 && priority <= 4 ? 4 + 1 - priority : 1
  const subtasks = chore.subTasks?.length ?? 0
  const confetti_count = 30 * priority_weight + subtasks * 20

  try {
    const pointer =
      lastPointer && Date.now() - lastPointer.at < POINTER_FRESH_MS
        ? lastPointer
        : null
    const x = pointer ? pointer.x : window.innerWidth / 2
    const y = pointer ? pointer.y : window.innerHeight / 2
    confetti(
      { x: window.scrollX + x, y: window.scrollY + y },
      { count: range(confetti_count - 5, confetti_count + 5) },
    )
  } catch {
    // confetti is decoration; never let it break a completion
  }
}
