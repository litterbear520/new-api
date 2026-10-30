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
import { memo } from 'react'

import { Response } from '@/components/ai-elements/response'
import { cn } from '@/lib/utils'

/**
 * What the agent wrote, as markdown (the chat page's renderer). While it
 * streams, a caret blinks after the last word.
 */
export const TextPart = memo(function TextPart(props: {
  text: string
  streaming?: boolean
}) {
  if (!props.text.trim() && !props.streaming) return null
  return (
    <div className={cn('bd-txt', props.streaming && 'is-streaming')}>
      <Response className='bd-md' final={!props.streaming}>
        {props.text}
      </Response>
    </div>
  )
})
