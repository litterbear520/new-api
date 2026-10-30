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

import { applyChunk, ToolCallAssembler } from '../lib/agent/stream'

const acc = () => ({ text: '', finish: null as string | null, usage: null })

describe('applyChunk', () => {
  it('joins tool-call pieces split across chunks into one call', () => {
    const state = acc()
    const tools = new ToolCallAssembler()
    const chunks = [
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'ask_user', arguments: '' },
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: {
                    arguments: '{"questions":[{"question":"风格？",',
                  },
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, function: { arguments: '"options":["A","B"]}]}' } },
              ],
            },
          },
        ],
      },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    ]
    const events = chunks.flatMap((c) =>
      applyChunk(JSON.stringify(c), state, tools)
    )

    expect(events).toEqual([{ type: 'tool-start', index: 0, name: 'ask_user' }])
    expect(state.finish).toBe('tool_calls')
    expect(tools.list()).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'ask_user',
          arguments:
            '{"questions":[{"question":"风格？","options":["A","B"]}]}',
        },
      },
    ])
  })

  it('keeps parallel tool calls apart by their index', () => {
    const state = acc()
    const tools = new ToolCallAssembler()
    applyChunk(
      JSON.stringify({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'a',
                  function: {
                    name: 'load_skill',
                    arguments: '{"skill_id":"x"}',
                  },
                },
                {
                  index: 1,
                  id: 'b',
                  function: { name: 'ask_user', arguments: '{}' },
                },
              ],
            },
          },
        ],
      }),
      state,
      tools
    )

    expect(tools.list().map((c) => [c.id, c.function.name])).toEqual([
      ['a', 'load_skill'],
      ['b', 'ask_user'],
    ])
  })

  it('collects text deltas and the usage chunk', () => {
    const state = acc()
    const tools = new ToolCallAssembler()
    applyChunk(
      JSON.stringify({ choices: [{ delta: { content: '好的，' } }] }),
      state,
      tools
    )
    applyChunk(
      JSON.stringify({ choices: [{ delta: { content: '先画一张' } }] }),
      state,
      tools
    )
    applyChunk(
      JSON.stringify({
        choices: [],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      }),
      state,
      tools
    )

    expect(state.text).toBe('好的，先画一张')
    expect(state.usage).toMatchObject({ prompt: 100, completion: 20 })
  })

  it('throws an early error when the stream starts with an error object', () => {
    expect(() =>
      applyChunk(
        JSON.stringify({
          error: { message: 'no available channel', code: 'model_not_found' },
        }),
        acc(),
        new ToolCallAssembler()
      )
    ).toThrow(/no available channel/)
  })
})
