import { useCalendarController } from '@fullcalendar/react'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import {
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  IconButton,
  Sheet,
  Typography,
} from '@mui/joy'
import { useMediaQuery } from '@mui/material'
import moment from 'moment'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useChores } from '../../queries/ChoreQueries'
import { useUserProfile } from '../../queries/UserQueries'
import { ChoresGrouper, GROUPING_OPTIONS } from '../../utils/Chores'
import PlannerTaskList from './PlannerTaskList'
import TimeBlockCalendar from './TimeBlockCalendar'
import { blockSeconds, isMine } from './timeBlocks'
import { useTimeBlockActions } from './useTimeBlockActions'

const formatRangeTitle = view => {
  if (!view) return ''
  const start = moment(view.currentStart)
  if (view.type === 'timeGridDay') return start.format('dddd, MMM D')
  const end = moment(view.currentEnd).subtract(1, 'day')
  return start.isSame(end, 'month')
    ? `${start.format('MMM D')} – ${end.format('D, YYYY')}`
    : `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`
}

const PlannerView = () => {
  const { t } = useTranslation('chores')
  const navigate = useNavigate()
  const isDesktop = useMediaQuery(theme => theme.breakpoints.up('md'), {
    noSsr: true,
  })
  const controller = useCalendarController()
  const [initialView] = useState(isDesktop ? 'timeGridWeek' : 'timeGridDay')
  const [view, setView] = useState(initialView)
  const [scope, setScope] = useState('mine')
  const [selectedId, setSelectedId] = useState(null)
  const { data, isLoading } = useChores()
  const { data: userProfile } = useUserProfile()
  const { saveBlock } = useTimeBlockActions()

  const chores = useMemo(() => {
    const all = data?.res ?? []
    if (scope !== 'mine' || !userProfile) return all
    return all.filter(chore => isMine(chore, userProfile.id))
  }, [data, scope, userProfile])

  const groups = useMemo(
    () =>
      ChoresGrouper(
        GROUPING_OPTIONS.SMART,
        chores.filter(chore => !chore._pendingCreate),
      ),
    [chores],
  )

  const changeView = next => {
    setView(next)
    controller.changeView(next)
  }

  const handleSlotClick = date => {
    if (selectedId === null) return
    const chore = chores.find(c => c.id === selectedId)
    setSelectedId(null)
    if (!chore) return
    const seconds = blockSeconds(chore)
    saveBlock(chore, new Date(date.getTime() + seconds * 1000), seconds)
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '60vh',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box
      sx={{
        px: { xs: 1, md: 3 },
        pt: { xs: 1, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography level='h4' sx={{ mr: 'auto' }}>
          {formatRangeTitle(controller.view)}
        </Typography>
        <ButtonGroup size='sm' variant='outlined'>
          <Button
            variant={scope === 'mine' ? 'solid' : 'outlined'}
            onClick={() => setScope('mine')}
          >
            {t('planner.mine')}
          </Button>
          <Button
            variant={scope === 'all' ? 'solid' : 'outlined'}
            onClick={() => setScope('all')}
          >
            {t('planner.everyone')}
          </Button>
        </ButtonGroup>
        <ButtonGroup size='sm' variant='outlined'>
          <Button
            variant={view === 'timeGridDay' ? 'solid' : 'outlined'}
            onClick={() => changeView('timeGridDay')}
          >
            {t('planner.day')}
          </Button>
          <Button
            variant={view === 'timeGridWeek' ? 'solid' : 'outlined'}
            onClick={() => changeView('timeGridWeek')}
          >
            {t('planner.week')}
          </Button>
        </ButtonGroup>
        <ButtonGroup size='sm' variant='outlined'>
          <IconButton
            aria-label={t('planner.previous')}
            onClick={() => controller.prev()}
          >
            <ChevronLeft />
          </IconButton>
          <Button onClick={() => controller.today()}>
            {t('planner.today')}
          </Button>
          <IconButton
            aria-label={t('planner.next')}
            onClick={() => controller.next()}
          >
            <ChevronRight />
          </IconButton>
        </ButtonGroup>
      </Box>

      {!isDesktop && (
        <PlannerTaskList
          compact
          groups={groups}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}
      {!isDesktop && selectedId !== null && (
        <Typography level='body-xs' color='primary'>
          {t('planner.tapToPlace')}
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 280px' },
          gap: 2,
          height: {
            xs: 'calc(100dvh - 290px - var(--safe-area-inset-bottom, 0px))',
            md: 'calc(100dvh - 140px)',
          },
          minHeight: { xs: 320, md: 420 },
        }}
      >
        <TimeBlockCalendar
          chores={chores}
          controller={controller}
          initialView={initialView}
          onSave={saveBlock}
          onSlotClick={handleSlotClick}
          onChoreClick={chore => navigate(`/chores/${chore.id}`)}
        />
        {isDesktop && (
          <Sheet
            variant='outlined'
            sx={{ p: 1.5, borderRadius: 'md', overflowY: 'auto' }}
          >
            <PlannerTaskList
              groups={groups}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </Sheet>
        )}
      </Box>
    </Box>
  )
}

export default PlannerView
