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
import { describe, expect, test } from 'vitest'

import { parseErrorBody, parseStreamData } from '../stream'

describe('parseStreamData', () => {
  test('reads reasoning and text deltas', () => {
    const data = JSON.stringify({
      choices: [{ delta: { reasoning_content: 'hm', content: 'Hi' } }],
    })
    expect(parseStreamData(data)).toEqual([
      { type: 'reasoning', text: 'hm' },
      { type: 'content', text: 'Hi' },
    ])
  })

  test('reads the usage chunk, including cached and reasoning tokens', () => {
    const data = JSON.stringify({
      choices: [],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        prompt_tokens_details: { cached_tokens: 64 },
        completion_tokens_details: { reasoning_tokens: 8 },
      },
    })
    expect(parseStreamData(data)).toEqual([
      {
        type: 'usage',
        usage: {
          prompt: 100,
          completion: 20,
          total: 120,
          cached: 64,
          reasoning: 8,
        },
      },
    ])
  })

  test('turns an error chunk into an error event', () => {
    const data = JSON.stringify({
      error: { message: 'no channel', code: 'model_not_found' },
    })
    expect(parseStreamData(data)).toEqual([
      { type: 'error', message: 'no channel', code: 'model_not_found' },
    ])
  })

  test('ignores lines that are not JSON', () => {
    expect(parseStreamData('keep-alive')).toEqual([])
  })
})

describe('parseErrorBody', () => {
  test('reads the OpenAI error shape', () => {
    expect(
      parseErrorBody(
        '{"error":{"message":"bad","type":"new_api_error","code":"x"}}'
      )
    ).toEqual({ message: 'bad', code: 'x' })
  })

  test("reads New API's success:false shape", () => {
    expect(parseErrorBody('{"success":false,"message":"未登录"}')).toEqual({
      message: '未登录',
    })
  })
})
