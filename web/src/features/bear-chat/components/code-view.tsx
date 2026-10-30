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
import { memo, useEffect, useMemo, useRef } from 'react'

import { highlight } from '../lib/highlight'

type CodeViewProps = {
  code: string
  lang: string
  /** Keep the newest line in view while it streams. */
  follow: boolean
}

/** Highlighted code with line numbers, as text (never as HTML). */
export const CodeView = memo(function CodeView(props: CodeViewProps) {
  const ref = useRef<HTMLPreElement>(null)
  const lines = useMemo(
    () => highlight(props.code, props.lang),
    [props.code, props.lang]
  )
  const { follow } = props
  useEffect(() => {
    const el = ref.current
    if (el && follow) el.scrollTop = el.scrollHeight
  }, [lines, follow])
  return (
    <pre ref={ref} className='bc-code' tabIndex={0}>
      {lines.map((tokens, i) => (
        // line numbers are the identity of a line here
        // eslint-disable-next-line react/no-array-index-key
        <span key={i} className='bc-line'>
          <span className='bc-ln' aria-hidden='true'>
            {i + 1}
          </span>
          {tokens.map(([cls, text], j) =>
            cls ? (
              // eslint-disable-next-line react/no-array-index-key
              <span key={j} className={cls}>
                {text}
              </span>
            ) : (
              text
            )
          )}
          {'\n'}
        </span>
      ))}
    </pre>
  )
})
