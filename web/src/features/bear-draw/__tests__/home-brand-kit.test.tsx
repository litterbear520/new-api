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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { BrandKitDialog } from '../components/dialogs/brand-kit-dialog'
import type { BrandKit } from '../types'

// the picture store (IndexedDB) is outside this test
vi.mock('../lib/engine', () => ({
  storeAttachments: vi.fn(() => Promise.resolve([])),
}))

const KIT: BrandKit = {
  name: '北屿',
  colors: ['#1F3A5F'],
  fonts: '优雅衬线',
  tone: '安静',
  points: ['12 小时保温'],
  logo: null,
  notes: '',
}

beforeEach(() => {
  localStorage.clear()
  useBearDrawStore.setState({ uid: null, brandKit: null })
})

describe('BrandKitDialog', () => {
  it('saves the typed kit and closes when Save is pressed', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<BrandKitDialog open onOpenChange={onOpenChange} />)

    await user.type(screen.getByLabelText('Brand name'), ' 北屿 ')
    await user.type(
      screen.getByLabelText('Main selling points'),
      '12 小时保温{Enter}{Enter}一键开盖'
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(useBearDrawStore.getState().brandKit).toEqual({
      name: '北屿',
      colors: ['#1F3A5F', '#E9E2D6'],
      fonts: '现代无衬线',
      tone: '',
      points: ['12 小时保温', '一键开盖'],
      logo: null,
      notes: '',
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('asks for a name instead of saving a kit without one', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<BrandKitDialog open onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Give the brand a name first'
    )
    expect(screen.getByLabelText('Brand name')).toHaveFocus()
    expect(useBearDrawStore.getState().brandKit).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('starts from the saved kit and keeps the picked type style', async () => {
    useBearDrawStore.setState({ brandKit: KIT })
    const user = userEvent.setup()
    render(<BrandKitDialog open onOpenChange={vi.fn()} />)

    expect(screen.getByLabelText('Brand name')).toHaveValue('北屿')
    await user.click(screen.getByRole('button', { name: 'Heavy and bold' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(useBearDrawStore.getState().brandKit).toMatchObject({
      name: '北屿',
      colors: ['#1F3A5F'],
      fonts: '粗黑醒目',
      points: ['12 小时保温'],
    })
  })

  it('turns the kit off with 「不用品牌套件」 and keeps it for later', async () => {
    useBearDrawStore.setState({ brandKit: KIT })
    useBearDrawStore.getState().setPrefs({ brand: true })
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<BrandKitDialog open onOpenChange={onOpenChange} />)

    await user.click(
      screen.getByRole('button', { name: 'Stop using the brand kit' })
    )

    expect(useBearDrawStore.getState().prefs.brand).toBe(false)
    expect(useBearDrawStore.getState().brandKit).toEqual(KIT)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
