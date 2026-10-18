import moment from 'moment'

import { getPriorityColor } from '../../utils/Colors'
import styles from './Calendar.module.css'

// Local calendar day a date falls on, used to bucket chores by due day.
export const toDayKey = date => moment(date).format('YYYY-MM-DD')

export const groupChoresByDay = chores => {
  const byDay = new Map()
  for (const chore of chores) {
    if (!chore.nextDueDate) continue
    const key = toDayKey(chore.nextDueDate)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(chore)
  }
  return byDay
}

// Priority dots under a calendar day: one per task, or a single bar coloured
// by the first task once there are more than three.
const CalendarChoreDots = ({ dayChores = [] }) => {
  if (dayChores.length === 0) {
    return (
      <div className={styles.dotContainer}>
        <span className={styles.dotEmpty}></span>
      </div>
    )
  }
  if (dayChores.length > 3) {
    return (
      <div className={styles.dotContainer}>
        <span
          className={styles.dotWithLine}
          style={{
            backgroundColor: getPriorityColor(dayChores[0].priority),
          }}
        ></span>
      </div>
    )
  }

  return (
    <div className={styles.dotContainer}>
      {dayChores.map(chore => (
        <span
          key={chore.id}
          className={styles.dot}
          style={{
            backgroundColor: getPriorityColor(chore.priority),
          }}
        ></span>
      ))}
    </div>
  )
}

export default CalendarChoreDots
