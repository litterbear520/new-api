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
import { describe, expect, test } from 'vitest'

import { readImageStream } from '../image-stream'

function streamOf(chunks: string[]) {
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(ctrl) {
      chunks.forEach((c) => ctrl.enqueue(enc.encode(c)))
      ctrl.close()
    },
  })
}

// Shape of a real reply from CLIProxyAPI v8.0.31 through new-api (10-31).
const KEEPALIVE = 'event: keepalive\ndata: {"type":"keepalive"}\n\n'
const COMPLETED =
  'event: image_generation.completed\n' +
  'data: {"type":"image_generation.completed","sequence_number":0,"b64_json":"QUJD",' +
  '"background":"opaque","quality":"low","size":"1536x1024","output_format":"png",' +
  '"usage":{"input_tokens":19,"input_tokens_details":{"image_tokens":0,"text_tokens":19},"output_tokens":343}}\n\n'

describe('readImageStream', () => {
  test('keeps the completed picture and its usage, skips keepalives and pings', async () => {
    const result = await readImageStream(
      streamOf([KEEPALIVE, ': PING\n\n', COMPLETED])
    )
    expect(result.error).toBeUndefined()
    expect(result.images).toEqual([
      { b64: 'QUJD', format: 'png', revised: undefined },
    ])
    expect(result.usage?.output_tokens).toBe(343)
  })

  test('joins events split across chunks and CRLF line ends', async () => {
    const crlf = (KEEPALIVE + COMPLETED).replaceAll('\n', '\r\n')
    const cut = [
      crlf.slice(0, 7),
      crlf.slice(7, 60),
      crlf.slice(60, 61),
      crlf.slice(61),
    ]
    const result = await readImageStream(streamOf(cut))
    expect(result.images.map((i) => i.b64)).toEqual(['QUJD'])
  })

  test('keeps every completed picture, ignores partial previews', async () => {
    const partial =
      'event: image_generation.partial_image\n' +
      'data: {"type":"image_generation.partial_image","b64_json":"cGFy","partial_image_index":0}\n\n'
    const second = COMPLETED.replace('QUJD', 'REVG')
    const result = await readImageStream(streamOf([partial, COMPLETED, second]))
    expect(result.images.map((i) => i.b64)).toEqual(['QUJD', 'REVG'])
  })

  test('reports an error event', async () => {
    const result = await readImageStream(
      streamOf([
        KEEPALIVE,
        'event: error\ndata: {"type":"error","error":{"message":"Your request was rejected by the safety system","code":"moderation_blocked"}}\n\n',
      ])
    )
    expect(result.images).toEqual([])
    expect(result.error?.code).toBe('moderation_blocked')
  })

  test('a stream that ends without a picture returns none', async () => {
    const result = await readImageStream(
      streamOf([KEEPALIVE, 'data: [DONE]\n\n'])
    )
    expect(result.images).toEqual([])
    expect(result.error).toBeUndefined()
  })
})
