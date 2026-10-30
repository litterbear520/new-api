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
import { useTranslation } from 'react-i18next'

import type { Mode } from '../../types'
import type { Example } from './examples'

type PlaceholderProps = {
  mode: Mode
  /** The skill in use, if any. */
  skillName: string | null
  /** Home, Agent mode: the example shown now (Tab fills it in). */
  example: Example | null
  /** Changes with every new example, to replay the fade. */
  exampleKey: number
}

/**
 * The hint inside the empty box. Home: 「让小熊 <example> Tab」, a new example
 * every few seconds; in a project: how "/" and "@" work.
 */
export function Placeholder(props: PlaceholderProps) {
  const { t } = useTranslation()
  let body
  if (props.mode === 'image') {
    body = t('Say what to draw, e.g. a latte by the window at dawn, film look')
  } else if (props.skillName) {
    body = t(
      'Tell the bear about your product or what you need; it will follow “{{name}}”',
      { name: props.skillName }
    )
  } else if (props.example) {
    body = (
      <span key={props.exampleKey} className='bd-ph-in'>
        <span className='bd-ph-lead'>{t('Ask the bear:')}</span>{' '}
        <span className='bd-ph-ex'>{props.example.text}</span>
        <kbd className='bd-kbd'>Tab</kbd>
      </span>
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
