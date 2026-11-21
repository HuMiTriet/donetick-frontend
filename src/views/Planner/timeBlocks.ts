import type { EventInput } from '@fullcalendar/react'
import type { TFunction } from 'i18next'

import type { Chore, NotificationTemplate } from '../../types/models'
import { getPriorityColor } from '../../utils/Colors'

export type PlannerView = 'timeGridDay' | 'timeGridWeek'

export type PlannerChore = Chore & {
  _pendingCreate?: boolean
  dueDate?: string
}

export type ChoreGroup = {
  name: string
  color: string
  content: PlannerChore[]
}

export type BlockEventProps = {
  choreId: number
  templateIndex: number
}

export type DueMarkerProps = {
  dueChores: PlannerChore[]
}

export const DEFAULT_BLOCK_SECONDS = 30 * 60

const MINUTE_MS = 60 * 1000
const UNIT_MS: Record<string, number> = {
  m: MINUTE_MS,
  h: 60 * MINUTE_MS,
  d: 24 * 60 * MINUTE_MS,
}

export const SLOT_MINUTES = 15
const SLOT_MS = SLOT_MINUTES * MINUTE_MS

const roundToSlot = (ms: number): number => Math.round(ms / SLOT_MS) * SLOT_MS

export const blockSeconds = (chore: Chore): number => {
  const seconds = chore.estimatedDuration
  return seconds && seconds > 0 ? seconds : DEFAULT_BLOCK_SECONDS
}

export const formatDuration = (seconds: number, t: TFunction): string => {
  const minutes = Math.round(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours && rest)
    return t('planner.duration.hoursMinutes', { hours, minutes: rest })
  if (hours) return t('planner.duration.hours', { hours })
  return t('planner.duration.minutes', { minutes })
}

export const offsetMs = (template: NotificationTemplate): number =>
  Number(template.value) * (UNIT_MS[template.unit] ?? MINUTE_MS)

export const toTemplate = (ms: number): NotificationTemplate => {
  const minutes = Math.round(ms / MINUTE_MS)
  if (minutes % (24 * 60) === 0)
    return { value: minutes / (24 * 60), unit: 'd' }
  if (minutes % 60 === 0) return { value: minutes / 60, unit: 'h' }
  return { value: minutes, unit: 'm' }
}

const templatesOf = (chore: Chore): NotificationTemplate[] =>
  chore.notificationMetadata?.templates ?? []

export const isOverDue = (chore: Chore): boolean =>
  Boolean(chore.nextDueDate) &&
  Date.now() > new Date(chore.nextDueDate as string).getTime()

const isOffsetValid = (chore: Chore, offset: number): boolean =>
  offset < 0 || (isOverDue(chore) && offset > 0)

export const choreToEvents = (chore: PlannerChore): EventInput[] => {
  if (!chore.nextDueDate) return []
  const due = roundToSlot(new Date(chore.nextDueDate).getTime())
  const duration = blockSeconds(chore) * 1000
  return templatesOf(chore).flatMap((template, index) => {
    const offset = offsetMs(template)
    if (!isOffsetValid(chore, offset)) return []
    const start = new Date(due + offset)
    const extendedProps: BlockEventProps = {
      choreId: chore.id,
      templateIndex: index,
    }
    return {
      id: `${chore.id}:${index}`,
      title: chore.name,
      start,
      end: new Date(start.getTime() + duration),
      color: getPriorityColor(chore.priority),
      editable: !chore._pendingCreate,
      extendedProps,
    }
  })
}

export const withBlockAt = (
  chore: PlannerChore,
  start: Date,
  seconds: number,
  index?: number,
): PlannerChore | null => {
  const endOfDay = new Date(start)
  endOfDay.setHours(23, 59, 59, 0)
  const dueDate = chore.nextDueDate ? new Date(chore.nextDueDate) : endOfDay
  const due = roundToSlot(dueDate.getTime())
  const blockStart = roundToSlot(start.getTime())
  const length = Math.max(SLOT_MS, roundToSlot(seconds * 1000))

  if (isOverDue(chore) ? blockStart === due : blockStart + length > due)
    return null

  const template = toTemplate(blockStart - due)
  const startOfTodayTime = new Date().setHours(0, 0, 0, 0)
  const templates = templatesOf(chore).filter((t, i) => {
    const offset = offsetMs(t)
    const isOldOverDueBlock =
      isOverDue(chore) &&
      isOffsetValid(chore, offset) &&
      due + offset < startOfTodayTime
    return i !== index && !isOldOverDueBlock
  })
  if (!templates.some(t => offsetMs(t) === offsetMs(template))) {
    templates.push(template)
  }
  return {
    ...chore,
    ...(!chore.nextDueDate && {
      dueDate: dueDate.toISOString(),
      nextDueDate: dueDate.toISOString(),
    }),
    notification: true,
    notificationMetadata: {
      circleGroupID: null,
      ...chore.notificationMetadata,
      templates,
    },
    estimatedDuration: length / 1000,
  }
}

export const withoutBlock = (
  chore: PlannerChore,
  index: number,
): PlannerChore => {
  const templates = templatesOf(chore).filter((_, i) => i !== index)
  return {
    ...chore,
    notification: chore.notification && templates.length > 0,
    notificationMetadata: {
      circleGroupID: null,
      ...chore.notificationMetadata,
      templates,
    },
  }
}

export const dueMarkers = (chores: PlannerChore[]): EventInput[] => {
  const byInstant = new Map<number, PlannerChore[]>()
  for (const chore of chores) {
    if (!chore.nextDueDate) continue
    const at = new Date(chore.nextDueDate).getTime()
    byInstant.set(at, [...(byInstant.get(at) ?? []), chore])
  }
  return [...byInstant].map(([at, dueChores]) => {
    const extendedProps: DueMarkerProps = { dueChores }
    return {
      id: `due-${at}`,
      start: new Date(at),
      end: new Date(at + MINUTE_MS),
      display: 'background',
      editable: false,
      extendedProps,
    }
  })
}

export const hasBlock = (chore: Chore): boolean => {
  if (!chore.nextDueDate) return false
  const due = roundToSlot(new Date(chore.nextDueDate).getTime())
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  return templatesOf(chore).some(template => {
    const offset = offsetMs(template)
    return (
      isOffsetValid(chore, offset) &&
      (!isOverDue(chore) || due + offset >= startOfToday)
    )
  })
}

export const isMine = (chore: Chore, userId: number): boolean =>
  !chore.assignedTo || chore.assignedTo === userId
