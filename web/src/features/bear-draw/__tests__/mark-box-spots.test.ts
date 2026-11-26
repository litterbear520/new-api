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

import { describeRef } from '../lib/agent/transcript'
import { boxStroke, finishBox, pathD } from '../lib/canvas/geometry'
import { markSpots, spotsText } from '../lib/mark-spots'

describe('a box mark', () => {
  it('is a closed stroke along the four sides, whichever way it was dragged', () => {
    const a = boxStroke([0.2, 0.1], [0.6, 0.5])
    const b = boxStroke([0.6, 0.5], [0.2, 0.1])
    expect(a).toEqual(b)
    expect(a[0]).toEqual([0.4, 0.1])
    for (const [u, v] of a) {
      const onSide = [0.2, 0.6].includes(u) || [0.1, 0.5].includes(v)
      expect(onSide).toBe(true)
    }
    expect(Math.min(...a.map((p) => p[0]))).toBe(0.2)
    expect(Math.max(...a.map((p) => p[1]))).toBe(0.5)
    expect(pathD(a, true, 1000).endsWith('Z')).toBe(true)
  })

  it('is kept only when it is big enough to be meant', () => {
    expect(finishBox([0.5, 0.5], [0.501, 0.501], 1000, 1000, 1)).toBeNull()
    const kept = finishBox([0.2, 0.2], [0.4, 0.3], 1000, 1000, 1)
    expect(kept?.closed).toBe(true)
    expect(kept?.note).toBe('')
  })
})

describe('where the marks are, for the planner', () => {
  const marks = [
    {
      n: 1,
      note: '',
      closed: true,
      points: [
        [600, 100],
        [760, 100],
        [760, 260],
        [600, 260],
      ] as Array<[number, number]>,
    },
    {
      n: 2,
      note: '',
      closed: false,
      points: [
        [480, 500],
        [520, 540],
      ] as Array<[number, number]>,
    },
  ]

  it('gives the centre of each mark in percent of the picture', () => {
    expect(markSpots(marks, 1000, 1000)).toEqual([
      { n: 1, x: 68, y: 18 },
      { n: 2, x: 50, y: 52 },
    ])
    expect(markSpots(marks, 0, 0)).toEqual([])
  })

  it('says it in words', () => {
    expect(spotsText(markSpots(marks, 1000, 1000))).toBe(
      '1 upper right (68% across, 18% down); 2 centre (50% across, 52% down)'
    )
  })

  it('is part of what the planner reads about the circled picture', () => {
    const text = describeRef(
      {
        id: 'm',
        w: 1000,
        h: 1000,
        nodeId: 'n_a',
        label: 'cup',
        marked: true,
        spots: [{ n: 1, x: 68, y: 18 }],
      },
      1
    )
    expect(text).toContain('The circles: 1 upper right (68% across, 18% down).')
    expect(
      describeRef({ id: 'm', w: 1, h: 1, nodeId: 'n_a', marked: true }, 1)
    ).not.toContain('The circles')
  })
})
