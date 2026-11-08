import { AttachMoney, Close } from '@mui/icons-material'
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  IconButton,
  Input,
  Tooltip,
  Typography,
} from '@mui/joy'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ModalActions from '../../components/common/ModalActions'
import { useModalShortcutScope } from '../../contexts/KeyboardShortcutScopeContext'
import { useResponsiveModal } from '../../hooks/useResponsiveModal'
import { formatStakeAmount, timeLeftParts } from '../../utils/stakes'
import { MIN_STAKE_CENTS } from './CustomParsers'

const toCents = text => {
  const trimmed = String(text).trim().replace(/^\$/, '')
  if (!/^\d{1,6}(\.\d{0,2})?$/.test(trimmed)) return null
  return Math.round(parseFloat(trimmed) * 100)
}

/**
 * "Place stake" pill for the task editors. A stake needs a due date and a
 * linked Beeminder account, so without either the pill stays visible but
 * greyed out, with a tooltip saying why.
 *
 * value: stake in cents, or null. onChange(cents | null).
 */
const StakePickerField = ({
  account,
  disabled = false,
  disabledReason,
  emptyDisplay = 'icon-text',
  onChange,
  size = 'sm',
  value,
}) => {
  const { t } = useTranslation('chores')
  const { ResponsiveModal } = useResponsiveModal()
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  // Keep the parent modal's keyboard shortcuts (Escape closes it) out of the
  // way while this dialog is up.
  useModalShortcutScope(isOpen)

  useEffect(() => {
    if (isOpen) setDraft(value ? (value / 100).toFixed(2) : '')
  }, [isOpen, value])

  const hasStake = Boolean(value) && !disabled
  const shouldShowLabel = hasStake || emptyDisplay === 'icon-text'
  const label = hasStake ? formatStakeAmount(value) : t('stake.place')

  const minCents = account?.minAmountCents || MIN_STAKE_CENTS
  const maxCents = account?.maxAmountCents || 0
  const cents = toCents(draft)
  let error = null
  if (draft.trim() && cents === null) error = t('stake.invalidAmount')
  else if (cents !== null && cents < minCents)
    error = t('stake.tooSmall', { amount: formatStakeAmount(minCents) })
  else if (cents !== null && maxCents > 0 && cents > maxCents)
    error = t('stake.tooLarge', { amount: formatStakeAmount(maxCents) })

  const windowSeconds = account?.editWindowSeconds || 0
  const windowText =
    windowSeconds > 0
      ? (() => {
          const { unit, value: count } = timeLeftParts(windowSeconds * 1000)
          return t(`stake.duration.${unit}`, { count })
        })()
      : null

  const handleSave = () => {
    if (cents === null || error) return
    onChange?.(cents)
    setIsOpen(false)
  }

  const button = (
    <Button
      size={size}
      variant={hasStake ? 'solid' : 'outlined'}
      color={hasStake ? 'danger' : 'neutral'}
      disabled={disabled}
      onClick={() => setIsOpen(true)}
      aria-label={hasStake ? t('stake.changeAria', { amount: label }) : label}
      data-testid='stake-picker'
      sx={{
        minHeight: 40,
        borderRadius: '128px',
        minWidth: 'min-content',
        px: shouldShowLabel ? 1.25 : 0.75,
        gap: shouldShowLabel ? 1 : 0,
        justifyContent: 'flex-start',
        whiteSpace: 'nowrap',
        transition: 'all 0.25s ease-in-out',
      }}
    >
      <AttachMoney sx={{ fontSize: '20px' }} />
      <Typography
        level='body-sm'
        textColor='inherit'
        sx={{
          fontWeight: hasStake ? 'lg' : undefined,
          whiteSpace: 'nowrap',
          maxWidth: shouldShowLabel ? 220 : 0,
          opacity: shouldShowLabel ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-width 0.25s ease-in-out, opacity 0.2s ease-in-out',
        }}
      >
        {label}
      </Typography>
    </Button>
  )

  return (
    <>
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {disabled && disabledReason ? (
          // A disabled button fires no pointer events, so the tooltip needs
          // a wrapper to hang on.
          <Tooltip title={disabledReason} variant='soft' arrow>
            <span style={{ display: 'inline-flex' }}>{button}</span>
          </Tooltip>
        ) : (
          button
        )}
        {hasStake && (
          <IconButton
            aria-label={t('stake.removeAria')}
            size='sm'
            variant='soft'
            color='danger'
            onClick={e => {
              e.stopPropagation()
              onChange?.(null)
            }}
            sx={{
              position: 'absolute',
              top: -18,
              right: -18,
              zIndex: 10,
              borderRadius: '50%',
            }}
          >
            <Close sx={{ fontSize: '18px' }} />
          </IconButton>
        )}
      </Box>

      <ResponsiveModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={t('stake.dialogTitle')}
        size='sm'
        footer={
          <ModalActions
            tertiary={
              value
                ? {
                    label: t('stake.remove'),
                    color: 'danger',
                    onClick: () => {
                      onChange?.(null)
                      setIsOpen(false)
                    },
                  }
                : undefined
            }
            secondary={{
              label: t('common:cancel'),
              onClick: () => setIsOpen(false),
            }}
            primary={{
              label: t('stake.save'),
              color: 'danger',
              disabled: cents === null || Boolean(error),
              onClick: handleSave,
            }}
          />
        }
      >
        <FormControl error={Boolean(error)}>
          <FormLabel>{t('stake.amountLabel')}</FormLabel>
          <Input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSave()
              }
            }}
            startDecorator='$'
            placeholder='5.00'
            inputMode='decimal'
            slotProps={{ input: { 'data-testid': 'stake-amount-input' } }}
          />
          <FormHelperText>
            {error ||
              (windowText
                ? t('stake.windowHint', { time: windowText })
                : t('stake.hint'))}
          </FormHelperText>
        </FormControl>
        <Typography level='body-sm' textColor='text.tertiary' sx={{ mt: 1.5 }}>
          {t('stake.chargeRule')}
        </Typography>
      </ResponsiveModal>
    </>
  )
}

export default StakePickerField
