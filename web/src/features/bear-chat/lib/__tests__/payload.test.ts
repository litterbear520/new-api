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

import type { Conversation, Reply } from '../../types'
import { buildBody } from '../payload'

const reply = (content: string, status: Reply['status'] = 'done'): Reply => ({
  id: `r-${content}`,
  model: 'm',
  content,
  status,
  startedAt: 0,
})

const conv = (turns: Conversation['turns'], system?: string): Conversation => ({
  id: 'c',
  title: 't',
  createdAt: 0,
  updatedAt: 0,
  system,
  turns,
})

const off = { temperature: null, top_p: null, max_tokens: null, effort: null }

describe('buildBody', () => {
  test('parameters that are off are not sent, and the usage chunk is asked for', () => {
    const c = conv([{ id: 'u', role: 'user', text: 'hi', at: 0 }])
    const body = buildBody({
      conv: c,
      upto: 1,
      model: 'm',
      group: 'default',
      params: off,
    })
    expect(body).toEqual({
      model: 'm',
      group: 'default',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
      stream_options: { include_usage: true },
    })
  })

  test('the system prompt goes first and set parameters are sent', () => {
    const c = conv([{ id: 'u', role: 'user', text: 'hi', at: 0 }], 'Be brief')
    const body = buildBody({
      conv: c,
      upto: 1,
      model: 'm',
      group: '',
      params: { ...off, temperature: 0.2, effort: 'high' },
    })
    expect(body.messages[0]).toEqual({ role: 'system', content: 'Be brief' })
    expect(body).toMatchObject({ temperature: 0.2, reasoning_effort: 'high' })
    expect(body).not.toHaveProperty('group')
  })

  test('pictures are sent as image parts after the text', () => {
    const c = conv([
      {
        id: 'u',
        role: 'user',
        text: 'what is this',
        at: 0,
        images: [{ id: 'i', url: 'data:image/png;base64,AA', w: 1, h: 1 }],
      },
    ])
    const body = buildBody({
      conv: c,
      upto: 1,
      model: 'm',
      group: '',
      params: off,
    })
    expect(body.messages[0].content).toEqual([
      { type: 'text', text: 'what is this' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AA' } },
    ])
  })

  test('a failed reply is left out and the user turns around it are merged', () => {
    const c = conv([
      { id: 'u1', role: 'user', text: 'first', at: 0 },
      { id: 'a1', role: 'assistant', replies: [reply('', 'error')], cur: 0 },
      { id: 'u2', role: 'user', text: 'second', at: 0 },
    ])
    const body = buildBody({
      conv: c,
      upto: 3,
      model: 'm',
      group: '',
      params: off,
    })
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'first' },
          { type: 'text', text: '\n\n' },
          { type: 'text', text: 'second' },
        ],
      },
    ])
  })

  test('the shown answer of a retried turn is the one sent as history, without its thinking', () => {
    const c = conv([
      { id: 'u1', role: 'user', text: 'q', at: 0 },
      {
        id: 'a1',
        role: 'assistant',
        replies: [reply('old'), reply('<think>x</think>new')],
        cur: 1,
      },
      { id: 'u2', role: 'user', text: 'more', at: 0 },
    ])
    const body = buildBody({
      conv: c,
      upto: 3,
      model: 'm',
      group: '',
      params: off,
    })
    expect(body.messages[1]).toEqual({ role: 'assistant', content: 'new' })
  })
})
