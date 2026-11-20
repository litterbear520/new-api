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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { render } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

import { Thread } from '../components/thread'
import type { ChatEnv } from '../hooks/use-chat-env'
import type { AssistantTurn, ChatTurn, Conversation, UserTurn } from '../types'

vi.mock('@/hooks/use-copy-to-clipboard', async (importOriginal) => {
  const real =
    await importOriginal<typeof import('@/hooks/use-copy-to-clipboard')>()
  return { ...real, useCopyToClipboard: vi.fn(real.useCopyToClipboard) }
})
// replies have their own memo; only the user turns are counted here
vi.mock('../components/reply-view', async () => {
  const { createElement } = await import('react')
  return { ReplyView: () => createElement('div', { className: 'bc-a' }) }
})

const env = {} as ChatEnv
const noop = () => undefined

const userTurn = (i: number): UserTurn => ({
  id: `u${i}`,
  role: 'user',
  text: `question ${i}`,
  at: i,
})
const replyTurn = (i: number, content = `answer ${i}`): AssistantTurn => ({
  id: `a${i}`,
  role: 'assistant',
  cur: 0,
  replies: [{ id: `r${i}`, model: 'm', content, status: 'done', startedAt: i }],
})

function conversation(rounds: number): Conversation {
  const turns: ChatTurn[] = []
  for (let i = 0; i < rounds; i++) turns.push(userTurn(i), replyTurn(i))
  return { id: 'c1', title: 't', createdAt: 0, updatedAt: 0, turns }
}

const thread = (conv: Conversation, busy = true) => (
  <Thread
    conv={conv}
    env={env}
    liveReplyId={null}
    busy={busy}
    onCopied={noop}
    onNewConversation={noop}
  />
)

describe('a streaming reply', () => {
  test('does not re-render the user messages above it', () => {
    const conv = conversation(3)
    const { rerender } = render(thread(conv))
    const before = vi.mocked(useCopyToClipboard).mock.calls.length
    expect(before).toBe(3)
    // a flush: a new conversation object, the last reply grows
    const turns = [...conv.turns]
    turns[turns.length - 1] = replyTurn(2, 'answer 2, longer')
    rerender(thread({ ...conv, turns }))
    expect(vi.mocked(useCopyToClipboard).mock.calls.length).toBe(before)
    // the reply ends: busy changes, so they update (the Edit button)
    rerender(thread({ ...conv, turns }, false))
    expect(vi.mocked(useCopyToClipboard).mock.calls.length).toBe(before + 3)
  })
})

describe('older turns of a long conversation', () => {
  const css = readFileSync(
    resolve(import.meta.dirname, '../bear-chat.css'),
    'utf8'
  )
  /** The selectors of the rules that set content-visibility: auto. */
  const deferred = [
    ...css.matchAll(/([^{}]+)\{[^{}]*content-visibility:\s*auto/g),
  ].map((m) => m[1].replaceAll(/\s+/g, ' ').trim())

  test('are deferred with a remembered placeholder height', () => {
    expect(deferred.length).toBeGreaterThan(0)
    const sizes = [...css.matchAll(/contain-intrinsic-size:\s*([^;]+);/g)]
    expect(sizes.length).toBeGreaterThan(0)
    for (const size of sizes) expect(size[1]).toMatch(/^auto\b.*\bauto \d+px$/)
  })

  test('are all but the last 12', () => {
    const { container } = render(thread(conversation(10), false))
    const picked = new Set(container.querySelectorAll(deferred.join(',')))
    const turns = [...container.querySelectorAll('.bc-col > *')]
    expect(turns).toHaveLength(20)
    expect(turns.map((el) => picked.has(el))).toEqual(
      turns.map((_, i) => i < 8)
    )
  })
})
