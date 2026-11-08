import { useQuery } from '@tanstack/react-query'

import { GetBeeminderAccount } from '../utils/Fetcher'
import { useResource } from './ResourceQueries'

export const BEEMINDER_ACCOUNT_KEY = ['beeminder', 'account']

// The linked Beeminder account, or null when none is linked or the server has
// Beeminder turned off. Used to decide whether a stake can be placed.
export const useBeeminderAccount = () => {
  const { data: resource } = useResource()
  const enabled = Boolean(resource?.beeminder_enabled)
  const query = useQuery({
    queryKey: BEEMINDER_ACCOUNT_KEY,
    queryFn: async () => {
      const response = await GetBeeminderAccount()
      if (!response?.ok) return null
      const { res } = await response.json()
      return res ?? null
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  })
  return {
    // Beeminder is turned on for this server.
    enabled,
    account: enabled ? (query.data ?? null) : null,
    isLoading: enabled && query.isLoading,
  }
}
