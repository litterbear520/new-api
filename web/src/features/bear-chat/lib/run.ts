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
import type { PricingModel } from '@/features/pricing/types'
import {
  currentConversation,
  useBearChatStore,
  type LiveReply,
} from '@/stores/bear-chat-store'

import type {
  AssistantTurn,
  ChatImage,
  ChatTurn,
  Conversation,
  Reply,
  UserTurn,
} from '../types'
import { costOfUsage } from './cost'
import { buildBody, type ChatRequestBody } from './payload'
import { ChatRequestError, streamChat, type StreamEvent } from './stream'

/*
 * Sending, retrying and stopping replies. Streams live at module level, so a
 * reply keeps arriving (and is saved) if the user leaves the page; the
 * server bills it either way. Text is batched and written to the store at
 * most every FLUSH_MS.
 */

const FLUSH_MS = 50
const TITLE_CHARS = 30

type Env = { prices: Map<string, PricingModel>; groupRatio: number }
let env: Env = { prices: new Map(), groupRatio: 1 }

/** Prices for the cost line; set by the page once pricing loads. */
export function setChatEnv(next: Env) {
  env = next
}

const controllers = new Map<string, AbortController>()
/** The last request body per conversation, for "API code". */
const lastBodies = new Map<string, ChatRequestBody>()

export function lastRequest(convId: string): ChatRequestBody | undefined {
  return lastBodies.get(convId)
}

let seq = 0
export const newId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function titleFrom(text: string): string {
  const line = text.trim().split('\n')[0]?.trim() ?? ''
  return line.length > TITLE_CHARS ? `${line.slice(0, TITLE_CHARS)}…` : line
}

function newReply(model: string): Reply {
  const effort = useBearChatStore.getState().settings.params.effort ?? undefined
  return {
    id: newId('r'),
    model,
    content: '',
    status: 'waiting',
    startedAt: Date.now(),
    effort,
  }
}

const store = () => useBearChatStore.getState()

function mapTurn(
  conv: Conversation,
  turnId: string,
  fn: (turn: AssistantTurn) => AssistantTurn
): Conversation {
  return {
    ...conv,
    turns: conv.turns.map((t) =>
      t.id === turnId && t.role === 'assistant' ? fn(t) : t
    ),
  }
}

function patchReply(
  convId: string,
  turnId: string,
  replyId: string,
  fn: (reply: Reply) => Reply
) {
  store().updateConv(convId, (conv) =>
    mapTurn(conv, turnId, (turn) => ({
      ...turn,
      replies: turn.replies.map((r) => (r.id === replyId ? fn(r) : r)),
    }))
  )
}

export function isGenerating(): boolean {
  return store().live !== null
}

/** Sends a message in the open conversation, or starts a new one. */
export function sendMessage(text: string, images: ChatImage[]) {
  const s = store()
  const model = s.settings.model
  if (!model || s.live) return
  const now = Date.now()
  const user: UserTurn = {
    id: newId('u'),
    role: 'user',
    text,
    images: images.length ? images : undefined,
    at: now,
  }
  const reply = newReply(model)
  const assistant: AssistantTurn = {
    id: newId('a'),
    role: 'assistant',
    replies: [reply],
    cur: 0,
  }
  let conv = currentConversation(s)
  if (!conv) {
    conv = {
      id: newId('c'),
      title: titleFrom(text) || (images.length ? '🖼' : '…'),
      createdAt: now,
      updatedAt: now,
      system: s.draftSystem.trim() || undefined,
      turns: [user, assistant],
    }
    s.putConv(conv)
    s.select(conv.id)
    s.setDraftSystem('')
  } else {
    const next: Conversation = {
      ...conv,
      updatedAt: now,
      turns: [...conv.turns, user, assistant],
    }
    s.putConv(next)
  }
  void run(conv.id, assistant.id, 'send')
}

/** Another answer for the same turn; `model` switches the model. */
export function retryReply(turnId: string, model?: string) {
  const s = store()
  const conv = currentConversation(s)
  if (!conv || s.live) return
  const turn = conv.turns.find(
    (t): t is AssistantTurn => t.id === turnId && t.role === 'assistant'
  )
  if (!turn) return
  const shown = turn.replies[turn.cur]
  const reply = newReply(model ?? shown?.model ?? s.settings.model)
  s.updateConv(conv.id, (c) => ({
    ...mapTurn(c, turnId, (t) => ({
      ...t,
      replies: [...t.replies, reply],
      cur: t.replies.length,
    })),
    updatedAt: Date.now(),
  }))
  void run(conv.id, turnId, 'retry')
}

/** Changes a user message and answers it again; later turns are dropped. */
export function editAndResend(userTurnId: string, text: string) {
  const s = store()
  const conv = currentConversation(s)
  if (!conv || s.live || !s.settings.model) return
  const at = conv.turns.findIndex((t) => t.id === userTurnId)
  const old = conv.turns[at]
  if (!old || old.role !== 'user') return
  const user: UserTurn = { ...old, text, at: Date.now() }
  const assistant: AssistantTurn = {
    id: newId('a'),
    role: 'assistant',
    replies: [newReply(s.settings.model)],
    cur: 0,
  }
  const turns: ChatTurn[] = [...conv.turns.slice(0, at), user, assistant]
  s.putConv({ ...conv, turns, updatedAt: Date.now() })
  void run(conv.id, assistant.id, 'edit')
}

export function stopReply() {
  const live = store().live
  if (live) controllers.get(live.replyId)?.abort()
}

async function run(convId: string, turnId: string, kind: LiveReply['kind']) {
  const s = store()
  const conv = s.convs.find((c) => c.id === convId)
  if (!conv) return
  const at = conv.turns.findIndex((t) => t.id === turnId)
  const turn = conv.turns[at]
  if (!turn || turn.role !== 'assistant') return
  const reply = turn.replies.at(-1)
  if (!reply) return
  const body = buildBody({
    conv,
    upto: at,
    model: reply.model,
    group: s.settings.group,
    params: s.settings.params,
  })
  lastBodies.set(convId, body)
  const ctrl = new AbortController()
  controllers.set(reply.id, ctrl)
  s.setLive({ convId, turnId, replyId: reply.id, kind })

  let pendText = ''
  let pendThink = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  let gotAny = false
  const update = (fn: (r: Reply) => Reply) =>
    patchReply(convId, turnId, reply.id, fn)
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    if (!pendText && !pendThink) return
    const text = pendText
    const think = pendThink
    pendText = ''
    pendThink = ''
    update((r) => {
      const now = Date.now()
      return {
        ...r,
        status: 'streaming',
        content: r.content + text,
        reasoning: think ? (r.reasoning ?? '') + think : r.reasoning,
        firstAt: r.firstAt ?? now,
        textAt: text && !r.textAt ? now : r.textAt,
      }
    })
  }
  const onEvent = (e: StreamEvent) => {
    if (e.type === 'content' || e.type === 'reasoning') {
      gotAny = true
      if (e.type === 'content') pendText += e.text
      else pendThink += e.text
      timer ??= setTimeout(flush, FLUSH_MS)
      return
    }
    flush()
    if (e.type === 'usage') update((r) => ({ ...r, usage: e.usage }))
    else if (e.type === 'finish') update((r) => ({ ...r, finish: e.reason }))
    else if (e.type === 'error') {
      throw new ChatRequestError(e.message, { code: e.code, early: !gotAny })
    }
  }

  try {
    await streamChat(body, { signal: ctrl.signal, onEvent })
    flush()
    update((r) => {
      const usage = r.usage
      const cost = usage
        ? costOfUsage(env.prices.get(r.model), usage, env.groupRatio)
        : null
      return { ...r, status: 'done', endedAt: Date.now(), cost }
    })
  } catch (error: unknown) {
    flush()
    const stopped = ctrl.signal.aborted
    // an error inside the stream leaves the connection open; close it
    ctrl.abort()
    if (stopped) {
      update((r) => ({ ...r, status: 'stopped', endedAt: Date.now() }))
    } else {
      const err =
        error instanceof ChatRequestError
          ? error
          : new ChatRequestError(
              error instanceof Error ? error.message : String(error),
              {
                code: 'network',
                early: !gotAny,
              }
            )
      update((r) => ({
        ...r,
        status: 'error',
        endedAt: Date.now(),
        error: {
          message: err.message,
          code: err.code,
          status: err.status,
          unbilled: err.early && !gotAny,
        },
      }))
    }
  } finally {
    clearTimeout(timer)
    controllers.delete(reply.id)
    if (store().live?.replyId === reply.id) store().setLive(null)
    store().updateConv(convId, (c) => ({ ...c, updatedAt: Date.now() }))
  }
}

/** Shows another saved answer of a turn (‹ 1/2 ›). */
export function showReply(turnId: string, index: number) {
  const s = store()
  const conv = currentConversation(s)
  if (!conv) return
  s.updateConv(conv.id, (c) =>
    mapTurn(c, turnId, (t) => ({
      ...t,
      cur: Math.max(0, Math.min(t.replies.length - 1, index)),
    }))
  )
}
