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
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { Composer, type ComposerHandle } from '../components/composer/composer'
import { DEFAULT_PREFS } from '../constants'
import type { GalleryItem } from '../data/gallery'

vi.mock('../lib/engine', () => ({
  storeAttachments: vi.fn(async () => []),
  estimatePicture: vi.fn(() => 0.03),
  isBusy: vi.fn(() => false),
}))

vi.mock('../hooks/use-env', () => {
  const env = {
    uid: 1,
    imageModels: [],
    brainModels: [],
    prices: new Map(),
    groupRatio: 1,
    balanceUsd: 10,
    loading: false,
    failed: false,
  }
  return { useBearDrawEnv: () => env }
})

/** A 玩法 that edits the user's own photo. */
const portrait = {
  id: 'id-photo',
  title: '证件照',
  ratio: '3:4',
  prompt: '把这张照片做成蓝底证件照',
  needsPhoto: true,
  inputHint: '**输入：**一张正脸照片',
} as GalleryItem

function setup(variant: 'home' | 'dock' = 'dock') {
  const onSend = vi.fn()
  const ref = createRef<ComposerHandle>()
  render(<Composer ref={ref} variant={variant} onSend={onSend} />)
  const box = screen.getByRole('textbox', {
    name: 'Describe what you want to design',
  })
  return { onSend, ref, box, user: userEvent.setup() }
}

beforeEach(() => {
  useBearDrawStore.setState({
    prefs: { ...DEFAULT_PREFS },
    brandKit: null,
    mySkills: [],
    live: {},
    projects: [],
  })
})

describe('Composer sending', () => {
  it('leaves the scrolling to the page when it is focused from outside', () => {
    const { ref, box } = setup('home')
    const focus = vi.spyOn(box, 'focus')

    act(() => ref.current?.focus())
    act(() => ref.current?.setText('a line'))
    act(() => ref.current?.setSkill(null))
    act(() => ref.current?.applyPreset(portrait))

    expect(focus).toHaveBeenCalledTimes(4)
    for (const call of focus.mock.calls) {
      expect(call[0]).toEqual({ preventScroll: true })
    }
  })

  it('adds the notes of a 圈选 after what is already typed', async () => {
    const { ref, box, user } = setup()
    await user.type(box, '整体再亮一点')

    act(() => ref.current?.appendText('①杯身换成白色'))
    expect(box).toHaveValue('整体再亮一点\n①杯身换成白色')

    // the same notes again (圈选 done twice) are not repeated
    act(() => ref.current?.appendText('①杯身换成白色'))
    expect(box).toHaveValue('整体再亮一点\n①杯身换成白色')
  })

  it('swaps the notes when the same picture is circled again', async () => {
    const { ref, box, user } = setup()
    await user.type(box, '整体再亮一点')
    act(() => ref.current?.appendText('①改红'))

    act(() => ref.current?.appendText('①改蓝', '①改红'))
    expect(box).toHaveValue('整体再亮一点\n①改蓝')
  })

  it('puts the notes of a 圈选 into an empty box as they are', () => {
    const { ref, box } = setup()
    act(() => ref.current?.appendText('①杯身换成白色'))
    expect(box).toHaveValue('①杯身换成白色')
  })

  it('sends the trimmed text when Enter is pressed, then clears', async () => {
    const { onSend, box, user } = setup()
    await user.type(box, '  给保温杯做主图  ')
    await user.keyboard('{Enter}')
    expect(onSend).toHaveBeenCalledWith({
      text: '给保温杯做主图',
      refs: [],
    })
    expect(box).toHaveValue('')
  })

  it('adds a new line on Shift+Enter instead of sending', async () => {
    const { onSend, box, user } = setup()
    await user.type(box, '第一行')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    expect(onSend).not.toHaveBeenCalled()
    expect(box).toHaveValue('第一行\n')
  })

  it('on a touch screen Enter adds a new line and the send button sends', async () => {
    const realMatchMedia = window.matchMedia
    const setMatchMedia = (value: typeof window.matchMedia) =>
      Object.defineProperty(window, 'matchMedia', { configurable: true, value })
    setMatchMedia((query) => ({
      ...realMatchMedia(query),
      matches: query === '(pointer: coarse)',
    }))
    try {
      const { onSend, box, user } = setup('home')
      await user.type(box, '第一行{Enter}第二行')
      expect(onSend).not.toHaveBeenCalled()
      expect(box).toHaveValue('第一行\n第二行')

      await user.click(screen.getByRole('button', { name: 'Send' }))
      expect(onSend).toHaveBeenCalledWith({
        text: '第一行\n第二行',
        refs: [],
      })
    } finally {
      setMatchMedia(realMatchMedia)
    }
  })

  it('does not send on the Enter that ends an IME composition', () => {
    const { onSend, box } = setup()
    fireEvent.change(box, { target: { value: 'baowenbei' } })
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send empty text', async () => {
    const { onSend, box, user } = setup()
    await user.click(box)
    await user.keyboard('{Enter}')
    expect(onSend).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })
})

describe('Composer with a 玩法 that needs a photo', () => {
  it('sets its ratio, fills the prompt and asks for the photo', () => {
    const { ref, box } = setup('home')
    act(() => ref.current?.applyPreset(portrait))
    expect(
      screen.getByRole('button', { name: 'Aspect ratio 3:4' })
    ).toBeVisible()
    expect(box).toHaveValue(portrait.prompt)
    expect(screen.getByRole('button', { name: 'Add your photo' })).toBeVisible()
  })

  it('blocks sending until a photo is attached, then sends it with the preset', async () => {
    const { ref, onSend, user } = setup('home')
    act(() => ref.current?.applyPreset(portrait))
    await user.keyboard('{Enter}')
    expect(onSend).not.toHaveBeenCalled()

    const photo = { id: 'img-1', w: 800, h: 1000 }
    act(() => ref.current?.addRefs([photo]))
    expect(screen.queryByRole('button', { name: 'Add your photo' })).toBeNull()
    await user.keyboard('{Enter}')
    expect(onSend).toHaveBeenCalledWith({
      text: portrait.prompt,
      refs: [photo],
      presetId: 'id-photo',
      presetTitle: '证件照',
      ratio: '3:4',
    })
    // the next message starts from 自动 again
    expect(screen.getByRole('button', { name: 'Aspect ratio' })).toBeVisible()
  })

  it('leaves the brand kit out while the 玩法 is on, and × gives its ratio back', async () => {
    useBearDrawStore.setState({
      brandKit: {
        name: '山野',
        colors: ['#112233'],
        fonts: '',
        tone: '',
        points: [],
        logo: null,
        notes: '',
      },
    })
    const { ref, box, user } = setup('home')
    expect(screen.getByText('Brand: 山野')).toBeVisible()
    act(() => ref.current?.applyPreset(portrait))
    expect(screen.queryByText('Brand: 山野')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Remove this preset' }))
    expect(box).toHaveValue('')
    expect(screen.getByText('Brand: 山野')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Aspect ratio' })).toBeVisible()
  })
})

describe('Composer with a skill picked over a 玩法', () => {
  it('drops the 玩法 and the ratio it brought, and keeps a ratio picked by hand', async () => {
    const { ref, user } = setup('home')
    act(() => ref.current?.applyPreset(portrait))
    act(() => ref.current?.setSkill('taobao-main-set'))
    expect(screen.queryByText('Preset: 证件照')).toBeNull()
    expect(screen.getByRole('button', { name: 'Aspect ratio' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Aspect ratio' }))
    await user.click(screen.getByRole('button', { name: '4:3' }))
    act(() => ref.current?.setSkill('white-background'))
    expect(
      screen.getByRole('button', { name: 'Aspect ratio 4:3' })
    ).toBeVisible()
  })
})

describe('Composer ratio', () => {
  it('has no mode switch: the bar holds +, the ratio and the thinking effort', () => {
    setup()
    expect(
      screen.queryByRole('button', { name: /Agent|Image mode/ })
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Aspect ratio' })).toBeVisible()
  })

  it('a picked ratio goes with one message, then is 自动 again', async () => {
    const { onSend, box, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Aspect ratio' }))
    await user.click(screen.getByRole('button', { name: '16:9' }))
    // picking closes the panel and shows the ratio on the chip
    expect(screen.queryByRole('button', { name: '9:16' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Aspect ratio 16:9' })
    ).toBeVisible()

    await user.type(box, '一张横幅')
    await user.keyboard('{Enter}')
    expect(onSend).toHaveBeenLastCalledWith({
      text: '一张横幅',
      refs: [],
      ratio: '16:9',
    })

    await user.type(box, '再来一张')
    await user.keyboard('{Enter}')
    expect(onSend).toHaveBeenLastCalledWith({ text: '再来一张', refs: [] })
  })
})
