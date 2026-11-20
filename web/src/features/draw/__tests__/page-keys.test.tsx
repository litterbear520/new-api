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
import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useDrawStore } from '@/stores/draw-store'

import { Draw } from '../index'

// the page waits for its data; its Esc listener is already on
vi.mock('../hooks/use-draw-persistence', () => ({
  useDrawPersistence: () => 'loading',
}))
vi.mock('../hooks/use-draw-env', () => {
  const env = { models: [], pricing: null, groupRatio: 1, loading: true }
  return { useDrawEnv: () => env }
})
vi.mock('../hooks/use-tab-alerts', () => ({ useTabAlerts: () => undefined }))
vi.mock('../hooks/use-glass', () => ({
  useGlass: () => () => undefined,
  useGlassLight: () => undefined,
}))
vi.mock('../lib/generate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/generate')>()),
  refreshBalance: async () => undefined,
}))

describe('classic draw page Esc', () => {
  beforeEach(() => {
    useDrawStore.setState({ mode: 'mark' })
  })

  test('Esc that closes the IME candidates keeps the canvas mode', () => {
    render(<Draw />)
    fireEvent.keyDown(document.body, { key: 'Escape', isComposing: true })
    fireEvent.keyDown(document.body, { key: 'Escape', keyCode: 229 })
    expect(useDrawStore.getState().mode).toBe('mark')
  })

  test('a plain Esc leaves the canvas mode', () => {
    render(<Draw />)
    fireEvent.keyDown(document.body, { key: 'Escape', keyCode: 27 })
    expect(useDrawStore.getState().mode).toBeNull()
  })
})
