import type { EventInput } from '@fullcalendar/react'

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

export const blockSeconds = (chore: Chore): number => {
  const seconds = chore.estimatedDuration
  return seconds && seconds > 0 ? seconds : DEFAULT_BLOCK_SECONDS
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

export const choreToEvents = (chore: PlannerChore): EventInput[] => {
  if (!chore.nextDueDate) return []
  const due = new Date(chore.nextDueDate).getTime()
  const length = blockSeconds(chore) * 1000
  return templatesOf(chore).flatMap((template, index) => {
    const offset = offsetMs(template)
    if (!(offset < 0)) return []
    const end = new Date(due + offset)
    const extendedProps: BlockEventProps = {
      choreId: chore.id,
      templateIndex: index,
    }
    return {
      id: `${chore.id}:${index}`,
      title: chore.name,
      start: new Date(end.getTime() - length),
      end,
      color: getPriorityColor(chore.priority),
      editable: !chore._pendingCreate,
      extendedProps,
    }
  })
}

const endOfDay = (date: Date): Date => {
  const day = new Date(date)
  day.setHours(23, 59, 0, 0)
  return day
}

export const withBlockAt = (
  chore: PlannerChore,
  end: Date,
  seconds: number,
  index?: number,
): PlannerChore | null => {
  const due = chore.nextDueDate ? new Date(chore.nextDueDate) : endOfDay(end)
  if (end.getTime() >= due.getTime()) return null
  const template = toTemplate(end.getTime() - due.getTime())
  const templates = [...templatesOf(chore)]
  if (index !== undefined) {
    templates[index] = template
  } else if (!templates.some(t => offsetMs(t) === offsetMs(template))) {
    templates.push(template)
  }
  return {
    ...chore,
    ...(!chore.nextDueDate && {
      dueDate: due.toISOString(),
      nextDueDate: due.toISOString(),
    }),
    notification: true,
    notificationMetadata: {
      circleGroupID: null,
      ...chore.notificationMetadata,
      templates,
    },
    estimatedDuration: seconds,
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

export const isMine = (chore: Chore, userId: number): boolean =>
  !chore.assignedTo || chore.assignedTo === userId
