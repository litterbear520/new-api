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

import type { Conversation } from '../../types'
import { fromJson, importable, toJson } from '../transfer'

const conv = (id: string): Conversation => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  turns: [],
})

describe('importable', () => {
  test('chats from the file get new ids; ones this account has are skipped', () => {
    let n = 0
    const out = importable(
      [conv('mine'), conv('from-a')],
      new Set(['mine']),
      () => `new${++n}`
    )
    expect(out.map((c) => c.id)).toEqual(['new1'])
    expect(out[0].title).toBe('from-a')
  })
})

describe('fromJson', () => {
  const file = (turns: unknown[]) =>
    JSON.stringify({ conversations: [{ id: 'c', title: 'c', turns }] })

  test('a hand-edited file loads as something the page can open', () => {
    const [c] = fromJson(
      file([
        {
          id: 'u',
          role: 'user',
          text: 'hi',
          images: [{ id: 'i', url: 'https://x/y.png' }],
        },
        {
          id: 'a',
          role: 'assistant',
          replies: [{ id: 'r', content: 7, status: 'streaming' }],
          cur: 4,
        },
        { id: 'empty', role: 'assistant', replies: [], cur: 0 },
        { id: 'bad', role: 'user', text: 3 },
      ])
    )
    expect(c.turns.map((t) => t.id)).toEqual(['u', 'a'])
    const [user, assistant] = c.turns
    expect(user.role === 'user' && user.images).toBeFalsy()
    if (assistant.role !== 'assistant') throw new Error('expected a reply')
    expect(assistant.cur).toBe(0)
    expect(assistant.replies[0]).toMatchObject({
      content: '',
      model: '',
      status: 'stopped',
    })
  })

  test('an export of ours comes back unchanged', () => {
    const ours: Conversation = {
      ...conv('ours'),
      system: 'be brief',
      turns: [
        { id: 'u', role: 'user', text: 'hi', at: 2 },
        {
          id: 'a',
          role: 'assistant',
          cur: 0,
          replies: [
            {
              id: 'r',
              model: 'm',
              content: 'hello',
              status: 'done',
              startedAt: 3,
              usage: { prompt: 1, completion: 2, total: 3 },
            },
          ],
        },
      ],
    }
    expect(fromJson(toJson([ours]))).toEqual([ours])
  })
})
