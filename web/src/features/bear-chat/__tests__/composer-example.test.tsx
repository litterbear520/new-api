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
import { fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { describe, expect, test, vi } from 'vitest'

import { Composer } from '../components/composer'
import { getExamples } from '../constants'
import type { ChatEnv } from '../hooks/use-chat-env'

vi.mock('@/features/draw/hooks/use-glass', () => ({
  useGlass: () => () => undefined,
}))

// the chips in the composer's bottom row; each has its own tests
vi.mock('../components/model-menu', () => ({ ModelMenu: () => null }))
vi.mock('../components/params-menu', () => ({ ParamsMenu: () => null }))

function renderComposer() {
  render(
    <Composer
      env={{ models: [], groups: [] } as unknown as ChatEnv}
      director={null}
      dark={false}
      busy={false}
      writing={false}
      empty
      images={[]}
      setImages={() => undefined}
      perch={null}
    />
  )
  return screen.getByRole<HTMLTextAreaElement>('textbox', {
    name: 'Message the model',
  })
}

const useExample = () => screen.getByRole('button', { name: 'Use example' })

describe('chat composer example', () => {
  test('Tab in the empty box moves on and leaves the box empty', () => {
    const box = renderComposer()
    const notPrevented = fireEvent.keyDown(box, { key: 'Tab' })
    expect(notPrevented).toBe(true)
    expect(box).toHaveValue('')
  })

  test('"Use example" comes right after the box in the Tab order', () => {
    const box = renderComposer()
    const order = [...document.querySelectorAll('textarea, button')]
    expect(order[order.indexOf(box) + 1]).toBe(useExample())
  })

  test('"Use example" fills the box and puts the caret at its end', () => {
    const box = renderComposer()
    fireEvent.click(useExample())
    expect(box.value).not.toBe('')
    expect(box).toHaveFocus()
    expect(box.selectionStart).toBe(box.value.length)
    expect(box.selectionEnd).toBe(box.value.length)
  })

  test('"Use example" is described by the example it fills in', () => {
    const box = renderComposer()
    const first = getExamples(i18next.t)[0]
    expect(useExample()).toHaveAccessibleDescription(first)
    fireEvent.click(useExample())
    expect(box).toHaveValue(first)
  })

  test('once there is text, "Use example" goes away', () => {
    const box = renderComposer()
    fireEvent.change(box, { target: { value: 'hi' } })
    expect(screen.queryByRole('button', { name: 'Use example' })).toBeNull()
  })
})
