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
import { afterEach, describe, expect, test, vi } from 'vitest'

import { Composer } from '../components/composer'
import type { ChatEnv } from '../hooks/use-chat-env'

vi.mock('@/features/draw/hooks/use-glass', () => ({
  useGlass: () => () => undefined,
}))
vi.mock('../components/model-menu', () => ({ ModelMenu: () => null }))
vi.mock('../components/params-menu', () => ({ ParamsMenu: () => null }))

function typeInto(supported: boolean) {
  vi.stubGlobal('CSS', { supports: () => supported })
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
  const box = screen.getByRole<HTMLTextAreaElement>('textbox', {
    name: 'Message the model',
  })
  fireEvent.change(box, { target: { value: 'one\ntwo\nthree' } })
  return box
}

afterEach(() => vi.unstubAllGlobals())

describe('chat composer height', () => {
  test('CSS sizes the box where the browser has field-sizing', () => {
    expect(typeInto(true).style.height).toBe('')
  })

  test('script sizes the box where it does not', () => {
    expect(typeInto(false).style.height).not.toBe('')
  })
})
