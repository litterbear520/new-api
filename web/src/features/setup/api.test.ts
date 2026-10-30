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
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { prefetchSetupStatus, takeSetupStatusPrefetch } from './api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('setup status prefetch', () => {
  it('starts one check at boot and hands it over once', async () => {
    const data = { success: true, data: { status: true } }
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data })

    prefetchSetupStatus()
    prefetchSetupStatus()
    expect(get).toHaveBeenCalledTimes(1)

    await expect(takeSetupStatusPrefetch()).resolves.toEqual(data)
    expect(takeSetupStatusPrefetch()).toBeNull()
  })

  it('turns a failed check into null instead of an unhandled rejection', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('offline'))

    prefetchSetupStatus()

    await expect(takeSetupStatusPrefetch()).resolves.toBeNull()
  })
})
