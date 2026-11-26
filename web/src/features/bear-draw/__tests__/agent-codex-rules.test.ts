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

import { DrawApiError } from '@/features/draw/api'

import { TYPICAL_SECS } from '../constants'
import {
  baseOf,
  itemInputs,
  MARKED_ROLE,
  turnMarks,
  unclearBase,
} from '../lib/agent/plan'
import { buildSystemPrompt } from '../lib/agent/prompt'
import { parseCall } from '../lib/agent/tools'
import { describeRef } from '../lib/agent/transcript'
import { retryable, RETRY_WITHIN_MS } from '../lib/pictures'
import type { Attachment, CanvasNode, PlanItem, Project } from '../types'

const node = (id: string, clear = false): CanvasNode =>
  ({
    id,
    groupId: null,
    status: 'ready',
    img: { id: `img-${id}`, w: 1536, h: 1024, clear },
    w: 1536,
    h: 1024,
    label: id,
    meta: {},
  }) as CanvasNode

const project = (nodes: CanvasNode[]): Project =>
  ({
    id: 'p',
    nodes,
    groups: [],
    messages: [],
    transcript: [],
  }) as unknown as Project

const circled = (nodeId: string): Attachment => ({
  id: `mark-${nodeId}`,
  w: 1536,
  h: 1024,
  nodeId,
  label: nodeId,
  marked: true,
})

const item = (over: Partial<PlanItem>): PlanItem =>
  ({
    id: 'it',
    label: 'a',
    prompt: 'change the cup to white',
    ratio: '1:1',
    model: 'gpt-image-2.6-sunburst',
    refs: [],
    est: 0,
    on: true,
    ...over,
  }) as PlanItem

describe('the picture a plan item edits', () => {
  const ready = new Set(['n_a', 'n_b'])

  it("is the planner's base when that picture is on the canvas", () => {
    expect(baseOf('n_b', [circled('n_a')], ready)).toBe('n_b')
  })

  it('is the one circled picture when the planner left base out', () => {
    expect(baseOf(undefined, [circled('n_a')], ready)).toBe('n_a')
    expect(baseOf('n_gone', [circled('n_a')], ready)).toBe('n_a')
  })

  it('stays open when two pictures are circled or none is', () => {
    expect(baseOf(undefined, [circled('n_a'), circled('n_b')], ready)).toBe(
      undefined
    )
    expect(baseOf(undefined, [], ready)).toBe(undefined)
  })

  it('sends the original and then its red-circle copy', () => {
    const p = project([node('n_a')])
    const got = itemInputs(p, item({ base: 'n_a' }), [circled('n_a')])
    expect(got.ids).toEqual(['img-n_a', 'mark-n_a'])
    expect(got.roles).toEqual(['the picture to edit', MARKED_ROLE])
  })
})

describe('the circles that belong to a request', () => {
  const user = (id: string, refs: Attachment[], reply = false) => ({
    id,
    role: 'user',
    at: 0,
    mode: 'agent',
    text: 'x',
    refs,
    ...(reply ? { reply: true } : {}),
  })
  const agent = (id: string) => ({ id, role: 'agent', parts: [] })
  const talk = (messages: object[]) =>
    ({ ...project([node('n_a'), node('n_b')]), messages }) as unknown as Project

  it('are those of the message being answered', () => {
    const p = talk([user('u1', [circled('n_a')]), agent('a1')])
    expect(turnMarks(p, 'a1').map((r) => r.id)).toEqual(['mark-n_a'])
  })

  it('do not reach a later request that has none', () => {
    const p = talk([
      user('u1', [circled('n_a')]),
      agent('a1'),
      user('u2', []),
      agent('a2'),
    ])
    expect(turnMarks(p, 'a2')).toEqual([])
  })

  it('stay with the request through a typed answer to its card', () => {
    const p = talk([
      user('u1', [circled('n_a')]),
      agent('a1'),
      user('u2', [], true),
      agent('a2'),
    ])
    expect(turnMarks(p, 'a2').map((r) => r.id)).toEqual(['mark-n_a'])
  })

  it('use the newest copy when a picture was circled twice', () => {
    const again = { ...circled('n_a'), id: 'mark-n_a-2' }
    const p = talk([user('u1', [circled('n_a'), again]), agent('a1')])
    const got = itemInputs(p, item({ base: 'n_a' }), [], turnMarks(p, 'a1'))
    expect(got.ids).toEqual(['img-n_a', 'mark-n_a-2'])
  })

  it('ask which picture when two are circled and no item names one', () => {
    const p = talk([user('u1', [circled('n_a'), circled('n_b')]), agent('a1')])
    expect(unclearBase(p, 'a1', [undefined])?.sort()).toEqual(['n_a', 'n_b'])
    expect(unclearBase(p, 'a1', ['n_b', undefined])).toBe(null)
  })

  it('do not ask when one picture is circled', () => {
    const p = talk([user('u1', [circled('n_a')]), agent('a1')])
    expect(unclearBase(p, 'a1', [undefined])).toBe(null)
  })
})

describe('transparent in a plan item', () => {
  const read = (extra: object) => {
    const call = parseCall(
      'propose_plan',
      JSON.stringify({
        title: 't',
        items: [{ label: 'a', prompt: 'p', ratio: '1:1', ...extra }],
      })
    )
    return call.name === 'propose_plan'
      ? call.args.items[0].transparent
      : 'not a plan'
  }

  it('is left open when the planner does not say, so an edit can keep it', () => {
    expect(read({})).toBe(undefined)
  })

  it("keeps the planner's true or false", () => {
    expect(read({ transparent: true })).toBe(true)
    expect(read({ transparent: false })).toBe(false)
  })
})

describe('the system prompt', () => {
  const build = (nodes: CanvasNode[]) =>
    buildSystemPrompt({ skills: [], project: project(nodes), brand: null })

  it('marks transparent pictures in the canvas list', () => {
    const text = build([node('n_a', true), node('n_b')])
    expect(text).toMatch(/n_a「n_a」.*透明底/)
    expect(text).not.toMatch(/n_b「n_b」.*透明底/)
  })

  it('carries the Codex rules ahead of the canvas list', () => {
    const text = build([node('n_a')])
    const rules = text.indexOf(
      'normalize it into a clean spec without adding creative requirements'
    )
    expect(rules).toBeGreaterThan(0)
    expect(
      text.indexOf('repeat invariants on every iteration')
    ).toBeGreaterThan(rules)
    expect(text.indexOf('## 画布')).toBeGreaterThan(rules)
  })

  it('is the same up to the canvas list whatever is on the canvas', () => {
    const head = (s: string) => s.slice(0, s.indexOf('## 画布'))
    expect(head(build([]))).toBe(head(build([node('n_a')])))
  })
})

describe('what the planner is told about a picture', () => {
  it('gives the real size and the size it is shown at', () => {
    const text = describeRef({ id: 'i', w: 1536, h: 2048 }, 1)
    expect(text).toContain('1536×2048, shown to you at 768×1024')
  })

  it('gives only the size of a small picture', () => {
    const text = describeRef({ id: 'i', w: 800, h: 800, nodeId: 'n_a' }, 2)
    expect(text).toContain('(id n_a), 800×800.')
  })
})

describe('trying a picture once more', () => {
  const busy = (status: number) => new DrawApiError('busy', 'x', status)

  it('retries a busy answer that came back at once', () => {
    for (const status of [429, 502, 503, 504]) {
      expect(retryable(busy(status), 800)).toBe(true)
    }
  })

  it('leaves slow failures, dropped connections and other errors alone', () => {
    expect(retryable(busy(502), RETRY_WITHIN_MS)).toBe(false)
    expect(retryable(busy(0), 800)).toBe(false)
    expect(retryable(busy(500), 800)).toBe(false)
    expect(retryable(new DrawApiError('moderation', 'x', 400), 800)).toBe(false)
    expect(retryable(new DrawApiError('balance', 'x', 429), 800)).toBe(false)
    expect(retryable(new Error('x'), 800)).toBe(false)
  })
})

describe('waiting times', () => {
  it('has the 2.6 models', () => {
    expect(TYPICAL_SECS['gpt-image-2.6-sunburst']).toBeDefined()
    expect(TYPICAL_SECS['gpt-image-2.6-flare']).toBeDefined()
  })
})
