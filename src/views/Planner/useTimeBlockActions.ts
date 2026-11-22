import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PAYWALL_REASON, usePaywall } from '../../contexts/PaywallContext'
import { useUpdateChore } from '../../queries/ChoreQueries'
import { useNotification } from '../../service/NotificationProvider'
import type { Chore } from '../../types/models'
import { GetChoreByID } from '../../utils/Fetcher'
import type { RemoveBlock, SaveBlocks } from './TimeBlockCalendar'
import type { BlockEventProps, PlannerChore } from './timeBlocks'
import {
  choreToEvents,
  endsPastDue,
  isOverDue,
  withBlockAt,
  withoutBlock,
} from './timeBlocks'

type ChoresData = { res?: Chore[] } | undefined

type SavedChore = PlannerChore & { _pendingUpdate?: boolean }

type Notify = (notification: {
  message?: string
  title?: string
  undoAction?: () => Promise<void>
}) => void

const ACTIVE_CHORES_KEY = ['chores', false]

const blockIndexAt = (chore: PlannerChore, start?: Date) => {
  if (!start) return undefined
  const block = choreToEvents(chore).find(
    event => (event.start as Date).getTime() === start.getTime(),
  )
  return (block?.extendedProps as BlockEventProps | undefined)?.templateIndex
}

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
  const { showError, showSuccess, showWarning } = useNotification() as {
    showError: Notify
    showSuccess: Notify
    showWarning: Notify
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

  const saveBlocks: SaveBlocks = useCallback(
    async (moves, revert) => {
      if (!isPlus) {
        revert?.()
        showPaywall(PAYWALL_REASON.ADVANCED_REMINDERS)
        return
      }
      const bases = new Map<number, PlannerChore>()
      const updates = new Map<number, PlannerChore>()
      for (const { chore, from, remove, seconds, start } of moves) {
        const base = bases.get(chore.id) ?? latestOf(chore)
        bases.set(chore.id, base)
        const current = updates.get(chore.id) ?? base
        const index = blockIndexAt(current, from)
        if (remove) {
          if (index !== undefined) {
            updates.set(chore.id, withoutBlock(current, index))
          }
          continue
        }
        const updated = withBlockAt(current, start, seconds, index)
        if (!updated) {
          revert?.()
          showError({ message: t('planner.cantStartAtDue') })
          return
        }
        updates.set(chore.id, updated)
      }
      const pastDue = moves.some(
        ({ chore, remove, seconds, start }) =>
          !remove &&
          !isOverDue(chore) &&
          endsPastDue(chore, new Date(start.getTime() + seconds * 1000)),
      )
      if (pastDue) showWarning({ message: t('planner.scheduledPastDue') })

      await Promise.all([...updates.values()].map(showOptimistic))
      try {
        const saved = await Promise.all([...updates.values()].map(persist))
        if (saved.some(chore => chore?._pendingUpdate)) {
          showSuccess({ message: t('planner.offlineSaved') })
        }
      } catch {
        bases.forEach(base => replaceChore(base))
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
      showWarning,
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

  return { removeBlock, saveBlocks }
}
