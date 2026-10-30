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

import type { DrawItem, DrawRoom } from '../../types'
import { settleLost } from '../storage'

const item = (patch: Partial<DrawItem>): DrawItem => ({
  id: 'p1',
  req: {
    text: 't',
    imgs: [],
    ratio: 'auto',
    clear: false,
    model: 'm',
    marks: null,
  },
  parent: null,
  start: 0,
  status: 'pending',
  est: 0.01,
  ...patch,
})

const room = (msgs: DrawRoom['msgs']): DrawRoom => ({
  id: 'r1',
  title: '',
  model: 'm',
  t: 0,
  msgs,
})

describe('settleLost', () => {
  test('a picture that was drawing is lost; one still waiting was never sent', () => {
    const out = settleLost(
      room([
        {
          id: 'm1',
          role: 'ai',
          items: [item({ id: 'a' }), item({ id: 'b', queued: true })],
        },
      ])
    )
    const msg = out.msgs[0]
    if (msg.role !== 'ai') throw new Error('expected a result message')
    expect(
      msg.items.map((it) => [it.status, it.error?.kind, it.queued])
    ).toEqual([
      ['error', 'lost', undefined],
      ['error', 'other', undefined],
    ])
  })

  test('a plan still being made can be started again', () => {
    const out = settleLost(
      room([
        {
          id: 'm1',
          role: 'ai',
          items: [],
          plan: { status: 'planning', parts: [] },
        },
      ])
    )
    const msg = out.msgs[0]
    expect(msg.role === 'ai' && msg.plan?.status).toBe('stale')
  })

  test('a finished conversation is returned as it was', () => {
    const r = room([
      { id: 'm1', role: 'ai', items: [item({ status: 'done' })] },
    ])
    expect(settleLost(r)).toBe(r)
  })
})
