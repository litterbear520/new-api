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

import { parseCall } from '../lib/agent/tools'
import {
  openCalls,
  placeToolResult,
  repairTranscript,
} from '../lib/agent/transcript'
import type { ApiMessage } from '../types'

describe('parseCall', () => {
  it('reads a plan and normalises ratios like "3x4" and refs given as strings', () => {
    const call = parseCall(
      'propose_plan',
      JSON.stringify({
        title: '保温杯 · 主图',
        items: [
          {
            label: '首图',
            prompt: 'a bottle',
            ratio: '3x4',
            refs: ['1', 2, 'x'],
          },
        ],
      })
    )

    expect(call.name).toBe('propose_plan')
    if (call.name !== 'propose_plan') return
    expect(call.args.items[0]).toMatchObject({ ratio: '3:4', refs: [1, 2] })
  })

  it('falls back to 1:1 for an unknown ratio', () => {
    const call = parseCall(
      'propose_plan',
      JSON.stringify({
        title: 't',
        items: [{ label: 'a', prompt: 'p', ratio: '5:7' }],
      })
    )

    expect(call.name === 'propose_plan' && call.args.items[0].ratio).toBe('1:1')
  })

  it('rejects a plan without any prompt, with a reason for the planner', () => {
    const call = parseCall(
      'propose_plan',
      JSON.stringify({ title: 't', items: [{ label: 'a' }] })
    )

    expect(call).toMatchObject({ name: 'unknown' })
  })

  it('drops questions with fewer than two options', () => {
    const call = parseCall(
      'ask_user',
      JSON.stringify({
        questions: [
          { question: '风格？', options: ['棚拍', '生活'] },
          { question: '卖点？', options: ['只有一个'] },
        ],
      })
    )

    expect(
      call.name === 'ask_user' && call.args.questions.map((q) => q.q)
    ).toEqual(['风格？'])
  })

  it('reads JSON wrapped in extra text', () => {
    const call = parseCall('load_skill', 'sure: {"skill_id":"xhs-cover"}')

    expect(call).toEqual({
      name: 'load_skill',
      args: { skill_id: 'xhs-cover' },
    })
  })
})

describe('transcript repair', () => {
  const calls: ApiMessage = {
    role: 'assistant',
    content: null,
    tool_calls: [
      {
        id: 'a',
        type: 'function',
        function: { name: 'load_skill', arguments: '{}' },
      },
      {
        id: 'b',
        type: 'function',
        function: { name: 'ask_user', arguments: '{}' },
      },
    ],
  }

  it('lists the calls still waiting for a result', () => {
    const list: ApiMessage[] = [
      { role: 'user', content: 'hi' },
      calls,
      { role: 'tool', tool_call_id: 'a', content: '{}' },
    ]

    expect(openCalls(list)).toEqual(['b'])
  })

  it('gives every unanswered call an "interrupted" result before the next user turn', () => {
    const list: ApiMessage[] = [
      { role: 'user', content: 'hi' },
      calls,
      { role: 'tool', tool_call_id: 'a', content: '{}' },
      { role: 'user', content: 'again' },
    ]

    const fixed = repairTranscript(list)

    expect(
      fixed.map((m) => (m.role === 'tool' ? `tool:${m.tool_call_id}` : m.role))
    ).toEqual(['user', 'assistant', 'tool:a', 'tool:b', 'user'])
  })
})

describe('tool results that arrive late', () => {
  const plan: ApiMessage = {
    role: 'assistant',
    content: null,
    tool_calls: [
      {
        id: 'p1',
        type: 'function',
        function: { name: 'propose_plan', arguments: '{}' },
      },
    ],
  }

  it('places a result right after its call even after the user moved on', () => {
    const list: ApiMessage[] = [
      { role: 'user', content: 'a set' },
      plan,
      { role: 'user', content: 'something else' },
    ]

    const next = placeToolResult(list, 'p1', '{"status":"stopped_by_user"}')

    expect(next.map((m) => m.role)).toEqual([
      'user',
      'assistant',
      'tool',
      'user',
    ])
  })

  it('replaces an earlier result for the same call instead of adding one', () => {
    const list: ApiMessage[] = [
      plan,
      {
        role: 'tool',
        tool_call_id: 'p1',
        content: '{"status":"stopped_by_user"}',
      },
    ]

    const next = placeToolResult(list, 'p1', '{"status":"drawn"}')

    expect(next).toHaveLength(2)
    expect(next[1]).toMatchObject({ content: '{"status":"drawn"}' })
  })

  it('repair moves a misplaced result back and drops duplicates', () => {
    const list: ApiMessage[] = [
      plan,
      { role: 'user', content: 'next' },
      { role: 'tool', tool_call_id: 'p1', content: 'late' },
      { role: 'tool', tool_call_id: 'p1', content: 'again' },
    ]

    const fixed = repairTranscript(list)

    expect(
      fixed.map((m) => (m.role === 'tool' ? `tool:${m.content}` : m.role))
    ).toEqual(['assistant', 'tool:late', 'user'])
  })
})
