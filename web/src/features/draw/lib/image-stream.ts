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
import type { DrawUsage } from '../types'

/*
 * Picture generation is streamed (Server-Sent Events) so the connection
 * never sits silent: Cloudflare drops a proxied request that sends no bytes
 * for 100 s, and a picture can take longer. new-api adds ": PING" comments
 * while it waits, CLIProxyAPI sends a "keepalive" event first, and only the
 * "*.completed" events carry a final picture (one per picture, each billed).
 */

export type StreamedImage = { b64: string; format?: string; revised?: string }

export type StreamError = { message?: string; code?: string; type?: string }

export type ImageStreamResult = {
  images: StreamedImage[]
  usage?: DrawUsage
  error?: StreamError
}

type ImageEvent = {
  type?: string
  b64_json?: string
  output_format?: string
  revised_prompt?: string
  usage?: DrawUsage
  error?: StreamError | string
  message?: string
}

/** Applies one event's `data:` payload to the result. */
export function applyImageEvent(data: string, result: ImageStreamResult) {
  let event: ImageEvent
  try {
    event = JSON.parse(data) as ImageEvent
  } catch {
    return
  }
  if (!event || typeof event !== 'object') return
  if (event.error || event.type === 'error') {
    result.error =
      event.error && typeof event.error === 'object'
        ? event.error
        : { message: event.message || String(event.error || 'error') }
    return
  }
  if (!event.type?.endsWith('.completed')) return
  if (event.b64_json) {
    result.images.push({
      b64: event.b64_json,
      format: event.output_format,
      revised: event.revised_prompt?.trim() || undefined,
    })
  }
  if (event.usage) result.usage = event.usage
}

function applyBlock(block: string, result: ImageStreamResult) {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n')
  if (data && data !== '[DONE]') applyImageEvent(data, result)
}

/** Reads a streamed /v1/images reply to its end. */
export async function readImageStream(
  body: ReadableStream<Uint8Array>
): Promise<ImageStreamResult> {
  const result: ImageStreamResult = { images: [] }
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let match: RegExpExecArray | null
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      applyBlock(buffer.slice(0, match.index), result)
      buffer = buffer.slice(match.index + match[0].length)
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) applyBlock(buffer, result)
  return result
}
