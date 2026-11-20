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
import { act, render, screen } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { toast as sonner } from 'sonner'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { getImageBlob } from '@/features/draw/lib/storage'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import {
  type ActionContext,
  runCanvasAction,
} from '../components/canvas/canvas-actions'
import { SaveSheet } from '../components/canvas/save-sheet'
import { blocksDownloads } from '../components/canvas/save-sheet-state'
import type { ActionPayload, CanvasApi, PublicNode } from '../lib/canvas/types'
import type { CanvasNode, Project } from '../types'

/*
 * 下载 on the canvas: one picture as itself, several as one ZIP (Chrome
 * blocks the 2nd and later of a burst of downloads), and in WeChat or QQ a
 * sheet to save them by long press.
 */

vi.mock('@/features/draw/lib/storage', () => ({ getImageBlob: vi.fn() }))
vi.mock('sonner', () => ({ toast: vi.fn() }))

const BYTES: Record<string, Blob> = {
  'img-a': new Blob(['jpeg-a'], { type: 'image/jpeg' }),
  'img-b': new Blob(['png-b'], { type: 'image/png' }),
  'img-c': new Blob(['jpeg-c'], { type: 'image/jpeg' }),
}

const node = (id: string): CanvasNode => ({
  id,
  groupId: null,
  status: 'ready',
  img: { id: `img-${id}`, w: 800, h: 600 },
  w: 800,
  h: 600,
  label: `label ${id}`,
  meta: {},
})

const project = (): Project =>
  ({
    id: 'p1',
    title: 'p1',
    createdAt: 1,
    updatedAt: 1,
    cost: 0,
    messages: [],
    transcript: [],
    groups: [],
    nodes: [node('a'), node('b'), node('c')],
  }) as unknown as Project

const t = ((k: string) => k) as unknown as TFunction
const toast = vi.fn()

function download(ids: string[]) {
  const ctx: ActionContext = {
    project: project(),
    cb: {
      onEdit: vi.fn(),
      onMarked: vi.fn(),
      onUpload: vi.fn(),
      onExport: vi.fn(),
    },
    cv: { toast } as unknown as CanvasApi,
    t,
    pickFiles: vi.fn(),
  }
  const nodes = ids.map((id) => ({ id, status: 'ready' }) as PublicNode)
  const kind = ids.length > 1 ? 'multi' : 'image'
  runCanvasAction(ctx, 'download', { ids, kind, nodes } as ActionPayload)
}

type Saved = { name: string; blob: Blob }
let saved: Saved[] = []
let urls = new Map<string, Blob>()

/** The stored entries of a ZIP, in order, read through the local headers. */
async function entries(zip: Blob): Promise<{ name: string; text: string }[]> {
  const bytes = new Uint8Array(await zip.arrayBuffer())
  const view = new DataView(bytes.buffer)
  const out: { name: string; text: string }[] = []
  let p = 0
  const dec = new TextDecoder()
  while (view.getUint32(p, true) === 0x04034b50) {
    const size = view.getUint32(p + 18, true)
    const nameLen = view.getUint16(p + 26, true)
    const extra = view.getUint16(p + 28, true)
    const start = p + 30 + nameLen + extra
    out.push({
      name: dec.decode(bytes.slice(p + 30, p + 30 + nameLen)),
      text: dec.decode(bytes.slice(start, start + size)),
    })
    p = start + size
  }
  return out
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 50 && !check(); i++) {
    await new Promise((r) => setTimeout(r, 0))
  }
}

const UA = navigator.userAgent

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () => ua,
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 20, 19, 12, 24))
  useBearDrawStore.setState({ uid: null, loaded: false, projects: [] })
  useBearDrawStore.getState().init(1, [project()])
  saved = []
  urls = new Map()
  toast.mockReset()
  vi.mocked(getImageBlob).mockImplementation(async (id) => BYTES[id] ?? null)
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (blob: Blob) => {
      const url = `blob:${urls.size}`
      urls.set(url, blob)
      return url
    },
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => undefined,
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    saved.push({
      name: this.download,
      blob: urls.get(this.getAttribute('href') ?? '') as Blob,
    })
  })
})

afterEach(() => {
  setUserAgent(UA)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('下载 on the canvas', () => {
  test('several pictures: one ZIP named like a single download, numbered entries, original bytes', async () => {
    download(['a', 'b', 'c'])
    await until(() => saved.length > 0)
    await new Promise((r) => setTimeout(r, 0))
    expect(saved.map((s) => s.name)).toEqual(['小熊画图-20261120-191224.zip'])
    expect(await entries(saved[0].blob)).toEqual([
      { name: '小熊画图-20261120-191224-1.jpg', text: 'jpeg-a' },
      { name: '小熊画图-20261120-191224-2.png', text: 'png-b' },
      { name: '小熊画图-20261120-191224-3.jpg', text: 'jpeg-c' },
    ])
    expect(toast).not.toHaveBeenCalled()
  })

  test('one picture: downloaded as itself, as before', async () => {
    download(['b'])
    await until(() => saved.length > 0)
    expect(saved.map((s) => s.name)).toEqual(['小熊画图-20261120-191224.png'])
    expect(await saved[0].blob.text()).toBe('png-b')
  })

  test('a picture that cannot be read is left out and reported once', async () => {
    vi.mocked(getImageBlob).mockImplementation(async (id) =>
      id === 'img-b' ? null : (BYTES[id] ?? null)
    )
    download(['a', 'b', 'c'])
    await until(() => toast.mock.calls.length > 0)
    expect(saved).toHaveLength(1)
    expect((await entries(saved[0].blob)).map((e) => e.name)).toEqual([
      '小熊画图-20261120-191224-1.jpg',
      '小熊画图-20261120-191224-2.jpg',
    ])
    expect(toast.mock.calls).toEqual([['Download failed']])
  })
})

describe('下载 in WeChat and QQ', () => {
  test('their in-app browsers are told apart from QQ Browser and Safari', () => {
    const wechat =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.54(0x18003637) NetType/WIFI Language/zh_CN'
    const qq =
      'Mozilla/5.0 (Linux; Android 14; V2309A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0 MQQBrowser/6.2 TBS/046613 Mobile Safari/537.36 V1_AND_SQ_9.0.65 QQ/9.0.65.17150 NetType/WIFI'
    const qqBrowser =
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0 MQQBrowser/15.0 Mobile Safari/537.36'
    const safari =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
    expect(blocksDownloads(wechat)).toBe(true)
    expect(blocksDownloads(qq)).toBe(true)
    expect(blocksDownloads(qqBrowser)).toBe(false)
    expect(blocksDownloads(safari)).toBe(false)
  })

  test('no download link: the pictures open to be saved by long press', async () => {
    setUserAgent('Mozilla/5.0 (iPhone) Mobile/15E148 MicroMessenger/8.0.54')
    render(<SaveSheet />)
    act(() => download(['a', 'b']))
    expect(
      await screen.findByText('Press and hold a picture to save it.')
    ).toBeInTheDocument()
    const imgs = await screen.findAllByRole('img')
    expect(imgs.map((i) => i.getAttribute('alt'))).toEqual([
      'label a',
      'label b',
    ])
    expect(imgs.every((i) => i.getAttribute('src')?.startsWith('data:'))).toBe(
      true
    )
    expect(saved).toEqual([])
  })
})

describe('下载 on a phone or tablet', () => {
  let share: ReturnType<typeof vi.fn>
  let canShare: ReturnType<typeof vi.fn>

  beforeEach(() => {
    share = vi.fn(async () => undefined)
    canShare = vi.fn(() => true)
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share,
    })
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: canShare,
    })
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({ matches: query === '(pointer: coarse)', media: query }) as never
    )
    vi.mocked(sonner).mockReset()
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share')
    Reflect.deleteProperty(navigator, 'canShare')
  })

  /** Name and type of each file in the last share. */
  const shared = () => {
    const last = share.mock.calls.at(-1)
    if (!last) throw new Error('nothing was shared')
    return (last[0] as { files: File[] }).files.map((f) => [f.name, f.type])
  }

  test('several pictures go to the share sheet as files, not a ZIP', async () => {
    download(['a', 'b', 'c'])
    await until(() => share.mock.calls.length > 0)
    expect(shared()).toEqual([
      ['小熊画图-20261120-191224-1.jpg', 'image/jpeg'],
      ['小熊画图-20261120-191224-2.png', 'image/png'],
      ['小熊画图-20261120-191224-3.jpg', 'image/jpeg'],
    ])
    const files = (share.mock.calls[0][0] as { files: File[] }).files
    expect(await files[1].text()).toBe('png-b')
    expect(saved).toEqual([])
    expect(toast).not.toHaveBeenCalled()
  })

  test('closing the sheet without a choice says nothing', async () => {
    share.mockRejectedValueOnce(new DOMException('', 'AbortError'))
    download(['a', 'b'])
    await until(() => share.mock.calls.length > 0)
    await new Promise((r) => setTimeout(r, 0))
    expect(toast).not.toHaveBeenCalled()
    expect(sonner).not.toHaveBeenCalled()
    expect(saved).toEqual([])
  })

  test('a refused sheet offers a button that shares on its own tap', async () => {
    share.mockRejectedValueOnce(new DOMException('', 'NotAllowedError'))
    download(['a', 'b'])
    await until(() => vi.mocked(sonner).mock.calls.length > 0)
    const [message, opts] = vi.mocked(sonner).mock.calls[0] as unknown as [
      string,
      { action: { label: string; onClick: () => void } },
    ]
    expect(message).toBe('The pictures are ready')
    expect(opts.action.label).toBe('Save to Photos')
    opts.action.onClick()
    await until(() => share.mock.calls.length > 1)
    expect(shared()).toHaveLength(2)
    expect(saved).toEqual([])
  })

  test('files that cannot be shared fall back to the ZIP', async () => {
    canShare.mockReturnValue(false)
    download(['a', 'b'])
    await until(() => saved.length > 0)
    expect(share).not.toHaveBeenCalled()
    expect(saved.map((s) => s.name)).toEqual(['小熊画图-20261120-191224.zip'])
  })

  test('one picture still downloads as itself', async () => {
    download(['b'])
    await until(() => saved.length > 0)
    expect(share).not.toHaveBeenCalled()
    expect(saved.map((s) => s.name)).toEqual(['小熊画图-20261120-191224.png'])
  })

  test('a computer keeps the ZIP', async () => {
    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) => ({ matches: false, media: query }) as never
    )
    download(['a', 'b'])
    await until(() => saved.length > 0)
    expect(share).not.toHaveBeenCalled()
    expect(saved.map((s) => s.name)).toEqual(['小熊画图-20261120-191224.zip'])
  })
})
