import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PAYWALL_REASON, usePaywall } from '../../contexts/PaywallContext'
import { useUpdateChore } from '../../queries/ChoreQueries'
import { useNotification } from '../../service/NotificationProvider'
import type { Chore } from '../../types/models'
import { GetChoreByID } from '../../utils/Fetcher'
import type { RemoveBlock, SaveBlock } from './TimeBlockCalendar'
import type { PlannerChore } from './timeBlocks'
import { withBlockAt, withoutBlock } from './timeBlocks'

type ChoresData = { res?: Chore[] } | undefined

type SavedChore = PlannerChore & { _pendingUpdate?: boolean }

type Notify = (notification: {
  message?: string
  title?: string
  undoAction?: () => Promise<void>
}) => void

const ACTIVE_CHORES_KEY = ['chores', false]

export const useTimeBlockActions = () => {
  const { t } = useTranslation('chores')
  const queryClient = useQueryClient()
  const { isPlus, showPaywall } = usePaywall() as {
    isPlus: boolean
    showPaywall: (reason: string) => void
  }
  const { mutateAsync: updateChore } = useUpdateChore() as unknown as {
    mutateAsync: (chore: PlannerChore) => Promise<SavedChore>
  }
  const { showError, showSuccess } = useNotification() as {
    showError: Notify
    showSuccess: Notify
  }

  const queues = useRef(new Map<number, Promise<void>>())
  const usedUpdatedAt = useRef(new Map<number, string>())

  const replaceChore = useCallback(
    (next: Chore) => {
      queryClient.setQueryData<ChoresData>(ACTIVE_CHORES_KEY, old =>
        old?.res
          ? { ...old, res: old.res.map(c => (c.id === next.id ? next : c)) }
          : old,
      )
    },
    [queryClient],
  )

  const showOptimistic = useCallback(
    async (next: Chore) => {
      await queryClient.cancelQueries({ queryKey: ['chores'] })
      replaceChore(next)
    },
    [queryClient, replaceChore],
  )

  const latestOf = useCallback(
    (chore: PlannerChore): PlannerChore =>
      queryClient
        .getQueryData<ChoresData>(ACTIVE_CHORES_KEY)
        ?.res?.find(c => c.id === chore.id) ?? chore,
    [queryClient],
  )

  const freshUpdatedAt = useCallback(async (chore: PlannerChore) => {
    const used = usedUpdatedAt.current.get(chore.id)
    if (
      used === undefined ||
      new Date(chore.updatedAt).getTime() > new Date(used).getTime()
    ) {
      return chore.updatedAt
    }
    try {
      const response = (await GetChoreByID(chore.id)) as Response
      if (!response.ok) return chore.updatedAt
      const body = (await response.json()) as { res?: Chore }
      return body.res?.updatedAt ?? chore.updatedAt
    } catch {
      return chore.updatedAt
    }
  }, [])

  const persist = useCallback(
    (next: PlannerChore): Promise<SavedChore> => {
      const run = async () => {
        const payload = { ...next, updatedAt: await freshUpdatedAt(next) }
        const saved = await updateChore({
          ...payload,
          labelsV2: payload.labelsV2 ?? [],
        })
        if (!saved?._pendingUpdate) {
          usedUpdatedAt.current.set(next.id, payload.updatedAt)
        }
        return saved
      }
      const previous = queues.current.get(next.id) ?? Promise.resolve()
      const result = previous.then(run)
      const tail = result.then(
        () => undefined,
        () => undefined,
      )
      queues.current.set(next.id, tail)
      void tail.then(() => {
        if (queues.current.get(next.id) === tail) queues.current.delete(next.id)
      })
      return result
    },
    [freshUpdatedAt, updateChore],
  )

  const showFailure = useCallback(
    () =>
      showError({
        title: t('actions.failRescheduleTitle'),
        message: t('actions.failRescheduleMessage'),
      }),
    [showError, t],
  )

  const saveBlock: SaveBlock = useCallback(
    async (
      chore: PlannerChore,
      end: Date,
      seconds: number,
      index?: number,
      revert?: () => void,
    ) => {
      if (!isPlus) {
        revert?.()
        showPaywall(PAYWALL_REASON.ADVANCED_REMINDERS)
        return
      }
      const base = latestOf(chore)
      const updated = withBlockAt(base, end, seconds, index)
      if (!updated) {
        revert?.()
        showError({ message: t('planner.mustEndBeforeDue') })
        return
      }

      await showOptimistic(updated)
      try {
        const saved = await persist(updated)
        if (saved?._pendingUpdate) {
          showSuccess({ message: t('planner.offlineSaved') })
        }
      } catch {
        replaceChore(base)
        revert?.()
        showFailure()
      }
    },
    [
      isPlus,
      latestOf,
      persist,
      replaceChore,
      showError,
      showFailure,
      showOptimistic,
      showPaywall,
      showSuccess,
      t,
    ],
  )

  const removeBlock: RemoveBlock = useCallback(
    async (chore: PlannerChore, index: number) => {
      const base = latestOf(chore)
      const updated = withoutBlock(base, index)

      await showOptimistic(updated)
      try {
        const saved = await persist(updated)
        showSuccess({
          message: saved?._pendingUpdate
            ? t('planner.offlineSaved')
            : t('planner.blockRemoved'),
          undoAction: async () => {
            const beforeUndo = latestOf(chore)
            const restored: PlannerChore = {
              ...beforeUndo,
              notification: base.notification,
              notificationMetadata: base.notificationMetadata,
            }
            await showOptimistic(restored)
            try {
              await persist(restored)
            } catch {
              replaceChore(beforeUndo)
              showFailure()
            }
          },
        })
      } catch {
        replaceChore(base)
        showFailure()
      }
    },
    [
      latestOf,
      persist,
      replaceChore,
      showFailure,
      showOptimistic,
      showSuccess,
      t,
    ],
  )

  return { removeBlock, saveBlock }
}
