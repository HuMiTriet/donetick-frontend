import { Capacitor } from '@capacitor/core'
import {
  Archive,
  AttachFile,
  CalendarMonth,
  Check,
  Checklist,
  Edit,
  History,
  HourglassEmpty,
  MoreVert,
  OpenInFull,
  PeopleAlt,
  Person,
  PlayArrow,
  PlaylistAdd,
  SwitchAccessShortcut,
  ThumbDown,
  ThumbUp,
  Unarchive,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  FormControl,
  Grid,
  IconButton,
  Input,
  Sheet,
  Typography,
} from '@mui/joy'
import { type UseMutationResult, useQueryClient } from '@tanstack/react-query'
import moment from 'moment'
import { type ComponentType, type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import EmptyState from '../../components/common/EmptyState'
import { useImpersonateUser } from '../../contexts/ImpersonateUserContext.jsx'
import { useLocalization } from '../../contexts/LocalizationContext'
import { useDescriptionHtml } from '../../hooks/useDescriptionHtml'
import {
  type InlineSubTaskEditor,
  useInlineSubTaskEditor,
} from '../../hooks/useInlineSubTaskEditor'
import { usePendingCommands } from '../../hooks/usePendingCommands'
import { useStakeCountdown, useStakeLockText } from '../../hooks/useStakeText'
import { useStakeTick } from '../../hooks/useStakeTick'
import {
  useChoreDetails,
  useChoreHistory,
} from '../../queries/ChoreQueries.jsx'
import {
  useChoreTimer,
  useDeleteTimeSession,
  usePauseChore,
  useResetChoreTimer,
  useStartChore,
} from '../../queries/TimeQueries'
import { useCircleMembers, useUserProfile } from '../../queries/UserQueries.jsx'
import { useNotification } from '../../service/NotificationProvider'
import type {
  ApiResponse,
  Chore,
  ChoreDetail,
  ChoreHistory,
  CircleMember,
} from '../../types/models'
import { celebrateTask } from '../../utils/Celebrate'
import {
  ChoreHistoryStatus,
  ChoreStatus,
  notInCompletionWindow,
  STAKE_LOCKED_ACTIONS,
} from '../../utils/Chores.jsx'
import { getTextColorFromBackgroundColor } from '../../utils/Colors.jsx'
import { commandQueue, CommandType } from '../../utils/CommandQueue'
import {
  ApproveChore,
  ArchiveChore,
  DeleteChore,
  GetChoreDetailById,
  MarkChoreComplete,
  NudgeChore,
  RejectChore,
  SaveChore,
  SkipChore,
  UnArchiveChore,
  UndoChoreAction,
  UpdateChoreAssignee,
  UpdateChorePriority,
  UpdateDueDate,
} from '../../utils/Fetcher'
import { offlineDB } from '../../utils/OfflineDB'
import { serverErrorMessage } from '../../utils/responseError'
import { getSafeBottomPadding } from '../../utils/SafeAreaUtils.js'
import { formatStakeAmount, STAKE_LEVEL_COLOR } from '../../utils/stakes'
import { removeEmptySubTasks } from '../../utils/SubTasks'
import ChoreActionMenu from '../components/ChoreActionMenu'
import DueDatePickerModal, {
  combineDueDate,
  splitDueDate,
} from '../components/DueDatePickerModal'
import LoadingComponent from '../components/Loading.jsx'
import PendingBadge from '../components/PendingBadge'
import UntypedRichTextEditor from '../components/RichTextEditor.jsx'
import StakeBadge from '../components/StakeBadge'
import UntypedSubTasks from '../components/SubTask.jsx'
import {
  SubTaskEditButton,
  SubTaskEditFooter,
} from '../components/SubTaskEditControls'
import AssigneeModal from '../Modals/Inputs/AssigneeModal'
import AttachmentBrowserModal from '../Modals/Inputs/AttachmentBrowserModal'
import ConfirmationModal from '../Modals/Inputs/ConfirmationModal'
import NoteViewerModal from '../Modals/Inputs/NoteViewerModal'
import NudgeModal from '../Modals/Inputs/NudgeModal'
import WriteNFCModal from '../Modals/Inputs/WriteNFCModal'
import TimePassedCard from './TimePassedCard.jsx'
import TimerSplitButton from './TimerSplitButton.jsx'

type ChoreViewData = Partial<Omit<ChoreDetail & Chore, 'status'>> & {
  status?: ChoreDetail['status'] | undefined
}

type InfoCard = {
  size: number
  icon: ReactNode
  title: string
  text?: string
  subtext?: string
  subtext2?: string | null
}

type ConfirmConfig = {
  isOpen?: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  onClose?: (confirmed: boolean) => void
}

type NoteViewerConfig = {
  isOpen: boolean
  title?: string
  content?: string | null | undefined
  onClose?: () => void
}

type ActiveModal =
  'changeAssignee' | 'changeDueDate' | 'nudge' | 'writeNFC' | null

type PriorityOption = {
  value: number
}

type ProjectOption = {
  id: number | null
  name: string
}

type MenuActionExtraData = {
  date?: Date | null
  project?: ProjectOption
}

type NudgePayload = {
  message: string
  notifyAllAssignees: boolean
}

type TimeSessionVariables = {
  choreId: string | undefined
  sessionId: number
}

type TimerMutation<TVariables> = UseMutationResult<
  Partial<ApiResponse<ChoreViewData>>,
  Error,
  TVariables
>

type RichTextEditorProps = {
  draftId?: string
  entityId?: number | undefined
  entityType?: string
  isEditable?: boolean
  onChange?: (html: string) => void
  placeholder?: string | null
  value?: string
  variant?: string
}

const RichTextEditor =
  UntypedRichTextEditor as ComponentType<RichTextEditorProps>

type SubTasksProps = InlineSubTaskEditor['subTasksProps'] & {
  choreId: number
  onToggleSettled?: (() => void) | undefined
  performers: CircleMember[]
}

const SubTasks = UntypedSubTasks as ComponentType<SubTasksProps>

const TIMER_STATUSES: readonly (number | undefined)[] = [
  ChoreStatus.ACTIVE,
  ChoreStatus.PAUSED,
]

const isNetworkError = (err: unknown) =>
  err instanceof TypeError && err.message === 'Failed to fetch'

const getErrorMessage = (error: unknown) =>
  typeof error === 'object' && error !== null && 'message' in error
    ? error.message
    : undefined

const decodeHtmlEntities = (value: unknown) => {
  if (typeof value !== 'string') return ''

  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

const hasHtmlTags = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value)

const getNFCUrl = (choreId: string | undefined) =>
  Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios'
    ? `donetick://chores/${choreId}`
    : `${window.location.origin}/chores/${choreId}`

const ChoreView = () => {
  const { t } = useTranslation('chores')
  const { fmt } = useLocalization()
  const [chore, setChore] = useState<ChoreViewData>({})
  const navigate = useNavigate()
  const [performers, setPerformers] = useState<CircleMember[]>([])
  const [infoCards, setInfoCards] = useState<InfoCard[]>([])
  const { choreId } = useParams()
  const [note, setNote] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { showError, showSuccess, showUndo } = useNotification()
  // Beeminder stake, re-evaluated as its window closes and deadline nears
  const stakeState = useStakeTick(chore)
  const stakeLocked = Boolean(stakeState?.locked)
  const stakeCountdown = useStakeCountdown(stakeState)
  const stakeLockText = useStakeLockText(stakeState)

  const [searchParams] = useSearchParams()

  const [completedDate, setCompletedDate] = useState<string | null>(null)
  const [confirmModelConfig, setConfirmModelConfig] = useState<ConfirmConfig>({
    isOpen: false,
  })
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [noteViewerConfig, setNoteViewerConfig] = useState<NoteViewerConfig>({
    isOpen: false,
  })
  const [timerActionConfig, setTimerActionConfig] = useState<ConfirmConfig>({
    isOpen: false,
  })
  const [attachmentBrowserOpen, setAttachmentBrowserOpen] = useState(false)
  const { data: circleMembersData, isLoading: isCircleMembersLoading } =
    useCircleMembers()
  const { data: userProfile } = useUserProfile()
  const { impersonatedUser } = useImpersonateUser()
  const descriptionHtml = useDescriptionHtml(chore?.description || '', {
    choreId: chore?.id,
  })
  const notesHtml = useDescriptionHtml(chore?.notes || '', {
    choreId: chore?.id,
  })

  const {
    data: choreData,
    isError: isChoreError,
    isLoading: isChoreLoading,
  } = useChoreDetails(choreId)
  const { data: choreHistoryData } = useChoreHistory(choreId)

  const { data: pendingCmds } = usePendingCommands(choreId)

  const subTaskEditor = useInlineSubTaskEditor({
    choreId: Number(choreId),
    subTasks: removeEmptySubTasks(chore.subTasks) ?? [],
    setSubTasks: tasks => setChore({ ...chore, subTasks: tasks }),
  })

  const choreHistory =
    (choreHistoryData as ApiResponse<ChoreHistory[]> | undefined)?.res || []
  const historyCompletionCount = choreHistory.filter(historyEntry => {
    const status = Number(historyEntry?.status)
    return status === ChoreHistoryStatus.COMPLETED
  }).length
  const completionCount = choreHistoryData
    ? historyCompletionCount
    : chore.totalCompletedCount || 0

  const startChore = useStartChore() as TimerMutation<string | undefined>
  const pauseChore = usePauseChore() as TimerMutation<string | undefined>
  const deleteTimeSession =
    useDeleteTimeSession() as unknown as TimerMutation<TimeSessionVariables>
  const resetChoreTimer = useResetChoreTimer() as TimerMutation<
    string | undefined
  >
  const { data: choreTimer } = useChoreTimer(choreId)

  useEffect(() => {
    if (!choreData || !choreData.res || !circleMembersData) {
      return
    }
    setChore(choreData.res)
    document.title = 'Donetick: ' + choreData.res.name

    setPerformers(circleMembersData.res)
    if (searchParams.get('auto_complete') === 'true') {
      navigate({ search: '' }, { replace: true })
      handleTaskCompletion()
    }
  }, [choreData, circleMembersData])

  useEffect(() => {
    if (chore && performers?.length > 0) {
      const cards: InfoCard[] = [
        {
          size: 6,
          icon: <PeopleAlt />,
          title: t('choreView.assignment'),
          text: `${t('choreView.assigned')}: ${
            performers.find(p => p.userId === chore.assignedTo)?.displayName ||
            t('choreView.na')
          }`,
          subtext: ` ${t('choreView.last')}: ${
            chore.lastCompletedDate
              ? performers.find(p => p.userId === chore.lastCompletedBy)
                  ?.displayName
              : t('choreView.na')
          }`,
        },
        {
          size: 6,
          icon: <CalendarMonth />,
          title: t('choreView.schedule'),
          text: `${t('choreView.due')}: ${
            chore.nextDueDate
              ? moment(chore.nextDueDate).fromNow()
              : t('choreView.na')
          }`,
          subtext: `${t('choreView.last')}: ${
            chore.lastCompletedDate
              ? moment(chore.lastCompletedDate).fromNow()
              : t('choreView.na')
          }`,

          subtext2:
            chore.deadlineOffset &&
            chore.deadlineOffset > 0 &&
            chore.nextDueDate
              ? t('choreView.deadline', {
                  date: moment(chore.nextDueDate)
                    .add(chore.deadlineOffset, 'seconds')
                    .fromNow(),
                })
              : null,
        },
        {
          size: 6,
          icon: <Checklist />,
          title: t('choreView.statistics'),
          text: `${t('choreView.completed')}: ${completionCount} ${t('choreView.times')}`,
        },
        {
          size: 6,
          icon: <Person />,
          title: t('choreView.details'),
          subtext: `${t('choreView.createdBy')}: ${
            performers.find(p => p.userId === chore.createdBy)?.displayName ||
            t('choreView.na')
          }`,
        },
      ]
      setInfoCards(cards)
    }
  }, [chore, performers, completionCount, t])
  const handleUpdatePriority = (priority: PriorityOption) => {
    UpdateChorePriority(choreId, priority.value).then(response => {
      if (response.ok) {
        response.json().then(() => {
          setChore(prev => ({ ...prev, priority: priority.value }))
          queryClient.invalidateQueries({ queryKey: ['chores'] })
        })
      }
    })
  }
  const handleTaskCompletion = async () => {
    try {
      const resp = await MarkChoreComplete(
        choreId,
        impersonatedUser
          ? { completedBy: impersonatedUser.userId, note }
          : { note },
        completedDate,
        null,
      )
      if (resp.ok) {
        celebrateTask(chore)
        const data = await resp.json()
        setNote(null)
        setChore(data.res)
        queryClient.invalidateQueries({ queryKey: ['chores'] })
        const detailResp = await GetChoreDetailById(choreId)
        if (detailResp.ok) {
          const detailData = await detailResp.json()
          setChore(detailData.res)
        }
        showSuccess({
          title: t('choreView.taskCompleted'),
          message: t('choreView.taskCompletedMessage'),
          undoAction: async () => {
            try {
              const undoResponse = await UndoChoreAction(choreId)
              if (undoResponse.ok) {
                const detailResponse = await GetChoreDetailById(choreId)
                if (detailResponse.ok) {
                  const detailData = await detailResponse.json()
                  setChore(detailData.res)
                  queryClient.invalidateQueries({ queryKey: ['chores'] })
                }
                showUndo({
                  title: t('choreView.undoSuccessful'),
                  message: t('choreView.taskCompletionUndone'),
                })
              } else {
                throw new Error(t('choreView.unableUndo'))
              }
            } catch (error) {
              showError({
                title: t('choreView.undoFailed'),
                message: t('choreView.undoFailedMessage'),
              })
            }
          },
        })
      }
    } catch (error) {
      if (isNetworkError(error)) {
        const cmdId = await commandQueue.enqueue(
          CommandType.COMPLETE_CHORE,
          choreId,
          {
            id: choreId,
            body: impersonatedUser
              ? { completedBy: impersonatedUser.userId, note }
              : { note },
            completedDate: completedDate || null,
            performer: null,
          },
        )
        await offlineDB.savePendingHistory({
          id: -Date.now(),
          choreId: Number(choreId),
          completedBy: impersonatedUser?.userId || userProfile?.id || 0,
          performedAt: completedDate || new Date().toISOString(),
          dueDate: chore.nextDueDate || null,
          notes: note || null,
          status: 1,
          points: chore.points || 0,
          pending: true,
        })
        queryClient.invalidateQueries({ queryKey: ['pendingCommands'] })
        celebrateTask(chore)
        showSuccess({
          message: t('choreView.offlineComplete'),
          undoAction: async () => {
            await commandQueue.cancel(cmdId)
            queryClient.invalidateQueries({ queryKey: ['pendingCommands'] })
          },
        })
      } else {
        showError({
          title: t('choreView.undoFailed'),
          message: getErrorMessage(error) || t('choreView.unableComplete'),
        })
      }
    }
  }
  const handleSkippingTask = async () => {
    try {
      const response = await SkipChore(choreId)
      if (!response.ok) {
        showError({
          title: t('choreView.undoFailed'),
          message: await serverErrorMessage(
            response,
            t('choreView.unableSkip'),
          ),
        })
        return
      }
      if (stakeState) {
        // The stake was charged; undoing the skip wouldn't refund it, so
        // there's no undo here
        const data = await response.json()
        setChore(data.res)
        queryClient.invalidateQueries({ queryKey: ['chores'] })
        showSuccess({
          message: t('stake.skippedCharged', {
            amount: formatStakeAmount(stakeState.amountCents),
          }),
        })
        return
      }
      if (response.ok) {
        const data = await response.json()
        setChore(data.res)
        queryClient.invalidateQueries({ queryKey: ['chores'] })
        showSuccess({
          message: t('choreView.skipTask'),
          undoAction: async () => {
            try {
              const undoResponse = await UndoChoreAction(choreId)
              if (undoResponse.ok) {
                const detailResponse = await GetChoreDetailById(choreId)
                if (detailResponse.ok) {
                  const detailData = await detailResponse.json()
                  setChore(detailData.res)
                  queryClient.invalidateQueries({ queryKey: ['chores'] })
                }
                showUndo({
                  title: t('choreView.undoSuccessful'),
                  message: t('choreView.taskSkipUndone'),
                })
              } else {
                throw new Error(t('choreView.unableUndo'))
              }
            } catch (error) {
              showError({
                title: t('choreView.undoFailed'),
                message: t('choreView.undoFailedMessage'),
              })
            }
          },
        })
      }
    } catch (error) {
      if (isNetworkError(error)) {
        const cmdId = await commandQueue.enqueue(
          CommandType.SKIP_CHORE,
          choreId,
          { id: choreId },
        )
        queryClient.invalidateQueries({ queryKey: ['pendingCommands'] })
        showSuccess({
          message: t('choreView.offlineSkip'),
          undoAction: async () => {
            await commandQueue.cancel(cmdId)
            queryClient.invalidateQueries({ queryKey: ['pendingCommands'] })
          },
        })
      } else {
        showError({
          title: t('choreView.undoFailed'),
          message: getErrorMessage(error) || t('choreView.unableSkip'),
        })
      }
    }
  }
  const handleChoreStart = () => {
    const startedChore = { ...chore, status: ChoreStatus.ACTIVE }
    startChore.mutate(choreId, {
      onSuccess: data => {
        setChore({ ...startedChore, ...data?.res })
      },
      onError: async error => {
        if (isNetworkError(error)) {
          const previousStatus = chore.status
          const cmdId = await commandQueue.enqueue(
            CommandType.START_CHORE,
            choreId,
            { id: choreId },
          )
          setChore(startedChore)
          queryClient.invalidateQueries({ queryKey: ['pendingCommands'] })
          showSuccess({
            message: t('choreView.offlineStart'),
            undoAction: async () => {
              await commandQueue.cancel(cmdId)
              queryClient.invalidateQueries({ queryKey: ['pendingCommands'] })
              setChore({ ...chore, status: previousStatus })
            },
          })
          return
        }

        showError({
          title: t('choreView.undoFailed'),
          message: error?.message || t('choreView.unableStart'),
        })
      },
    })
  }

  const handleChorePause = () => {
    const pausedChore = { ...chore, status: ChoreStatus.PAUSED }
    pauseChore.mutate(choreId, {
      onSuccess: data => {
        setChore({ ...pausedChore, ...data?.res })
      },
      onError: async error => {
        if (isNetworkError(error)) {
          const previousStatus = chore.status
          const cmdId = await commandQueue.enqueue(
            CommandType.PAUSE_CHORE,
            choreId,
            { id: choreId },
          )
          setChore(pausedChore)
          queryClient.invalidateQueries({ queryKey: ['pendingCommands'] })
          showSuccess({
            message: t('choreView.offlinePause'),
            undoAction: async () => {
              await commandQueue.cancel(cmdId)
              queryClient.invalidateQueries({ queryKey: ['pendingCommands'] })
              setChore({ ...chore, status: previousStatus })
            },
          })
          return
        }

        showError({
          title: t('choreView.undoFailed'),
          message: error?.message || t('choreView.unablePause'),
        })
      },
    })
  }

  const handleResetTimer = () => {
    setTimerActionConfig({
      isOpen: true,
      title: t('choreView.resetTimer'),
      message: t('choreView.resetTimerConfirmation'),
      confirmText: t('choreView.resetTimer'),
      cancelText: t('common:cancel'),
      onClose: confirmed => {
        if (confirmed) {
          resetChoreTimer.mutate(choreId, {
            onSuccess: data => {
              const newChore = {
                ...chore,
                ...data.res,
              }
              setChore(newChore)
            },
          })
        }
        setTimerActionConfig({})
      },
    })
  }

  const handleClearAllTime = () => {
    setTimerActionConfig({
      isOpen: true,
      title: t('choreView.clearAllTimeRecords'),
      message: t('choreView.clearAllTimeConfirmation'),
      confirmText: t('choreView.clearAllTimeRecords'),
      cancelText: t('common:cancel'),
      onClose: async confirmed => {
        if (confirmed) {
          if (choreTimer?.res?.id) {
            deleteTimeSession.mutate(
              { choreId, sessionId: choreTimer.res.id },
              {
                onSuccess: data => {
                  const newChore = {
                    ...chore,
                    ...data.res,
                  }
                  setChore(newChore)
                },
              },
            )
          }
        }
        setTimerActionConfig({})
      },
    })
  }

  const handleApproveChore = () => {
    ApproveChore(choreId).then(response => {
      if (response.ok) {
        response.json().then((data: ApiResponse<Chore>) => {
          setChore(data.res)
          queryClient.invalidateQueries({ queryKey: ['chores'] })
        })
      }
    })
  }

  const handleRejectChore = () => {
    RejectChore(choreId).then(response => {
      if (response.ok) {
        response.json().then((data: ApiResponse<Chore>) => {
          setChore(data.res)
          queryClient.invalidateQueries({ queryKey: ['chores'] })
        })
      }
    })
  }

  const handleUnarchiveChore = async () => {
    try {
      const response = await UnArchiveChore(choreId)
      if (response.ok) {
        await offlineDB.saveChores([{ ...chore, isActive: true }])
        setChore({ ...chore, isActive: true })
        queryClient.invalidateQueries({ queryKey: ['chores'] })
      }
    } catch (error) {
      const isNetworkError = (err: unknown) =>
        err instanceof TypeError && err.message === 'Failed to fetch'
      if (isNetworkError(error)) {
        const cmdId = await commandQueue.enqueue(
          CommandType.UNARCHIVE_CHORE,
          choreId,
          { id: choreId },
        )
        await offlineDB.saveChores([
          { ...chore, isActive: true, _pending: 'unarchive' },
        ])
        setChore({ ...chore, isActive: true })
        queryClient.invalidateQueries({ queryKey: ['pendingCommands'] })
        showSuccess({
          message: t('choreView.offlineRestore'),
          undoAction: async () => {
            await commandQueue.cancel(cmdId)
            await offlineDB.saveChores([{ ...chore, isActive: false }])
            setChore({ ...chore, isActive: false })
            queryClient.invalidateQueries({ queryKey: ['pendingCommands'] })
          },
        })
      } else {
        showError({
          title: t('choreView.restoreFailed'),
          message: getErrorMessage(error) || t('choreView.unableRestore'),
        })
      }
    }
  }

  const confirmSkipTask = () => {
    setConfirmModelConfig({
      isOpen: true,
      title: t('choreView.skipTask'),
      message: stakeState
        ? t('stake.skipConfirm', {
            amount: formatStakeAmount(stakeState.amountCents),
          })
        : t('choreView.skipTaskConfirmation'),
      confirmText: t('choreView.skip'),
      cancelText: t('choreView.cancel'),
      onClose: confirmed => {
        if (confirmed) {
          handleSkippingTask()
        }
        setConfirmModelConfig({})
      },
    })
  }

  const handleArchiveChore = async () => {
    try {
      const response = await ArchiveChore(choreId)
      if (response.ok) {
        await offlineDB.saveChores([{ ...chore, isActive: false }])
        setChore({ ...chore, isActive: false })
        queryClient.invalidateQueries({ queryKey: ['chores'] })
      } else {
        showError({
          title: t('choreView.failedArchive'),
          message: await serverErrorMessage(
            response,
            t('choreView.unableArchiveTask'),
          ),
        })
      }
    } catch (error) {
      showError({
        title: t('choreView.failedArchive'),
        message: getErrorMessage(error) || t('choreView.unableArchiveTask'),
      })
    }
  }

  const confirmDeleteChore = () => {
    setConfirmModelConfig({
      isOpen: true,
      title: t('choreView.deleteTaskTitle'),
      message: t('choreView.deleteTaskMessage'),
      confirmText: t('common:delete'),
      cancelText: t('choreView.cancel'),
      onClose: async confirmed => {
        setConfirmModelConfig({})
        if (!confirmed) return
        try {
          const response = await DeleteChore(choreId)
          if (response.ok) {
            queryClient.invalidateQueries({ queryKey: ['chores'] })
            showSuccess({
              title: t('choreView.taskDeletedTitle'),
              message: t('choreView.taskDeletedMessage'),
            })
            navigate('/chores')
          } else {
            showError({
              title: t('choreView.failedDelete'),
              message: await serverErrorMessage(
                response,
                t('choreView.unableDeleteTask'),
              ),
            })
          }
        } catch (error) {
          showError({
            title: t('choreView.failedDelete'),
            message: getErrorMessage(error) || t('choreView.unableDeleteTask'),
          })
        }
      },
    })
  }

  const handleDueDateChange = async (newDate: string | null) => {
    try {
      const response = await UpdateDueDate(choreId, newDate)
      if (response.ok) {
        setChore(prev => ({ ...prev, nextDueDate: newDate }))
        queryClient.invalidateQueries({ queryKey: ['chores'] })
      }
    } catch (error) {
      showError({
        title: t('choreView.failedReschedule'),
        message: getErrorMessage(error) || t('choreView.unableChangeDueDate'),
      })
    }
  }

  const handleMoveToProject = async (project: ProjectOption | undefined) => {
    const projectId = project?.id ?? null
    try {
      const response = await SaveChore({ ...chore, projectId })
      if (response.ok) {
        setChore(prev => ({ ...prev, projectId }))
        queryClient.invalidateQueries({ queryKey: ['chores'] })
        showSuccess({
          title: t('choreView.taskMovedTitle'),
          message: t('choreView.taskMovedMessage', {
            project: project?.name || t('actionMenu.defaultProject'),
          }),
        })
      }
    } catch (error) {
      showError({
        title: t('choreView.failedMoveTask'),
        message:
          getErrorMessage(error) || t('choreView.unableMoveTaskToProject'),
      })
    }
  }

  const handleNudge = async ({ message, notifyAllAssignees }: NudgePayload) => {
    try {
      const response = await NudgeChore(choreId, {
        message,
        notifyAllAssignees,
      })
      if (!response.ok) {
        throw new Error(t('choreView.failedSendNudgeError'))
      }
      const data = await response.json()
      showSuccess({
        title: t('choreView.nudgeSentTitle'),
        message: data.message || t('choreView.nudgeSentMessage'),
      })
    } catch (error) {
      showError({
        title: t('choreView.failedSendNudgeTitle'),
        message: getErrorMessage(error) || t('choreView.unableSendNudge'),
      })
    }
  }

  // Picking a circle member who isn't yet in the chore's assignee pool must
  // not surface the backend's "assignee not in assignees list" rejection —
  // assigning someone should always just work, so this adds them to the pool
  // first (existing per-chore state, no dedicated endpoint for it) and only
  // then assigns.
  const handleAssigneeChange = async (assigneeId: number) => {
    try {
      const isInPool = (chore.assignees || []).some(
        a => a.userId === assigneeId,
      )
      if (!isInPool) {
        const saveResponse = await SaveChore({
          ...chore,
          assignees: [...(chore.assignees || []), { userId: assigneeId }],
        })
        if (!saveResponse.ok)
          throw new Error(t('choreView.unableChangeAssignee'))
      }
      const response = await UpdateChoreAssignee(chore.id, assigneeId)
      if (!response.ok) throw new Error(t('choreView.unableChangeAssignee'))
      const data = await response.json()
      setChore(data.res)
      queryClient.invalidateQueries({ queryKey: ['chores'] })
    } catch (error) {
      showError({
        title: t('choreView.failedDelegate'),
        message: getErrorMessage(error) || t('choreView.unableChangeAssignee'),
      })
    }
  }

  // Actions the menu raises that ChoreView owns; the rest of its items either
  // navigate on their own or come in through the dedicated callbacks.
  const handleMenuAction = (
    type: string,
    _chore: unknown,
    extraData?: MenuActionExtraData,
  ) => {
    switch (type) {
      case 'skip':
        confirmSkipTask()
        break
      case 'archive':
        handleArchiveChore()
        break
      case 'unarchive':
        handleUnarchiveChore()
        break
      case 'delete':
        confirmDeleteChore()
        break
      case 'changeDueDate':
        handleDueDateChange(extraData?.date?.toISOString() ?? null)
        break
      case 'moveToProject':
        handleMoveToProject(extraData?.project)
        break
      default:
        break
    }
  }

  // Check if the current user can approve/reject (admin, manager, or task owner)
  const canApproveReject = () => {
    if (!circleMembersData?.res || !chore) return false

    const currentUser = circleMembersData.res.find(
      (member: CircleMember) =>
        member.userId === (impersonatedUser?.userId || userProfile?.id),
    )

    // User can approve/reject if they are:
    // 1. Admin or manager of the circle
    // 2. Owner/creator of the task
    return (
      currentUser?.role === 'admin' ||
      currentUser?.role === 'manager' ||
      chore.createdBy === (impersonatedUser?.userId || userProfile?.id)
    )
  }

  if (isChoreLoading || isCircleMembersLoading) {
    // while loading the chore or circle members, return a loading state
    return <LoadingComponent />
  }
  if (isChoreError) {
    return (
      <Container maxWidth='sm'>
        <EmptyState
          variant='error'
          fullHeight
          icon={<Checklist />}
          title={t('choreView.notFoundTitle')}
          description={t('choreView.notFoundDescription')}
          primaryAction={{ label: t('archived.backToTasks'), to: '/chores' }}
          secondaryAction={undefined}
          sx={undefined}
        />
      </Container>
    )
  }
  const subTasks = removeEmptySubTasks(chore.subTasks)
  return (
    <Container
      maxWidth='sm'
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minWidth: 0,
        overflowX: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          mb: 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            mt: 1,
            mb: 0.5,
          }}
        >
          <Typography level='h3'>{chore.name}</Typography>
          <PendingBadge commands={pendingCmds} />
        </Box>
        {stakeState && (
          <Alert
            variant='soft'
            color={STAKE_LEVEL_COLOR[stakeState.level]}
            startDecorator={<StakeBadge state={stakeState} size='md' />}
            data-testid='stake-banner'
            sx={{ mb: 1, maxWidth: 520, textAlign: 'left' }}
          >
            <Box>
              <Typography level='title-sm' textColor='inherit'>
                {t('stake.atStake', {
                  amount: formatStakeAmount(stakeState.amountCents),
                })}
                {stakeCountdown ? ` · ${stakeCountdown}` : ''}
              </Typography>
              <Typography level='body-sm' textColor='inherit'>
                {stakeLockText}
              </Typography>
            </Box>
          </Alert>
        )}
        {chore.isActive === false && (
          <Chip
            startDecorator={<Archive />}
            size='md'
            color='warning'
            sx={{ mb: 1 }}
          >
            {t('choreView.archive')}
          </Chip>
        )}
        <Chip startDecorator={<CalendarMonth />} size='md' sx={{ mb: 1 }}>
          {chore.nextDueDate
            ? `${t('choreView.due')} ${fmt.dateTime(chore.nextDueDate)}`
            : t('choreView.na')}
        </Chip>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            mb: 1,
            flexWrap: 'wrap',
            gap: 0.5,
          }}
        >
          {chore?.labelsV2?.map((label, index) => (
            <Chip
              key={index}
              sx={{
                backgroundColor: label?.color,
                color: getTextColorFromBackgroundColor(label?.color),
              }}
            >
              {label?.name}
            </Chip>
          ))}

          {!!chore?.attachments?.length && (
            <Chip
              startDecorator={<AttachFile />}
              size='md'
              variant='soft'
              color='neutral'
              onClick={() => setAttachmentBrowserOpen(true)}
              sx={{ cursor: 'pointer' }}
            >
              {t('choreView.attachment', { count: chore.attachments.length })}
            </Chip>
          )}
        </Box>
      </Box>

      <Box>
        <Grid
          container
          spacing={1}
          sx={{
            mb: 1,
          }}
        >
          {TIMER_STATUSES.includes(chore.status) && (
            <Grid xs={12}>
              <TimePassedCard
                chore={chore}
                handleAction={(action: string) => {
                  if (action === 'pause') {
                    handleChorePause()
                  } else if (
                    action === 'resume' &&
                    !notInCompletionWindow(chore)
                  ) {
                    handleChoreStart()
                  }
                }}
                onShowDetails={() => navigate(`/chores/${choreId}/timer`)}
              />
            </Grid>
          )}
          {infoCards.map((card, index) => (
            <Grid xs={6} sm={6} key={index}>
              <Card
                variant='soft'
                sx={{
                  borderRadius: 'md',
                  boxShadow: 1,
                  px: 2,
                  py: 1,
                  minHeight: 90,
                  height: '100%',
                  // change from space-between to start:
                  justifyContent: 'start',
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'start',
                      mb: 0.5,
                    }}
                  >
                    {card.icon}

                    <Typography
                      level='body-md'
                      sx={{
                        ml: 1,
                        fontWeight: '500',
                        color: 'text.primary',
                      }}
                    >
                      {card.title}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography
                      level='body-sm'
                      sx={{ color: 'text.secondary', lineHeight: 1.5 }}
                    >
                      {card.text}
                    </Typography>
                    <Typography
                      level='body-sm'
                      sx={{ color: 'text.secondary', lineHeight: 1.5 }}
                    >
                      {card.subtext}
                    </Typography>
                    {card.subtext2 && (
                      <Typography
                        level='body-sm'
                        sx={{ color: 'danger.plainColor', lineHeight: 1.5 }}
                      >
                        {card.subtext2}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            gap: 1,
            alignContent: 'center',
            justifyContent: 'center',
            mb: 1,
          }}
        >
          <Button
            size='sm'
            color='neutral'
            variant='plain'
            fullWidth
            onClick={() => {
              navigate(`/chores/${choreId}/history`)
            }}
            sx={{
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 1,
            }}
          >
            <History />
            {t('choreView.history')}
          </Button>
          <Button
            size='sm'
            color='neutral'
            variant='plain'
            fullWidth
            sx={{
              // top right of the card:
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 1,
            }}
            disabled={stakeLocked}
            title={stakeLocked ? stakeLockText : undefined}
            onClick={() => {
              navigate(`/chores/${choreId}/edit`)
            }}
          >
            <Edit />
            {t('choreView.edit')}
          </Button>
          <ChoreActionMenu
            chore={chore}
            hiddenActions={['view'] as never[]}
            disabledActions={stakeLocked ? STAKE_LOCKED_ACTIONS : []}
            onAction={handleMenuAction}
            onWriteNFC={() => setActiveModal('writeNFC')}
            onCompleteWithNote={() => setNote('')}
            onCompleteWithPastDate={() =>
              setCompletedDate(moment(new Date()).format('YYYY-MM-DDTHH:00:00'))
            }
            onChangeDueDate={() => setActiveModal('changeDueDate')}
            onChangePriority={handleUpdatePriority}
            onDelete={confirmDeleteChore}
            anchorEl={undefined}
            onClose={undefined}
            onMouseEnter={undefined}
            onMouseLeave={undefined}
            onOpen={undefined}
            trigger={
              <Button
                size='sm'
                color='neutral'
                variant='plain'
                fullWidth
                sx={{
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 1,
                }}
              >
                <MoreVert />
                {t('choreView.more', 'More')}
              </Button>
            }
          />
        </Box>

        {chore.description && (
          <>
            <Typography level='title-md' sx={{ mb: 1 }}>
              {t('choreView.description')}
            </Typography>

            <Sheet
              variant='plain'
              sx={{
                p: 2,
                borderRadius: 'lg',
                mb: 1,
                cursor: 'pointer',
              }}
              onClick={() => {
                setNoteViewerConfig({
                  isOpen: true,
                  title: t('choreView.descriptionTitle'),
                  content: chore.description,
                  onClose: () => setNoteViewerConfig({ isOpen: false }),
                })
              }}
            >
              <IconButton
                variant='plain'
                size='sm'
                sx={{
                  position: 'absolute',
                  bottom: 5,
                  right: 5,
                }}
              >
                <OpenInFull />
              </IconButton>
              <Box
                sx={{
                  maxHeight: '100px',
                  overflow: 'hidden',
                }}
              >
                {(() => {
                  const raw = chore.description || ''
                  const shouldRenderHtml = hasHtmlTags(raw)

                  return shouldRenderHtml ? (
                    <Box
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                      dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                    />
                  ) : (
                    <Typography
                      level='body-md'
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {decodeHtmlEntities(raw)}
                    </Typography>
                  )
                })()}
              </Box>
            </Sheet>
          </>
        )}

        {chore.notes && (
          <>
            <Typography level='title-md' sx={{ mb: 1 }}>
              {t('choreView.previousNoteLabel')}
            </Typography>
            <Sheet
              variant='plain'
              sx={{
                p: 2,
                borderRadius: 'lg',
                mb: 1,
                cursor: 'pointer',
              }}
              onClick={() => {
                setNoteViewerConfig({
                  isOpen: true,
                  title: t('choreView.previousNote'),
                  content: chore.notes,
                  onClose: () => setNoteViewerConfig({ isOpen: false }),
                })
              }}
            >
              <IconButton
                variant='plain'
                size='sm'
                sx={{
                  position: 'absolute',
                  bottom: 5,
                  right: 5,
                }}
              >
                <OpenInFull />
              </IconButton>
              <Box
                sx={{
                  maxHeight: '100px',
                  overflow: 'hidden',
                }}
              >
                {(() => {
                  const raw = chore.notes || ''
                  const shouldRenderHtml = hasHtmlTags(raw)

                  return shouldRenderHtml ? (
                    <Box
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                      dangerouslySetInnerHTML={{ __html: notesHtml }}
                    />
                  ) : (
                    <Typography
                      level='body-md'
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {decodeHtmlEntities(raw)}
                    </Typography>
                  )
                })()}
              </Box>
            </Sheet>
          </>
        )}
        {subTasks?.length > 0 || subTaskEditor.isEditing ? (
          <Box sx={{ p: 0, m: 0, mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1,
              }}
            >
              <Typography level='title-md'>
                {t('choreView.subtasksLabel')}
              </Typography>
              <SubTaskEditButton editor={subTaskEditor} />
            </Box>
            <Sheet
              variant='plain'
              sx={{
                borderRadius: 'lg',
                p: 1,
                overflow: 'auto',
                // maxHeight: '100px',
              }}
            >
              <SubTasks
                {...subTaskEditor.subTasksProps}
                performers={performers}
                choreId={Number(choreId ?? 0)}
                onToggleSettled={undefined}
              />
            </Sheet>
            <SubTaskEditFooter editor={subTaskEditor} />
          </Box>
        ) : (
          <Button
            size='sm'
            variant='plain'
            startDecorator={<PlaylistAdd />}
            onClick={subTaskEditor.startEditing}
            sx={{ mb: 2 }}
          >
            {t('subtaskEditor.add')}
          </Button>
        )}
      </Box>

      <Card
        sx={{
          p: 2,
          borderRadius: 'md',
          boxShadow: 'sm',
          paddingBottom: getSafeBottomPadding(2),
        }}
        variant='soft'
      >
        <Typography level='body-md' sx={{ mb: 1 }}>
          {t('choreView.taskActions')}
        </Typography>

        <FormControl size='sm'>
          <Checkbox
            checked={note !== null}
            size='lg'
            disabled={chore.isActive === false}
            onChange={e => {
              if (e.target.checked) {
                setNote('')
              } else {
                setNote(null)
              }
            }}
            overlay
            label={
              <Typography
                level='body-sm'
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {t('choreView.addNote')}
              </Typography>
            }
          />
        </FormControl>
        {note !== null && (
          <Box sx={{ mb: 1 }}>
            <Typography level='body-sm' sx={{ mb: 1 }}>
              {t('choreView.additionalNotes')}
            </Typography>
            <RichTextEditor
              value={note || ''}
              onChange={setNote}
              entityId={chore?.id}
              entityType={'chore_completion_note'}
              placeholder={t('choreView.notePlaceholder')}
            />
          </Box>
        )}

        <FormControl size='sm'>
          <Checkbox
            checked={completedDate !== null}
            size='lg'
            disabled={chore.isActive === false}
            onChange={e => {
              if (e.target.checked) {
                setCompletedDate(
                  moment(new Date()).format('YYYY-MM-DDTHH:00:00'),
                )
              } else {
                setCompletedDate(null)
              }
            }}
            overlay
            sx={
              {
                // my: 1,
              }
            }
            label={
              <Typography
                level='body-sm'
                sx={{
                  // center vertically
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {t('choreView.setCustomCompletionTime')}
              </Typography>
            }
          />
        </FormControl>
        {completedDate !== null && (
          <Input
            sx={{ mt: 1, mb: 1.5, width: 300 }}
            type='datetime-local'
            value={completedDate}
            onChange={e => {
              setCompletedDate(e.target.value)
            }}
          />
        )}

        {chore.isActive === false ? (
          // Archived chore - only show unarchive button
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              alignContent: 'center',
              justifyContent: 'center',
            }}
          >
            <Button
              fullWidth
              size='lg'
              onClick={handleUnarchiveChore}
              color='primary'
              startDecorator={<Unarchive />}
            >
              {t('choreView.unarchive')}
            </Button>
          </Box>
        ) : (
          // Active chore - show all normal actions
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              alignContent: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                gap: 1,
                alignContent: 'center',
                justifyContent: 'center',
                mb: 1,
              }}
            >
              {chore.status === 3 ? (
                // Pending approval: Show approve/reject for admins/managers/owners, grayed out button for others
                canApproveReject() ? (
                  <>
                    <Button
                      fullWidth
                      size='lg'
                      onClick={handleApproveChore}
                      color='success'
                      startDecorator={<ThumbUp />}
                      sx={{
                        flex: 1,
                      }}
                    >
                      {t('choreView.approve')}
                    </Button>
                    <Button
                      fullWidth
                      size='lg'
                      onClick={handleRejectChore}
                      color='danger'
                      startDecorator={<ThumbDown />}
                      sx={{
                        flex: 1,
                      }}
                    >
                      <Box>{t('choreView.reject')}</Box>
                    </Button>
                  </>
                ) : (
                  <Button
                    fullWidth
                    size='lg'
                    disabled={true}
                    color='neutral'
                    startDecorator={<HourglassEmpty />}
                  >
                    <Box>{t('choreView.pendingApproval')}</Box>
                  </Button>
                )
              ) : (
                // Normal completion flow
                <>
                  <Button
                    fullWidth
                    size='lg'
                    onClick={handleTaskCompletion}
                    disabled={!!notInCompletionWindow(chore)}
                    color='success'
                    startDecorator={<Check />}
                    sx={{
                      flex: 4,
                    }}
                  >
                    <Box>{t('choreView.markAsDone')}</Box>
                  </Button>

                  <Button
                    fullWidth
                    size='lg'
                    onClick={confirmSkipTask}
                    disabled={!!notInCompletionWindow(chore)}
                    startDecorator={<SwitchAccessShortcut />}
                    sx={{
                      flex: 1,
                    }}
                  >
                    <Box>{t('choreView.skip')}</Box>
                  </Button>
                </>
              )}
            </Box>
            {notInCompletionWindow(chore) && (
              <Typography
                level='body-sm'
                sx={{ color: 'warning.plainColor', textAlign: 'center', mb: 1 }}
              >
                {t('choreView.availableToCompleteStarting', {
                  date: moment(chore.nextDueDate)
                    .subtract(chore.completionWindow, 'hours')
                    .format('MM/DD/YYYY hh:mm A'),
                })}
              </Typography>
            )}
            {/* Timer Button - Show split button when timer is active, regular button otherwise */}
            {TIMER_STATUSES.includes(chore.status) ? (
              <TimerSplitButton
                disabled={
                  chore.status === ChoreStatus.PAUSED &&
                  !!notInCompletionWindow(chore)
                }
                chore={chore}
                onAction={(action: string) => {
                  if (action === 'pause') {
                    handleChorePause()
                  } else if (action === 'resume') {
                    handleChoreStart()
                  }
                }}
                onShowDetails={() => navigate(`/chores/${choreId}/timer`)}
                onResetTimer={handleResetTimer}
                onClearAllTime={handleClearAllTime}
                fullWidth
              />
            ) : chore.status === ChoreStatus.PENDING_APPROVAL ? (
              <></>
            ) : (
              <Button
                size='lg'
                onClick={() => {
                  handleChoreStart()
                }}
                variant='soft'
                color='success'
                disabled={!!notInCompletionWindow(chore)}
                startDecorator={<PlayArrow />}
                sx={{
                  flex: 1,
                }}
              >
                {t('choreView.start')}
              </Button>
            )}
          </Box>
        )}

        <ConfirmationModal config={confirmModelConfig} />
        <ConfirmationModal config={timerActionConfig} />
        <NoteViewerModal config={noteViewerConfig} />
        {activeModal === 'changeDueDate' && (
          <DueDatePickerModal
            open={true}
            title={t('choreView.changeDueDate', 'Change due date')}
            {...splitDueDate(chore.nextDueDate)}
            onClose={() => setActiveModal(null)}
            onApply={(parts: ReturnType<typeof splitDueDate>) => {
              handleDueDateChange(combineDueDate(parts)?.toISOString() ?? null)
              setActiveModal(null)
            }}
            onRemove={() => {
              handleDueDateChange(null)
              setActiveModal(null)
            }}
            applyLabel={undefined}
            excludeChoreIds={undefined}
          />
        )}
        {activeModal === 'changeAssignee' && (
          <AssigneeModal
            isOpen={true}
            members={performers as never[]}
            assignedTo={chore.assignedTo}
            title={t('choreView.delegateToSomeoneElse')}
            onClose={() => setActiveModal(null)}
            onSave={handleAssigneeChange}
          />
        )}
        {activeModal === 'nudge' && (
          <NudgeModal
            config={{
              isOpen: true,
              choreId: chore.id,
              onClose: () => setActiveModal(null),
              onConfirm: handleNudge,
            }}
          />
        )}
        {activeModal === 'writeNFC' && (
          <WriteNFCModal
            config={{
              isOpen: true,
              url: getNFCUrl(choreId),
              onClose: () => setActiveModal(null),
            }}
          />
        )}
        <AttachmentBrowserModal
          choreId={choreId}
          isOpen={attachmentBrowserOpen}
          onClose={() => setAttachmentBrowserOpen(false)}
        />
      </Card>
    </Container>
  )
}

export default ChoreView
