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
import { api } from '@/lib/api'

import { IMAGE_MODERATION, IMAGE_QUALITY, MAX_SPLIT } from './constants'
import { readImageStream } from './lib/image-stream'
import { base64ToBlob } from './lib/images'
import type { DrawErrorKind, DrawPlanPart, DrawUsage } from './types'

/*
 * Pictures come from /v1/images with the page's own token (see
 * lib/draw-key.ts). These calls use fetch without cookies: a 401 here means
 * the drawing token, not the console session, so the console's auth
 * handling must not see it.
 */

export class DrawApiError extends Error {
  constructor(
    public kind: DrawErrorKind,
    message: string,
    public status = 0
  ) {
    super(message)
  }
}

type ImageInput = { blob: Blob; name: string }

type ImageReply = {
  data?: Array<{ b64_json?: string; revised_prompt?: string }>
  output_format?: string
  size?: string
  usage?: DrawUsage
  error?: { message?: string; code?: string; type?: string }
}

export function classifyError(
  status: number,
  message: string,
  code = ''
): DrawErrorKind {
  if (
    /moderation|safety|content.?policy|rejected by|违规|审核/i.test(message)
  ) {
    return 'moderation'
  }
  // A token with a quota limit says "token quota is not enough" (403) before
  // it runs out and 401 after; both are the token, not the balance.
  if (
    status === 401 ||
    code === 'pre_consume_token_quota_failed' ||
    /无权|not allowed|invalid token|令牌/i.test(message)
  ) {
    return 'auth'
  }
  if (/quota|insufficient|balance|余额|额度/i.test(message)) return 'balance'
  if (status === 0 || status === 408 || status === 429 || status >= 500) {
    return 'busy'
  }
  return 'other'
}

export async function requestImage(opts: {
  key: string
  model: string
  prompt: string
  clear: boolean
  images: ImageInput[]
  signal?: AbortSignal
}): Promise<{
  images: Array<{ blob: Blob; revised?: string }>
  usage?: DrawUsage
}> {
  const edit = opts.images.length > 0
  let body: BodyInit
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.key}`,
  }
  if (edit) {
    const form = new FormData()
    form.append('model', opts.model)
    form.append('prompt', opts.prompt)
    form.append('n', '1')
    form.append('quality', IMAGE_QUALITY)
    form.append('moderation', IMAGE_MODERATION)
    if (opts.clear) form.append('background', 'transparent')
    opts.images.forEach((img) => form.append('image[]', img.blob, img.name))
    body = form
  } else {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      n: 1,
      quality: IMAGE_QUALITY,
      moderation: IMAGE_MODERATION,
      // Streamed so bytes keep flowing past Cloudflare's 100 s limit (see
      // lib/image-stream.ts). Edits stay plain JSON: CLIProxyAPI v8.0.31
      // answers a streamed edit with a JSON body labelled text/event-stream,
      // which new-api relays as an empty stream.
      stream: true,
      ...(opts.clear
        ? { background: 'transparent', output_format: 'png' }
        : {}),
    })
  }

  let res: Response
  try {
    res = await fetch(`/v1/images/${edit ? 'edits' : 'generations'}`, {
      method: 'POST',
      headers,
      body,
      credentials: 'omit',
      signal: opts.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new DrawApiError('busy', 'Network error')
  }

  let reply: ImageReply = {}
  const streamed =
    res.ok &&
    res.body !== null &&
    (res.headers.get('Content-Type') ?? '').includes('text/event-stream')
  if (streamed && res.body) {
    try {
      const result = await readImageStream(res.body)
      reply = {
        data: result.images.map((img) => ({
          b64_json: img.b64,
          revised_prompt: img.revised,
        })),
        output_format: result.images[0]?.format,
        usage: result.usage,
        error: result.error,
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      throw new DrawApiError('busy', 'Network error', res.status)
    }
  } else {
    try {
      reply = (await res.json()) as ImageReply
    } catch {
      // An HTML error page (e.g. a proxy timeout) is classified by status.
    }
  }
  if (!res.ok || reply.error) {
    const message = reply.error?.message || reply.error?.code || res.statusText
    throw new DrawApiError(
      classifyError(res.status, message, reply.error?.code),
      message,
      res.status
    )
  }
  const type = reply.output_format === 'jpeg' ? 'image/jpeg' : 'image/png'
  // We ask for one picture, but every picture in the reply is billed, so keep all.
  const images = (reply.data ?? []).flatMap((d) =>
    d.b64_json
      ? [
          {
            blob: base64ToBlob(d.b64_json, type),
            revised: d.revised_prompt?.trim() || undefined,
          },
        ]
      : []
  )
  if (!images.length) {
    throw new DrawApiError('other', 'The reply had no picture', res.status)
  }
  return { images, usage: reply.usage }
}

const SUGGEST_SYSTEM =
  'You suggest follow-up edits for a picture someone just made from the description below. ' +
  'Reply with only a JSON array of 3 short suggestions in the same language as the description. ' +
  'Each one is a concrete change to the picture (subject detail, setting, style, or turn it into a wallpaper/avatar/sticker), ' +
  'at most 12 Chinese characters or 6 English words. No numbering, no other text.'

/** "↳ 接着改": a cheap chat model writes three follow-ups (about $0.0001). */
export async function suggestEdits(
  model: string,
  text: string
): Promise<string[]> {
  const res = await api.post(
    '/pg/chat/completions',
    {
      model,
      stream: false,
      temperature: 0.8,
      max_tokens: 200,
      messages: [
        { role: 'system', content: SUGGEST_SYSTEM },
        { role: 'user', content: text },
      ],
    },
    { skipErrorHandler: true } as Record<string, unknown>
  )
  const content: unknown = res.data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') return []
  const match = content.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const list = JSON.parse(match[0]) as unknown
    if (!Array.isArray(list)) return []
    return list
      .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
      .map((s) => s.trim().slice(0, 40))
      .slice(0, 3)
  } catch {
    return []
  }
}

const PLAN_SYSTEM =
  'You plan picture requests for an image generator that makes exactly ONE picture per call. ' +
  'Decide how many separate pictures the user wants.\n' +
  '- The default is 1. Use more than 1 only when the user clearly asks for separate pictures: ' +
  'e.g. 分别画 / 各画一张 / 拆开 / 分开 / 每个单独一张 / 两张 / one picture each / separately, ' +
  'or several variants (colours, styles, angles) as separate pictures.\n' +
  '- Several things inside one picture (两只猫在一起, a poster that shows three products) is 1 picture.\n' +
  `- At most ${MAX_SPLIT} pictures. If they ask for more, plan the first ${MAX_SPLIT} and add "more": true.\n` +
  '- For 1 picture reply {"count":1} and nothing else.\n' +
  '- For more reply {"count":N,"pictures":[{"title":"…","prompt":"…"}]}. ' +
  'Write every prompt in the language the user wrote in. Each prompt stands alone: it names the one item it shows, ' +
  'described concretely from the attached pictures (colour, pattern, shape, position) so it cannot be confused with the others, ' +
  'says it is the only subject, and repeats every shared requirement from the user (background, style, ratio, text to print) word for word. ' +
  'Do not add objects, brands, colours or text the user did not ask for. Keep quoted text exactly.\n' +
  '- title: a short label for the item, at most 8 Chinese characters or 4 English words.\n' +
  'Reply with JSON only.'

export type DrawPlanResult = { parts: DrawPlanPart[]; capped: boolean }

/**
 * Reads the planner's reply. No parts means one picture with the user's own
 * words; null means the reply could not be read.
 */
export function parsePlan(content: unknown): DrawPlanResult | null {
  if (typeof content !== 'string') return null
  const match = content.match(/\{[\s\S]*\}/)
  if (!match) return null
  let data: { count?: unknown; pictures?: unknown; more?: unknown }
  try {
    data = JSON.parse(match[0]) as typeof data
  } catch {
    return null
  }
  const count = Number(data.count)
  const pictures = Array.isArray(data.pictures)
    ? (data.pictures as unknown[])
    : []
  const parts = pictures.flatMap((p) => {
    if (!p || typeof p !== 'object') return []
    const { title, prompt } = p as { title?: unknown; prompt?: unknown }
    const text = typeof prompt === 'string' ? prompt.trim().slice(0, 1200) : ''
    if (!text) return []
    const label = typeof title === 'string' ? title.trim().slice(0, 16) : ''
    return [{ title: label, text }]
  })
  if (!(count > 1) || parts.length < 2) return { parts: [], capped: false }
  return {
    parts: parts.slice(0, MAX_SPLIT),
    capped: data.more === true || parts.length > MAX_SPLIT || count > MAX_SPLIT,
  }
}

/**
 * Asks a cheap chat model how many separate pictures this message wants
 * (about $0.0001). `images` are small data URLs with what each one is.
 */
export async function planPictures(opts: {
  model: string
  text: string
  images: Array<{ url: string; role: string }>
  signal: AbortSignal
}): Promise<DrawPlanResult | null> {
  const lines = opts.images.map((img, i) => `Picture ${i + 1}: ${img.role}.`)
  const text = [...lines, `User: ${opts.text}`].join('\n')
  const content = opts.images.length
    ? [
        { type: 'text', text },
        ...opts.images.map((img) => ({
          type: 'image_url',
          image_url: { url: img.url },
        })),
      ]
    : text
  const res = await api.post(
    '/pg/chat/completions',
    {
      model: opts.model,
      stream: false,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: PLAN_SYSTEM },
        { role: 'user', content },
      ],
    },
    { skipErrorHandler: true, signal: opts.signal } as Record<string, unknown>
  )
  return parsePlan(res.data?.choices?.[0]?.message?.content)
}
