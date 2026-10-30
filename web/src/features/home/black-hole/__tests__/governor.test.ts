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

import { type Governor, governor } from '../governor'

/** Frames `ms` apart for `seconds` from `t` (ms): what the governor said, and when they ended */
function frames(
  g: Governor,
  ms: number,
  seconds: number,
  t = 0
): { said: string[]; now: number } {
  const said: string[] = []
  let now = t
  for (; now < t + seconds * 1000; now += ms) {
    const a = g.frame(ms, now)
    if (a) said.push(a)
  }
  return { said, now }
}

/** Frames `ms` apart from `t` until the governor says `word` (at most 30 s): when it did */
function until(g: Governor, ms: number, word: string, t: number): number {
  for (let now = t; now < t + 30000; now += ms) {
    if (g.frame(ms, now) === word) return now
  }
  throw new Error(`never said ${word}`)
}

/** A governor that has watched a screen refresh every `vsync` ms while the sky loaded */
function on(vsync: number, minGap = 0): Governor {
  const g = governor(minGap)
  for (let i = 0; i < 24; i++) g.screen(vsync)
  return g
}

describe('the resolution governor', () => {
  it("leaves a GPU that keeps the screen's pace alone", () => {
    const g = on(16.7)
    expect(frames(g, 16.7, 30).said).toEqual([])
    expect(g.res).toBe(1)
  })

  it('draws fewer pixels on a 60 Hz screen when each frame takes two of its frames', () => {
    const g = on(16.7)
    const first = frames(g, 16.7, 21)
    expect(frames(g, 33.3, 2, first.now).said).toEqual(['down'])
    expect(g.res).toBeCloseTo(0.85)
  })

  it('draws fewer pixels on a fast screen whose every other frame is missed', () => {
    const g = on(12.5, 10.5)
    const first = frames(g, 12.5, 21)
    expect(frames(g, 25, 2, first.now).said).toEqual(['down'])
  })

  it('counts a 160 Hz screen drawn every other frame as on time', () => {
    const g = on(6.25, 10.5)
    expect(g.budget).toBeCloseTo(12.5)
    expect(frames(g, 12.5, 30).said).toEqual([])
  })

  it('counts a 100 Hz screen drawn every other frame as on time', () => {
    const g = on(10, 10.5)
    expect(g.budget).toBeCloseTo(20)
    expect(frames(g, 20, 30).said).toEqual([])
  })

  it('takes a frame one screen frame late on a 120 Hz screen as on time, two as late', () => {
    const g = on(8.33, 10.5)
    expect(frames(g, 25, 30).said).toEqual([])
    expect(frames(g, 33.3, 2, 30000).said).toEqual(['down'])
  })

  it('learns a screen held to 30 frames a second (a browser saving power) and keeps its pace', () => {
    const g = on(33.3)
    expect(g.budget).toBeCloseTo(33.3)
    expect(frames(g, 33.3, 30).said).toEqual([])
    expect(g.res).toBe(1)
  })

  it('learns nothing from ticks that disagree (the page busy while the sky loads)', () => {
    const g = governor(0)
    for (let i = 0; i < 24; i++) g.screen(i % 2 ? 16.7 : 33.3)
    expect(g.budget).toBeCloseTo(16.7)
    for (let i = 0; i < 12; i++) g.screen(16.7)
    for (let i = 0; i < 12; i++) g.screen(8.33)
    expect(g.budget).toBeCloseTo(8.33)
    // once learnt, the screen only gets quicker
    for (let i = 0; i < 12; i++) g.screen(16.7)
    expect(g.budget).toBeCloseTo(8.33)
  })

  it('lets a late frame now and then pass', () => {
    const g = on(16.7)
    let t = frames(g, 16.7, 21).now
    const said: string[] = []
    for (let i = 0; i < 10; i++) {
      const second = frames(g, 16.7, 1, t)
      said.push(...second.said)
      t = second.now + 40
      const a = g.frame(40, t)
      if (a) said.push(a)
    }
    expect(said).toEqual([])
  })

  it('bears with slowish frames on a fast screen in its first 20 seconds, new shaders still compiling', () => {
    const g = on(6.25, 10.5)
    expect(frames(g, 25, 19).said).toEqual([])
    expect(frames(g, 25, 3, 19000).said).toEqual(['down'])
  })

  it('steps down at once on a 60 Hz screen, where any missed frame is over 30 ms', () => {
    const g = on(16.7)
    expect(until(g, 33.3, 'down', 0)).toBeLessThan(2500)
  })

  it('takes a pause (the page out of sight) for no frame at all', () => {
    const g = on(16.7)
    let t = frames(g, 16.7, 21).now
    for (let i = 0; i < 5; i++) {
      t += 2000
      expect(g.frame(2000, t)).toBeNull()
      t = frames(g, 16.7, 0.2, t).now
    }
    expect(g.res).toBe(1)
  })

  it('counts afresh when frames start again (the first screen back in view)', () => {
    const g = on(16.7)
    let t = until(g, 40, 'down', 0)
    // a minute out of view: no going up on the first frame back, only after frames keep time again
    t += 60000
    g.resume(t)
    expect(g.frame(16.7, t + 16.7)).toBeNull()
    expect(frames(g, 16.7, 4, t + 16.7).said).toEqual(['up'])
  })

  it('draws every pixel again once frames keep time for a while', () => {
    const g = on(16.7)
    const t = until(g, 40, 'down', 0)
    expect(g.res).toBeCloseTo(0.85)
    expect(frames(g, 16.7, 4, t).said).toEqual(['up'])
    expect(g.res).toBe(1)
  })

  it('waits longer before going up again when that was too much', () => {
    const g = on(16.7)
    let t = until(g, 40, 'down', 0)
    t = until(g, 16.7, 'up', t)
    t = until(g, 40, 'down', t)
    const quick = frames(g, 16.7, 5, t)
    expect(quick.said).toEqual([])
    expect(frames(g, 16.7, 2, quick.now).said).toEqual(['up'])
  })

  it('gives up for the still picture when even its fewest pixels are too many', () => {
    const g = on(16.7)
    expect(frames(g, 60, 20).said.slice(0, 4)).toEqual([
      'down',
      'down',
      'down',
      'fail',
    ])
  })
})
