import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  ClearChoreTimer,
  DeleteTimeSession,
  GetChoreTimer,
  PauseChore,
  ResetChoreTimer,
  StartChore,
  UpdateTimeSession,
} from '../utils/Fetcher'

const parseTimerResponse = async response => {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error || 'Request failed')
  return body
}

export const useChoreTimer = choreId => {
  return useQuery({
    queryKey: ['choreTimer', choreId],
    queryFn: async () => {
      if (!choreId) {
        throw new Error('Chore ID is required to fetch timer')
      }
      const response = await GetChoreTimer(choreId)
      if (response && response.ok) {
        return await response.json()
      }
      throw new Error('Failed to fetch chore timer')
    },
    enabled: !!choreId,
  })
}

export const useStartChore = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: choreId => StartChore(choreId).then(parseTimerResponse),
    onSuccess: (_, choreId) => {
      queryClient.invalidateQueries({ queryKey: ['choreTimer', choreId] })
      queryClient.invalidateQueries({ queryKey: ['choreDetails', choreId] })
      queryClient.invalidateQueries({ queryKey: ['chores'] })
      queryClient.invalidateQueries({ queryKey: ['choreHistory', choreId] })
    },
  })
}

export const usePauseChore = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: choreId => PauseChore(choreId).then(parseTimerResponse),
    onSuccess: (_, choreId) => {
      queryClient.invalidateQueries({ queryKey: ['choreTimer', choreId] })
      queryClient.invalidateQueries({ queryKey: ['choreDetails', choreId] })
      queryClient.invalidateQueries({ queryKey: ['chores'] })
      queryClient.invalidateQueries({ queryKey: ['choreHistory', choreId] })
    },
  })
}

export const useUpdateTimeSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ choreId, sessionData, sessionId }) =>
      UpdateTimeSession(choreId, sessionId, sessionData),
    onSuccess: (_, { choreId }) => {
      queryClient.invalidateQueries({ queryKey: ['choreTimer', choreId] })
      queryClient.invalidateQueries({ queryKey: ['chores'] })
      queryClient.invalidateQueries({ queryKey: ['choreHistory', choreId] })
    },
  })
}

export const useDeleteTimeSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ choreId, sessionId }) =>
      DeleteTimeSession(choreId, sessionId),
    onSuccess: (_, { choreId }) => {
      queryClient.invalidateQueries({ queryKey: ['choreTimer', choreId] })
      queryClient.invalidateQueries({ queryKey: ['chores'] })
      queryClient.invalidateQueries({ queryKey: ['choreHistory', choreId] })
    },
  })
}

export const useResetChoreTimer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ResetChoreTimer,
    onSuccess: (_, choreId) => {
      queryClient.invalidateQueries({ queryKey: ['choreTimer', choreId] })
      queryClient.invalidateQueries({ queryKey: ['chores'] })
      queryClient.invalidateQueries({ queryKey: ['choreHistory', choreId] })
    },
  })
}

export const useClearChoreTimer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ClearChoreTimer,
    onSuccess: (_, choreId) => {
      queryClient.invalidateQueries({ queryKey: ['choreTimer', choreId] })
      queryClient.invalidateQueries({ queryKey: ['chores'] })
      queryClient.invalidateQueries({ queryKey: ['choreHistory', choreId] })
    },
  })
}
