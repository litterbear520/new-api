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

import { fetchTokenKey } from '@/features/keys/api'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

import { useKeyCopy } from '../use-key-copy'

vi.mock('@/features/keys/api', () => ({ fetchTokenKey: vi.fn() }))
vi.mock('@/lib/copy-to-clipboard', () => ({
  copyToClipboard: vi.fn(async () => true),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

/** A key request the test answers when it wants. */
function slowKey() {
  let answer: (key: string) => void = () => undefined
  vi.mocked(fetchTokenKey).mockReturnValue(
    new Promise((resolve) => {
      answer = (key) => resolve({ success: true, data: { key } } as never)
    })
  )
  return (key: string) => answer(key)
}

class FakeClipboardItem {
  constructor(public items: Record<string, Promise<Blob>>) {}
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('copying a key', () => {
  test('the clipboard write starts in the click, before the key arrives', async () => {
    const write = vi.fn(async (items: FakeClipboardItem[]) => {
      await items[0].items['text/plain']
    })
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { write } })
    const answer = slowKey()
    const { result } = renderHook(() => useKeyCopy())

    let done: Promise<void> = Promise.resolve()
    act(() => {
      done = result.current.copy('env', 5, (key) => `KEY=${key}`)
    })
    expect(write).toHaveBeenCalledTimes(1)

    answer('abc')
    await act(() => done)
    const blob = await write.mock.calls[0][0][0].items['text/plain']
    expect(await blob.text()).toBe('KEY=sk-abc')
    expect(copyToClipboard).not.toHaveBeenCalled()
    expect(result.current.copiedId).toBe('env')
  })

  test('without ClipboardItem it copies the plain way once the key is in', async () => {
    vi.stubGlobal('ClipboardItem', undefined)
    const answer = slowKey()
    const { result } = renderHook(() => useKeyCopy())
    let done: Promise<void> = Promise.resolve()
    act(() => {
      done = result.current.copy('env', 5, (key) => `KEY=${key}`)
    })
    answer('abc')
    await act(() => done)
    expect(copyToClipboard).toHaveBeenCalledWith('KEY=sk-abc')
    expect(fetchTokenKey).toHaveBeenCalledTimes(1)
  })
})
