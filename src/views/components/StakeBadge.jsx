import { Lock, LockOpen } from '@mui/icons-material'
import { Chip, Tooltip } from '@mui/joy'

import { useStakeCountdown, useStakeLockText } from '../../hooks/useStakeText'
import { useStakeTick } from '../../hooks/useStakeTick'
import { formatStakeAmount, STAKE_LEVEL_COLOR } from '../../utils/stakes'
import { stakePulseSx } from '../../utils/stakeStyles'

// The money-at-stake chip: padlock (open during the edit window, closed
// after), the amount, and a countdown in the last day. Pass `state` to reuse
// a stake state the caller already ticks; otherwise the badge ticks itself.
/**
 * @param {{
 *   chore?: object | null,
 *   size?: 'sm' | 'md' | 'lg',
 *   state?: import('../../utils/stakes').StakeState | null,
 *   sx?: object,
 * }} props
 */
const StakeBadge = ({
  chore = null,
  size = 'sm',
  state: givenState = null,
  sx = {},
}) => {
  const ownState = useStakeTick(givenState ? null : chore)
  const state = givenState ?? ownState
  const countdown = useStakeCountdown(state)
  const lockText = useStakeLockText(state)
  if (!state) return null

  const color = STAKE_LEVEL_COLOR[state.level]
  const Icon = state.locked ? Lock : LockOpen
  const amount = formatStakeAmount(state.amountCents)
  const label = countdown ? `${amount} · ${countdown}` : amount

  return (
    <Tooltip title={lockText} variant='soft' arrow>
      <Chip
        size={size}
        variant='solid'
        color={color}
        startDecorator={<Icon sx={{ fontSize: size === 'sm' ? 14 : 16 }} />}
        aria-label={`${label}. ${lockText}`}
        data-testid='stake-badge'
        sx={{
          fontWeight: 'lg',
          fontVariantNumeric: 'tabular-nums',
          ...(state.level === 'critical' ? stakePulseSx(color) : {}),
          ...sx,
        }}
      >
        {label}
      </Chip>
    </Tooltip>
  )
}

export default StakeBadge
