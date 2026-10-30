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
import { getFreshAuthHeaders } from '@/lib/api'

import type { ChatUsage } from '../types'

/*
 * One streamed chat completion over fetch. The console's session headers
 * authorise /pg/chat/completions, which bills the user's own quota. Events
 * come out in order: reasoning and text deltas, the finish reason, and the
 * usage chunk that `stream_options.include_usage` asks for.
 */

export const CHAT_ENDPOINT = '/pg/chat/completions'

export type StreamEvent =
  | { type: 'reasoning'; text: string }
  | { type: 'content'; text: string }
  | { type: 'finish'; reason: string }
  | { type: 'usage'; usage: ChatUsage }
  | { type: 'error'; message: string; code?: string }

export class ChatRequestError extends Error {
  status?: number
  code?: string
  /** True when the failure happened before anything streamed back. */
  early: boolean

  constructor(
    message: string,
    opts: { status?: number; code?: string; early: boolean }
  ) {
    super(message)
    this.name = 'ChatRequestError'
    this.status = opts.status
    this.code = opts.code
    this.early = opts.early
  }
}

type RawUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
  completion_tokens_details?: { reasoning_tokens?: number }
}

type RawChunk = {
  error?: { message?: string; code?: string | number; type?: string }
  message?: string
  success?: boolean
  choices?: Array<{
    delta?: {
      content?: string | null
      reasoning_content?: string | null
      reasoning?: string | null
    }
    message?: {
      content?: string | null
      reasoning_content?: string | null
      reasoning?: string | null
    }
    finish_reason?: string | null
  }>
  usage?: RawUsage | null
}

export function toUsage(raw: RawUsage): ChatUsage {
  const prompt = raw.prompt_tokens ?? 0
  const completion = raw.completion_tokens ?? 0
  return {
    prompt,
    completion,
    total: raw.total_tokens ?? prompt + completion,
    cached: raw.prompt_tokens_details?.cached_tokens || undefined,
    reasoning: raw.completion_tokens_details?.reasoning_tokens || undefined,
  }
}

/** Events in one `data:` payload; non-JSON lines are ignored. */
export function parseStreamData(data: string): StreamEvent[] {
  let chunk: RawChunk
  try {
    chunk = JSON.parse(data) as RawChunk
  } catch {
    return []
  }
  if (!chunk || typeof chunk !== 'object') return []
  if (chunk.error) {
    return [
      {
        type: 'error',
        message: chunk.error.message || 'Request failed',
        code: chunk.error.code == null ? undefined : String(chunk.error.code),
      },
    ]
  }
  const out: StreamEvent[] = []
  const choice = chunk.choices?.[0]
  const delta = choice?.delta ?? choice?.message
  const reasoning = delta?.reasoning_content ?? delta?.reasoning
  if (typeof reasoning === 'string' && reasoning) {
    out.push({ type: 'reasoning', text: reasoning })
  }
  if (typeof delta?.content === 'string' && delta.content) {
    out.push({ type: 'content', text: delta.content })
  }
  if (choice?.finish_reason) {
    out.push({ type: 'finish', reason: choice.finish_reason })
  }
  if (chunk.usage && typeof chunk.usage.prompt_tokens === 'number') {
    out.push({ type: 'usage', usage: toUsage(chunk.usage) })
  }
  return out
}

/** The message and code of an error body (OpenAI or New API shape). */
export function parseErrorBody(text: string): {
  message?: string
  code?: string
} {
  try {
    const body = JSON.parse(text) as RawChunk
    if (body.error) {
      return {
        message: body.error.message,
        code:
          body.error.code == null ? body.error.type : String(body.error.code),
      }
    }
    if (typeof body.message === 'string') return { message: body.message }
  } catch {
    // not JSON
  }
  const plain = text.trim()
  return plain ? { message: plain.slice(0, 300) } : {}
}

export async function streamChat(
  body: unknown,
  opts: { signal: AbortSignal; onEvent: (event: StreamEvent) => void }
): Promise<void> {
  const headers = {
    ...(await getFreshAuthHeaders()),
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts.signal,
    credentials: 'same-origin',
  })
  if (!res.ok || !res.body) {
    const parsed = parseErrorBody(await res.text().catch(() => ''))
    throw new ChatRequestError(parsed.message || `HTTP ${res.status}`, {
      status: res.status,
      code: parsed.code,
      early: true,
    })
  }
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('text/event-stream')) {
    // a plain JSON reply: an error, or a channel that ignored `stream`
    const text = await res.text()
    const events = parseStreamData(text)
    const error = events.find((e) => e.type === 'error')
    if (error && error.type === 'error') {
      throw new ChatRequestError(error.message, {
        status: res.status,
        code: error.code,
        early: true,
      })
    }
    if (!events.length) {
      const parsed = parseErrorBody(text)
      throw new ChatRequestError(parsed.message || 'Empty response', {
        status: res.status,
        code: parsed.code,
        early: true,
      })
    }
    events.forEach(opts.onEvent)
    return
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
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
        return
      }
      for (const event of parseStreamData(data)) opts.onEvent(event)
    }
  }
}
