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
import { describe, expect, test, vi } from 'vitest'

import { DRAW_TOKEN_NAME } from '@/features/draw/constants'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'

import { fetchActiveChatKey } from '../use-active-chat-key'

vi.mock('@/features/keys/api', () => ({
  getApiKeys: vi.fn(),
  fetchTokenKey: vi.fn(),
}))

const token = (id: number, name: string) => ({ id, name, status: 1 }) as ApiKey

describe('fetchActiveChatKey', () => {
  test('skips the drawing page token', async () => {
    vi.mocked(getApiKeys).mockResolvedValue({
      success: true,
      data: {
        items: [token(9, DRAW_TOKEN_NAME), token(4, 'my key')],
        total: 2,
        page: 1,
        page_size: 50,
      },
    } as Awaited<ReturnType<typeof getApiKeys>>)
    vi.mocked(fetchTokenKey).mockResolvedValue({
      success: true,
      data: { key: 'abc' },
    } as Awaited<ReturnType<typeof fetchTokenKey>>)

    await expect(fetchActiveChatKey()).resolves.toBe('sk-abc')
    expect(fetchTokenKey).toHaveBeenCalledWith(4)
  })
})
