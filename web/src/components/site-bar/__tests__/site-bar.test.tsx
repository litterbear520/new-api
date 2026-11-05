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
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MouseEvent } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { ThemeProvider } from '@/context/theme-provider'
import { ROLE } from '@/lib/roles'
import { STATUS_QUERY_KEY } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

import { ACCOUNT_NOTE_KEY } from '../account-note'
import { HANDOFF_KEY, LENS_HANDOFF_KEY } from '../handoff'
import { SiteBar } from '../site-bar'
import {
  useDarkSiteBar,
  useSiteBarMenu,
  useSiteBarSignIn,
  useSplitSiteBar,
} from '../store'

const signInSpy = vi.fn()
const menuSpy = vi.fn()

let reducedMotion = false

beforeEach(() => {
  reducedMotion = false
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  })
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('reduced-motion') && reducedMotion,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  )
  setWindowScroll(0)
})

afterEach(() => {
  consoleLoading = Promise.resolve()
  vi.useRealTimers()
  vi.restoreAllMocks()
  signInSpy.mockReset()
  menuSpy.mockReset()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  window.localStorage.clear()
  window.sessionStorage.clear()
  Object.defineProperty(document, 'referrer', { value: '', configurable: true })
})

function setWindowScroll(top: number) {
  Object.defineProperty(window, 'scrollY', { value: top, configurable: true })
}

/** Scroll the page in wheel-sized steps, one frame each. */
function scrollPageTo(top: number, step = 10) {
  let at = window.scrollY
  while (at !== top) {
    at = top > at ? Math.min(at + step, top) : Math.max(at - step, top)
    setWindowScroll(at)
    act(() => {
      document.dispatchEvent(new Event('scroll'))
      vi.advanceTimersByTime(16)
    })
  }
}

function scrollElementTo(el: HTMLElement, top: number, step = 10) {
  let at = el.scrollTop
  while (at !== top) {
    at = top > at ? Math.min(at + step, top) : Math.max(at - step, top)
    el.scrollTop = at
    act(() => {
      el.dispatchEvent(new Event('scroll'))
      vi.advanceTimersByTime(16)
    })
  }
}

/** A box as tall as the screen, like a table page's list. */
function tallBox() {
  const box = document.createElement('div')
  Object.defineProperty(box, 'clientHeight', { value: window.innerHeight })
  return box
}

/** Lets the scroll come to rest and any spring settle. */
function settle() {
  act(() => {
    vi.advanceTimersByTime(2000)
  })
}

function NightSeaStub() {
  useDarkSiteBar()
  useSiteBarSignIn((event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    signInSpy()
  })
  return <main>night sea</main>
}

function ChatStub() {
  useSplitSiteBar()
  return (
    <main>
      <div data-testid='thread' />
    </main>
  )
}

/** The console's first page loads until a test lets it. */
let consoleLoading: Promise<void> = Promise.resolve()

function ConsoleStub() {
  useSiteBarMenu(menuSpy)
  return (
    <div data-testid='console-scroller' data-slot='console-scroller'>
      <Outlet />
    </div>
  )
}

function buildRouter(initial: string) {
  const root = createRootRoute({
    component: () => (
      <ThemeProvider>
        <SiteBar />
        <Outlet />
      </ThemeProvider>
    ),
  })
  const page = (path: string, component = () => <main>{path}</main>) =>
    createRoute({ getParentRoute: () => root, path, component })
  const authed = createRoute({
    getParentRoute: () => root,
    id: '_authenticated',
    component: ConsoleStub,
  })
  const consolePage = (path: string, component = () => <main>{path}</main>) =>
    createRoute({ getParentRoute: () => authed, path, component })
  const consoleHome = createRoute({
    getParentRoute: () => authed,
    path: '/dashboard',
    loader: () => consoleLoading,
    component: () => <main>/dashboard</main>,
  })
  return createRouter({
    routeTree: root.addChildren([
      page('/', NightSeaStub),
      page('/pricing'),
      page('/activity'),
      page('/setup'),
      authed.addChildren([
        consoleHome,
        consolePage('/dashboard/overview'),
        consolePage('/keys'),
        consolePage('/playground', ChatStub),
        consolePage('/draw'),
      ]),
    ]),
    history: createMemoryHistory({ initialEntries: [initial] }),
  })
}

async function renderAt(
  initial: string,
  options: { signedIn?: boolean; role?: number; nav?: object } = {}
) {
  if (options.signedIn) {
    useAuthStore.getState().auth.setUser({
      id: 1,
      username: 'alice',
      role: options.role ?? ROLE.USER,
      permissions: { sidebar_settings: true },
    })
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(STATUS_QUERY_KEY, {
    system_name: '小熊API',
    docs_link: '/docs/',
    HeaderNavModules: JSON.stringify(
      options.nav ?? {
        pricing: { enabled: true, requireAuth: false },
        rankings: { enabled: false, requireAuth: false },
        about: false,
      }
    ),
  })
  client.setQueryData(['notice'], '')
  const router = buildRouter(initial)
  await act(() => router.load())
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { router, bar: screen.queryByRole('banner') as HTMLElement }
}

function siteLinks(bar: HTMLElement) {
  return within(bar).getByRole('navigation', { name: 'Site links' })
}

test('at the top of a page the bar is split', async () => {
  const { bar } = await renderAt('/pricing')

  expect(bar).toHaveAttribute('data-state', 'split')
})

test('scrolling the page down past the morph distance assembles the bar', async () => {
  const { bar } = await renderAt('/pricing')

  scrollPageTo(120)
  settle()

  expect(bar).toHaveAttribute('data-state', 'assembled')
})

test('the bar follows the scroll while it moves', async () => {
  const { bar } = await renderAt('/pricing')

  scrollPageTo(30)

  expect(bar).toHaveAttribute('data-state', 'moving')
})

test('scrolling back to the top splits the bar again', async () => {
  const { bar } = await renderAt('/pricing')
  scrollPageTo(200)
  settle()

  scrollPageTo(0)
  settle()

  expect(bar).toHaveAttribute('data-state', 'split')
})

test('stopping past halfway on the way down snaps the bar together', async () => {
  const { bar } = await renderAt('/pricing')

  scrollPageTo(50)
  settle()

  expect(bar).toHaveAttribute('data-state', 'assembled')
})

test('stopping just after the top snaps the bar back apart', async () => {
  const { bar } = await renderAt('/pricing')

  scrollPageTo(10)
  settle()

  expect(bar).toHaveAttribute('data-state', 'split')
})

test('a small wobble around the snap point does not flip the bar', async () => {
  const { bar } = await renderAt('/pricing')
  scrollPageTo(200)
  settle()

  scrollPageTo(185, 5)
  scrollPageTo(200, 5)
  settle()

  expect(bar).toHaveAttribute('data-state', 'assembled')
})

test('with reduced motion the bar never shows an in-between state', async () => {
  reducedMotion = true
  const { bar } = await renderAt('/pricing')

  scrollPageTo(30)
  expect(bar).toHaveAttribute('data-state', 'split')

  scrollPageTo(70)
  expect(bar).toHaveAttribute('data-state', 'assembled')
})

test('in the console the bar follows the console scroller', async () => {
  const { bar } = await renderAt('/dashboard/overview', { signedIn: true })

  scrollElementTo(screen.getByTestId('console-scroller'), 150)
  settle()

  expect(bar).toHaveAttribute('data-state', 'assembled')
})

test('a quick flick down while the bar is still opening brings it back together', async () => {
  const { bar } = await renderAt('/pricing')
  scrollPageTo(200)
  settle()

  // back to the top: the bar starts to open…
  scrollPageTo(0, 40)
  act(() => {
    vi.advanceTimersByTime(48)
  })
  // …and a flick goes well past the morph distance before it is done
  setWindowScroll(150)
  act(() => {
    document.dispatchEvent(new Event('scroll'))
  })
  settle()

  expect(bar).toHaveAttribute('data-state', 'assembled')
})

test('leaving a scrolled console page for a page at its top splits the bar', async () => {
  const { router, bar } = await renderAt('/keys', { signedIn: true })
  scrollElementTo(screen.getByTestId('console-scroller'), 300)
  settle()

  await act(() => router.navigate({ to: '/pricing' }))
  settle()

  expect(bar).toHaveAttribute('data-state', 'split')
})

test('a list scrolled back to its top inside a scrolled page keeps the bar together', async () => {
  const { bar } = await renderAt('/pricing')
  scrollPageTo(400)
  settle()
  const list = document.createElement('div')
  document.body.append(list)

  scrollElementTo(list, 30)
  scrollElementTo(list, 0)
  settle()

  expect(bar).toHaveAttribute('data-state', 'assembled')
  list.remove()
})

test('a table scrolling inside its page leaves the bar split: nothing passes under it', async () => {
  const { bar } = await renderAt('/keys', { signedIn: true })
  const table = tallBox()
  screen.getByTestId('console-scroller').append(table)

  scrollElementTo(table, 400)
  settle()

  expect(bar).toHaveAttribute('data-state', 'split')
})

test('a console scroller first seen part-way down is not read as one big jump from the top', async () => {
  const { bar } = await renderAt('/dashboard/overview', { signedIn: true })
  const scroller = screen.getByTestId('console-scroller')
  scroller.scrollTop = 30

  scrollElementTo(scroller, 35, 5)

  expect(bar).toHaveAttribute('data-state', 'split')
})

test('scrolling inside a dialog leaves the bar alone', async () => {
  const { bar } = await renderAt('/pricing')
  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  const list = document.createElement('div')
  dialog.append(list)
  document.body.append(dialog)

  scrollElementTo(list, 150)
  settle()

  expect(bar).toHaveAttribute('data-state', 'split')
  dialog.remove()
})

test('chat keeps the bar split, even while its thread scrolls', async () => {
  const { bar } = await renderAt('/playground', { signedIn: true })
  settle()
  expect(bar).toHaveAttribute('data-state', 'split')

  scrollElementTo(screen.getByTestId('thread'), 400)
  settle()

  expect(bar).toHaveAttribute('data-state', 'split')
})

test('opening chat from a scrolled page splits the bar', async () => {
  const { router, bar } = await renderAt('/keys', { signedIn: true })
  scrollElementTo(screen.getByTestId('console-scroller'), 300)
  settle()
  expect(bar).toHaveAttribute('data-state', 'assembled')

  await act(() => router.navigate({ to: '/playground' }))
  settle()

  expect(bar).toHaveAttribute('data-state', 'split')
})

test('the drawing feed scrolling inside its own box leaves the bar split', async () => {
  const { bar } = await renderAt('/draw', { signedIn: true })
  const feed = tallBox()
  screen.getByTestId('console-scroller').append(feed)

  scrollElementTo(feed, 150)
  settle()

  expect(bar).toHaveAttribute('data-state', 'split')
})

test('the night-sea pages dress the bar in dark glass, other pages follow the theme', async () => {
  const { router, bar } = await renderAt('/')
  expect(bar).toHaveClass('dark')

  await act(() => router.navigate({ to: '/pricing' }))

  expect(bar).not.toHaveClass('dark')
})

test('switching pages keeps the same bar and moves the current link', async () => {
  const { router, bar } = await renderAt('/pricing')
  expect(
    within(siteLinks(bar)).getByRole('link', { current: 'page' })
  ).toHaveTextContent('Model Square')

  await act(() => router.navigate({ to: '/activity' }))

  expect(screen.getByRole('banner')).toBe(bar)
  expect(
    within(siteLinks(bar)).getByRole('link', { current: 'page' })
  ).toHaveTextContent('Offers')
})

test('every console page lights 控制台', async () => {
  const { router, bar } = await renderAt('/dashboard/overview', {
    signedIn: true,
  })
  await act(() => router.navigate({ to: '/keys' }))

  expect(
    within(siteLinks(bar)).getByRole('link', { current: 'page' })
  ).toHaveTextContent('Console')
})

test('the bar links the whole site, the docs in the same tab', async () => {
  const { bar } = await renderAt('/pricing')
  const nav = siteLinks(bar)

  expect(
    within(nav)
      .getAllByRole('link')
      .map((link) => [link.textContent, link.getAttribute('href')])
  ).toEqual([
    ['Home', '/'],
    ['Console', '/dashboard'],
    ['Model Square', '/pricing'],
    ['Offers', '/activity'],
    ['Docs', '/docs/'],
  ])
  expect(within(nav).getByRole('link', { name: 'Docs' })).not.toHaveAttribute(
    'target'
  )
})

test('a site link the admin turned off is not shown', async () => {
  const { bar } = await renderAt('/activity', {
    nav: {
      pricing: { enabled: false },
      rankings: { enabled: false },
      about: false,
      docs: false,
    },
  })

  expect(
    within(siteLinks(bar))
      .getAllByRole('link')
      .map((link) => link.textContent)
  ).toEqual(['Home', 'Console', 'Offers'])
})

test('content passing under the bar never makes it read the page', async () => {
  const reads = vi.fn(() => [])
  document.elementsFromPoint = reads
  await renderAt('/pricing')

  scrollPageTo(400)
  settle()
  Reflect.deleteProperty(document, 'elementsFromPoint')

  expect(reads).not.toHaveBeenCalled()
})

test('the brand on the left links home', async () => {
  const { bar } = await renderAt('/pricing')

  expect(within(bar).getByRole('link', { name: '小熊API' })).toHaveAttribute(
    'href',
    '/'
  )
})

test('signed out: language, theme, 登录 and the phone menu', async () => {
  const { bar } = await renderAt('/pricing')

  expect(within(bar).getAllByRole('button')).toEqual([
    within(bar).getByRole('button', { name: 'Change language' }),
    within(bar).getByRole('button', { name: 'Switch to dark theme' }),
    // Base UI keeps role=button on a Button rendered as a Link
    within(bar).getByRole('button', { name: 'Sign in' }),
    within(bar).getByRole('button', { name: 'Toggle navigation menu' }),
  ])
  expect(within(bar).getByRole('button', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/sign-in'
  )
})

test('signed in: language, theme, messages, the account menu and the phone menu', async () => {
  const { bar } = await renderAt('/pricing', { signedIn: true })

  expect(within(bar).getAllByRole('button')).toEqual([
    within(bar).getByRole('button', { name: 'Change language' }),
    within(bar).getByRole('button', { name: 'Switch to dark theme' }),
    within(bar).getByRole('button', { name: 'Notifications' }),
    within(bar).getByRole('button', { name: 'Account menu' }),
    within(bar).getByRole('button', { name: 'Toggle navigation menu' }),
  ])
})

test('a page can take over 登录, like the night sea opening its dialog', async () => {
  const { bar } = await renderAt('/')
  vi.useRealTimers()

  await userEvent.click(within(bar).getByRole('button', { name: 'Sign in' }))

  expect(signInSpy).toHaveBeenCalledOnce()
})

test('signed out on such a page, 控制台 opens the same sign-in', async () => {
  const { bar } = await renderAt('/')
  vi.useRealTimers()

  await userEvent.click(
    within(siteLinks(bar)).getByRole('link', { name: 'Console' })
  )

  expect(signInSpy).toHaveBeenCalledOnce()
})

test('the phone menu opens a list of the site links and closes on Escape', async () => {
  const { bar } = await renderAt('/pricing')
  vi.useRealTimers()

  await userEvent.click(
    within(bar).getByRole('button', { name: 'Toggle navigation menu' })
  )
  const menu = await screen.findByRole('navigation', { name: 'Site menu' })
  expect(
    within(menu)
      .getAllByRole('link')
      .map((link) => link.textContent)
  ).toEqual(['Home', 'Console', 'Model Square', 'Offers', 'Docs'])
  expect(within(menu).getByRole('link', { current: 'page' })).toHaveTextContent(
    'Model Square'
  )

  await userEvent.keyboard('{Escape}')
  expect(
    screen.queryByRole('navigation', { name: 'Site menu' })
  ).not.toBeInTheDocument()
})

test('in the console the phone menu button opens the sidebar drawer', async () => {
  const { bar } = await renderAt('/keys', { signedIn: true })
  vi.useRealTimers()

  await userEvent.click(
    within(bar).getByRole('button', { name: 'Toggle navigation menu' })
  )

  expect(menuSpy).toHaveBeenCalledOnce()
  expect(
    screen.queryByRole('navigation', { name: 'Site menu' })
  ).not.toBeInTheDocument()
})

test('signed in, the bar leaves the docs a note of who is reading, with nothing secret in it', async () => {
  await renderAt('/pricing', { signedIn: true })

  const raw = window.localStorage.getItem(ACCOUNT_NOTE_KEY)
  expect(JSON.parse(raw ?? 'null')).toEqual({
    name: 'alice',
    detail: 'User',
    avatar: { text: 'A', background: expect.stringMatching(/^hsl\(/) },
    superAdmin: false,
  })
  expect(raw).not.toMatch(/token|sid/i)
})

test('signed out, the note for the docs is gone', async () => {
  window.localStorage.setItem(ACCOUNT_NOTE_KEY, '{"name":"old"}')
  useAuthStore.getState().auth.reset('complete')

  await renderAt('/pricing')

  expect(window.localStorage.getItem(ACCOUNT_NOTE_KEY)).toBeNull()
})

test('while the session is still being restored, the note for the docs stays', async () => {
  window.localStorage.setItem(ACCOUNT_NOTE_KEY, '{"name":"alice"}')
  useAuthStore.getState().auth.reset('checking')

  await renderAt('/pricing')

  expect(window.localStorage.getItem(ACCOUNT_NOTE_KEY)).toBe('{"name":"alice"}')
})

test('arriving from the docs with the bar together, it starts together, then opens at the top', async () => {
  const from = 'http://localhost:3000/docs/'
  Object.defineProperty(document, 'referrer', {
    value: from,
    configurable: true,
  })
  window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ q: 1, from }))

  const { bar } = await renderAt('/pricing')
  expect(bar).toHaveAttribute('data-state', 'assembled')

  settle()
  expect(bar).toHaveAttribute('data-state', 'split')
})

test('a reload does not count as arriving with the bar together', async () => {
  window.sessionStorage.setItem(
    HANDOFF_KEY,
    JSON.stringify({ q: 1, from: 'http://localhost:3000/docs/' })
  )

  const { bar } = await renderAt('/pricing')

  expect(bar).toHaveAttribute('data-state', 'split')
})

test('leaving the page, the bar notes how far it had come together', async () => {
  const { bar } = await renderAt('/pricing')
  scrollPageTo(200)
  settle()
  expect(bar).toHaveAttribute('data-state', 'assembled')

  act(() => {
    window.dispatchEvent(new Event('pagehide'))
  })

  expect(
    JSON.parse(window.sessionStorage.getItem(HANDOFF_KEY) ?? 'null')
  ).toEqual({
    q: 1,
    from: window.location.href,
    at: expect.any(Number),
  })
})

/** jsdom lays nothing out: each link 64px wide, one every 80px. */
function layOutLinks() {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(64)
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(
    function (this: HTMLElement) {
      const siblings = [...(this.parentElement?.children ?? [])]
      return siblings.indexOf(this) * 80
    }
  )
}

/** The lens's left edge, in px from the links' left. */
function lensLeft(bar: HTMLElement) {
  const lens = bar.querySelector<HTMLElement>('[data-site-lens]')
  return Number(
    /translate3d\(([-\d.]+)px/.exec(lens?.style.transform ?? '')?.[1]
  )
}

/** Where the lens sits under a link (the lens is the links' first child). */
function leftOf(bar: HTMLElement, name: string) {
  return within(siteLinks(bar)).getByRole('link', { name }).offsetLeft
}

/** Clicks a link the way a reader does, without jsdom trying to load it. */
function clickLink(link: HTMLElement, init: MouseEventInit = {}) {
  const stop = (event: Event) => event.preventDefault()
  window.addEventListener('click', stop)
  act(() => {
    fireEvent.click(link, init)
  })
  window.removeEventListener('click', stop)
}

test('a click on the docs slides the lens there at once, while they load', async () => {
  layOutLinks()
  const { bar } = await renderAt('/pricing')

  clickLink(within(siteLinks(bar)).getByRole('link', { name: 'Docs' }))
  settle()

  expect(lensLeft(bar)).toBe(leftOf(bar, 'Docs'))
  // still on this page until the docs arrive
  expect(
    within(siteLinks(bar)).getByRole('link', { current: 'page' })
  ).toHaveTextContent('Model Square')
})

test('opening the docs in a new tab leaves the lens where it is', async () => {
  layOutLinks()
  const { bar } = await renderAt('/pricing')

  clickLink(within(siteLinks(bar)).getByRole('link', { name: 'Docs' }), {
    metaKey: true,
  })
  settle()

  expect(lensLeft(bar)).toBe(leftOf(bar, 'Model Square'))
})

test('back from the docs out of the page cache, the lens comes home', async () => {
  layOutLinks()
  const { bar } = await renderAt('/pricing')
  clickLink(within(siteLinks(bar)).getByRole('link', { name: 'Docs' }))
  settle()

  act(() => {
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true })
    )
  })
  settle()

  expect(lensLeft(bar)).toBe(leftOf(bar, 'Model Square'))
})

test('leaving the page, the bar notes where the lens is', async () => {
  layOutLinks()
  const { bar } = await renderAt('/pricing')
  const left = leftOf(bar, 'Model Square')

  act(() => {
    window.dispatchEvent(new Event('pagehide'))
  })

  expect(
    JSON.parse(window.sessionStorage.getItem(LENS_HANDOFF_KEY) ?? 'null')
  ).toEqual({
    left,
    right: left + 64,
    vLeft: 0,
    vRight: 0,
    from: window.location.href,
    at: expect.any(Number),
  })
})

function noteLens(from: string, at = Date.now()) {
  window.sessionStorage.setItem(
    LENS_HANDOFF_KEY,
    JSON.stringify({
      left: 400,
      right: 464,
      vLeft: -900,
      vRight: -400,
      from,
      at,
    })
  )
}

test('arriving from the docs mid-slide, the lens carries on from where it was', async () => {
  layOutLinks()
  const from = 'http://localhost:3000/docs/'
  Object.defineProperty(document, 'referrer', {
    value: from,
    configurable: true,
  })
  noteLens(from)

  const { bar } = await renderAt('/pricing')
  expect(lensLeft(bar)).toBe(400)

  settle()
  expect(lensLeft(bar)).toBe(leftOf(bar, 'Model Square'))
})

test('a lens note from another visit is not used', async () => {
  layOutLinks()
  const from = 'http://localhost:3000/docs/'
  Object.defineProperty(document, 'referrer', {
    value: from,
    configurable: true,
  })
  noteLens(from, Date.now() - 4000)

  const { bar } = await renderAt('/pricing')

  expect(lensLeft(bar)).toBe(leftOf(bar, 'Model Square'))
})

test('a lens note is for arriving, not for a page reached long after', async () => {
  layOutLinks()
  const from = 'http://localhost:3000/docs/'
  Object.defineProperty(document, 'referrer', {
    value: from,
    configurable: true,
  })
  noteLens(from)

  // a page none of the links is for (模型广场 turned off), then one that is
  const { router, bar } = await renderAt('/pricing', {
    nav: {
      pricing: { enabled: false },
      rankings: { enabled: false },
      about: false,
    },
  })
  act(() => {
    vi.advanceTimersByTime(4000)
  })
  await act(() => router.navigate({ to: '/activity' }))

  expect(lensLeft(bar)).toBe(leftOf(bar, 'Offers'))
})

test('the first-run setup has no bar', async () => {
  await renderAt('/setup')

  expect(screen.queryByRole('banner')).not.toBeInTheDocument()
})

test('the account menu holds the account pages and sign-out only', async () => {
  const { bar } = await renderAt('/keys', { signedIn: true })
  vi.useRealTimers()
  await userEvent.click(
    within(bar).getByRole('button', { name: 'Account menu' })
  )

  const items = await screen.findAllByRole('menuitem')
  expect(items.map((item) => item.textContent)).toEqual([
    'Account settings',
    'Sign out',
  ])
})

test('super admins also reach the system settings from the account menu', async () => {
  const { bar } = await renderAt('/keys', {
    signedIn: true,
    role: ROLE.SUPER_ADMIN,
  })
  vi.useRealTimers()
  await userEvent.click(
    within(bar).getByRole('button', { name: 'Account menu' })
  )

  const items = await screen.findAllByRole('menuitem')
  expect(items.map((item) => item.textContent)).toEqual([
    'Account settings',
    'System Settings',
    'Sign out',
  ])
})

test('a click on 控制台 slides the lens there at once, while the console loads', async () => {
  layOutLinks()
  let loaded = () => {}
  consoleLoading = new Promise<void>((resolve) => {
    loaded = resolve
  })
  const { bar } = await renderAt('/pricing', { signedIn: true })
  const from = leftOf(bar, 'Model Square')
  const to = leftOf(bar, 'Console')

  clickLink(within(siteLinks(bar)).getByRole('link', { name: 'Console' }))
  act(() => {
    vi.advanceTimersByTime(48)
  })

  // on its way, never gone
  const lens = bar.querySelector<HTMLElement>('[data-site-lens]')
  expect(lens?.style.opacity).toBe('1')
  expect(lensLeft(bar)).toBeLessThan(from)
  expect(lensLeft(bar)).toBeGreaterThan(to - 16)
  expect(screen.getByText('/pricing')).toBeInTheDocument()

  settle()
  expect(lensLeft(bar)).toBe(to)
  await act(async () => loaded())
})

/** One mouse pointer, as a browser reports it. */
const MOUSE = { pointerId: 1, pointerType: 'mouse', isPrimary: true }
/** …with its main button held down. */
const HELD = { ...MOUSE, buttons: 1 }

/** The middle of a link, where a finger would press it. */
function middleOf(bar: HTMLElement, name: string) {
  return leftOf(bar, name) + 32
}

/** Where the held pointer is. */
let pointerAt = 0

function press(bar: HTMLElement, name: string) {
  const link = within(siteLinks(bar)).getByRole('link', { name })
  pointerAt = middleOf(bar, name)
  act(() => {
    fireEvent.pointerDown(link, { ...MOUSE, clientX: pointerAt, button: 0 })
  })
}

/** Moves the held pointer to `x` in small steps, a frame each. */
function dragTo(bar: HTMLElement, x: number, step = 8) {
  const nav = siteLinks(bar)
  while (pointerAt !== x) {
    pointerAt =
      x > pointerAt
        ? Math.min(pointerAt + step, x)
        : Math.max(pointerAt - step, x)
    act(() => {
      fireEvent.pointerMove(nav, { ...HELD, clientX: pointerAt })
      vi.advanceTimersByTime(16)
    })
  }
  return bar.querySelector<HTMLElement>('[data-site-lens]')
}

function letGo(bar: HTMLElement) {
  fireEvent.pointerUp(siteLinks(bar), MOUSE)
}

test('dragging the lens to another link and letting go opens that page', async () => {
  layOutLinks()
  const { router, bar } = await renderAt('/pricing')

  press(bar, 'Model Square')
  dragTo(bar, middleOf(bar, 'Offers'))
  await act(async () => letGo(bar))
  settle()

  expect(router.state.location.pathname).toBe('/activity')
  expect(
    within(siteLinks(bar)).getByRole('link', { current: 'page' })
  ).toHaveTextContent('Offers')
  expect(lensLeft(bar)).toBe(leftOf(bar, 'Offers'))
})

test('a held lens swells and lights the link under it, and settles back when let go', async () => {
  layOutLinks()
  const { bar } = await renderAt('/pricing')

  press(bar, 'Model Square')
  const lens = dragTo(bar, middleOf(bar, 'Offers'))
  settle()

  expect(lens).toHaveAttribute('data-swollen')
  expect(
    within(siteLinks(bar)).getByRole('link', { name: 'Offers' })
  ).toHaveClass('text-foreground')
  expect(
    within(siteLinks(bar)).getByRole('link', { name: 'Model Square' })
  ).toHaveClass('text-muted-foreground')

  await act(async () => letGo(bar))
  settle()
  expect(lens).not.toHaveAttribute('data-swollen')
})

test('letting go, the words never wash out while the lens still covers them', async () => {
  layOutLinks()
  const { bar } = await renderAt('/pricing')

  press(bar, 'Model Square')
  const lens = dragTo(bar, middleOf(bar, 'Offers'))
  settle()
  await act(async () => letGo(bar))

  const magnifier = lens?.firstElementChild as HTMLElement
  let covered = 0
  for (let frame = 0; frame < 60; frame++) {
    act(() => {
      vi.advanceTimersByTime(16)
    })
    if (lens?.hasAttribute('data-swollen')) {
      covered += 1
      expect(magnifier.style.opacity).toBe('1')
    }
  }
  expect(covered).toBeGreaterThan(0)
  expect(lens).not.toHaveAttribute('data-swollen')
})

test('letting go back over the current link opens nothing and the lens goes home', async () => {
  layOutLinks()
  const { router, bar } = await renderAt('/pricing')

  press(bar, 'Model Square')
  dragTo(bar, middleOf(bar, 'Offers'))
  dragTo(bar, middleOf(bar, 'Model Square'))
  await act(async () => letGo(bar))
  settle()

  expect(router.state.location.pathname).toBe('/pricing')
  expect(lensLeft(bar)).toBe(leftOf(bar, 'Model Square'))
})

test('Escape while dragging puts the lens back and opens nothing', async () => {
  layOutLinks()
  const { router, bar } = await renderAt('/pricing')

  press(bar, 'Model Square')
  dragTo(bar, middleOf(bar, 'Offers'))
  act(() => {
    fireEvent.keyDown(window, { key: 'Escape' })
  })
  await act(async () => letGo(bar))
  settle()

  expect(router.state.location.pathname).toBe('/pricing')
  expect(lensLeft(bar)).toBe(leftOf(bar, 'Model Square'))
})

test('a press that barely moves is still a plain click', async () => {
  layOutLinks()
  const { router, bar } = await renderAt('/pricing')
  const offers = within(siteLinks(bar)).getByRole('link', { name: 'Offers' })

  act(() => {
    fireEvent.pointerDown(offers, {
      ...MOUSE,
      clientX: middleOf(bar, 'Offers'),
    })
    fireEvent.pointerMove(offers, {
      ...HELD,
      clientX: middleOf(bar, 'Offers') + 3,
    })
    fireEvent.pointerUp(offers, MOUSE)
  })
  await act(async () => clickLink(offers))
  settle()

  expect(router.state.location.pathname).toBe('/activity')
})

test('a mouse let go outside the links leaves nothing held: moving over them later drags nothing', async () => {
  layOutLinks()
  const { router, bar } = await renderAt('/pricing')
  const nav = siteLinks(bar)

  // pressed, then let go above the bar, where the links never saw it
  press(bar, 'Model Square')
  act(() => {
    fireEvent.pointerMove(nav, {
      ...MOUSE,
      buttons: 0,
      clientX: pointerAt + 40,
    })
  })
  settle()
  await act(async () => letGo(bar))
  settle()

  const lens = bar.querySelector<HTMLElement>('[data-site-lens]')
  expect(lens).not.toHaveAttribute('data-swollen')
  expect(router.state.location.pathname).toBe('/pricing')
  expect(lensLeft(bar)).toBe(leftOf(bar, 'Model Square'))
})
