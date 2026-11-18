import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'

import type {
  CalendarController,
  DropInfo,
  EventDragStopInfo,
  EventDropInfo,
  EventResizeDoneInfo,
} from '@fullcalendar/react'
import FullCalendar from '@fullcalendar/react'
import interactionPlugin from '@fullcalendar/react/interaction'
import classicThemePlugin from '@fullcalendar/react/themes/classic'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import { DeleteOutline } from '@mui/icons-material'
import { Box, Sheet, Tooltip, Typography } from '@mui/joy'
import moment from 'moment'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  TIME_FORMATS,
  useLocalization,
} from '../../contexts/LocalizationContext'
import { priorityOrder } from '../../utils/Chores'
import { getPriorityColor } from '../../utils/Colors'
import styles from './TimeBlockCalendar.module.css'
import type {
  BlockEventProps,
  DueMarkerProps,
  PlannerChore,
  PlannerView,
} from './timeBlocks'
import { blockSeconds, choreToEvents, dueMarkers } from './timeBlocks'

const PLUGINS = [timeGridPlugin, interactionPlugin, classicThemePlugin]

type Point = { x: number; y: number }

const pointOf = (event: MouseEvent | TouchEvent): Point | null => {
  if ('changedTouches' in event) {
    const touch = event.changedTouches[0]
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }
  return { x: event.clientX, y: event.clientY }
}

const contains = (el: HTMLElement | null, point: Point | null) => {
  const rect = el?.getBoundingClientRect()
  return Boolean(
    point &&
    rect &&
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom,
  )
}

type Localization = {
  firstDayOfWeek: number
  isRTL: boolean
  timeFormat: string
}

type DueLineProps = {
  dueChores: PlannerChore[]
  hour12: boolean
  onChoreClick: (chore: PlannerChore) => void
}

const DueLine = ({ dueChores, hour12, onChoreClick }: DueLineProps) => {
  const { t } = useTranslation('chores')
  const time = moment(dueChores[0]?.nextDueDate).format(
    hour12 ? 'h:mm A' : 'HH:mm',
  )
  const topPriority = Math.min(
    ...dueChores.map(chore => priorityOrder.indexOf(chore.priority)),
  )
  const color = getPriorityColor(priorityOrder[topPriority])
  return (
    <Tooltip
      placement='top'
      variant='outlined'
      arrow
      title={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {dueChores.map(chore => (
            <Typography key={chore.id} level='title-sm'>
              {chore.name}
            </Typography>
          ))}
          <Typography level='body-xs' color='danger'>
            {t('planner.dueAt', { time })}
          </Typography>
        </Box>
      }
    >
      <div
        className={styles['dueHit']}
        data-due-line
        onClick={() => {
          const [only] = dueChores
          if (dueChores.length === 1 && only) onChoreClick(only)
        }}
      >
        <div className={styles['dueLine']} style={{ backgroundColor: color }} />
      </div>
    </Tooltip>
  )
}

export type SaveBlock = (
  chore: PlannerChore,
  end: Date,
  seconds: number,
  index?: number,
  revert?: () => void,
) => void

export type RemoveBlock = (chore: PlannerChore, index: number) => void

type TimeBlockCalendarProps = {
  chores: PlannerChore[]
  controller: CalendarController
  initialView: PlannerView
  onChoreClick: (chore: PlannerChore) => void
  onRemove: RemoveBlock
  onSave: SaveBlock
  onSlotClick: (date: Date) => void
}

const TimeBlockCalendar = ({
  chores,
  controller,
  initialView,
  onChoreClick,
  onRemove,
  onSave,
  onSlotClick,
}: TimeBlockCalendarProps) => {
  const { t } = useTranslation('chores')
  const { firstDayOfWeek, isRTL, timeFormat } =
    useLocalization() as Localization
  const hour12 = timeFormat === TIME_FORMATS.HOUR_12

  const choresById = useMemo(
    () => new Map(chores.map(chore => [String(chore.id), chore])),
    [chores],
  )

  const events = useMemo(
    () => [...chores.flatMap(choreToEvents), ...dueMarkers(chores)],
    [chores],
  )

  const scrollTime = useMemo(
    () => moment().subtract(1, 'hour').format('HH:00:00'),
    [],
  )

  const handleChange = (info: EventDropInfo | EventResizeDoneInfo) => {
    const { choreId, templateIndex } = info.event
      .extendedProps as BlockEventProps
    const chore = choresById.get(String(choreId))
    const { end, start } = info.event
    if (!chore || !start || !end) {
      info.revert()
      return
    }
    onSave(
      chore,
      end,
      Math.round((end.getTime() - start.getTime()) / 1000),
      templateIndex,
      info.revert,
    )
  }

  const trashRef = useRef<HTMLDivElement>(null)
  const removingId = useRef<string | null>(null)
  const stopTracking = useRef<(() => void) | null>(null)
  const [dragging, setDragging] = useState(false)
  const [overTrash, setOverTrash] = useState(false)

  useEffect(() => () => stopTracking.current?.(), [])

  const handleDragStart = () => {
    removingId.current = null
    setDragging(true)
    const track = (event: PointerEvent | TouchEvent) =>
      setOverTrash(contains(trashRef.current, pointOf(event)))
    document.addEventListener('pointermove', track)
    document.addEventListener('touchmove', track, { passive: true })
    stopTracking.current = () => {
      document.removeEventListener('pointermove', track)
      document.removeEventListener('touchmove', track)
    }
  }

  const handleDragStop = (info: EventDragStopInfo) => {
    stopTracking.current?.()
    stopTracking.current = null
    const dropped = contains(trashRef.current, pointOf(info.jsEvent))
    setDragging(false)
    setOverTrash(false)
    if (!dropped) return
    const { choreId, templateIndex } = info.event
      .extendedProps as BlockEventProps
    const chore = choresById.get(String(choreId))
    if (!chore) return
    removingId.current = info.event.id
    onRemove(chore, templateIndex)
  }

  const handleMove = (info: EventDropInfo) => {
    if (removingId.current === info.event.id) {
      removingId.current = null
      info.revert()
      return
    }
    handleChange(info)
  }

  const handleDrop = (info: DropInfo) => {
    const chore = choresById.get(info.draggedEl.dataset['choreId'] ?? '')
    if (!chore) return
    const seconds = blockSeconds(chore)
    onSave(chore, new Date(info.date.getTime() + seconds * 1000), seconds)
  }

  return (
    <div className={styles['calendar']}>
      <FullCalendar
        plugins={PLUGINS}
        controller={controller}
        initialView={initialView}
        headerToolbar={false}
        height='100%'
        allDaySlot={false}
        nowIndicator
        nowIndicatorLineClass={styles['nowLine']}
        nowIndicatorHeaderClass={styles['nowHeader']}
        nowIndicatorHeaderContent={arg => (
          <span className={styles['nowPill']}>
            {moment(arg.date).format(hour12 ? 'h:mm' : 'HH:mm')}
          </span>
        )}
        editable
        droppable
        eventResizableFromStart
        slotDuration='00:15'
        slotHeaderInterval='01:00'
        scrollTime={scrollTime}
        firstDay={firstDayOfWeek}
        direction={isRTL ? 'rtl' : 'ltr'}
        longPressDelay={300}
        events={events}
        eventDragStart={handleDragStart}
        eventDragStop={handleDragStop}
        eventDrop={handleMove}
        eventResize={handleChange}
        drop={handleDrop}
        dateClick={info => onSlotClick(info.date)}
        eventClick={info => {
          const { choreId } = info.event.extendedProps as BlockEventProps
          const chore = choresById.get(String(choreId))
          if (chore) onChoreClick(chore)
        }}
        backgroundEventClass={styles['dueMarker']}
        backgroundEventContent={arg => (
          <DueLine
            dueChores={(arg.event.extendedProps as DueMarkerProps).dueChores}
            hour12={hour12}
            onChoreClick={onChoreClick}
          />
        )}
        dayHeaderContent={arg => moment(arg.date).format('ddd D')}
        slotHeaderFormat={{
          hour: 'numeric',
          minute: '2-digit',
          omitZeroMinute: true,
          hour12,
        }}
        eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12 }}
      />
      {dragging && (
        <Sheet
          ref={trashRef}
          variant={overTrash ? 'solid' : 'soft'}
          color='danger'
          sx={{
            position: 'fixed',
            insetInline: 0,
            bottom: 0,
            height: 'calc(88px + var(--safe-area-inset-bottom, 0px))',
            pb: 'var(--safe-area-inset-bottom, 0px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            borderTop: '1px solid',
            borderColor: 'danger.outlinedBorder',
            zIndex: 'var(--joy-zIndex-modal)',
            pointerEvents: 'none',
          }}
          data-remove-zone
        >
          <DeleteOutline />
          <Typography level='title-sm' textColor='inherit'>
            {t('planner.dropToRemove')}
          </Typography>
        </Sheet>
      )}
    </div>
  )
}

export default TimeBlockCalendar
