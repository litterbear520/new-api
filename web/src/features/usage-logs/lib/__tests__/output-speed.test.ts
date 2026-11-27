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
import { describe, expect, it } from 'vitest'

import { formatTokensPerSecond, getOutputTokensPerSecond } from '../format'

const streamed = { is_stream: true, use_time: 12, completion_tokens: 1000 }

describe('getOutputTokensPerSecond', () => {
  it('divides the output by the time after the first token', () => {
    // 1000 tokens / (12 s - 2 s) = 100 tok/s
    expect(getOutputTokensPerSecond(streamed, 2000)).toBe(100)
  })

  it('leaves out requests that were not streamed', () => {
    expect(
      getOutputTokensPerSecond({ ...streamed, is_stream: false }, 2000)
    ).toBeNull()
  })

  it('leaves out requests without a first-token time', () => {
    expect(getOutputTokensPerSecond(streamed, undefined)).toBeNull()
    expect(getOutputTokensPerSecond(streamed, 0)).toBeNull()
    // The backend writes -1000 when nothing was streamed back.
    expect(getOutputTokensPerSecond(streamed, -1000)).toBeNull()
  })

  it('leaves out short outputs', () => {
    expect(
      getOutputTokensPerSecond({ ...streamed, completion_tokens: 99 }, 2000)
    ).toBeNull()
  })

  it('leaves out generation windows shorter than ten seconds', () => {
    // use_time is cut to whole seconds, so it can even be below the first token.
    expect(getOutputTokensPerSecond({ ...streamed, use_time: 1 }, 1500)).toBe(
      null
    )
    expect(getOutputTokensPerSecond({ ...streamed, use_time: 11 }, 2000)).toBe(
      null
    )
    expect(getOutputTokensPerSecond({ ...streamed, use_time: 12 }, 2000)).toBe(
      100
    )
  })

  it('leaves out a short request whose window is mostly upstream preparation', () => {
    // A real Fast row: 146 tokens, 7 s, first data at 2.1 s. It would read
    // 30 tok/s on a model that writes about 73 tok/s.
    expect(
      getOutputTokensPerSecond(
        { is_stream: true, use_time: 7, completion_tokens: 146 },
        2100
      )
    ).toBeNull()
  })
})

describe('formatTokensPerSecond', () => {
  it('rounds and marks the number as an estimate', () => {
    expect(formatTokensPerSecond(38.6)).toBe('≈39 tok/s')
  })
})
