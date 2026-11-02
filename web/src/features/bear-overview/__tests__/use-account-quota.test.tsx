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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import {
  useAccountQuota,
  useRefreshAccountQuota,
  useResetAccountQuota,
} from '../hooks/use-account-quota'

vi.mock('@/lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }))

const post = vi.mocked(api.post)
const get = vi.mocked(api.get)
const account = {
  group: 'team_a',
  windows: [{ id: 'five_hour', used_percent: 0, reset_at: null }],
}

function setup() {
  const client = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useResetAccountQuota('team_a'), {
    wrapper,
  })
  return { client, reset: result.current.mutateAsync }
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('reading the quota', () => {
  beforeEach(() => {
    post.mockReset()
    get.mockReset()
  })

  it('opening the page only gets the last reading, never a refresh', async () => {
    get.mockResolvedValue({ data: { account } })
    const client = new QueryClient()
    const { result } = renderHook(() => useAccountQuota('team_a'), {
      wrapper: wrapperFor(client),
    })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    expect(get).toHaveBeenCalledWith('/pay/quota', {
      skipErrorHandler: true,
      skipAuthRefresh: true,
    })
    expect(post).not.toHaveBeenCalled()
  })

  it('default-group users never ask', () => {
    const client = new QueryClient()
    renderHook(() => useAccountQuota('default'), {
      wrapper: wrapperFor(client),
    })
    expect(get).not.toHaveBeenCalled()
  })

  it('the refresh button posts and puts the new numbers into the card', async () => {
    post.mockResolvedValue({ data: { account } })
    const client = new QueryClient()
    const { result } = renderHook(() => useRefreshAccountQuota('team_a'), {
      wrapper: wrapperFor(client),
    })
    await result.current.mutateAsync()
    expect(post).toHaveBeenCalledWith('/pay/quota/refresh', null, {
      skipErrorHandler: true,
      skipAuthRefresh: true,
    })
    expect(
      client.getQueryData(['bear-overview', 'account-quota', 'team_a'])
    ).toMatchObject({ group: 'team_a', windows: [{ left: 100 }] })
  })
})

describe('useResetAccountQuota', () => {
  beforeEach(() => post.mockReset())

  it('posts the request id and puts the new numbers into the card', async () => {
    post.mockResolvedValue({ data: { result: 'reset', account } })
    const { client, reset } = setup()
    expect(await reset('id-12345678')).toBe('reset')
    expect(post).toHaveBeenCalledWith(
      '/pay/quota/reset',
      { request_id: 'id-12345678' },
      { skipErrorHandler: true, skipAuthRefresh: true }
    )
    expect(
      client.getQueryData(['bear-overview', 'account-quota', 'team_a'])
    ).toMatchObject({ group: 'team_a', windows: [{ left: 100 }] })
  })

  it('tells "nothing was spent" from "may have reached OpenAI"', async () => {
    const { reset } = setup()
    const fail = (status?: number) =>
      post.mockRejectedValueOnce(
        Object.assign(new Error('x'), status ? { response: { status } } : {})
      )
    fail(502)
    expect(await reset('id-12345678')).toBe('unavailable')
    fail(401)
    expect(await reset('id-12345678')).toBe('unavailable')
    fail(504)
    expect(await reset('id-12345678')).toBe('unknown')
    fail()
    expect(await reset('id-12345678')).toBe('unknown')
  })
})
