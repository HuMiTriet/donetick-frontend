import { getPriorityColor } from '../../utils/Colors'

export const DEFAULT_BLOCK_SECONDS = 30 * 60

const MINUTE_MS = 60 * 1000
const UNIT_MS = { m: MINUTE_MS, h: 60 * MINUTE_MS, d: 24 * 60 * MINUTE_MS }

export const blockSeconds = chore =>
  chore?.estimatedDuration > 0 ? chore.estimatedDuration : DEFAULT_BLOCK_SECONDS

export const offsetMs = template =>
  Number(template?.value) * (UNIT_MS[template?.unit] ?? MINUTE_MS)

export const toTemplate = ms => {
  const minutes = Math.round(ms / MINUTE_MS)
  if (minutes % (24 * 60) === 0)
    return { value: minutes / (24 * 60), unit: 'd' }
  if (minutes % 60 === 0) return { value: minutes / 60, unit: 'h' }
  return { value: minutes, unit: 'm' }
}

const templatesOf = chore => chore?.notificationMetadata?.templates ?? []

export const choreToEvents = chore => {
  if (!chore.nextDueDate) return []
  const due = new Date(chore.nextDueDate).getTime()
  const length = blockSeconds(chore) * 1000
  return templatesOf(chore).flatMap((template, index) => {
    const offset = offsetMs(template)
    if (!(offset < 0)) return []
    const end = new Date(due + offset)
    return {
      id: `${chore.id}:${index}`,
      title: chore.name,
      start: new Date(end.getTime() - length),
      end,
      color: getPriorityColor(chore.priority),
      editable: !chore._pendingCreate,
      extendedProps: { choreId: chore.id, templateIndex: index },
    }
  })
}

const endOfDay = date => {
  const day = new Date(date)
  day.setHours(23, 59, 0, 0)
  return day
}

export const withBlockAt = (chore, end, seconds, index) => {
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
    notificationMetadata: { ...chore.notificationMetadata, templates },
    estimatedDuration: seconds,
  }
}

export const dueMarkers = chores => {
  const byInstant = new Map()
  for (const chore of chores) {
    if (!chore.nextDueDate) continue
    const at = new Date(chore.nextDueDate).getTime()
    byInstant.set(at, [...(byInstant.get(at) ?? []), chore])
  }
  return [...byInstant].map(([at, dueChores]) => ({
    id: `due-${at}`,
    start: new Date(at),
    end: new Date(at + MINUTE_MS),
    display: 'background',
    editable: false,
    extendedProps: { dueChores },
  }))
}

export const isMine = (chore, userId) =>
  !chore.assignedTo || chore.assignedTo === userId
