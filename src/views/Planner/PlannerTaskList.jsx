import { Draggable } from '@fullcalendar/react/interaction'
import { Box, Chip, Sheet, Typography } from '@mui/joy'
import PropTypes from 'prop-types'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { getPriorityColor } from '../../utils/Colors'
import { blockSeconds } from './timeBlocks'

const formatDuration = (seconds, t) => {
  const minutes = Math.round(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours && rest)
    return t('planner.duration.hoursMinutes', { hours, minutes: rest })
  if (hours) return t('planner.duration.hours', { hours })
  return t('planner.duration.minutes', { minutes })
}

const Dot = ({ color, size = 8 }) => (
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

Dot.propTypes = {
  color: PropTypes.string.isRequired,
  size: PropTypes.number,
}

const TaskItem = ({ chore, compact, groupColor, onSelect, selected }) => {
  const { t } = useTranslation('chores')
  const seconds = blockSeconds(chore)
  const common = {
    'data-chore-id': chore.id,
    'data-title': chore.name,
    'data-duration': seconds,
    onClick: () => onSelect(selected ? null : chore.id),
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

TaskItem.propTypes = {
  chore: PropTypes.object.isRequired,
  compact: PropTypes.bool,
  groupColor: PropTypes.string.isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
}

const Section = ({ compact, group, onSelect, selectedId }) => {
  const items = group.content.map(chore => (
    <TaskItem
      key={chore.id}
      chore={chore}
      compact={compact}
      groupColor={group.color}
      selected={selectedId === chore.id}
      onSelect={onSelect}
    />
  ))
  if (compact) return items
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

Section.propTypes = {
  compact: PropTypes.bool,
  group: PropTypes.shape({
    name: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    content: PropTypes.array.isRequired,
  }).isRequired,
  selectedId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSelect: PropTypes.func.isRequired,
}

const PlannerTaskList = ({ compact, groups, onSelect, selectedId }) => {
  const { t } = useTranslation('chores')
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return undefined
    const draggable = new Draggable(containerRef.current, {
      itemSelector: '[data-chore-id]',
      longPressDelay: 300,
      eventData: el => ({
        title: el.dataset.title,
        duration: { seconds: Number(el.dataset.duration) },
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
            onSelect={onSelect}
          />
        ))
      )}
    </Box>
  )
}

PlannerTaskList.propTypes = {
  compact: PropTypes.bool,
  groups: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSelect: PropTypes.func.isRequired,
}

export default PlannerTaskList
