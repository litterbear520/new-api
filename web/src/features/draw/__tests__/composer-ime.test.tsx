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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDrawStore } from '@/stores/draw-store'

import { Composer } from '../components/composer'
import { sendDraft } from '../lib/actions'

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))

vi.mock('../components/draw-context', () => {
  const ctx = {
    pricing: null,
    groupRatio: 1,
    models: [],
    balanceUsd: 10,
    narrow: false,
    canvasOff: false,
    openCanvas: vi.fn(),
  }
  return { useDrawPage: () => ctx }
})

vi.mock('../components/composer-menus', () => ({
  ModelMenu: () => null,
  PlusMenu: () => null,
  RatioMenu: () => null,
}))

vi.mock('../hooks/use-glass', () => ({ useGlass: () => () => undefined }))

vi.mock('../lib/alerts', () => ({ ensureAudio: vi.fn() }))

vi.mock('../lib/actions', () => ({
  addFiles: vi.fn(async () => ({ added: 0, skipped: 0, failed: 0 })),
  addReference: vi.fn(),
  attachments: vi.fn(() => []),
  heldCost: vi.fn(() => 0),
  sendDraft: vi.fn(() => 'sent'),
}))

function setup() {
  const room = useDrawStore.getState().fresh
  render(<Composer room={room} />)
  const box = screen.getByRole('textbox')
  fireEvent.change(box, { target: { value: '一只橘猫' } })
  return box
}

describe('classic draw composer and IME', () => {
  beforeEach(() => {
    vi.mocked(sendDraft).mockClear()
    // jsdom has no CSS.supports; the composer asks it about field-sizing.
    vi.stubGlobal('CSS', { supports: () => true })
  })

  it('does not send on the Enter that picks a candidate in Safari', () => {
    const box = setup()
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 229 })
    expect(sendDraft).not.toHaveBeenCalled()
  })

  it('does not send while composing', () => {
    const box = setup()
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 13, isComposing: true })
    expect(sendDraft).not.toHaveBeenCalled()
  })

  it('sends on a plain Enter', () => {
    const box = setup()
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 13 })
    expect(sendDraft).toHaveBeenCalledTimes(1)
  })
})
