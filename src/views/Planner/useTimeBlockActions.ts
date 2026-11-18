import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { PAYWALL_REASON, usePaywall } from '../../contexts/PaywallContext'
import { useUpdateChore } from '../../queries/ChoreQueries'
import { useNotification } from '../../service/NotificationProvider'
import type { Chore } from '../../types/models'
import { withBlockAt } from './timeBlocks'

type ChoresData = { res?: Chore[] } | undefined

type SavedChore = Chore & { _pendingUpdate?: boolean }

type Notify = (notification: { message?: string; title?: string }) => void

const ACTIVE_CHORES_KEY = ['chores', false]

export const useTimeBlockActions = () => {
  const { t } = useTranslation('chores')
  const queryClient = useQueryClient()
  const { isPlus, showPaywall } = usePaywall() as {
    isPlus: boolean
    showPaywall: (reason: string) => void
  }
  const { mutateAsync: updateChore } = useUpdateChore() as unknown as {
    mutateAsync: (chore: Chore) => Promise<SavedChore>
  }
  const { showError, showSuccess } = useNotification() as {
    showError: Notify
    showSuccess: Notify
  }

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

  const saveBlock = useCallback(
    async (
      chore: Chore,
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
      const updated = withBlockAt(chore, end, seconds, index) as Chore | null
      if (!updated) {
        revert?.()
        showError({ message: t('planner.mustEndBeforeDue') })
        return
      }

      replaceChore(updated)
      try {
        const saved = await updateChore({
          ...updated,
          labelsV2: updated.labelsV2 ?? [],
        })
        if (saved?._pendingUpdate) {
          showSuccess({ message: t('planner.offlineSaved') })
        }
      } catch {
        replaceChore(chore)
        revert?.()
        showError({
          title: t('actions.failRescheduleTitle'),
          message: t('actions.failRescheduleMessage'),
        })
      }
    },
    [isPlus, replaceChore, showError, showPaywall, showSuccess, t, updateChore],
  )

  return { saveBlock }
}
