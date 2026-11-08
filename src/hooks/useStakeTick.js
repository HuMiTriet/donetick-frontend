import { useEffect, useReducer } from 'react'

import { getStakeState, nextStakeChangeAt } from '../utils/stakes'

// Returns the chore's current stake state and re-renders the caller whenever
// it visibly changes: the padlock closing, the colour stepping up as the
// deadline nears, and the countdown each minute in the last day.
export const useStakeTick = chore => {
  const [, rerender] = useReducer(count => count + 1, 0)
  const now = Date.now()
  const nextAt = nextStakeChangeAt(chore, now)

  useEffect(() => {
    if (nextAt === null) return undefined
    // setTimeout overflows past ~24.8 days; wake up early and recompute
    const delay = Math.min(Math.max(nextAt - Date.now(), 0) + 50, 2 ** 31 - 1)
    const timer = setTimeout(rerender, delay)
    return () => clearTimeout(timer)
  }, [nextAt])

  return getStakeState(chore, now)
}
