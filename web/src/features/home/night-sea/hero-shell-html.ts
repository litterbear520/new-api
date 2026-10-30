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
// The HTML of the home page's first screen (hero-copy.ts), built with the
// page: rsbuild.config.ts calls heroShellTags with the built home CSS and
// the posters' addresses. It is a template, put into the page by a small
// script on the home page only (every page is served the same index.html).
// Plain strings, no imports from the app: the build reads this file.
import {
  HERO,
  HERO_SHELL_ID,
  HERO_SHELL_STYLE_ID,
  POSTER_FADE_MS,
  WORDS_FADE_MS,
} from './hero-copy'

export type HeroShellAssets = {
  /** The home page's built CSS (night-sea.css, black-hole.css and the rest of its chunk) */
  css: string
  /** The posters' addresses: computers, phones */
  poster: string
  phonePoster: string
}

const TEMPLATE_ID = 'ns-shell-tpl'

const escape = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')

const phrases = (pair: readonly string[]) =>
  pair.map((p) => `<span class="ns-phrase">${escape(p)}</span>`).join(' ')

/**
 * Only the shell's own: over the app's night (a loading screen), under its
 * site bar; held back at .01, not 0 (night-sea.css ns-rise: browsers skip
 * what is painted at 0 when they measure Largest Contentful Paint); no
 * poster where the engine keeps the window's own frame (black-hole.css); the
 * scroll bar's room kept from the start, so the long page coming in under it
 * does not narrow the screen
 */
const SHELL_CSS = `
html:has(#${HERO_SHELL_ID}){overflow-y:scroll}
#${HERO_SHELL_ID}{position:absolute;top:0;left:0;right:0;z-index:1}
#${HERO_SHELL_ID} .ns-hero{transition:opacity ${WORDS_FADE_MS}ms}
#${HERO_SHELL_ID}.ns-shell-wait .ns-hero{opacity:.01}
#${HERO_SHELL_ID} .ns-sky-poster img{opacity:.01;transition:opacity ${POSTER_FADE_MS}ms ease-out}
#${HERO_SHELL_ID} .ns-sky-poster img.ns-in{opacity:1}
@media (min-width:641px) and (max-aspect-ratio:6/5) and (prefers-reduced-motion:no-preference){#${HERO_SHELL_ID} .ns-sky-poster{display:none}}`

/** The markup NightSeaHome renders for its first screen (the offer's place kept empty: it needs the app) */
export function heroShellMarkup(
  assets: Pick<HeroShellAssets, 'poster' | 'phonePoster'>
) {
  return `<div id="${HERO_SHELL_ID}" class="night-sea ns-hole"><main><section class="ns-first">\
<picture class="ns-sky ns-sky-poster"><source media="(max-width: 640px)" srcset="${escape(assets.phonePoster)}">\
<img src="${escape(assets.poster)}" alt="" fetchpriority="high"></picture>\
<div class="ns-sky-fade" aria-hidden="true"></div>\
<div class="ns-hero"><div class="ns-offer-slot"></div><h1>${phrases(HERO.title)}</h1>\
<p class="ns-poem">${phrases(HERO.poem)}</p>\
<p class="ns-what">${phrases(HERO.what)}</p>\
<div class="ns-actions"><a href="/sign-up" class="ns-pill ns-pill-solid">${escape(HERO.start)}</a>\
<a href="/docs/" class="ns-pill ns-pill-quiet">${escape(HERO.docs)}</a></div>\
<div class="ns-endpoint"><code translate="no"></code><button type="button">复制</button></div></div>\
<div class="ns-shore"><p class="ns-prayer">${escape(HERO.prayer)}</p>\
<a href="#ns-more" class="ns-more" aria-label="${escape(HERO.more)}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5"></path></svg></a></div>\
</section></main></div>`
}

// From the docs, none: the browser keeps their page and its site bar on screen
// until the app's comes, and a first screen without the bar would cut that short.
// On the home page (it runs once the page's stylesheet is in, as a script after
// one does, so the poster it fetches takes nothing from the stylesheet): the
// template into the page, the line's own address in it,
// the words held back until their font is in (at most 1.5 s), so they don't
// change face as it arrives, and the poster held back until all of it can
// show (not drawn in as it comes), then faded up.
// For the app taking over (performance.now()): data-at, when the screen went
// in (its words' way in started); data-words, when they showed; the poster's
// data-in, when it came up.
const SHOW = `(function () {
  try {
    if (location.pathname !== '/') return
    if (document.referrer.indexOf(location.origin + '/docs/') === 0) return
    var tpl = document.getElementById('${TEMPLATE_ID}')
    if (!tpl || !tpl.content) return
    var frag = tpl.content.cloneNode(true)
    var code = frag.querySelector('.ns-endpoint code')
    if (code) code.textContent = location.origin + '/v1'
    document.body.appendChild(frag)
    var shell = document.getElementById('${HERO_SHELL_ID}')
    if (shell) shell.dataset.at = shell.dataset.words = String(performance.now())
    if (shell && document.fonts && document.fonts.load) {
      shell.classList.add('ns-shell-wait')
      var shown = function () {
        if (!shell.classList.contains('ns-shell-wait')) return
        shell.dataset.words = String(performance.now())
        shell.classList.remove('ns-shell-wait')
      }
      setTimeout(shown, 1500)
      document.fonts.load('1em "Night Sea Serif"').then(shown, shown)
    }
    var img = shell && shell.querySelector('.ns-sky-poster img')
    if (img) {
      var lit = function () {
        img.dataset.in = String(performance.now())
        img.classList.add('ns-in')
      }
      var ready = function () {
        if (img.decode) img.decode().then(lit, lit)
        else lit()
      }
      if (img.complete && img.naturalWidth) ready()
      else img.addEventListener('load', ready)
    }
  } catch (e) {}
})()`

/** An HTML tag as the build takes it (rsbuild's modifyHTMLTags) */
export type ShellTag = {
  tag: string
  attrs?: Record<string, string>
  children: string
}

/** The template and the script that shows it, as the build's HTML tags */
export function heroShellTags(assets: HeroShellAssets): ShellTag[] {
  // a style inside a template applies only once the template is put in the page
  // nothing in the CSS may end the style element early
  const css = assets.css.replaceAll('</style', '<\\/style')
  const style = `<style id="${HERO_SHELL_STYLE_ID}">${css}${SHELL_CSS}</style>`
  return [
    {
      tag: 'template',
      attrs: { id: TEMPLATE_ID },
      children: style + heroShellMarkup(assets),
    },
    { tag: 'script', children: SHOW },
  ]
}
