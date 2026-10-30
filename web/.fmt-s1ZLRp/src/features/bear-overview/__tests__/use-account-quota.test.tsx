import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { useResetAccountQuota } from '../hooks/use-account-quota'

vi.mock('@/lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }))

const post = vi.mocked(api.post)
const account = {
  group: 'team-a',
  windows: [{ id: 'five_hour', used_percent: 0, reset_at: null }],
}

function setup() {
  const client = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useResetAccountQuota('team-a'), {
    wrapper,
  })
  return { client, reset: result.current.mutateAsync }
}

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
      client.getQueryData(['bear-overview', 'account-quota', 'team-a'])
    ).toMatchObject({ group: 'team-a', windows: [{ left: 100 }] })
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
