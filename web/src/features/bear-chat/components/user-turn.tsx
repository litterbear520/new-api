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
import { Check, Copy, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tip } from '@/features/draw/components/tip'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

import { editAndResend } from '../lib/run'
import type { UserTurn } from '../types'

type UserTurnViewProps = {
  turn: UserTurn
  busy: boolean
  onCopied: () => void
}

export function UserTurnView(props: UserTurnViewProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: false })
  const turn = props.turn

  if (editing) {
    return (
      <div className='bc-u bc-u-edit'>
        <Textarea
          autoFocus
          value={draft}
          rows={Math.min(10, Math.max(2, draft.split('\n').length))}
          aria-label={t('Edit message')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false)
          }}
        />
        <div className='bc-u-edit-row'>
          <span className='bc-u-edit-note'>
            {t('Sending again drops the replies after this message.')}
          </span>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => setEditing(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            size='sm'
            disabled={props.busy || (!draft.trim() && !turn.images?.length)}
            onClick={() => {
              setEditing(false)
              editAndResend(turn.id, draft.trim())
            }}
          >
            {t('Send')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='bc-u'>
      {turn.images && turn.images.length > 0 && (
        <div className='bc-u-imgs'>
          {turn.images.map((img) => (
            <div key={img.id} className='bc-att bc-att-lg'>
              <img
                src={img.url}
                alt={img.name ?? t('Picture')}
                loading='lazy'
              />
            </div>
          ))}
        </div>
      )}
      {turn.text && <div className='bc-bub'>{turn.text}</div>}
      <div className='bc-acts bc-acts-u'>
        <Tip label={copiedText ? t('Copied') : t('Copy')}>
          <button
            type='button'
            aria-label={t('Copy')}
            onClick={() => {
              void copyToClipboard(turn.text)
              props.onCopied()
            }}
          >
            {copiedText ? (
              <Check aria-hidden='true' />
            ) : (
              <Copy aria-hidden='true' />
            )}
          </button>
        </Tip>
        <Tip label={t('Edit')}>
          <button
            type='button'
            aria-label={t('Edit')}
            disabled={props.busy}
            onClick={() => {
              setDraft(turn.text)
              setEditing(true)
            }}
          >
            <Pencil aria-hidden='true' />
          </button>
        </Tip>
      </div>
    </div>
  )
}
