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
import { afterEach, describe, expect, test, vi } from 'vitest'

import { createCanvas } from '../lib/canvas/canvas'
import type { CanvasApi } from '../lib/canvas/types'

const made: CanvasApi[] = []

function canvas(): CanvasApi {
  const root = document.createElement('div')
  document.body.append(root)
  const cv = createCanvas(root, { autoFocus: false })
  made.push(cv)
  return cv
}

afterEach(() => {
  for (const cv of made.splice(0)) cv.destroy()
  document.body.replaceChildren()
})

/** Enter or Esc as an input method sends it: composing, or Safari's 229. */
const imeKey = (key: string, how: 'composing' | '229') =>
  new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    isComposing: how === 'composing',
    keyCode: how === '229' ? 229 : 0,
  })

function renaming(cv: CanvasApi) {
  cv.addGroup({ id: 'g1', title: '主图', x: 0, y: 0 })
  const title = cv.el.querySelector<HTMLElement>('[data-cv-title="g1"]')
  if (!title) throw new Error('no frame title')
  title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  const name = title.querySelector<HTMLElement>('.bd-cv-gt-name')
  if (!name || !editing(name)) throw new Error('rename did not start')
  return name
}

/** The frame title shows its editing look while the rename is open. */
const editing = (name: HTMLElement) =>
  name.closest('[data-cv-title]')?.classList.contains('is-editing') ?? false

/** One ready picture with two marks, selected, with the 圈选 tool on. */
function marking(cv: CanvasApi) {
  cv.addImage({
    id: 'a',
    w: 800,
    h: 800,
    src: 'blob:a',
    label: '第一张',
    marks: [
      { pts: [[0.1, 0.1]], closed: true, note: '' },
      { pts: [[0.5, 0.5]], closed: true, note: '' },
    ],
  })
  cv.select('a')
  cv.setTool('mark')
  const notes = [...cv.el.querySelectorAll<HTMLInputElement>('input[data-mk]')]
  if (notes.length !== 2) throw new Error('no mark notes')
  return notes
}

describe('frame rename with an input method', () => {
  test.each(['composing', '229'] as const)(
    'Enter while composing (%s) keeps the title in editing',
    (how) => {
      const name = renaming(canvas())
      name.textContent = 'zhu'
      name.dispatchEvent(imeKey('Enter', how))
      expect(editing(name)).toBe(true)
    }
  )

  test('Esc while composing does not put the old title back', () => {
    const name = renaming(canvas())
    name.textContent = '主图二'
    name.dispatchEvent(imeKey('Escape', 'composing'))
    expect(editing(name)).toBe(true)
    expect(name.textContent).toBe('主图二')
  })

  test('a plain Enter still commits the new title', () => {
    const cv = canvas()
    const name = renaming(cv)
    name.textContent = '主图二'
    name.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
    expect(editing(name)).toBe(false)
    expect(cv.getState().groups[0].title).toBe('主图二')
  })
})

describe('圈选 notes with an input method', () => {
  test.each(['composing', '229'] as const)(
    'Enter while composing (%s) stays in the note',
    (how) => {
      const [first] = marking(canvas())
      first.focus()
      first.dispatchEvent(imeKey('Enter', how))
      expect(document.activeElement).toBe(first)
    }
  )

  test('Esc while composing stays in the note', () => {
    const [first] = marking(canvas())
    first.focus()
    first.dispatchEvent(imeKey('Escape', 'composing'))
    expect(document.activeElement).toBe(first)
  })

  test('a plain Enter moves to the next note', () => {
    const [first, second] = marking(canvas())
    first.focus()
    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
    expect(document.activeElement).toBe(second)
  })

  test('the panel is not redrawn under a composition, only after it', async () => {
    const cv = canvas()
    const [first] = marking(cv)
    first.focus()
    first.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true })
    )
    // the header shows the picture's name: a new name redraws the panel
    cv.updateImage('a', { label: '第二张' })
    expect(first.isConnected).toBe(true)
    expect(cv.el.textContent).not.toContain('第二张')

    first.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true })
    )
    await vi.waitFor(() => expect(cv.el.textContent).toContain('第二张'))
    expect(document.activeElement).toBe(
      cv.el.querySelector('input[data-mk="1"]')
    )
  })
})
