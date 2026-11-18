import { useLocation } from 'react-router-dom'

export type ReturnState = { returnTo: string }

export const useReturnTo = () => {
  const location = useLocation()
  const value = (location.state as { returnTo?: unknown } | null)?.returnTo
  const returnTo =
    typeof value === 'string' && value.startsWith('/') ? value : undefined
  const returnState: ReturnState | undefined = returnTo
    ? { returnTo }
    : undefined
  return { returnState, returnTo }
}
