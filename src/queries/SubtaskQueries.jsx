import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { networkManager } from '../hooks/NetworkManager'
import { CompleteSubTask, SaveChore } from '../utils/Fetcher'

export const useUpdate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async updatedChore => {
      const resp = await SaveChore(updatedChore)
      if (!resp || !resp.ok) {
        throw new Error('Failed to save chore')
      }
      const updatedChoreRes = await resp.json()
      if (!updatedChoreRes) {
        throw new Error('Failed to get updated chore data')
      }
      // Successfully updated the chore on the server, return the updated chore
      return updatedChoreRes?.res || updatedChoreRes
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chores'] })
    },
  })
}

// Chore lists render straight from the ['chores', ...] caches, so a card that
// checks off a subtask patches them in place for instant feedback, then
// refetches once the server has settled so the list matches it again.
export const useCachedSubTasks = () => {
  const queryClient = useQueryClient()

  const setCachedSubTasks = useCallback(
    (choreId, subTasks) => {
      queryClient.setQueriesData({ queryKey: ['chores'] }, oldData => {
        if (!oldData?.res) return oldData
        return {
          ...oldData,
          res: oldData.res.map(chore =>
            chore.id === choreId ? { ...chore, subTasks } : chore,
          ),
        }
      })
    },
    [queryClient],
  )

  const refreshChores = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['chores'] }),
    [queryClient],
  )

  return { refreshChores, setCachedSubTasks }
}

export const useCompleteSubTask = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (subTaskId, choreId, completedAt) => {
      if (!networkManager.isOnline) {
        throw new Error('Cannot complete subtask while offline')
      }
      const resp = await CompleteSubTask(subTaskId, choreId, completedAt)
      if (!resp || !resp.ok) {
        throw new Error('Failed to complete subtask')
      }
      const result = await resp.json()
      if (!result || !result.res) {
        throw new Error('Failed to get completed subtask data')
      }
      return result.res
    },
    onSuccess: (data, variables) => {},
  })
}
