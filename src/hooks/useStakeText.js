import { useTranslation } from 'react-i18next'

import { STAKE_LEVEL_HOURS, timeLeftParts } from '../utils/stakes'

const HOUR_MS = 3_600_000

// Short "3h left" / "overdue" text for stakes inside their last day, else null.
export const useStakeCountdown = state => {
  const { t } = useTranslation('chores')
  if (!state || state.hoursLeft === null) return null
  if (state.overdue) return t('stake.overdue')
  if (state.hoursLeft > STAKE_LEVEL_HOURS.urgent) return null
  const { unit, value } = timeLeftParts(state.hoursLeft * HOUR_MS)
  return t(`stake.left.${unit}`, { count: value })
}

// What the padlock means right now, for tooltips and banners.
export const useStakeLockText = state => {
  const { t } = useTranslation('chores')
  if (!state) return ''
  if (state.locked) return t('stake.lockedHint')
  if (!state.editableUntil) return t('stake.editableHintSoon')
  const { unit, value } = timeLeftParts(
    state.editableUntil.getTime() - Date.now(),
  )
  return t('stake.editableHint', {
    time: t(`stake.duration.${unit}`, { count: value }),
  })
}
