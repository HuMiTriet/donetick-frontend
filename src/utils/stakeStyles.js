import { STAKE_LEVEL_COLOR } from './stakes'

// Slow pulsing ring for stakes in their last hours. Turned off for people
// who ask for reduced motion.
export const stakePulseSx = color => {
  const ring = alpha =>
    `rgba(var(--joy-palette-${color}-mainChannel) / ${alpha})`
  return {
    '@keyframes dt-stake-pulse': {
      '0%': { boxShadow: `0 0 0 0 ${ring(0.55)}` },
      '70%': { boxShadow: `0 0 0 8px ${ring(0)}` },
      '100%': { boxShadow: `0 0 0 0 ${ring(0)}` },
    },
    animation: 'dt-stake-pulse 2s ease-out infinite',
    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  }
}

// Card styling that makes a staked chore stand out, stronger as its deadline
// nears: a coloured border and tint, pulsing at the critical level.
export const stakeAccentSx = state => {
  if (!state) return {}
  const color = STAKE_LEVEL_COLOR[state.level]
  const strong = state.level !== 'staked'
  const base = {
    borderColor: `${color}.${strong ? 500 : 300}`,
    borderWidth: strong ? 2 : 1,
    backgroundColor: `${color}.softBg`,
    '&:hover': { borderColor: `${color}.600` },
  }
  return state.level === 'critical' ? { ...base, ...stakePulseSx(color) } : base
}
