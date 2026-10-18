import { useMemo } from 'react'
import Calendar from 'react-calendar'

import { useLocalization } from '../../contexts/LocalizationContext'
import styles from './Calendar.module.css'
import CalendarChoreDots, {
  groupChoresByDay,
  toDayKey,
} from './CalendarChoreDots'
const CalendarMonthly = ({ chores, onDateChange }) => {
  const { firstDayOfWeek } = useLocalization()
  const calendarType =
    firstDayOfWeek === 1
      ? 'iso8601'
      : firstDayOfWeek === 6
        ? 'islamic'
        : 'gregory'
  const choresByDay = useMemo(() => groupChoresByDay(chores), [chores])
  const tileContent = ({ date, view }) =>
    view === 'month' ? (
      <CalendarChoreDots dayChores={choresByDay.get(toDayKey(date))} />
    ) : null
  return (
    <div className={styles.reactCalendar}>
      <Calendar
        tileContent={tileContent}
        calendarType={calendarType}
        onChange={d => {
          onDateChange(new Date(d))
        }}
        // format the days from MON, TUE, WED, THU, FRI, SAT, SUN to first three letters:
        formatShortWeekday={(locale, date) =>
          ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()]
        }
        // format month names to show only first 3 characters
        formatMonth={(locale, date) => {
          const monthNames = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
          ]
          return monthNames[date.getMonth()]
        }}
      />
    </div>
  )
}

export default CalendarMonthly
