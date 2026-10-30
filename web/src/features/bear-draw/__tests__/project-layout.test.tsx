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
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import type { ComposerHandle } from '../components/composer/composer'
import { useProjectActions } from '../components/project/use-project-actions'
import type { Project, ProjectLayout } from '../types'

function project(layout?: ProjectLayout): Project {
  return {
    id: 'p1',
    title: 'Set',
    createdAt: 1,
    updatedAt: 100,
    cost: 0,
    messages: [],
    transcript: [],
    groups: [{ id: 'g1', title: '主图', x: 0, y: 0, children: ['n1'] }],
    nodes: [
      {
        id: 'n1',
        groupId: 'g1',
        status: 'ready',
        w: 1024,
        h: 1024,
        label: '首图',
        meta: {},
        img: { id: 'i1', w: 1024, h: 1024 },
      },
    ],
    layout,
  }
}

/** The project page's actions on a wide or narrow card. */
function actions(narrow: boolean, layout?: ProjectLayout) {
  useBearDrawStore.setState({ projects: [project(layout)] })
  const composer: ComposerHandle = {
    focus: vi.fn(),
    setText: vi.fn(),
    setSkill: vi.fn(),
    applyPreset: vi.fn(),
    addRefs: vi.fn(),
  }
  const setSheet = vi.fn()
  const focusCanvas = vi.fn()
  const { result } = renderHook(() =>
    useProjectActions({
      projectId: 'p1',
      narrow,
      composerRef: { current: composer },
      focusCanvas,
      setSheet,
      balanceUsd: 5,
      busy: false,
      goHome: vi.fn(),
    })
  )
  return { act: result, composer, setSheet, focusCanvas }
}

const layout = () => findProject('p1')?.layout

afterEach(() => {
  useBearDrawStore.setState({ projects: [] })
})

describe('wide card: the project remembers chat, canvas or both', () => {
  test('a project without a layout shows both, and the choice is saved', () => {
    const a = actions(false)
    expect(layout()).toBeUndefined()
    act(() => a.act.current.setLayout('chat'))
    expect(layout()).toBe('chat')
    expect(a.setSheet).not.toHaveBeenCalled()
  })

  test('choosing the layout it already has does not touch the project', () => {
    const a = actions(false, 'split')
    const before = findProject('p1')
    act(() => a.act.current.setLayout('split'))
    expect(findProject('p1')).toBe(before)
  })

  test('在画布里查看 from chat only brings the canvas back next to the chat', () => {
    const a = actions(false, 'chat')
    act(() => a.act.current.parts.openCanvas(['n1']))
    expect(a.focusCanvas).toHaveBeenCalledWith(['n1'])
    expect(layout()).toBe('split')
  })

  test('在画布里查看 with the chat hidden keeps the canvas only', () => {
    const a = actions(false, 'canvas')
    act(() => a.act.current.parts.openCanvas(['n1']))
    expect(layout()).toBe('canvas')
  })

  test('editing a picture from canvas only brings the chat back with it in the box', () => {
    const a = actions(false, 'canvas')
    act(() => a.act.current.onEdit('n1'))
    expect(a.composer.addRefs).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'i1', nodeId: 'n1', label: '首图' }),
    ])
    expect(a.composer.focus).toHaveBeenCalled()
    expect(layout()).toBe('split')
  })

  test('editing from both sides leaves the layout as it is', () => {
    const a = actions(false, 'split')
    act(() => a.act.current.onEdit('n1'))
    expect(layout()).toBe('split')
  })
})

describe('narrow card: the canvas is a sheet over the chat', () => {
  test('showing the canvas opens the sheet and saves nothing', () => {
    const a = actions(true, 'chat')
    act(() => a.act.current.setLayout('canvas'))
    expect(a.setSheet).toHaveBeenLastCalledWith(true)
    expect(layout()).toBe('chat')
  })

  test('在画布里查看 opens the sheet', () => {
    const a = actions(true)
    act(() => a.act.current.parts.openCanvas(['n1']))
    expect(a.setSheet).toHaveBeenLastCalledWith(true)
    expect(layout()).toBeUndefined()
  })

  test('editing a picture closes the sheet so the box is in view', () => {
    const a = actions(true)
    act(() => a.act.current.onEdit('n1'))
    expect(a.setSheet).toHaveBeenLastCalledWith(false)
    expect(a.composer.addRefs).toHaveBeenCalled()
  })
})
