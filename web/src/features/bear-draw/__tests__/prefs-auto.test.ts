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

import { readPrefs, useBearDrawStore } from '@/stores/bear-draw-store'

import { DEFAULT_PREFS, STORAGE_KEYS } from '../constants'
import { hasQueued, stopQueued } from '../lib/engine'
import type { Project } from '../types'

const save = (prefs: object) =>
  localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs))

afterEach(() => {
  localStorage.clear()
  useBearDrawStore.setState({ prefs: { ...DEFAULT_PREFS } })
})

describe('自动 in the model preferences', () => {
  it('is on for prefs saved before it existed that kept the old defaults', () => {
    // 2.5 Sunburst and gpt-6-luna: the defaults of their time
    save({ image: 'gpt-image-2.5-sunburst', brain: 'gpt-6-luna' })
    expect(readPrefs()).toMatchObject({
      auto: true,
      image: DEFAULT_PREFS.image,
      brain: DEFAULT_PREFS.brain,
    })
  })

  it('stays off for prefs saved before it existed with models picked by hand', () => {
    save({ image: 'gpt-image-2.6-flare', brain: 'claude-sonnet-4-6' })
    expect(readPrefs()).toMatchObject({
      auto: false,
      image: 'gpt-image-2.6-flare',
      brain: 'claude-sonnet-4-6',
    })
  })

  it('off keeps the models the user picked', () => {
    save({ auto: false, image: 'gpt-image-2.6-flare', brain: 'gpt-6-luna' })
    expect(readPrefs()).toMatchObject({
      auto: false,
      image: 'gpt-image-2.6-flare',
      brain: 'gpt-6-luna',
    })
  })

  it('goes off when a model is picked by hand, and back on restores the defaults', () => {
    const { setPrefs } = useBearDrawStore.getState()
    setPrefs({ image: 'gpt-image-2.6-flare' })
    expect(useBearDrawStore.getState().prefs).toMatchObject({
      auto: false,
      image: 'gpt-image-2.6-flare',
    })
    setPrefs({ auto: true })
    expect(useBearDrawStore.getState().prefs).toMatchObject({
      auto: true,
      image: DEFAULT_PREFS.image,
      brain: DEFAULT_PREFS.brain,
    })
    // other settings leave it alone
    setPrefs({ ratio: '1:1', transparent: true })
    expect(useBearDrawStore.getState().prefs.auto).toBe(true)
  })
})

describe('hasQueued', () => {
  const project = (status: string) =>
    ({
      messages: [
        { role: 'user' },
        {
          role: 'agent',
          parts: [
            { type: 'progress', items: [{ status: 'done' }, { status }] },
          ],
        },
      ],
    }) as unknown as Project

  it('is true while a picture waits for its turn', () => {
    expect(hasQueued(project('queued'))).toBe(true)
    expect(hasQueued(project('drawing'))).toBe(false)
    expect(hasQueued(null)).toBe(false)
  })
})

describe('stopQueued', () => {
  it('stops pictures in line and leaves a waiting question card alone', () => {
    const p = {
      id: 'p',
      title: 'p',
      createdAt: 1,
      updatedAt: 1,
      cost: 0,
      transcript: [],
      groups: [],
      nodes: [{ id: 'n', status: 'pending' }],
      messages: [
        {
          id: 'ask',
          role: 'agent',
          mode: 'agent',
          status: 'waiting',
          parts: [{ id: 'q', type: 'questions', items: [] }],
        },
        {
          id: 'img',
          role: 'agent',
          mode: 'image',
          status: 'running',
          parts: [
            {
              id: 'pg',
              type: 'progress',
              items: [{ id: 'i', nodeId: 'n', status: 'queued' }],
            },
          ],
        },
      ],
    } as unknown as Project
    useBearDrawStore.getState().init(1, [p])

    stopQueued('p')

    const now = useBearDrawStore.getState().projects[0]
    expect(hasQueued(now)).toBe(false)
    expect(now.messages[0]).toMatchObject({ status: 'waiting' })
    const ask = now.messages[0]
    expect(ask.role === 'agent' && ask.parts[0]).not.toHaveProperty('skipped')
    useBearDrawStore.setState({ projects: [], uid: null, loaded: false })
  })
})
