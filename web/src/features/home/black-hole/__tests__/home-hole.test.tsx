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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { STATUS_QUERY_KEY } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

import { HERO_SHELL_ID } from '../../night-sea/hero-copy'
import { heroShellMarkup } from '../../night-sea/hero-shell-html'
import { NightSeaHome } from '../../night-sea/night-sea-home'
import type { BlackHoleOptions } from '../engine'

// This browser can draw the black hole (unless a test says not); the engine itself is a stand-in.
const support = vi.hoisted(() => ({
  webgl2: true,
  layout: '00',
  changed: new Set<() => void>(),
}))
vi.mock('../support', () => ({
  PHONE_QUERY: '(max-width: 640px)',
  STACKED_QUERY: '(max-width: 999px)',
  canDrawBlackHole: () => support.webgl2,
  layoutNow: () => support.layout,
  subscribeLayout: (fn: () => void) => {
    support.changed.add(fn)
    return () => support.changed.delete(fn)
  },
  afterFirstPaint: (fn: () => void) => {
    fn()
    return () => {}
  },
}))
const engine = vi.hoisted(() => ({
  starts: [] as BlackHoleOptions[],
  fail: false,
}))
vi.mock('../engine', () => ({
  startBlackHole: vi.fn(
    async (_canvas: HTMLCanvasElement, opts: BlackHoleOptions) => {
      engine.starts.push(opts)
      if (engine.fail) {
        opts.onFail?.()
        return null
      }
      return { stop: () => {} }
    }
  ),
}))

function renderHome() {
  const client = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  })
  client.setQueryData(STATUS_QUERY_KEY, { register_enabled: true })
  const root = createRootRoute({ component: Outlet })
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({
        getParentRoute: () => root,
        path: '/',
        component: () => <NightSeaHome isAuthenticated={false} />,
      }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return view.container
}

/** A screen that matches these media queries (none: a computer, motion welcome) */
function screenMatching(...queries: string[]) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: queries.includes(query),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  )
}

beforeEach(() => {
  engine.starts.length = 0
  engine.fail = false
  support.webgl2 = true
  support.layout = '00'
  screenMatching()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  // a reload: what lies under the first screen is there at once (below-fold.test.ts has its timing)
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
    { type: 'reload' } as unknown as PerformanceEntry,
  ])
  // the strands and the glass find no 2D canvas in jsdom
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => null
  )
  useAuthStore.getState().auth.reset('complete')
})

afterEach(() => {
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset('idle')
})

it('draws the black hole live on the first screen of a computer, the gateway under it, and credits the sky', async () => {
  const page = renderHome()

  expect(
    await screen.findByRole('region', { name: '所有模型 一个入口' })
  ).toBeInTheDocument()
  await waitFor(() => expect(engine.starts).toHaveLength(1))
  // over the poster the page's HTML showed first
  expect(page.querySelector('.ns-first canvas.ns-sky-hole')).not.toBeNull()
  expect(page.querySelector('.ns-first .ns-sky-poster img')).not.toBeNull()
  expect(screen.getByRole('contentinfo')).toHaveTextContent(
    'NASA Earth Observatory'
  )
})

it('shows phones the still picture and starts no engine', async () => {
  screenMatching('(max-width: 640px)', '(max-width: 999px)')
  const page = renderHome()

  expect(
    await screen.findByRole('region', { name: '所有模型 一个入口' })
  ).toBeInTheDocument()
  expect(page.querySelector('.ns-first .ns-sky-poster img')).toHaveAttribute(
    'alt',
    ''
  )
  expect(page.querySelector('canvas.ns-sky-hole')).toBeNull()
  expect(engine.starts).toHaveLength(0)
})

it('shows the still picture when less motion is asked for', async () => {
  screenMatching('(prefers-reduced-motion: reduce)')
  const page = renderHome()

  expect(
    await screen.findByRole('region', { name: '所有模型 一个入口' })
  ).toBeInTheDocument()
  expect(page.querySelector('.ns-sky-poster')).not.toBeNull()
  expect(page.querySelector('canvas.ns-sky-hole')).toBeNull()
  expect(engine.starts).toHaveLength(0)
})

it('shows the still picture when the browser has no WebGL2', async () => {
  support.webgl2 = false
  const page = renderHome()

  expect(
    await screen.findByRole('region', { name: '所有模型 一个入口' })
  ).toBeInTheDocument()
  expect(page.querySelector('.ns-first .ns-sky-poster')).not.toBeNull()
  expect(page.querySelector('canvas.ns-sky-hole')).toBeNull()
})

it('keeps the hole going when the gateway stacks (a window narrowed past 1000 px)', async () => {
  const page = renderHome()
  await waitFor(() => expect(engine.starts).toHaveLength(1))

  screenMatching('(max-width: 999px)')
  support.layout = '01'
  act(() => {
    for (const fn of support.changed) fn()
  })

  expect(engine.starts).toHaveLength(1)
  expect(engine.starts[0].signal.aborted).toBe(false)
  expect(page.querySelector('.ns-first canvas.ns-sky-hole')).not.toBeNull()
})

it('stops the hole and shows the still picture when the window narrows to a phone', async () => {
  const page = renderHome()
  await waitFor(() => expect(engine.starts).toHaveLength(1))

  screenMatching('(max-width: 640px)', '(max-width: 999px)')
  support.layout = '11'
  act(() => {
    for (const fn of support.changed) fn()
  })

  expect(engine.starts[0].signal.aborted).toBe(true)
  expect(page.querySelector('.ns-first .ns-sky-poster')).not.toBeNull()
  expect(page.querySelector('canvas.ns-sky-hole')).toBeNull()
})

it('falls back to the still picture when the GPU gives out', async () => {
  engine.fail = true
  const page = renderHome()

  await waitFor(() =>
    expect(page.querySelector('.ns-first .ns-sky-poster')).not.toBeNull()
  )
  expect(page.querySelector('canvas.ns-sky-hole')).toBeNull()
  expect(
    screen.getByRole('region', { name: '所有模型 一个入口' })
  ).toBeInTheDocument()
  expect(screen.getByRole('contentinfo')).toHaveTextContent('NASA')
})

/** The elements under `el`, in order, as tag.class (what the app adds alone left out) */
function shape(el: Element) {
  return [...el.querySelectorAll('*')]
    .filter((e) => !e.closest('canvas, .ns-offer-pill'))
    .map((e) => `${e.tagName.toLowerCase()}.${e.getAttribute('class') ?? ''}`)
}

it('takes over the first screen sent with the HTML: the same words in the same order', async () => {
  document.body.insertAdjacentHTML(
    'beforeend',
    heroShellMarkup({
      poster: '/p.webp',
      phonePoster: '/q.webp',
      posterAvif: '/p.avif',
      phonePosterAvif: '/q.avif',
    })
  )
  const shellFirst = document.querySelector(`#${HERO_SHELL_ID} .ns-first`)
  if (!shellFirst) throw new Error('no first screen in the HTML')
  const shellShape = shape(shellFirst)
  const shellWords = shellFirst.querySelector('.ns-hero')?.textContent ?? ''

  const page = renderHome()
  await waitFor(() =>
    expect(document.querySelector(`#${HERO_SHELL_ID}`)).toBeNull()
  )
  const first = page.querySelector('.ns-first')
  if (!first) throw new Error('no first screen')
  expect(shape(first)).toEqual(shellShape)
  // the line's own address is filled in by the HTML's script, before the button's label
  expect(first.querySelector('.ns-hero')?.textContent).toBe(
    shellWords.replace('复制', `${window.location.origin}/v1复制`)
  )
})

it("lets clicks through to its own page at once, and takes over once the HTML's words are up", async () => {
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: () => Promise.resolve(),
  })
  try {
    document.body.insertAdjacentHTML(
      'beforeend',
      heroShellMarkup({
        poster: '/p.webp',
        phonePoster: '/q.webp',
        posterAvif: '/p.avif',
        phonePosterAvif: '/q.avif',
      })
    )
    const shell = document.querySelector<HTMLElement>(`#${HERO_SHELL_ID}`)
    const shellPoster = shell?.querySelector<HTMLElement>('picture img')
    if (!shell || !shellPoster) throw new Error('no first screen in the HTML')
    // its words still waiting for their font
    shell.classList.add('ns-shell-wait')

    const page = renderHome()
    await waitFor(() =>
      expect(page.querySelector('.ns-first .ns-hero')).not.toBeNull()
    )
    await new Promise((r) => setTimeout(r, 250))
    expect(shell.isConnected).toBe(true)
    expect(shell.inert).toBe(true)
    expect(shell.style.pointerEvents).toBe('none')

    // the font is in, a while ago; its poster not yet up
    shell.dataset.words = String(performance.now() - 1000)
    shell.classList.remove('ns-shell-wait')
    await new Promise((r) => setTimeout(r, 250))
    expect(shell.isConnected).toBe(true)

    shellPoster.dataset.in = String(performance.now() - 1000)
    await waitFor(() => expect(shell.isConnected).toBe(false))
  } finally {
    // jsdom has no decode of its own
    delete (HTMLImageElement.prototype as { decode?: unknown }).decode
  }
})
