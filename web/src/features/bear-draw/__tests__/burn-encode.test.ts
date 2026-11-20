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

import type { MarkRec } from '../lib/canvas/context'

/*
 * 完成圈选 encodes the marked picture off the main thread: in a worker when
 * the browser can, else with the canvas's toBlob, never toDataURL. The
 * result is a PNG Blob the size the picture was drawn at.
 */

const png = (text: string) => new Blob([text], { type: 'image/png' })

/** A 2d context that accepts every call. */
function fakeContext(): CanvasRenderingContext2D {
  const ctx: Record<string, unknown> = { getImageData: () => ({}) }
  return new Proxy(ctx, {
    get: (t, k: string) => (k in t ? t[k] : () => undefined),
    set: (t, k: string, v) => {
      t[k] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

class LoadingImage extends EventTarget {
  crossOrigin = ''
  set src(_v: string) {
    queueMicrotask(() => this.dispatchEvent(new Event('load')))
  }
}

type Encoded = { w: number; h: number; type: string | undefined }

let toBlobCalls: Encoded[] = []
let toDataURL: ReturnType<typeof vi.fn>

const mark: MarkRec = {
  n: 1,
  pts: [
    [0.2, 0.2],
    [0.8, 0.2],
    [0.5, 0.8],
  ],
  closed: true,
  note: '',
  ax: 0.5,
  ay: 0.5,
}

type Reply = { ok: true; blob: Blob } | { ok: false; reason: string }

class FakeWorker extends EventTarget {
  static made: FakeWorker[] = []
  static reply: Reply = { ok: true, blob: png('from-worker') }
  posted: { msg: unknown; transfer: unknown[] }[] = []
  terminated = false
  constructor(
    public url: URL,
    public opts: WorkerOptions
  ) {
    super()
    FakeWorker.made.push(this)
  }
  postMessage(msg: unknown, transfer: unknown[]) {
    this.posted.push({ msg, transfer })
    queueMicrotask(() =>
      this.dispatchEvent(
        new MessageEvent('message', { data: FakeWorker.reply })
      )
    )
  }
  terminate() {
    this.terminated = true
  }
}

beforeEach(() => {
  vi.resetModules()
  toBlobCalls = []
  vi.stubGlobal('Image', LoadingImage)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => fakeContext() as never
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
    type?: string
  ) {
    toBlobCalls.push({ w: this.width, h: this.height, type })
    cb(png('from-toBlob'))
  })
  toDataURL = vi.fn(() => 'data:image/png;base64,AAAA')
  HTMLCanvasElement.prototype.toDataURL = toDataURL as never
  FakeWorker.made = []
  FakeWorker.reply = { ok: true, blob: png('from-worker') }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubWorkerSupport() {
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('OffscreenCanvas', function OffscreenCanvas() {})
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (c: HTMLCanvasElement) => ({
      width: c.width,
      height: c.height,
      close: vi.fn(),
    }))
  )
}

async function burn(w: number, h: number) {
  const { burnMarks } = await import('../lib/canvas/burn')
  return burnMarks('blob:picture', w, h, [mark])
}

describe('完成圈选 without workers that can draw', () => {
  test('a PNG Blob from toBlob, at most 2048 px; toDataURL is never used', async () => {
    vi.stubGlobal('Worker', undefined)
    const res = await burn(4096, 2730)
    expect(res.marksOnly).toBe(false)
    expect(res.blob).toBeInstanceOf(Blob)
    expect(res.blob?.type).toBe('image/png')
    expect(await res.blob?.text()).toBe('from-toBlob')
    expect(toBlobCalls).toEqual([{ w: 2048, h: 1365, type: 'image/png' }])
    expect(toDataURL).not.toHaveBeenCalled()
  })

  test('a small picture keeps its size', async () => {
    vi.stubGlobal('OffscreenCanvas', undefined)
    const res = await burn(1024, 1536)
    expect(await res.blob?.text()).toBe('from-toBlob')
    expect(toBlobCalls).toEqual([{ w: 1024, h: 1536, type: 'image/png' }])
  })
})

describe('完成圈选 in a worker', () => {
  test('the canvas goes over as an ImageBitmap, the PNG comes back', async () => {
    stubWorkerSupport()
    const res = await burn(2048, 2048)
    expect(await res.blob?.text()).toBe('from-worker')
    expect(toBlobCalls).toEqual([])
    expect(toDataURL).not.toHaveBeenCalled()
    const [worker] = FakeWorker.made
    expect(worker.opts).toEqual({ type: 'module' })
    expect(String(worker.url)).toMatch(/png-encode\.worker\.ts\b/)
    const { msg, transfer } = worker.posted[0]
    const bitmap = (msg as { bitmap: { width: number; height: number } }).bitmap
    expect(bitmap).toMatchObject({ width: 2048, height: 2048 })
    expect(transfer).toEqual([bitmap])
    expect(worker.terminated).toBe(true)
  })

  test('no 2d context in workers: toBlob now, and the worker is not tried again', async () => {
    stubWorkerSupport()
    FakeWorker.reply = { ok: false, reason: 'no-2d' }
    const first = await burn(800, 800)
    expect(await first.blob?.text()).toBe('from-toBlob')
    const second = await burn(800, 800)
    expect(await second.blob?.text()).toBe('from-toBlob')
    expect(FakeWorker.made).toHaveLength(1)
    expect(toBlobCalls).toHaveLength(2)
  })

  test('a worker that fails once: toBlob for this picture, the worker next time', async () => {
    stubWorkerSupport()
    FakeWorker.reply = { ok: false, reason: 'failed' }
    expect(await (await burn(800, 800)).blob?.text()).toBe('from-toBlob')
    FakeWorker.reply = { ok: true, blob: png('from-worker') }
    expect(await (await burn(800, 800)).blob?.text()).toBe('from-worker')
    expect(FakeWorker.made).toHaveLength(2)
  })
})

describe('pngFromBitmap (inside the worker)', () => {
  function offscreen(ctx: unknown) {
    const made: { w: number; h: number; type?: string }[] = []
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          public width: number,
          public height: number
        ) {
          made.push({ w: width, h: height })
        }
        getContext() {
          return ctx
        }
        async convertToBlob(o: { type: string }) {
          made[0].type = o.type
          return png('encoded')
        }
      }
    )
    return made
  }

  const bitmap = () =>
    ({ width: 640, height: 480, close: vi.fn() }) as unknown as ImageBitmap

  test('copies the snapshot 1:1 and encodes it as PNG', async () => {
    const drawImage = vi.fn()
    const made = offscreen({ drawImage })
    const { pngFromBitmap } = await import('../lib/canvas/png-bitmap')
    const b = bitmap()
    const reply = await pngFromBitmap(b)
    expect(reply.ok && (await reply.blob.text())).toBe('encoded')
    expect(made).toEqual([{ w: 640, h: 480, type: 'image/png' }])
    expect(drawImage).toHaveBeenCalledWith(b, 0, 0)
    expect(b.close).toHaveBeenCalled()
  })

  test('no 2d context: says so', async () => {
    offscreen(null)
    const { pngFromBitmap } = await import('../lib/canvas/png-bitmap')
    const b = bitmap()
    expect(await pngFromBitmap(b)).toEqual({ ok: false, reason: 'no-2d' })
    expect(b.close).toHaveBeenCalled()
  })
})
