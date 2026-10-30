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
import { afterEach, describe, expect, it } from 'vitest'

import { HERO, HERO_SHELL_ID, HERO_SHELL_STYLE_ID } from '../hero-copy'
import { dropHeroShell } from '../hero-shell'
import { heroShellTags } from '../hero-shell-html'

/** Puts the build's tags in the page as the HTML would, scripts run */
function loadPage() {
  for (const tag of heroShellTags({
    css: '.ns-hero{color:white}',
    poster: '/static/image/hole-desktop.1.webp',
    phonePoster: '/static/image/hole-phone.2.webp',
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
  it('shows on the home page, with the line’s own address', () => {
    loadPage()
    const shell = document.querySelector(`#${HERO_SHELL_ID}`)
    expect(shell).not.toBeNull()
    expect(shell?.querySelector('h1')).toHaveTextContent(HERO.title.join(' '))
    expect(shell?.querySelector('.ns-endpoint code')).toHaveTextContent(
      `${window.location.origin}/v1`
    )
    expect(shell?.querySelector('picture img')).toHaveAttribute(
      'src',
      '/static/image/hole-desktop.1.webp'
    )
    expect(shell?.querySelector('picture source')).toHaveAttribute(
      'srcset',
      '/static/image/hole-phone.2.webp'
    )
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

  it('goes when the app shows its own page; its style stays, with the font it brought', () => {
    loadPage()
    dropHeroShell()
    expect(document.querySelector(`#${HERO_SHELL_ID}`)).toBeNull()
    expect(document.querySelector(`#${HERO_SHELL_STYLE_ID}`)).not.toBeNull()
  })

  it('escapes what would end its style early', () => {
    const [template] = heroShellTags({
      css: '.x{background:url("data:image/svg+xml,</style>")}',
      poster: '/p.webp',
      phonePoster: '/q.webp',
    })
    expect(template.children).not.toContain('</style>")')
  })
})
