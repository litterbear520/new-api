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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  HERO,
  HERO_SHELL_ID,
  HERO_SHELL_STYLE_ID,
  PHONE_POSTER_QUERY,
} from '../hero-copy'
import { dropHeroShell } from '../hero-shell'
import {
  appStylesheetScript,
  firstNightScript,
  firstScreenCss,
  heroShellTags,
} from '../hero-shell-html'

/** Puts the build's tags in the page as the HTML would, scripts run */
function loadPage() {
  for (const tag of heroShellTags({
    css: '.ns-hero{color:white}',
    poster: '/static/image/hole-desktop.1.webp',
    phonePoster: '/static/image/hole-phone.2.webp',
    posterAvif: '/static/image/hole-desktop.3.avif',
    phonePosterAvif: '/static/image/hole-phone.4.avif',
  })) {
    if (tag.tag === 'script') {
      new Function(tag.children)()
    } else {
      const el = document.createElement(tag.tag)
      for (const [k, v] of Object.entries(tag.attrs ?? {})) {
        el.setAttribute(k, v)
      }
      el.innerHTML = tag.children
      document.body.append(el)
    }
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  window.history.replaceState(null, '', '/')
})

describe('the first screen in the HTML', () => {
  it('shows on the home page', () => {
    loadPage()
    const shell = document.querySelector(`#${HERO_SHELL_ID}`)
    expect(shell).not.toBeNull()
    expect(shell?.querySelector('h1')).toHaveTextContent(HERO.title.join(' '))
    expect(shell?.querySelector('.ns-what')).toHaveTextContent(
      HERO.what.join(' ')
    )
    expect(shell?.querySelector('picture img')).toHaveAttribute(
      'src',
      '/static/image/hole-desktop.1.webp'
    )
    // AVIF where the browser takes it, phones first: the browser takes the first that fits
    expect(
      [...(shell?.querySelectorAll('picture source') ?? [])].map((source) => [
        source.getAttribute('media'),
        source.getAttribute('type'),
        source.getAttribute('srcset'),
      ])
    ).toEqual([
      [PHONE_POSTER_QUERY, 'image/avif', '/static/image/hole-phone.4.avif'],
      [PHONE_POSTER_QUERY, null, '/static/image/hole-phone.2.webp'],
      [null, 'image/avif', '/static/image/hole-desktop.3.avif'],
    ])
    expect(document.querySelector(`#${HERO_SHELL_STYLE_ID}`)).toHaveTextContent(
      '.ns-hero{color:white}'
    )
  })

  it('stays out when the docs lead here: their page holds until the app’s', () => {
    Object.defineProperty(document, 'referrer', {
      value: `${window.location.origin}/docs/quick-start/`,
      configurable: true,
    })
    try {
      loadPage()
      expect(document.querySelector(`#${HERO_SHELL_ID}`)).toBeNull()
    } finally {
      Object.defineProperty(document, 'referrer', {
        value: '',
        configurable: true,
      })
    }
  })

  it('stays out of every other page', () => {
    window.history.replaceState(null, '', '/pricing')
    loadPage()
    expect(document.querySelector(`#${HERO_SHELL_ID}`)).toBeNull()
    expect(document.querySelector(`#${HERO_SHELL_STYLE_ID}`)).toBeNull()
  })

  it('goes when the app shows its own page, its CSS too: later in the page, it would outrank the app\u2019s', () => {
    loadPage()
    dropHeroShell()
    expect(document.querySelector(`#${HERO_SHELL_ID}`)).toBeNull()
    expect(document.querySelector(`#${HERO_SHELL_STYLE_ID}`)).toBeNull()
  })

  it('leaves the title\u2019s font behind: the app\u2019s title is set in it', () => {
    for (const tag of heroShellTags({
      css: '',
      poster: '/p.webp',
      phonePoster: '/q.webp',
      posterAvif: '/p.avif',
      phonePosterAvif: '/q.avif',
      heroFont: 'AAAA',
    })) {
      if (tag.tag === 'script') new Function(tag.children)()
      else {
        const el = document.createElement(tag.tag)
        for (const [k, v] of Object.entries(tag.attrs ?? {})) {
          el.setAttribute(k, v)
        }
        el.innerHTML = tag.children
        document.body.append(el)
      }
    }
    dropHeroShell()
    const styles = [...document.querySelectorAll('body > style')]
    expect(styles.map((s) => s.textContent).join('')).toContain('AAAA')
  })

  it('escapes what would end its style early', () => {
    const [template] = heroShellTags({
      css: '.ns-hero{background:url("data:image/svg+xml,</style>")}',
      poster: '/p.webp',
      phonePoster: '/q.webp',
      posterAvif: '/p.avif',
      phonePosterAvif: '/q.avif',
    })
    expect(template.children).not.toContain('</style>")')
  })
})

describe('the first screen\u2019s own CSS', () => {
  it('keeps what the first screen shows and leaves the rest of the page out', () => {
    expect(
      firstScreenCss(
        '.ns-hero{color:red}.ns-gw-chip{color:blue}.ns-why{color:blue}html{color:blue}'
      )
    ).toBe('.ns-hero{color:red}')
  })

  it('goes selector by selector, brackets kept whole', () => {
    expect(firstScreenCss('.ns-hero a,.ns-endpoint{color:red}')).toBe(
      '.ns-hero a{color:red}'
    )
    expect(
      firstScreenCss('.ns-first:has(> .ns-sky-hole[data-ready]) .ns-sky{top:0}')
    ).toBe('.ns-first:has(> .ns-sky-hole[data-ready]) .ns-sky{top:0}')
    expect(firstScreenCss(':is(.ns-hero,.ns-first) p,.ns-why{top:0}')).toBe(
      ':is(.ns-hero,.ns-first) p{top:0}'
    )
  })

  it('goes inside media queries and drops the ones left empty', () => {
    expect(
      firstScreenCss(
        '@media (min-width:641px){.ns-first{top:0}.ns-why{top:1px}}@media print{.ns-why{top:1px}}'
      )
    ).toBe('@media (min-width:641px){.ns-first{top:0}}')
  })

  it('keeps the fonts and the words\u2019 way in, not the gateway\u2019s motion', () => {
    const face = "@font-face{font-family:'X';src:url(/x.woff2)}"
    const rise = '@keyframes ns-rise{from{opacity:.01}}'
    expect(
      firstScreenCss(`${face}${rise}@keyframes ns-gw-breathe{to{opacity:1}}`)
    ).toBe(`${face}${rise}`)
  })

  it('is not fooled by a bracket in a string', () => {
    expect(firstScreenCss('.ns-hero::before{content:"}"}.ns-why{top:0}')).toBe(
      '.ns-hero::before{content:"}"}'
    )
  })
})

describe('the app\u2019s stylesheet', () => {
  const load = (href = '/static/css/index.1.css') =>
    new Function(appStylesheetScript(href))()
  const writes: string[] = []

  beforeEach(() => {
    writes.length = 0
    vi.spyOn(document, 'write').mockImplementation((html) => {
      writes.push(String(html))
    })
    Reflect.deleteProperty(window, '__appCss')
  })

  it('does not hold the home page\u2019s first screen back', async () => {
    load()
    const link = document.head.querySelector<HTMLLinkElement>('link')
    expect(link).toHaveAttribute('href', '/static/css/index.1.css')
    expect(link).toHaveAttribute('rel', 'stylesheet')
    expect(writes).toEqual([])
    let done = false
    void window.__appCss?.then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)
    link?.dispatchEvent(new Event('load'))
    await window.__appCss
    expect(done).toBe(true)
  })

  it('tells the app when it failed too: the app goes on', async () => {
    load()
    document.head.querySelector('link')?.dispatchEvent(new Event('error'))
    await expect(window.__appCss).resolves.toBeDefined()
  })

  it('holds every other page as a stylesheet in the head does', () => {
    window.history.replaceState(null, '', '/pricing')
    load()
    expect(document.head.querySelector('link')).toBeNull()
    expect(window.__appCss).toBeUndefined()
    expect(writes).toEqual([
      '<link rel="stylesheet" href="/static/css/index.1.css">',
    ])
  })
})

describe('the night before the first screen', () => {
  const load = () => new Function(firstNightScript())()

  const barColour = () =>
    document.querySelector('meta[name=theme-color]')?.getAttribute('content')

  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#fff">'
  })

  it('dresses the page and the phone\u2019s bar from the first frame', () => {
    load()
    expect(document.querySelector('style')?.textContent).toContain('#04060d')
    expect(barColour()).toBe('#04060d')
  })

  it('goes with the first screen, with a class change the bar\u2019s colour follows', () => {
    load()
    expect(document.documentElement).toHaveClass('ns-first-night')
    dropHeroShell()
    expect(document.documentElement).not.toHaveClass('ns-first-night')
    expect(document.querySelector('style')).toBeNull()
  })

  it('stays off every other page', () => {
    window.history.replaceState(null, '', '/pricing')
    load()
    expect(document.querySelector('style')).toBeNull()
    expect(barColour()).toBe('#fff')
    expect(document.documentElement).not.toHaveClass('ns-first-night')
  })
})
