import { Draggable } from '@fullcalendar/react/interaction'
import { Box, Chip, Sheet, Typography } from '@mui/joy'
import type { PointerEvent } from 'react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { getPriorityColor } from '../../utils/Colors'
import type { ChoreGroup, PlannerChore } from './timeBlocks'
import { blockSeconds, formatDuration } from './timeBlocks'

type ItemClick = (chore: PlannerChore) => void

const CLICK_SLOP_PX = 6

type DotProps = {
  color: string
  size?: number
}

const Dot = ({ color, size = 8 }: DotProps) => (
  <Box
    sx={{
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      bgcolor: color,
    }}
  />
)

type TaskItemProps = {
  chore: PlannerChore
  compact?: boolean
  groupColor: string
  selected: boolean
  onItemClick: ItemClick
}

const TaskItem = ({
  chore,
  compact,
  groupColor,
  onItemClick,
  selected,
}: TaskItemProps) => {
  const { t } = useTranslation('chores')
  const seconds = blockSeconds(chore)
  const dragged = useRef(false)
  const common = {
    'data-chore-id': chore.id,
    'data-title': chore.name,
    'data-duration': seconds,
    'data-color': getPriorityColor(chore.priority),
    onPointerDown: (event: PointerEvent) => {
      dragged.current = false
      const start = { x: event.clientX, y: event.clientY }
      const track = (move: globalThis.PointerEvent) => {
        if (
          Math.hypot(move.clientX - start.x, move.clientY - start.y) >
          CLICK_SLOP_PX
        ) {
          dragged.current = true
        }
      }
      const stop = () => {
        document.removeEventListener('pointermove', track)
        document.removeEventListener('pointerup', stop)
        document.removeEventListener('pointercancel', stop)
      }
      document.addEventListener('pointermove', track)
      document.addEventListener('pointerup', stop)
      document.addEventListener('pointercancel', stop)
    },
    onClick: () => {
      if (!dragged.current) onItemClick(chore)
      dragged.current = false
    },
  }

  if (compact) {
    return (
      <Chip
        {...common}
        variant={selected ? 'solid' : 'soft'}
        color={selected ? 'primary' : 'neutral'}
        startDecorator={<Dot color={groupColor} />}
        sx={{ flexShrink: 0, cursor: 'grab', touchAction: 'pan-x' }}
      >
        {chore.name}
      </Chip>
    )
  }

  return (
    <Sheet
      {...common}
      variant={selected ? 'soft' : 'outlined'}
      color={selected ? 'primary' : 'neutral'}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: 'sm',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <Dot color={getPriorityColor(chore.priority)} />
      <Typography level='body-sm' noWrap sx={{ flex: 1 }}>
        {chore.name}
      </Typography>
      <Typography level='body-xs' color='neutral'>
        {formatDuration(seconds, t)}
      </Typography>
    </Sheet>
  )
}

type SectionProps = {
  compact?: boolean
  group: ChoreGroup
  selectedId: number | null
  onItemClick: ItemClick
}

const Section = ({ compact, group, onItemClick, selectedId }: SectionProps) => {
  const items = group.content.map(chore => (
    <TaskItem
      key={chore.id}
      chore={chore}
      compact={compact}
      groupColor={group.color}
      selected={selectedId === chore.id}
      onItemClick={onItemClick}
    />
  ))
  if (compact) return <>{items}</>
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Dot color={group.color} size={10} />
        <Typography level='title-sm'>
          {group.name} ({group.content.length})
        </Typography>
      </Box>
      {items}
    </Box>
  )
}

type PlannerTaskListProps = {
  compact?: boolean
  groups: ChoreGroup[]
  selectedId: number | null
  onItemClick: ItemClick
}

const PlannerTaskList = ({
  compact,
  groups,
  onItemClick,
  selectedId,
}: PlannerTaskListProps) => {
  const { t } = useTranslation('chores')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return undefined
    const draggable = new Draggable(containerRef.current, {
      itemSelector: '[data-chore-id]',
      longPressDelay: 300,
      eventData: (el: HTMLElement) => ({
        title: el.dataset['title'],
        duration: { seconds: Number(el.dataset['duration']) },
        color: el.dataset['color'],
        create: false,
      }),
    })
    return () => draggable.destroy()
  }, [])

  return (
    <Box
      ref={containerRef}
      sx={
        compact
          ? {
              display: 'flex',
              gap: 1,
              overflowX: 'auto',
              pb: 0.5,
              '&::-webkit-scrollbar': { display: 'none' },
            }
          : { display: 'flex', flexDirection: 'column', gap: 2 }
      }
    >
      {groups.length === 0 ? (
        <Typography level='body-sm' color='neutral'>
          {t('planner.allPlanned')}
        </Typography>
      ) : (
        groups.map(group => (
          <Section
            key={group.name}
            compact={compact}
            group={group}
            selectedId={selectedId}
            onItemClick={onItemClick}
          />
        ))
      )}
    </Box>
  )
}

export default PlannerTaskList
