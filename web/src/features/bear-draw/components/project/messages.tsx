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
import { ArrowDown } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useStickToBottom } from 'use-stick-to-bottom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { Project } from '../../types'
import { AgentMessage } from './agent-message'
import { UserMessage } from './user-message'

/**
 * The conversation. It sticks to the bottom while the agent writes and
 * draws, unless the user scrolled up to read; then a ↓ button brings them
 * back. Sending a message always jumps to the bottom.
 */
export function Messages(props: { project: Project }) {
  const { t } = useTranslation()
  const stick = useStickToBottom({ initial: 'instant', resize: 'smooth' })
  const { scrollToBottom } = stick
  const messages = props.project.messages
  const lastUser =
    [...messages].reverse().find((m) => m.role === 'user')?.id ?? null

  useEffect(() => {
    void scrollToBottom('instant')
  }, [props.project.id, scrollToBottom])

  useEffect(() => {
    if (lastUser) void scrollToBottom('smooth')
  }, [lastUser, scrollToBottom])

  return (
    <div className='bd-msgs-wrap'>
      <div ref={stick.scrollRef} className='bd-chatp-scroll'>
        <div
          ref={stick.contentRef}
          className='bd-msgs'
          role='log'
          aria-live='off'
          aria-label={t('Conversation')}
        >
          {messages.map((m) =>
            m.role === 'user' ? (
              <UserMessage key={m.id} message={m} />
            ) : (
              <AgentMessage
                key={m.id}
                projectId={props.project.id}
                message={m}
              />
            )
          )}
        </div>
      </div>
      <Button
        type='button'
        variant='outline'
        size='icon-sm'
        className={cn('bd-tobot', !stick.isNearBottom && 'is-on')}
        aria-label={t('Jump to the latest')}
        tabIndex={stick.isNearBottom ? -1 : 0}
        onClick={() => void scrollToBottom('smooth')}
      >
        <ArrowDown aria-hidden='true' />
      </Button>
    </div>
  )
}
