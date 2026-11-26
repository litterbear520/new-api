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
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  allStoredRooms,
  deleteImages,
  storedImageTimes,
} from '@/features/draw/lib/storage'
import { useBearDrawStore } from '@/stores/bear-draw-store'
import { useDrawStore } from '@/stores/draw-store'

import {
  ORPHAN_AGE,
  scheduleImageSweep,
  sweepImages,
} from '../lib/orphan-images'
import { allProjectRecords } from '../lib/storage'

vi.mock('@/features/draw/lib/storage', async (original) => ({
  ...(await original<typeof import('@/features/draw/lib/storage')>()),
  storedImageTimes: vi.fn(async () => []),
  allStoredRooms: vi.fn(async () => []),
  deleteImages: vi.fn(async () => {}),
}))
vi.mock('../lib/storage', async (original) => ({
  ...(await original<typeof import('../lib/storage')>()),
  allProjectRecords: vi.fn(async () => []),
}))

const NOW = 10 * ORPHAN_AGE
const old = (id: string) => ({ id, at: NOW - ORPHAN_AGE - 1 })

const deleted = () => [...(vi.mocked(deleteImages).mock.calls[0]?.[0] ?? [])]

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  useBearDrawStore.setState({ projects: [], draft: null, brandKit: null })
  useDrawStore.getState().reset()
})
afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('sweeping pictures nobody uses', () => {
  test('an old picture nothing mentions is deleted', async () => {
    vi.mocked(storedImageTimes).mockResolvedValue([old('u-gone')])
    expect(await sweepImages(1, NOW)).toEqual(['u-gone'])
    expect(deleted()).toEqual(['u-gone'])
  })

  test('pictures stored less than a day ago or with no stored time stay', async () => {
    vi.mocked(storedImageTimes).mockResolvedValue([
      { id: 'u-new', at: NOW - 1000 },
      { id: 'u-undated' },
    ])
    expect(await sweepImages(1, NOW)).toEqual([])
    expect(deleteImages).not.toHaveBeenCalled()
  })

  test('a picture a stored project uses for a retry stays', async () => {
    vi.mocked(storedImageTimes).mockResolvedValue([old('i-in'), old('u-gone')])
    vi.mocked(allProjectRecords).mockResolvedValue([
      {
        id: 'p1',
        uid: 2,
        messages: [{ parts: [{ items: [{ job: { inputs: ['i-in'] } }] }] }],
      },
    ])
    expect(await sweepImages(1, NOW)).toEqual(['u-gone'])
  })

  test('a picture a classic conversation uses stays', async () => {
    vi.mocked(storedImageTimes).mockResolvedValue([old('k-mark')])
    vi.mocked(allStoredRooms).mockResolvedValue([
      { id: 'r1', mark: { img: { id: 'k-mark' } } },
    ])
    expect(await sweepImages(1, NOW)).toEqual([])
  })

  test('a brand logo kept in localStorage stays', async () => {
    vi.mocked(storedImageTimes).mockResolvedValue([old('u-logo')])
    localStorage.setItem(
      'bear-draw.brand.3',
      JSON.stringify({ logo: { id: 'u-logo' } })
    )
    expect(await sweepImages(1, NOW)).toEqual([])
  })

  test('a picture only this tab’s unsaved draft uses stays', async () => {
    vi.mocked(storedImageTimes).mockResolvedValue([old('u-draft')])
    useBearDrawStore.setState({
      draft: { text: '', refs: [{ id: 'u-draft', w: 1, h: 1 }] },
    })
    expect(await sweepImages(1, NOW)).toEqual([])
  })

  test('nothing is deleted when a store cannot be read', async () => {
    vi.mocked(storedImageTimes).mockResolvedValue([old('u-gone')])
    vi.mocked(allStoredRooms).mockRejectedValue(new Error('aborted'))
    await expect(sweepImages(1, NOW)).rejects.toThrow()
    expect(deleteImages).not.toHaveBeenCalled()
  })
})

describe('when the sweep runs', () => {
  test('without requestIdleCallback it runs after a timeout, once per visit', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    scheduleImageSweep(9)
    await vi.advanceTimersByTimeAsync(5000)
    expect(storedImageTimes).toHaveBeenCalledTimes(1)

    scheduleImageSweep(9)
    await vi.advanceTimersByTimeAsync(5000)
    expect(storedImageTimes).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  test('leaving the page before it is idle cancels the sweep', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    const cancel = scheduleImageSweep(10)
    cancel()
    await vi.advanceTimersByTimeAsync(5000)
    expect(storedImageTimes).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
