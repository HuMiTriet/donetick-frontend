import { Avatar, Box, Chip, Grid, Typography } from '@mui/joy'
import moment from 'moment'
import { useTranslation } from 'react-i18next'

import { useLocalization } from '../../contexts/LocalizationContext'
import { useCircleMembers, useUserProfile } from '../../queries/UserQueries'
import { getPriorityColor, TASK_COLOR } from '../../utils/Colors'
import { toDayKey } from './CalendarChoreDots'

const getAssigneeColor = (assignee, userProfile) => {
  return assignee === userProfile?.id
    ? TASK_COLOR.ASSIGNED_TO_ME
    : TASK_COLOR.ASSIGNED_TO_OTHER
}

// Legend for the priority dots, listing only the priorities present in `chores`.
export const CalendarPriorityLegend = ({ chores, sx }) => {
  const { t } = useTranslation('chores')

  const priorityLevels = new Set(
    chores.map(chore => chore.priority).filter(p => p !== undefined),
  )
  const legendItems = []

  // Add priority levels that exist in the chores
  if (priorityLevels.has(1)) {
    legendItems.push({
      name: t('calendarCard.highPriority'),
      color: TASK_COLOR.PRIORITY_1,
    })
  }
  if (priorityLevels.has(2)) {
    legendItems.push({
      name: t('calendarCard.mediumPriority'),
      color: TASK_COLOR.PRIORITY_2,
    })
  }
  if (priorityLevels.has(3)) {
    legendItems.push({
      name: t('calendarCard.lowPriority'),
      color: TASK_COLOR.PRIORITY_3,
    })
  }
  if (priorityLevels.has(4)) {
    legendItems.push({
      name: t('calendarCard.lowestPriority'),
      color: TASK_COLOR.PRIORITY_4,
    })
  }
  if (
    chores.some(
      chore => chore.priority === undefined || chore.priority === null,
    )
  ) {
    legendItems.push({
      name: t('calendarCard.noPriority'),
      color: TASK_COLOR.NO_PRIORITY,
    })
  }

  return (
    <Grid
      container
      // start from left:
      sx={{
        ml: 3,
        mt: 1,
        width: '100%',
        display: 'flex',
        justifyContent: 'start',
        ...sx,
      }}
    >
      {legendItems.map((item, index) => (
        <Grid
          key={index}
          xs={6}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'start',
          }}
        >
          <Box
            sx={{
              display: 'inline-block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              backgroundColor: item.color,
            }}
          />
          <Typography level='body-xs' ml={0.5}>
            {item.name}
          </Typography>
        </Grid>
      ))}
    </Grid>
  )
}

// The tasks due on `date`, soonest first. Rows are only clickable when
// `onChoreClick` is given.
const CalendarDayTasks = ({ chores, date, onChoreClick, sx }) => {
  const { t } = useTranslation('chores')
  const { data: userProfile } = useUserProfile()
  const { fmt } = useLocalization()

  // Fetch circle members data to get assignee names
  const { data: circleMembersData } = useCircleMembers()
  const circleMembers = circleMembersData?.res || []

  // Helper function to get assignee display name
  const getAssigneeName = assignedTo => {
    if (assignedTo === userProfile?.id) {
      return userProfile.displayName
    }
    const assignee = circleMembers.find(member => member.userId === assignedTo)
    return assignee
      ? `${assignee.displayName}`
      : t('calendarCard.assignedToOther')
  }

  const dayKey = toDayKey(date)
  const dayChores = chores
    .filter(
      chore => chore.nextDueDate && toDayKey(chore.nextDueDate) === dayKey,
    )
    .sort((a, b) => moment(a.nextDueDate).diff(moment(b.nextDueDate)))

  return (
    <Box
      sx={{
        mt: 2,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        ...sx,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <Typography level='title-md'>{fmt.date(date)}</Typography>
        <Chip variant='soft' color='primary' size='md'>
          {t('calendarCard.tasksCount', { count: dayChores.length })}
        </Chip>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          overflowY: 'auto',
          maxHeight: '170px',

          p: 1,
        }}
      >
        {dayChores.map(chore => (
          <Box
            key={chore.id}
            onClick={onChoreClick ? () => onChoreClick(chore) : undefined}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.25,
              cursor: onChoreClick ? 'pointer' : 'default',
              position: 'relative',
              pl: '16px',
              py: 0.75,
              transition: 'all 0.2s ease-in-out',
              borderRadius: 'sm',
              '&:hover': onChoreClick
                ? {
                    bgcolor: 'background.level1',
                  }
                : undefined,
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '3px',
                backgroundColor: getPriorityColor(chore.priority),
                borderRadius: '2px',
              },
            }}
          >
            <Typography
              level='body-sm'
              sx={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'text.primary',
              }}
            >
              {chore.name}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography
                level='body-xs'
                sx={{
                  color: 'neutral.500',
                }}
              >
                {fmt.time(chore.nextDueDate)}
              </Typography>
              <Chip
                variant='soft'
                color='neutral'
                size='sm'
                startDecorator={
                  <Avatar
                    src={
                      circleMembers.find(
                        member => member.userId === chore.assignedTo,
                      )?.image
                    }
                  />
                }
                sx={{
                  backgroundColor: getAssigneeColor(
                    chore.assignedTo,
                    userProfile,
                  ),
                  color: 'white',
                }}
              >
                {getAssigneeName(chore.assignedTo)}
              </Chip>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export default CalendarDayTasks
