import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSaveSubTasks } from '../queries/SubtaskQueries'
import { useNotification } from '../service/NotificationProvider'
import type { SubTask } from '../types/models'

type InlineSubTaskEditorOptions = {
  choreId: number
  subTasks: SubTask[]
  setSubTasks: (tasks: SubTask[]) => void
}

export const useInlineSubTaskEditor = ({
  choreId,
  setSubTasks,
  subTasks,
}: InlineSubTaskEditorOptions) => {
  const { t } = useTranslation('chores')
  const { showError } = useNotification()
  const { isSaving, saveSubTasks } = useSaveSubTasks()
  const [draft, setDraft] = useState<SubTask[] | null>(null)

  const save = async (): Promise<void> => {
    if (!draft) return
    try {
      await saveSubTasks(choreId, draft)
      setDraft(null)
    } catch {
      showError({
        title: t('subtaskEditor.saveFailedTitle'),
        message: t('subtaskEditor.saveFailedMessage'),
      })
    }
  }

  return {
    isEditing: draft !== null,
    isSaving,
    startEditing: () => setDraft([...subTasks]),
    cancel: () => setDraft(null),
    save,
    subTasksProps: draft
      ? { editMode: true, tasks: draft, setTasks: setDraft, shouldFocus: true }
      : {
          editMode: false,
          tasks: subTasks,
          setTasks: setSubTasks,
          shouldFocus: false,
        },
  }
}

export type InlineSubTaskEditor = ReturnType<typeof useInlineSubTaskEditor>
