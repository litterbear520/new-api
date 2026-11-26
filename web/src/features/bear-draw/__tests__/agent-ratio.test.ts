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
import { afterEach, describe, expect, it } from 'vitest'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { DEFAULT_PREFS } from '../constants'
import { brandFor, itemInputs, ratioProblem, sizeFits } from '../lib/agent/plan'
import type { PlanArgsT } from '../lib/agent/tools'
import type { PlanItem, Project, Ratio } from '../types'

const talk = (user: object): Project =>
  ({
    id: 'p',
    nodes: [],
    groups: [],
    transcript: [],
    messages: [
      { id: 'u', role: 'user', mode: 'agent', text: 'x', refs: [], ...user },
      { id: 'a', role: 'agent', mode: 'agent', parts: [] },
    ],
  }) as unknown as Project

const plan = (...ratios: Ratio[]): PlanArgsT => ({
  title: 't',
  items: ratios.map((ratio, i) => ({
    label: `no${i + 1}`,
    prompt: 'a cup',
    ratio,
    refs: [],
    inputs: undefined,
  })),
})

afterEach(() => {
  useBearDrawStore.setState({ prefs: { ...DEFAULT_PREFS }, brandKit: null })
})

describe('a plan against the ratio the user picked', () => {
  it('is sent back when a picture uses another ratio', () => {
    const p = talk({ ratio: '16:9' })
    expect(ratioProblem(p, 'a', plan('16:9', '16:9'))).toBeNull()
    const problem = ratioProblem(p, 'a', plan('16:9', '1:1'))
    expect(problem).toContain('16:9')
    expect(problem).toContain('「no2」')
    expect(problem).not.toContain('「no1」')
  })

  it('is free when the user left the ratio to the planner', () => {
    expect(ratioProblem(talk({}), 'a', plan('1:1', '3:4'))).toBeNull()
  })
})

describe('a delivery size', () => {
  it('is kept only when it has the ratio of its picture', () => {
    expect(sizeFits('800×800', '1:1')).toBe(true)
    expect(sizeFits('1920x1080', '16:9')).toBe(true)
    expect(sizeFits('800×800', '16:9')).toBe(false)
    // nothing to compare: 750 宽, no size, a ratio left open
    expect(sizeFits('750 宽', '16:9')).toBe(true)
    expect(sizeFits(undefined, '16:9')).toBe(true)
    expect(sizeFits('800×800', 'auto')).toBe(true)
  })
})

describe('the brand kit in a 玩法 from the gallery', () => {
  const item = {
    id: 'it',
    label: 'a',
    prompt: 'a toy box of landmarks, 标志性地标',
    ratio: '1:1',
    refs: [],
  } as unknown as PlanItem

  it('stays out: no logo is sent with the picture', () => {
    useBearDrawStore.setState({
      brandKit: {
        name: '山野',
        colors: [],
        fonts: '',
        tone: '',
        points: [],
        logo: { id: 'logo', w: 10, h: 10 },
        notes: '',
      },
    })
    const preset = talk({ presetId: 'country-toybox' })
    expect(brandFor(preset, 'a')).toBe(false)
    expect(itemInputs(preset, item, [], [], brandFor(preset, 'a')).ids).toEqual(
      []
    )

    const plain = talk({})
    expect(brandFor(plain, 'a')).toBe(true)
    expect(itemInputs(plain, item, [], [], brandFor(plain, 'a')).ids).toEqual([
      'logo',
    ])
  })
})
