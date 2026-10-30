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
import type { ChatEnv } from '../hooks/use-chat-env'
import type { Conversation } from '../types'
import { ReplyView } from './reply-view'
import { UserTurnView } from './user-turn'

type ThreadProps = {
  conv: Conversation
  env: ChatEnv
  liveReplyId: string | null
  busy: boolean
  onCopied: () => void
  onNewConversation: () => void
}

/** The conversation, user bubbles on the right, replies in a reading column. */
export function Thread(props: ThreadProps) {
  return (
    <div className='bc-col' role='log' aria-live='off'>
      {props.conv.turns.map((turn) =>
        turn.role === 'user' ? (
          <UserTurnView
            key={turn.id}
            turn={turn}
            busy={props.busy}
            onCopied={props.onCopied}
          />
        ) : (
          <ReplyView
            key={turn.id}
            turn={turn}
            env={props.env}
            live={turn.replies.some((r) => r.id === props.liveReplyId)}
            busy={props.busy}
            onCopied={props.onCopied}
            onNewConversation={props.onNewConversation}
          />
        )
      )}
    </div>
  )
}
