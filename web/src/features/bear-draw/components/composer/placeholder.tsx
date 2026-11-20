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
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import type { Mode } from '../../types'
import type { Example } from './examples'

type PlaceholderProps = {
  mode: Mode
  /** The skill in use, if any. */
  skillName: string | null
  /** Home, Agent mode: the example shown now (「使用示例」 fills it in). */
  example: Example | null
  /** Changes with every new example, to replay the fade. */
  exampleKey: number
  onUseExample: () => void
  /** The 「使用示例」 button got or lost the focus. */
  onExampleFocus: (on: boolean) => void
}

/**
 * The hint inside the empty box. Home: 「让小熊 <example>」 and a 「使用示例」
 * button, a new example every few seconds; in a project: how "/" and "@"
 * work. It comes after the box, so Tab goes from the box to the button.
 */
export function Placeholder(props: PlaceholderProps) {
  const { t } = useTranslation()
  const exampleId = useId()
  if (props.mode === 'agent' && !props.skillName && props.example) {
    return (
      <div className='bd-comp-ph bd-comp-ph-ex'>
        <span key={props.exampleKey} className='bd-ph-in' aria-hidden='true'>
          <span className='bd-ph-lead'>{t('Ask the bear:')}</span>{' '}
          <span className='bd-ph-ex'>{props.example.text}</span>
        </span>
        <span id={exampleId} hidden>
          {props.example.text}
        </span>
        <button
          type='button'
          className='bd-ph-use'
          aria-describedby={exampleId}
          onClick={props.onUseExample}
          onFocus={() => props.onExampleFocus(true)}
          onBlur={() => props.onExampleFocus(false)}
        >
          {t('Use example')}
        </button>
      </div>
    )
  }
  let body
  if (props.mode === 'image') {
    body = t('Say what to draw, e.g. a latte by the window at dawn, film look')
  } else if (props.skillName) {
    body = t(
      'Tell the bear about your product or what you need; it will follow “{{name}}”',
      { name: props.skillName }
    )
  } else {
    body = t(
      'Say what to change or do next; “/” for skills, “@” for a picture on the canvas'
    )
  }
  return (
    <div className='bd-comp-ph' aria-hidden='true'>
      {body}
    </div>
  )
}
