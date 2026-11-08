import {
  CheckCircleRounded,
  ErrorOutlineRounded,
  KeyRounded,
  Visibility,
  VisibilityOff,
  WarningAmberRounded,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  FormControl,
  FormHelperText,
  FormLabel,
  IconButton,
  Input,
  Link,
  Option,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/joy'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BEEMINDER_ACCOUNT_KEY } from '@/queries/BeeminderQueries'
import type { ApiResponse, Label } from '@/types/models'
import { timeLeftParts } from '@/utils/stakes'
import { useLabels } from '@/views/Labels/LabelQueries'

import {
  GetBeeminderAccount,
  SaveBeeminderAccount,
  SaveBeeminderSettings,
} from '../../utils/Fetcher'
import SettingsLayout from './SettingsLayout'

const BEEMINDER_TOKEN_URL = 'https://www.beeminder.com/api/v1/auth_token.json'

type BeeminderAccount = {
  // Beeminder username; only filled when the server asked Beeminder
  username: string | null
  // false when Beeminder rejected the stored token, null when not checked
  tokenValid: boolean | null
  deadbeat: boolean
  dryRun: boolean
  serverDryRun: boolean
  defaultLabelId: number | null
  editWindowSeconds: number
  minAmountCents: number
  maxAmountCents: number
}

type AccountResponse = ApiResponse<BeeminderAccount | null>

const getAccount = GetBeeminderAccount as (options?: {
  live?: boolean
}) => Promise<Response | null>
const saveAccount = SaveBeeminderAccount as (
  authToken: string,
) => Promise<Response | null>
const saveSettings = SaveBeeminderSettings as (settings: {
  defaultLabelId: number | null
  dryRun: boolean
}) => Promise<Response | null>

type SaveResult =
  | { status: 'saved'; account: BeeminderAccount }
  | { status: 'invalid' }
  | { status: 'failed' }

const saveBeeminderKey = async (apiKey: string): Promise<SaveResult> => {
  const resp = await saveAccount(apiKey)
  if (resp?.ok) {
    const { res } = (await resp.json()) as AccountResponse
    if (res) return { status: 'saved', account: res }
  }
  return { status: resp?.status === 422 ? 'invalid' : 'failed' }
}

const BeeminderSettings = () => {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const { data: labelsData } = useLabels() as { data?: Label[] }
  const labels = labelsData ?? []
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<SaveResult | null>(null)
  const [account, setAccount] = useState<BeeminderAccount | null>(null)
  const [settingsError, setSettingsError] = useState(false)

  // The task editors read the account through react-query; keep them in step
  const shareAccount = useCallback(
    (next: BeeminderAccount | null) => {
      setAccount(next)
      queryClient.setQueryData(BEEMINDER_ACCOUNT_KEY, next)
    },
    [queryClient],
  )

  useEffect(() => {
    let active = true
    getAccount({ live: true })
      .then(async resp => {
        if (!resp?.ok) return
        const { res } = (await resp.json()) as AccountResponse
        if (active) shareAccount(res ?? null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [shareAccount])

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setResult(null)
    try {
      const saved = await saveBeeminderKey(apiKey.trim())
      setResult(saved)
      if (saved.status === 'saved') {
        shareAccount(saved.account)
        setApiKey('')
      }
    } catch {
      setResult({ status: 'failed' })
    } finally {
      setSaving(false)
    }
  }

  const updateSettings = async (
    changes: Partial<Pick<BeeminderAccount, 'defaultLabelId' | 'dryRun'>>,
  ) => {
    if (!account) return
    const next = { ...account, ...changes }
    setSettingsError(false)
    setAccount(next)
    try {
      const resp = await saveSettings({
        defaultLabelId: next.defaultLabelId,
        dryRun: next.dryRun,
      })
      if (!resp?.ok) throw new Error('save failed')
      const { res } = (await resp.json()) as AccountResponse
      // The settings response doesn't ask Beeminder for the username again
      shareAccount(res ? { ...res, username: account.username } : next)
    } catch {
      setAccount(account)
      setSettingsError(true)
    }
  }

  const editWindow = (() => {
    if (!account?.editWindowSeconds) return null
    const { unit, value } = timeLeftParts(account.editWindowSeconds * 1000)
    return t(`beeminder.duration.${unit}`, { count: value })
  })()

  return (
    <SettingsLayout title={t('beeminder.title')}>
      <Stack spacing={2} sx={{ maxWidth: 500 }}>
        <Card>
          <Typography level='title-md'>{t('beeminder.apiKeyTitle')}</Typography>
          <Typography level='body-sm'>
            {t('beeminder.apiKeyDescription')}
          </Typography>
          {account?.username && (
            <Typography
              level='body-sm'
              color='success'
              startDecorator={<CheckCircleRounded fontSize='small' />}
            >
              {t('beeminder.linkedAs', { username: account.username })}
            </Typography>
          )}
          {account && account.tokenValid === false && (
            <Alert color='danger' startDecorator={<ErrorOutlineRounded />}>
              {t('beeminder.tokenRejected')}
            </Alert>
          )}
          {account?.deadbeat && (
            <Alert color='warning' startDecorator={<WarningAmberRounded />}>
              {t('beeminder.deadbeat')}
            </Alert>
          )}
          <form onSubmit={handleSave}>
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>{t('beeminder.apiKeyLabel')}</FormLabel>
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={event => {
                    setApiKey(event.target.value)
                    setResult(null)
                  }}
                  placeholder={t('beeminder.apiKeyPlaceholder')}
                  autoComplete='off'
                  startDecorator={<KeyRounded fontSize='small' />}
                  endDecorator={
                    <IconButton
                      aria-label={
                        showKey
                          ? t('beeminder.hideKey')
                          : t('beeminder.showKey')
                      }
                      onClick={() => setShowKey(show => !show)}
                    >
                      {showKey ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  }
                />
                <FormHelperText>
                  <Link
                    href={BEEMINDER_TOKEN_URL}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {t('beeminder.whereToFind')}
                  </Link>
                </FormHelperText>
              </FormControl>
              <Button
                type='submit'
                loading={saving}
                disabled={!apiKey.trim()}
                sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
              >
                {t('beeminder.save')}
              </Button>
              {result?.status === 'saved' && (
                <Alert color='success' startDecorator={<CheckCircleRounded />}>
                  {t('beeminder.saveSuccess')}
                </Alert>
              )}
              {result?.status === 'invalid' && (
                <Alert color='danger' startDecorator={<ErrorOutlineRounded />}>
                  {t('beeminder.invalidKey')}
                </Alert>
              )}
              {result?.status === 'failed' && (
                <Alert color='danger' startDecorator={<ErrorOutlineRounded />}>
                  {t('beeminder.saveFailed')}
                </Alert>
              )}
            </Stack>
          </form>
        </Card>

        {account && (
          <Card>
            <Typography level='title-md'>
              {t('beeminder.stakesTitle')}
            </Typography>
            <Typography level='body-sm'>
              {t('beeminder.stakesDescription')}
            </Typography>

            <FormControl>
              <FormLabel>{t('beeminder.defaultLabel')}</FormLabel>
              <Select
                value={account.defaultLabelId ?? 0}
                onChange={(_, value) =>
                  updateSettings({
                    defaultLabelId: value ? Number(value) : null,
                  })
                }
                slotProps={{
                  button: { 'aria-label': t('beeminder.defaultLabel') },
                }}
              >
                <Option value={0}>{t('beeminder.noLabel')}</Option>
                {labels.map(label => (
                  <Option key={label.id} value={label.id}>
                    <Box
                      component='span'
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: label.color,
                        display: 'inline-block',
                        mr: 1,
                      }}
                    />
                    {label.name}
                  </Option>
                ))}
              </Select>
              <FormHelperText>{t('beeminder.defaultLabelHelp')}</FormHelperText>
            </FormControl>

            <FormControl>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 1.5,
                }}
              >
                <Typography level='title-sm' sx={{ fontWeight: 600 }}>
                  {t('beeminder.dryRun')}
                </Typography>
                <Switch
                  checked={account.dryRun || account.serverDryRun}
                  disabled={account.serverDryRun}
                  onChange={event =>
                    updateSettings({ dryRun: event.target.checked })
                  }
                />
              </Box>
              <FormHelperText>
                {account.serverDryRun
                  ? t('beeminder.dryRunServer')
                  : t('beeminder.dryRunHelp')}
              </FormHelperText>
            </FormControl>

            {editWindow && (
              <Typography level='body-sm' textColor='text.secondary'>
                {t('beeminder.editWindow', { time: editWindow })}
              </Typography>
            )}
            {settingsError && (
              <Alert color='danger' startDecorator={<ErrorOutlineRounded />}>
                {t('beeminder.settingsFailed')}
              </Alert>
            )}
          </Card>
        )}
      </Stack>
    </SettingsLayout>
  )
}

export default BeeminderSettings
