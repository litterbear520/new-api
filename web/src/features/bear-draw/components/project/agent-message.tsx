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
import { Check, Copy, Square, Unplug } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tip } from '@/features/draw/components/tip'
import { useMoney } from '@/features/draw/hooks/use-money'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

import type { AgentMessage as AgentMessageData } from '../../types'
import { PartView } from '../parts/part-view'
import { StatusPart } from '../parts/status-part'

/** 「这一轮 $0.10」 and copying what the agent wrote. */
function AgentFooter(props: { message: AgentMessageData }) {
  const { t } = useTranslation()
  const money = useMoney()
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: false })
  const m = props.message
  const text = m.parts
    .map((p) => (p.type === 'text' ? p.text.trim() : ''))
    .filter(Boolean)
    .join('\n\n')
  if (!text && m.cost <= 0) return null
  return (
    <div className='bd-a-ft'>
      {text && (
        <Tip label={copiedText ? t('Copied') : t('Copy')}>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            className='bd-a-copy'
            aria-label={t('Copy')}
            onClick={() => void copyToClipboard(text)}
          >
            {copiedText ? (
              <Check aria-hidden='true' />
            ) : (
              <Copy aria-hidden='true' />
            )}
          </Button>
        </Tip>
      )}
      {m.cost > 0 && (
        <span className='bd-a-cost bd-num'>
          {t('This turn {{cost}}', { cost: money.cost(m.cost) })}
        </span>
      )}
    </div>
  )
}

/** A short note when a turn ended early. */
function EndNote(props: { message: AgentMessageData }) {
  const { t } = useTranslation()
  const m = props.message
  if (m.status === 'lost') {
    return (
      <div className='bd-st bd-a-note'>
        <Unplug className='bd-st-i' aria-hidden='true' />
        <span>{t('The page was closed before this turn finished.')}</span>
      </div>
    )
  }
  if (m.status !== 'stopped' || m.parts.some((x) => x.type === 'result')) {
    return null
  }
  const pictures = m.parts.some(
    (x) =>
      x.type === 'progress' && x.items.some((it) => it.status === 'stopped')
  )
  if (!pictures) return null
  return (
    <div className='bd-st bd-a-note'>
      <Square className='bd-st-i' aria-hidden='true' />
      <span>
        {t('Stopped. Pictures that had not started are not charged.')}
      </span>
    </div>
  )
}

/**
 * The agent's turn: its parts in order (status lines, text, question card,
 * plan, pictures, result, error), then the cost of the turn once it ends.
 */
export function AgentMessage(props: {
  projectId: string
  message: AgentMessageData
}) {
  const m = props.message
  const working = m.status === 'running' || m.status === 'waiting'
  return (
    <div className={cn('bd-a', working && 'is-working')}>
      {m.parts.map((part) => (
        <PartView
          key={part.id}
          projectId={props.projectId}
          messageId={m.id}
          status={m.status}
          part={part}
        />
      ))}
      {m.status === 'running' && m.parts.length === 0 && (
        <StatusPart icon='think' text={{ key: 'Thinking…' }} live />
      )}
      <EndNote message={m} />
      {!working && <AgentFooter message={m} />}
    </div>
  )
}
