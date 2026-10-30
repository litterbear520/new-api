/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type SystemDialogProps = {
  open: boolean
  value: string
  onOpenChange: (open: boolean) => void
  onSave: (text: string) => void
}

/** The conversation's system prompt: who the model is and how it answers. */
export function SystemDialog(props: SystemDialogProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(props.value)
  const { open, value } = props
  useEffect(() => {
    if (open) setText(value)
  }, [open, value])
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('System prompt')}
      description={t(
        'Tell the model who it is and how to answer. It applies to this whole conversation.'
      )}
      contentClassName='sm:max-w-xl'
      footer={
        <>
          {props.value && (
            <Button
              type='button'
              variant='ghost'
              className='mr-auto'
              onClick={() => {
                props.onSave('')
                props.onOpenChange(false)
              }}
            >
              {t('Remove')}
            </Button>
          )}
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            onClick={() => {
              props.onSave(text.trim())
              props.onOpenChange(false)
            }}
          >
            {t('Save')}
          </Button>
        </>
      }
    >
      <Textarea
        autoFocus
        rows={7}
        value={text}
        maxLength={20000}
        placeholder={t(
          'For example: You are a patient maths teacher. Answer in short steps.'
        )}
        aria-label={t('System prompt')}
        onChange={(e) => setText(e.target.value)}
      />
    </Dialog>
  )
}
