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

import { useBearChatStore, type LiveReply } from '@/stores/bear-chat-store'

import type { ReplyStatus } from '../types'

type ChatState = ReturnType<typeof useBearChatStore.getState>

const END_WORDS: Partial<Record<ReplyStatus, string>> = {
  done: 'Reply finished',
  stopped: 'Reply stopped',
  error: 'Reply failed',
}

function statusOf(s: ChatState, live: LiveReply): ReplyStatus | undefined {
  const turn = s.convs
    .find((c) => c.id === live.convId)
    ?.turns.find((x) => x.id === live.turnId)
  if (turn?.role !== 'assistant') return undefined
  return turn.replies.find((r) => r.id === live.replyId)?.status
}

/**
 * The one line screen readers hear about a reply: once when it starts, once
 * when it ends. Always mounted (a region added with its text is often not
 * read) and visually hidden, also on narrow screens; the ticking seconds in
 * the bear's status line stay out of it.
 */
export function ReplyAnnouncer() {
  const { t } = useTranslation()
  const [words, setWords] = useState('')
  useEffect(
    () =>
      useBearChatStore.subscribe((s, prev) => {
        if (s.live?.replyId === prev.live?.replyId) return
        if (s.live) {
          setWords(t('Replying'))
          return
        }
        if (!prev.live) return
        const key = END_WORDS[statusOf(s, prev.live) ?? 'waiting']
        setWords(key ? t(key) : '')
      }),
    [t]
  )
  return (
    <div role='status' className='sr-only'>
      {words}
    </div>
  )
}
