import {
  ChatRequestError,
  parseErrorBody,
  toUsage,
} from '@/features/bear-chat/lib/stream'
import type { ChatUsage } from '@/features/bear-chat/types'
import { getFreshAuthHeaders } from '@/lib/api'

import type { ApiToolCall } from '../../types'

/*
 * One streamed chat completion with tools, over fetch to
 * /pg/chat/completions (the console session pays from the user's balance).
 * Text arrives as deltas; tool calls arrive in pieces keyed by `index`
 * (id and name first, then the arguments in chunks) and are put together
 * here. The upstream may force parallel tool calls, so several may come at once.
 */

export const CHAT_ENDPOINT = '/pg/chat/completions'

export type StepEvent =
  | { type: 'text'; text: string }
  | { type: 'tool-start'; index: number; name: string }

export type StepResult = {
  text: string
  toolCalls: ApiToolCall[]
  finish: string | null
  usage: ChatUsage | null
}

type RawToolDelta = {
  index?: number
  id?: string
  type?: string
  function?: { name?: string; arguments?: string }
}

type RawChunk = {
  error?: { message?: string; code?: string | number; type?: string }
  choices?: Array<{
    delta?: {
      content?: string | null
      tool_calls?: RawToolDelta[] | null
    }
    message?: {
      content?: string | null
      tool_calls?: RawToolDelta[] | null
    }
    finish_reason?: string | null
  }>
  usage?: Parameters<typeof toUsage>[0] | null
}

/** Puts tool-call pieces together, keyed by their index. */
export class ToolCallAssembler {
  private calls = new Map<number, { id: string; name: string; args: string }>()
  private order: number[] = []

  /** Returns the index of a call that just got its name. */
  add(delta: RawToolDelta, fallbackIndex: number): number | null {
    const index = typeof delta.index === 'number' ? delta.index : fallbackIndex
    let call = this.calls.get(index)
    let named = false
    if (!call) {
      call = { id: '', name: '', args: '' }
      this.calls.set(index, call)
      this.order.push(index)
    }
    if (delta.id) call.id = delta.id
    if (delta.function?.name) {
      named = !call.name
      call.name += call.name ? '' : delta.function.name
    }
    if (typeof delta.function?.arguments === 'string') {
      call.args += delta.function.arguments
    }
    return named ? index : null
  }

  list(): ApiToolCall[] {
    return this.order.flatMap((i, n) => {
      const c = this.calls.get(i)
      if (!c || !c.name) return []
      return [
        {
          id: c.id || `call_${Date.now().toString(36)}_${n}`,
          type: 'function' as const,
          function: { name: c.name, arguments: c.args || '{}' },
        },
      ]
    })
  }

  nameOf(index: number): string {
    return this.calls.get(index)?.name ?? ''
  }
}

/** Applies one `data:` payload to the step; returns events for the UI. */
export function applyChunk(
  data: string,
  acc: { text: string; finish: string | null; usage: ChatUsage | null },
  tools: ToolCallAssembler
): StepEvent[] {
  let chunk: RawChunk
  try {
    chunk = JSON.parse(data) as RawChunk
  } catch {
    return []
  }
  if (!chunk || typeof chunk !== 'object') return []
  if (chunk.error) {
    throw new ChatRequestError(chunk.error.message || 'Request failed', {
      code: chunk.error.code == null ? undefined : String(chunk.error.code),
      early: acc.text === '' && tools.list().length === 0,
    })
  }
  const out: StepEvent[] = []
  const choice = chunk.choices?.[0]
  const delta = choice?.delta ?? choice?.message
  if (typeof delta?.content === 'string' && delta.content) {
    acc.text += delta.content
    out.push({ type: 'text', text: delta.content })
  }
  const calls = delta?.tool_calls
  if (Array.isArray(calls)) {
    calls.forEach((c, i) => {
      const named = tools.add(c, i)
      if (named != null) {
        out.push({
          type: 'tool-start',
          index: named,
          name: tools.nameOf(named),
        })
      }
    })
  }
  if (choice?.finish_reason) acc.finish = choice.finish_reason
  if (chunk.usage && typeof chunk.usage.prompt_tokens === 'number') {
    acc.usage = toUsage(chunk.usage)
  }
  return out
}

/**
 * Sends one request and streams it. Throws ChatRequestError (with `early`
 * when nothing came back yet, so the caller may try another model).
 */
export async function streamStep(
  body: unknown,
  opts: { signal: AbortSignal; onEvent: (event: StepEvent) => void }
): Promise<StepResult> {
  const headers = {
    ...(await getFreshAuthHeaders()),
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  let res: Response
  try {
    res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
      credentials: 'same-origin',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ChatRequestError('Network error', {
      code: 'network',
      early: true,
    })
  }
  if (!res.ok || !res.body) {
    const parsed = parseErrorBody(await res.text().catch(() => ''))
    throw new ChatRequestError(parsed.message || `HTTP ${res.status}`, {
      status: res.status,
      code: parsed.code,
      early: true,
    })
  }

  const acc = {
    text: '',
    finish: null as string | null,
    usage: null as ChatUsage | null,
  }
  const tools = new ToolCallAssembler()
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('text/event-stream')) {
    // A plain JSON reply: an error, or a channel that ignored `stream`.
    const text = await res.text()
    applyChunk(text, acc, tools).forEach(opts.onEvent)
    if (!acc.text && !tools.list().length && !acc.finish) {
      const parsed = parseErrorBody(text)
      throw new ChatRequestError(parsed.message || 'Empty response', {
        status: res.status,
        code: parsed.code,
        early: true,
      })
    }
    return { ...acc, toolCalls: tools.list() }
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += value
      for (let nl = buf.indexOf('\n'); nl >= 0; nl = buf.indexOf('\n')) {
        const line = buf.slice(0, nl).replace(/\r$/, '')
        buf = buf.slice(nl + 1)
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') {
          void reader.cancel().catch(() => undefined)
          return { ...acc, toolCalls: tools.list() }
        }
        applyChunk(data, acc, tools).forEach(opts.onEvent)
      }
    }
  } catch (error) {
    if (error instanceof ChatRequestError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ChatRequestError('The connection dropped', {
      code: 'network',
      early: acc.text === '' && tools.list().length === 0,
    })
  }
  return { ...acc, toolCalls: tools.list() }
}
