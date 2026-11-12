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

import { createApiKey, fetchTokenKey, searchApiKeys } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { useAuthStore } from '@/stores/auth-store'

import { DRAW_TOKEN_NAME, STORAGE_KEYS } from '../../constants'
import { forgetDrawKeyWhenSignedOut, getDrawKey } from '../draw-key'

vi.mock('@/features/keys/api', () => ({
  searchApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  fetchTokenKey: vi.fn(),
  updateApiKey: vi.fn(),
}))

const token = (patch: Partial<ApiKey>): ApiKey => ({
  id: 7,
  name: DRAW_TOKEN_NAME,
  key: 'abc**xyz',
  status: 1,
  remain_quota: 0,
  used_quota: 0,
  unlimited_quota: true,
  expired_time: -1,
  created_time: 0,
  accessed_time: 0,
  group: '',
  auto_groups: null,
  cross_group_retry: false,
  model_limits_enabled: true,
  model_limits: 'gpt-image-2',
  allow_ips: '',
  allow_user_quota_query: false,
  ...patch,
})

const page = (items: ApiKey[]) => ({
  success: true,
  data: { items, total: items.length, page: 1, page_size: 50 },
})

const signIn = (id: number) =>
  useAuthStore.getState().auth.setUser({ id, username: `u${id}`, role: 1 })

beforeEach(() => {
  localStorage.clear()
  useAuthStore.getState().auth.reset('idle')
  signIn(1)
  vi.mocked(fetchTokenKey).mockResolvedValue({
    success: true,
    data: { key: 'secret' },
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('getDrawKey', () => {
  test('without a drawing token it creates one and reveals its key', async () => {
    vi.mocked(searchApiKeys)
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page([token({})]))
    vi.mocked(createApiKey).mockResolvedValue({ success: true })

    await expect(getDrawKey(1, ['gpt-image-2'])).resolves.toBe('sk-secret')
    expect(createApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        name: DRAW_TOKEN_NAME,
        unlimited_quota: true,
        expired_time: -1,
        model_limits: 'gpt-image-2',
        group: 'default',
      })
    )
  })

  test('an existing drawing token is reused, not created again', async () => {
    vi.mocked(searchApiKeys).mockResolvedValue(
      page([token({ name: `${DRAW_TOKEN_NAME}（旧）` }), token({})])
    )

    await expect(getDrawKey(1, ['gpt-image-2'])).resolves.toBe('sk-secret')
    expect(createApiKey).not.toHaveBeenCalled()
  })

  test('the key is revealed once per browser and user', async () => {
    vi.mocked(searchApiKeys).mockResolvedValue(page([token({})]))

    await getDrawKey(1, ['gpt-image-2'])
    await getDrawKey(1, ['gpt-image-2'])
    expect(fetchTokenKey).toHaveBeenCalledTimes(1)

    signIn(2)
    await getDrawKey(2, ['gpt-image-2'])
    expect(fetchTokenKey).toHaveBeenCalledTimes(2)
  })

  test('a disabled drawing token is reported instead of replaced', async () => {
    vi.mocked(searchApiKeys).mockResolvedValue(page([token({ status: 2 })]))

    await expect(getDrawKey(1, ['gpt-image-2'])).rejects.toThrow('disabled')
    expect(createApiKey).not.toHaveBeenCalled()
  })

  test('a lookup still loading when the account changes is not shared', async () => {
    vi.mocked(searchApiKeys).mockResolvedValue(page([token({})]))
    type Revealed = Awaited<ReturnType<typeof fetchTokenKey>>
    let releaseA: (value: Revealed) => void = () => {}
    vi.mocked(fetchTokenKey)
      .mockImplementationOnce(
        () => new Promise((resolve) => (releaseA = resolve))
      )
      .mockResolvedValueOnce({ success: true, data: { key: 'of-b' } })

    const forA = getDrawKey(1, ['gpt-image-2'])
    await vi.waitFor(() => expect(fetchTokenKey).toHaveBeenCalledTimes(1))
    useAuthStore.getState().auth.reset()
    signIn(2)

    await expect(getDrawKey(2, ['gpt-image-2'])).resolves.toBe('sk-of-b')
    releaseA({ success: true, data: { key: 'of-a' } })
    await expect(forA).rejects.toThrow('account changed')
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.key) ?? '')
    ).toMatchObject({ uid: 2, key: 'sk-of-b' })
  })
})

describe('forgetDrawKeyWhenSignedOut', () => {
  const cached = JSON.stringify({ uid: 1, id: 7, key: 'sk-secret' })

  test('signing out drops the key', () => {
    localStorage.setItem(STORAGE_KEYS.key, cached)
    const stop = forgetDrawKeyWhenSignedOut()
    useAuthStore.getState().auth.setBootstrapState('complete')
    expect(localStorage.getItem(STORAGE_KEYS.key)).toBe(cached)

    useAuthStore.getState().auth.reset()
    expect(localStorage.getItem(STORAGE_KEYS.key)).toBeNull()
    stop()
  })

  test('a page that loads with nobody signed in drops it once checked', () => {
    useAuthStore.getState().auth.reset('idle')
    localStorage.setItem(STORAGE_KEYS.key, cached)
    const stop = forgetDrawKeyWhenSignedOut()
    useAuthStore.getState().auth.setBootstrapState('checking')
    expect(localStorage.getItem(STORAGE_KEYS.key)).toBe(cached)

    useAuthStore.getState().auth.setBootstrapState('complete')
    expect(localStorage.getItem(STORAGE_KEYS.key)).toBeNull()
    stop()
  })
})
