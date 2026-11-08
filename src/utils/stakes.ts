// Beeminder stakes on chores: lock state, urgency, and the smart-order boost.
// Pure functions with no imports, so they run anywhere (and in Node tests).

export type ChoreStake = {
  amountCents: number
  // When the edit window closes. Missing on a chore that was just created
  // offline and hasn't come back from the server yet.
  editableUntil?: string | null
}

type StakedChoreLike = {
  stake?: ChoreStake | null
  nextDueDate?: string | null
}

// staked: more than a day left; urgent: a day or less; critical: six hours
// or less, or overdue.
export type StakeLevel = 'staked' | 'urgent' | 'critical'

export type StakeState = {
  amountCents: number
  editableUntil: Date | null
  // Past the edit window: the chore can't be edited, deleted or archived.
  locked: boolean
  // Hours until the due date (negative when overdue), null without one.
  hoursLeft: number | null
  overdue: boolean
  // 0 far from the deadline, rising to 1 at the deadline.
  urgency: number
  level: StakeLevel
}

const HOUR_MS = 3_600_000

// Tunables for how staked chores climb the smart order. A staked chore gets
// `floor` priority levels of boost however far off its deadline is, plus up
// to `max` more as the deadline approaches over the last `horizonHours`. The
// approach is squared, so the climb is slow at first and fast near the end.
export const STAKE_RANK = { floor: 0.5, max: 4, horizonHours: 72 } as const

// Hours left at which a stake turns urgent, then critical.
export const STAKE_LEVEL_HOURS = { urgent: 24, critical: 6 } as const

// Joy color for each level.
export const STAKE_LEVEL_COLOR: Record<StakeLevel, 'warning' | 'danger'> = {
  staked: 'warning',
  urgent: 'danger',
  critical: 'danger',
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const formatStakeAmount = (cents: number): string =>
  `$${(cents / 100).toFixed(2)}`

export const getStakeState = (
  chore: StakedChoreLike | null | undefined,
  now: number = Date.now(),
): StakeState | null => {
  const stake = chore?.stake
  if (!stake || !stake.amountCents) return null

  const editableUntil = stake.editableUntil
    ? new Date(stake.editableUntil)
    : null
  const locked = editableUntil ? now >= editableUntil.getTime() : false

  const due = chore?.nextDueDate ? new Date(chore.nextDueDate).getTime() : null
  const hoursLeft = due === null ? null : (due - now) / HOUR_MS
  const overdue = hoursLeft !== null && hoursLeft <= 0

  let urgency = 0
  if (overdue) urgency = 1
  else if (hoursLeft !== null)
    urgency = clamp(1 - hoursLeft / STAKE_RANK.horizonHours, 0, 1)

  let level: StakeLevel = 'staked'
  if (
    overdue ||
    (hoursLeft !== null && hoursLeft <= STAKE_LEVEL_HOURS.critical)
  )
    level = 'critical'
  else if (hoursLeft !== null && hoursLeft <= STAKE_LEVEL_HOURS.urgent)
    level = 'urgent'

  return {
    amountCents: stake.amountCents,
    editableUntil,
    locked,
    hoursLeft,
    overdue,
    urgency,
    level,
  }
}

export const isStakeLocked = (
  chore: StakedChoreLike | null | undefined,
  now: number = Date.now(),
): boolean => getStakeState(chore, now)?.locked ?? false

// How many priority levels a staked chore is lifted in the smart order.
// Priority indexes run P1 = 0 … P4 = 3, none = 4, lower first, so the boost
// is subtracted from the index.
export const stakeRankBoost = (
  chore: StakedChoreLike | null | undefined,
  now: number = Date.now(),
): number => {
  const state = getStakeState(chore, now)
  if (!state) return 0
  return STAKE_RANK.floor + STAKE_RANK.max * state.urgency ** 2
}

// The next moment a staked chore's badge needs to re-render: when the edit
// window closes, when it turns urgent or critical, when it goes overdue, and
// every minute while a countdown is showing. Null when nothing will change.
export const nextStakeChangeAt = (
  chore: StakedChoreLike | null | undefined,
  now: number = Date.now(),
): number | null => {
  const state = getStakeState(chore, now)
  if (!state) return null

  const candidates: number[] = []
  if (state.editableUntil && !state.locked) {
    candidates.push(state.editableUntil.getTime())
  }
  if (state.hoursLeft !== null && !state.overdue) {
    const due = now + state.hoursLeft * HOUR_MS
    candidates.push(
      due - STAKE_LEVEL_HOURS.urgent * HOUR_MS,
      due - STAKE_LEVEL_HOURS.critical * HOUR_MS,
      due,
    )
    if (state.hoursLeft <= STAKE_LEVEL_HOURS.urgent) {
      candidates.push(now + 60_000)
    }
  }
  const upcoming = candidates.filter(time => time > now)
  return upcoming.length ? Math.min(...upcoming) : null
}

// Splits a duration into the single largest whole unit, for short countdowns
// like "3h" or "2d".
export const timeLeftParts = (
  ms: number,
): { value: number; unit: 'd' | 'h' | 'm' } => {
  const minutes = Math.max(1, Math.ceil(ms / 60_000))
  if (minutes < 60) return { value: minutes, unit: 'm' }
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return { value: hours, unit: 'h' }
  return { value: Math.floor(hours / 24), unit: 'd' }
}
