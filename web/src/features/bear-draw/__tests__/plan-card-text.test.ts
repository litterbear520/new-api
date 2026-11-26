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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import { drawPlan } from '../lib/agent/plan'
import { resume } from '../lib/agent/run'
import { decide, editPlanText, fixAdLaw, undoAdLaw } from '../lib/engine'
import { planSummary, planTexts, replacePlanText } from '../lib/plan-text'
import type { Part, PlanItem, Project } from '../types'

vi.mock('../lib/agent/plan', async (original) => ({
  ...(await original<typeof import('../lib/agent/plan')>()),
  drawPlan: vi.fn(),
}))
vi.mock('../lib/agent/run', async (original) => ({
  ...(await original<typeof import('../lib/agent/run')>()),
  resume: vi.fn(async () => undefined),
}))

const PROMPT = `Use case: promotional poster
Primary request: A clean sale poster with the headline "岁末酬宾".
Text (verbatim): large headline "岁末酬宾"; smaller line below:
"全场满 300 减 60"
Style: flat, bold "retro" type.`

describe('the words a planned picture shows', () => {
  it('are the quoted strings of the text part only', () => {
    expect(planTexts(PROMPT)).toEqual(['岁末酬宾', '全场满 300 减 60'])
    expect(planTexts('文字：「新品上市」\n风格：简洁')).toEqual(['新品上市'])
    expect(planTexts('A cat on a sofa, "cozy" mood')).toEqual([])
  })

  it('change everywhere the same string is asked for', () => {
    const next = replacePlanText(PROMPT, 0, ' 年终酬宾" ')
    expect(planTexts(next)).toEqual(['年终酬宾', '全场满 300 减 60'])
    expect(next).toContain('headline "年终酬宾".')
    expect(next).not.toContain('岁末酬宾')
    // the unquoted word elsewhere is left alone
    expect(replacePlanText(PROMPT, 0, '年终')).toContain('bold "retro" type')
    // nothing to change
    expect(replacePlanText(PROMPT, 0, '  ')).toBe(PROMPT)
    expect(replacePlanText(PROMPT, 5, 'x')).toBe(PROMPT)
  })

  it('change one place only when the words are short or repeated', () => {
    const prompt = `Primary request: put Image 1 on a shelf, price 10.
Text (verbatim):
Headline: "1"
Subtitle: 『周末见』
Badge: "1"
Style: flat`
    expect(planTexts(prompt)).toEqual(['1', '周末见', '1'])
    const next = replacePlanText(prompt, 2, '2')
    expect(planTexts(next)).toEqual(['1', '周末见', '2'])
    expect(next).toContain('put Image 1 on a shelf, price 10.')
    expect(planTexts(replacePlanText(prompt, 1, '周五见'))[1]).toBe('周五见')
  })

  it('lose their letter-by-letter spelling when they change', () => {
    const spelled =
      'Text (verbatim): "岁末钜惠" (characters: 岁, 末, 钜, 惠), bold'
    expect(replacePlanText(spelled, 0, '开年优惠')).toBe(
      'Text (verbatim): "开年优惠", bold'
    )
  })

  it('come with one line that says what the picture is', () => {
    expect(planSummary(PROMPT)).toBe(
      'A clean sale poster with the headline "岁末酬宾".'
    )
    expect(planSummary('\nA cat on a sofa')).toBe('A cat on a sofa')
  })
})

const item = (id: string, over: Partial<PlanItem> = {}): PlanItem =>
  ({
    id,
    label: id,
    prompt: PROMPT,
    ratio: '1:1',
    model: 'gpt-image-2.6-sunburst',
    refs: [],
    est: 0.02,
    on: true,
    ...over,
  }) as PlanItem

function project(items: PlanItem[], state = 'pending'): Project {
  return {
    id: 'p',
    title: 'p',
    createdAt: 1,
    updatedAt: 1,
    cost: 0,
    messages: [
      {
        id: 'agent',
        role: 'agent',
        mode: 'agent',
        status: 'waiting',
        startedAt: 1,
        cost: 0,
        parts: [
          {
            id: 'plan',
            type: 'plan',
            callId: 'c1',
            title: 'set',
            items,
            state,
            adlaw: [],
          } as Part,
        ],
      },
    ],
    transcript: [],
    groups: [],
    nodes: [],
  } as Project
}

const planPart = () => {
  const m = findProject('p')?.messages[0]
  const part = m?.role === 'agent' ? m.parts[0] : undefined
  if (part?.type !== 'plan') throw new Error('no plan')
  return part
}

beforeEach(() => {
  useBearDrawStore.getState().init(1, [])
})
afterEach(() => {
  useBearDrawStore.setState({
    uid: null,
    loaded: false,
    projects: [],
    live: {},
  })
  vi.mocked(drawPlan).mockReset()
  vi.mocked(resume).mockClear()
})

describe('changing the words on the plan card', () => {
  it('rewrites the prompt and checks the advertising law again', () => {
    useBearDrawStore.setState({ projects: [project([item('a'), item('b')])] })
    editPlanText('p', 'plan', 'a', 0, '全网第一')
    const part = planPart()
    expect(planTexts(part.items[0].prompt)[0]).toBe('全网第一')
    expect(part.items[1].prompt).toBe(PROMPT)
    expect(part.adlaw.map((h) => h.itemId)).toContain('a')
  })

  it('leaves a plan that no longer waits as it is', () => {
    useBearDrawStore.setState({
      projects: [project([item('a')], 'confirmed')],
    })
    editPlanText('p', 'plan', 'a', 0, '年终酬宾')
    expect(planPart().items[0].prompt).toBe(PROMPT)
  })
})

describe('只画第一张', () => {
  it('tells the planner which pictures still wait', async () => {
    useBearDrawStore.setState({
      projects: [
        project([item('a', { on: false }), item('b'), item('c'), item('d')]),
      ],
    })
    vi.mocked(drawPlan).mockResolvedValue({
      groupId: 'g',
      results: [],
      cost: 0,
    })
    decide('p', 'plan', 'first')
    await vi.waitFor(() => expect(resume).toHaveBeenCalled())
    expect(planPart().items.map((x) => x.on)).toEqual([
      false,
      true,
      false,
      false,
    ])
    expect(vi.mocked(resume).mock.calls[0][3]).toMatchObject({
      status: 'drawn',
      preview_first: true,
      not_drawn: ['c', 'd'],
    })
    expect(vi.mocked(resume).mock.calls[0][3]).not.toHaveProperty(
      'user_changed_text'
    )
  })

  it('tells the planner the words the user changed on the card', async () => {
    useBearDrawStore.setState({ projects: [project([item('a'), item('b')])] })
    editPlanText('p', 'plan', 'b', 1, '全场满 300 减 80')
    vi.mocked(drawPlan).mockResolvedValue({
      groupId: 'g',
      results: [],
      cost: 0,
    })
    decide('p', 'plan', 'start')
    await vi.waitFor(() => expect(resume).toHaveBeenCalled())
    expect(vi.mocked(resume).mock.calls[0][3]).toMatchObject({
      user_changed_text: [
        { label: 'b', text: ['岁末酬宾', '全场满 300 减 80'] },
      ],
    })
  })

  it('draws the first one although a later one lost its picture', async () => {
    useBearDrawStore.setState({
      projects: [project([item('a'), item('b', { base: 'n_gone' })])],
    })
    vi.mocked(drawPlan).mockResolvedValue({
      groupId: 'g',
      results: [],
      cost: 0,
    })
    decide('p', 'plan', 'first')
    await vi.waitFor(() => expect(resume).toHaveBeenCalled())
    expect(drawPlan).toHaveBeenCalledTimes(1)
    expect(vi.mocked(resume).mock.calls[0][3]).toMatchObject({
      status: 'drawn',
    })
  })

  it('says nothing of it when the whole plan is drawn', async () => {
    useBearDrawStore.setState({ projects: [project([item('a'), item('b')])] })
    vi.mocked(drawPlan).mockResolvedValue({
      groupId: 'g',
      results: [],
      cost: 0,
    })
    decide('p', 'plan', 'start')
    await vi.waitFor(() => expect(resume).toHaveBeenCalled())
    expect(vi.mocked(resume).mock.calls[0][3]).not.toHaveProperty(
      'preview_first'
    )
  })

  it('draws nothing when a picture the plan needs was removed', async () => {
    useBearDrawStore.setState({
      projects: [project([item('a', { base: 'n_gone' })])],
    })
    decide('p', 'plan', 'start')
    await vi.waitFor(() => expect(resume).toHaveBeenCalled())
    expect(drawPlan).not.toHaveBeenCalled()
    expect(vi.mocked(resume).mock.calls[0][3]).toMatchObject({
      status: 'not_drawn',
    })
    expect(planPart().state).toBe('cancelled')
  })
})

describe('广告法 「全部替换」', () => {
  const LAW = 'Text (verbatim): "全网第一" in bold type.'

  it('can be taken back while the plan still waits', () => {
    const p = project([item('a', { prompt: LAW }), item('b')])
    const part = p.messages[0]
    if (part.role !== 'agent' || part.parts[0].type !== 'plan') {
      throw new Error('no plan')
    }
    part.parts[0].adlaw = [{ itemId: 'a', word: '第一', fix: '领先' }]
    useBearDrawStore.getState().init(1, [p])

    fixAdLaw('p', 'plan')
    expect(planPart().adlawFixed).toBe(true)
    expect(planPart().items[0].prompt).toContain('全网领先')
    expect(planPart().items[1].prompt).toBe(PROMPT)

    undoAdLaw('p', 'plan')
    expect(planPart().adlawFixed).toBe(false)
    expect(planPart().adlawUndo).toBeUndefined()
    expect(planPart().items[0].prompt).toBe(LAW)
    // the flagged words show again
    expect(planPart().adlaw).toHaveLength(1)
  })
})
