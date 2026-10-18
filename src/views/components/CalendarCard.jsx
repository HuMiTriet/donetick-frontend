import { CalendarMonth } from '@mui/icons-material'
import { Box, Typography } from '@mui/joy'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import CalendarDayTasks, { CalendarPriorityLegend } from './CalendarDayTasks'
import CalendarMonthly from './CalendarMonthly'

const CalendarCard = ({ chores }) => {
  const { t } = useTranslation('chores')

  const [selectedDate, setSeletedDate] = useState(null)
  const Navigate = useNavigate()

  // Auto-update selected calendar date when day changes
  useEffect(() => {
    if (!selectedDate) {
      return
    }

    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0) // Set to start of tomorrow

    const msUntilTomorrow = tomorrow.getTime() - now.getTime()

    const timeout = setTimeout(() => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      // Check if selected date is now yesterday and update to today
      if (selectedDate.toDateString() === yesterday.toDateString()) {
        setSeletedDate(today)
      }
    }, msUntilTomorrow)

    return () => clearTimeout(timeout)
  }, [selectedDate])

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Calendar Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 1,
          maxWidth: '250px',
          mb: 2,
        }}
      >
        <CalendarMonth />
        <Typography level='title-md'>{t('calendarCard.title')}</Typography>
      </Box>

      <div>
        <CalendarMonthly
          // className={styled.reactCalendar}
          chores={chores}
          onDateChange={date => {
            setSeletedDate(date)
          }}
        />
      </div>

      {!selectedDate && <CalendarPriorityLegend chores={chores} />}
      {selectedDate && (
        <CalendarDayTasks
          chores={chores}
          date={selectedDate}
          onChoreClick={chore => Navigate('/chores/' + chore.id)}
        />
      )}
    </div>
  )
}

export default CalendarCard
