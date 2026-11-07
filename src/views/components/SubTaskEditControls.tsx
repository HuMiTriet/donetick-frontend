import { Edit } from '@mui/icons-material'
import { Box, Button, IconButton } from '@mui/joy'
import { useTranslation } from 'react-i18next'

import type { InlineSubTaskEditor } from '../../hooks/useInlineSubTaskEditor'

type SubTaskEditControlProps = {
  editor: InlineSubTaskEditor
}

export const SubTaskEditButton = ({ editor }: SubTaskEditControlProps) => {
  const { t } = useTranslation('chores')
  if (editor.isEditing) return null

  return (
    <IconButton
      size='sm'
      variant='plain'
      aria-label={t('subtaskEditor.edit')}
      title={t('subtaskEditor.edit')}
      onClick={editor.startEditing}
    >
      <Edit />
    </IconButton>
  )
}

export const SubTaskEditFooter = ({ editor }: SubTaskEditControlProps) => {
  const { t } = useTranslation('chores')
  if (!editor.isEditing) return null

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
      <Button
        size='sm'
        variant='plain'
        color='neutral'
        disabled={editor.isSaving}
        onClick={editor.cancel}
      >
        {t('subtaskEditor.cancel')}
      </Button>
      <Button size='sm' loading={editor.isSaving} onClick={editor.save}>
        {t('subtaskEditor.save')}
      </Button>
    </Box>
  )
}
