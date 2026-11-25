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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import {
  CHECK_MAX,
  CHECK_PX,
  drawnPictures,
  type DrawnPlan,
  inputProblem,
  itemInputs,
  lostInput,
  makePlan,
  type PlanPart,
  statedBases,
} from '../lib/agent/plan'
import { buildSystemPrompt } from '../lib/agent/prompt'
import { MAX_INPUTS, MAX_VIEW, parseCall, TOOLS } from '../lib/agent/tools'
import {
  openCalls,
  placeToolResult,
  shownPictures,
  wireMessages,
} from '../lib/agent/transcript'
import type {
  ApiMessage,
  Attachment,
  CanvasNode,
  PlanItem,
  Project,
} from '../types'

vi.mock('@/features/draw/lib/storage', () => ({
  getImageBlob: vi.fn(async (id: string) => new Blob([id])),
}))
vi.mock('@/features/draw/lib/images', () => ({
  smallJpeg: vi.fn(async (blob: Blob, px: number) => ({ blob, px })),
  blobToDataUrl: vi.fn(
    async (x: { blob: Blob; px: number }) =>
      `data:${await x.blob.text()}@${x.px}`
  ),
}))

const node = (id: string, status = 'ready'): CanvasNode =>
  ({
    id,
    groupId: null,
    status,
    img: status === 'ready' ? { id: `img-${id}`, w: 2048, h: 1024 } : undefined,
    w: 2048,
    h: 1024,
    label: `L${id}`,
    meta: {},
  }) as CanvasNode

const upload = (id: string): Attachment => ({ id, w: 800, h: 800 })

const project = (nodes: CanvasNode[], refs: Attachment[] = []): Project =>
  ({
    id: 'p',
    nodes,
    groups: [],
    messages: [
      { id: 'u1', role: 'user', at: 0, mode: 'agent', text: '', refs },
      { id: 'a1', role: 'agent', at: 0, mode: 'agent', parts: [] },
    ],
    transcript: [],
  }) as unknown as Project

const item = (over: Partial<PlanItem>): PlanItem =>
  ({
    id: 'it',
    label: 'a',
    prompt: 'x',
    ratio: '1:1',
    model: 'gpt-image-2.6-sunburst',
    refs: [],
    est: 0,
    on: true,
    ...over,
  }) as PlanItem

const plan = (items: unknown[]) => {
  const call = parseCall('propose_plan', JSON.stringify({ title: 't', items }))
  if (call.name !== 'propose_plan') throw new Error('not a plan')
  return call.args
}

describe('view_pictures', () => {
  it('is offered to the planner', () => {
    expect(TOOLS.map((x) => x.function.name)).toContain('view_pictures')
  })

  it('reads the ids once each', () => {
    const call = parseCall(
      'view_pictures',
      JSON.stringify({ node_ids: ['n_a', ' n_a ', 'n_b', 7] })
    )
    expect(call).toEqual({
      name: 'view_pictures',
      args: { node_ids: ['n_a', 'n_b'] },
    })
  })

  it('tells the planner the limit instead of cutting the list', () => {
    const ids = Array.from({ length: MAX_VIEW + 1 }, (_, i) => `n_${i}`)
    const call = parseCall('view_pictures', JSON.stringify({ node_ids: ids }))
    expect(call.name).toBe('unknown')
    expect(parseCall('view_pictures', '{}').name).toBe('unknown')
  })
})

describe('pictures the page shows the planner', () => {
  it('names them by canvas id, with the size they are sent at', () => {
    const m = shownPictures('asked', [node('n_a'), node('n_b', 'failed')])
    expect(m).toMatchObject({ role: 'user', shown: true, images: ['img-n_a'] })
    expect(m?.role === 'user' && m.content).toContain(
      'n_a「Ln_a」, 2048×1024, shown to you at 1024×512'
    )
    expect(m?.role === 'user' && m.content).not.toContain('Picture 1')
    expect(shownPictures('asked', [node('n_b', 'failed')])).toBeNull()
  })

  it('sends the drawn ones smaller', () => {
    const m = shownPictures('drawn', [node('n_a')], CHECK_PX)
    expect(m).toMatchObject({ px: CHECK_PX })
    expect(m?.role === 'user' && m.content).toContain('shown to you at 768×384')
  })

  const call = (id: string, name: string): ApiMessage => ({
    role: 'assistant',
    content: null,
    tool_calls: [{ id, type: 'function', function: { name, arguments: '{}' } }],
  })
  const shown = shownPictures('asked', [node('n_a')]) as ApiMessage

  it('stay inlined with the user pictures until the user speaks again', async () => {
    const turn: ApiMessage[] = [
      { role: 'user', content: 'edit it', images: ['up1'] },
      call('c1', 'view_pictures'),
      { role: 'tool', tool_call_id: 'c1', content: '{}' },
      shown,
    ]
    const wire = await wireMessages('sys', turn)
    expect(wire[1].content).toEqual([
      { type: 'text', text: 'edit it' },
      { type: 'image_url', image_url: { url: 'data:up1@1024' } },
    ])
    expect(wire[4].content).toEqual([
      { type: 'text', text: (shown as { content: string }).content },
      { type: 'image_url', image_url: { url: 'data:img-n_a@1024' } },
    ])
    expect(wire[4]).not.toHaveProperty('shown')

    const later = await wireMessages('sys', [
      ...turn,
      { role: 'assistant', content: 'done' },
      { role: 'user', content: 'next' },
    ])
    expect(typeof later[1].content).toBe('string')
    expect(later[4].content).toContain('no longer shown')
  })

  it('are sent at their own size', async () => {
    const m = shownPictures('drawn', [node('n_a')], CHECK_PX) as ApiMessage
    const wire = await wireMessages('sys', [
      { role: 'user', content: 'draw' },
      m,
    ])
    expect(wire[2].content).toEqual([
      expect.anything(),
      { type: 'image_url', image_url: { url: `data:img-n_a@${CHECK_PX}` } },
    ])
  })

  it('do not close the calls still waiting for a result', () => {
    const two: ApiMessage = {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: 'c1', type: 'function', function: { name: 'a', arguments: '' } },
        { id: 'c2', type: 'function', function: { name: 'b', arguments: '' } },
      ],
    }
    const list: ApiMessage[] = [
      { role: 'user', content: 'x' },
      two,
      { role: 'tool', tool_call_id: 'c1', content: '{}' },
      shown,
    ]
    expect(openCalls(list)).toEqual(['c2'])
    const placed = placeToolResult(list, 'c2', '{}')
    expect(placed.map((m) => m.role)).toEqual([
      'user',
      'assistant',
      'tool',
      'tool',
      'user',
    ])
  })
})

describe('checking what was drawn', () => {
  const drawn = (n: number, failed = 0): DrawnPlan => ({
    groupId: 'g',
    cost: 0,
    results: Array.from({ length: n }, (_, i) => ({
      label: `l${i}`,
      node_id: `n_${i}`,
      status: i < failed ? ('failed' as const) : ('done' as const),
    })),
  })
  const nodes = Array.from({ length: 6 }, (_, i) => node(`n_${i}`))

  beforeEach(() => {
    useBearDrawStore.setState({ projects: [project(nodes)] })
  })

  it('shows a small set to the planner, finished pictures only', () => {
    const [m] = drawnPictures('p', drawn(CHECK_MAX, 1))
    expect(m).toMatchObject({
      shown: true,
      px: CHECK_PX,
      images: ['img-n_1', 'img-n_2', 'img-n_3'],
    })
  })

  it('leaves a bigger set, or one with nothing drawn, to view_pictures', () => {
    expect(drawnPictures('p', drawn(CHECK_MAX + 1))).toEqual([])
    expect(drawnPictures('p', drawn(2, 2))).toEqual([])
  })

  it('is asked of the planner in its rules', () => {
    const rules = buildSystemPrompt({
      skills: [],
      project: project([]),
      brand: null,
    })
    expect(rules).toContain('view_pictures')
    expect(rules).toContain('error_kind')
    expect(rules).toContain('不要自己再调用 propose_plan 重画')
  })
})

describe('inputs with roles', () => {
  const p = project(
    [node('n_a'), node('n_b'), node('n_c', 'failed')],
    [upload('up1'), upload('up2')]
  )

  it('reads node or ref and falls back to a style reference', () => {
    const args = plan([
      {
        label: 'a',
        prompt: 'x',
        ratio: '1:1',
        inputs: [
          { node_id: 'n_a', role: 'edit_target' },
          { ref: 2, role: 'product_ref' },
          { ref: '1', role: 'made_up' },
        ],
      },
    ])
    expect(args.items[0].inputs).toEqual([
      { node: 'n_a', role: 'edit_target' },
      { ref: 2, role: 'product_ref' },
      { ref: 1, role: 'style_ref' },
    ])
    expect(statedBases(args)).toEqual(['n_a'])
    expect(inputProblem(p, 'a1', args)).toBeNull()
  })

  it('sends them in order, each with its role', () => {
    const got = itemInputs(
      p,
      item({
        inputs: [
          { node: 'n_a', role: 'edit_target' },
          { node: 'n_b', role: 'style_ref' },
          { ref: 1, role: 'logo_ref' },
        ],
        // Ignored once inputs are given.
        base: 'n_b',
        refs: [2],
      }),
      [upload('up1'), upload('up2')]
    )
    expect(got.ids).toEqual(['img-n_a', 'img-n_b', 'up1'])
    expect(got.roles[0]).toBe('the picture to edit')
    expect(got.roles[1]).toMatch(/^「Ln_b」, a style reference/)
    expect(got.roles[2]).toMatch(/^the logo/)
  })

  const mark: Attachment = {
    id: 'mark-a',
    w: 1,
    h: 1,
    nodeId: 'n_a',
    marked: true,
  }

  it('puts the red-circle copy last, so Image N keeps the listed order', () => {
    const got = itemInputs(
      p,
      item({
        inputs: [
          { node: 'n_b', role: 'scene_ref' },
          { node: 'n_a', role: 'edit_target' },
          { ref: 2, role: 'insert' },
        ],
      }),
      [mark, upload('up1')],
      [mark]
    )
    expect(got.ids).toEqual(['img-n_b', 'img-n_a', 'up1', 'mark-a'])
    expect(got.roles[3]).toMatch(/^a copy of Image 2 with red numbered circles/)
  })

  it('wants the circled picture listed as the one to edit', () => {
    const circled = project([node('n_a'), node('n_b')], [mark])
    const ask = (inputs: unknown[]) =>
      inputProblem(
        circled,
        'a1',
        plan([{ label: 'cup', prompt: 'x', ratio: '1:1', inputs }])
      )
    expect(ask([{ node_id: 'n_b', role: 'insert' }])).toContain(
      'circled the canvas picture n_a'
    )
    expect(
      ask([
        { node_id: 'n_a', role: 'edit_target' },
        { node_id: 'n_b', role: 'insert' },
      ])
    ).toBeNull()
    // The copy with the circles counts toward the five.
    expect(
      ask([
        { node_id: 'n_a', role: 'edit_target' },
        ...Array.from({ length: MAX_INPUTS - 1 }, () => ({
          node_id: 'n_b',
          role: 'style_ref',
        })),
      ])
    ).toContain(`at most ${MAX_INPUTS}`)
  })

  it('keeps a malformed input in the list, so the plan goes back', () => {
    const args = plan([
      {
        label: 'cup',
        prompt: 'x',
        ratio: '1:1',
        inputs: [{ ref: 1, role: 'edit_target' }, null],
      },
    ])
    expect(args.items[0].inputs).toHaveLength(2)
    expect(inputProblem(p, 'a1', args)).toContain('node_id or ref')
  })

  it('keeps the transparency of an attached picture it edits', () => {
    const clear = project([node('n_a')], [{ ...upload('png'), clear: true }])
    useBearDrawStore.setState({ projects: [clear] })
    const made = (over: object) =>
      makePlan(
        'p',
        'a1',
        'c1',
        plan([
          {
            label: 'logo',
            prompt: 'x',
            ratio: '1:1',
            inputs: [{ ref: 1, role: 'edit_target' }],
            ...over,
          },
        ])
      ).items[0]
    expect(made({}).transparent).toBe(true)
    expect(made({ transparent: false }).transparent).toBeUndefined()
    // base is not read once inputs are given.
    expect(made({ base: 'n_a' }).base).toBeUndefined()
    useBearDrawStore.setState({ projects: [] })
  })

  it('notices a picture removed while the plan waited', () => {
    const waiting = {
      items: [
        item({ inputs: [{ node: 'n_a', role: 'style_ref' }] }),
        item({ base: 'n_gone', on: false }),
      ],
    } as PlanPart
    expect(lostInput(p, waiting)).toBeNull()
    expect(lostInput(project([node('n_b')]), waiting)).toContain('n_a')
  })

  it('keeps base + refs working as before', () => {
    const got = itemInputs(p, item({ base: 'n_a', refs: [1] }), [upload('up1')])
    expect(got.ids).toEqual(['img-n_a', 'up1'])
  })

  const problem = (inputs: unknown[]) =>
    inputProblem(
      p,
      'a1',
      plan([{ label: 'cup', prompt: 'x', ratio: '1:1', inputs }])
    )

  it('tells the planner what is wrong instead of dropping a picture', () => {
    expect(problem([{ node_id: 'n_zz', role: 'style_ref' }])).toContain('n_zz')
    expect(problem([{ node_id: 'n_c', role: 'style_ref' }])).toContain('n_c')
    expect(problem([{ ref: 3, role: 'style_ref' }])).toContain('2 picture(s)')
    expect(problem([{ role: 'style_ref' }])).toContain('node_id or ref')
    expect(
      problem([
        { node_id: 'n_a', role: 'edit_target' },
        { node_id: 'n_b', role: 'edit_target' },
      ])
    ).toContain('more than one edit_target')
    expect(
      problem(
        Array.from({ length: MAX_INPUTS + 1 }, () => ({
          ref: 1,
          role: 'style_ref',
        }))
      )
    ).toContain(`at most ${MAX_INPUTS}`)
  })
})
