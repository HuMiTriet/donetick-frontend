import {
  CheckCircleRounded,
  ErrorOutlineRounded,
  KeyRounded,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material'
import {
  Alert,
  Button,
  Card,
  FormControl,
  FormHelperText,
  FormLabel,
  IconButton,
  Input,
  Link,
  Stack,
  Typography,
} from '@mui/joy'
import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ApiResponse } from '@/types/models'

import { GetBeeminderAccount, SaveBeeminderAccount } from '../../utils/Fetcher'
import SettingsLayout from './SettingsLayout'

const BEEMINDER_TOKEN_URL = 'https://www.beeminder.com/api/v1/auth_token.json'

type BeeminderAccount = {
  username: string | null
  dryRun: boolean
}

type AccountResponse = ApiResponse<BeeminderAccount | null>

const getAccount = GetBeeminderAccount as () => Promise<Response | null>
const saveAccount = SaveBeeminderAccount as (
  authToken: string,
) => Promise<Response | null>

type SaveResult =
  | { status: 'saved'; username: string }
  | { status: 'invalid' }
  | { status: 'failed' }

const saveBeeminderKey = async (apiKey: string): Promise<SaveResult> => {
  const resp = await saveAccount(apiKey)
  if (resp?.ok) {
    const { res } = (await resp.json()) as AccountResponse
    return { status: 'saved', username: res?.username ?? '' }
  }
  return { status: resp?.status === 422 ? 'invalid' : 'failed' }
}

const BeeminderSettings = () => {
  const { t } = useTranslation('settings')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<SaveResult | null>(null)
  const [linkedUsername, setLinkedUsername] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getAccount()
      .then(async resp => {
        if (!resp?.ok) return
        const { res } = (await resp.json()) as AccountResponse
        if (active) setLinkedUsername(res?.username ?? null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setResult(null)
    try {
      const saved = await saveBeeminderKey(apiKey.trim())
      setResult(saved)
      if (saved.status === 'saved') {
        setLinkedUsername(saved.username)
        setApiKey('')
      }
    } catch {
      setResult({ status: 'failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsLayout title={t('beeminder.title')}>
      <Card sx={{ maxWidth: 500 }}>
        <Typography level='title-md'>{t('beeminder.apiKeyTitle')}</Typography>
        <Typography level='body-sm'>
          {t('beeminder.apiKeyDescription')}
        </Typography>
        {linkedUsername && (
          <Typography
            level='body-sm'
            color='success'
            startDecorator={<CheckCircleRounded fontSize='small' />}
          >
            {t('beeminder.linkedAs', { username: linkedUsername })}
          </Typography>
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
                      showKey ? t('beeminder.hideKey') : t('beeminder.showKey')
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
    </SettingsLayout>
  )
}

export default BeeminderSettings
