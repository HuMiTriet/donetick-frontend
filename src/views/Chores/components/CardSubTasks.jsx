import { Checklist, ExpandMore } from '@mui/icons-material'
import { Box, Chip } from '@mui/joy'
import PropTypes from 'prop-types'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useCachedSubTasks } from '../../../queries/SubtaskQueries'
import SubTasks from '../../components/SubTask'

/**
 * Done/total subtask chip for a chore card. With `onToggle` it also expands
 * and collapses the card's subtask list; without it, it only shows progress.
 */
export const SubTaskCountChip = ({
  expanded = false,
  onToggle,
  size,
  subTasks,
  sx,
}) => {
  const { t } = useTranslation('chores')
  if (!subTasks.length) return null

  const done = subTasks.filter(task => task.completedAt).length
  const total = subTasks.length
  const iconSx = { fontSize: size === 'sm' ? 14 : 18 }

  return (
    <Chip
      variant='soft'
      color={done === total ? 'success' : 'neutral'}
      size={size}
      startDecorator={<Checklist sx={iconSx} />}
      endDecorator={
        onToggle && (
          <ExpandMore
            sx={{
              ...iconSx,
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        )
      }
      onClick={
        onToggle
          ? event => {
              event.stopPropagation()
              onToggle()
            }
          : undefined
      }
      slotProps={{
        action: {
          'aria-expanded': expanded,
          'aria-label': t(
            expanded ? 'choreCard.hideSubtasks' : 'choreCard.showSubtasks',
          ),
        },
      }}
      title={t('choreCard.subtaskProgress', { done, total })}
      sx={{ whiteSpace: 'nowrap', flexShrink: 0, ...sx }}
    >
      {done}/{total}
    </Chip>
  )
}

/**
 * The subtask list an expanded chore card shows. Checking a subtask updates
 * the chore list cache right away, then refetches once the server settles.
 */
export const CardSubTaskList = ({ choreId, performers, subTasks, sx }) => {
  const { refreshChores, setCachedSubTasks } = useCachedSubTasks()
  // Refetch only once every toggle in flight has settled, so a quick run of
  // checks doesn't flicker back through the server's in-between states
  const pendingToggles = useRef(0)

  const setTasks = next => {
    pendingToggles.current += 1
    setCachedSubTasks(
      choreId,
      typeof next === 'function' ? next(subTasks) : next,
    )
  }

  const handleToggleSettled = () => {
    pendingToggles.current = Math.max(0, pendingToggles.current - 1)
    if (pendingToggles.current === 0) refreshChores()
  }

  return (
    <Box
      // Taps on the list must not open the chore
      onClick={event => event.stopPropagation()}
      sx={{
        mt: 1,
        pt: 0.5,
        borderTop: '1px solid',
        borderColor: 'divider',
        cursor: 'default',
        ...sx,
      }}
    >
      <SubTasks
        editMode={false}
        choreId={choreId}
        performers={performers}
        tasks={subTasks}
        setTasks={setTasks}
        onToggleSettled={handleToggleSettled}
      />
    </Box>
  )
}

SubTaskCountChip.propTypes = {
  expanded: PropTypes.bool,
  onToggle: PropTypes.func,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  subTasks: PropTypes.arrayOf(PropTypes.object).isRequired,
  sx: PropTypes.object,
}

CardSubTaskList.propTypes = {
  choreId: PropTypes.number.isRequired,
  performers: PropTypes.arrayOf(PropTypes.object),
  subTasks: PropTypes.arrayOf(PropTypes.object).isRequired,
  sx: PropTypes.object,
}
