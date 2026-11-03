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
  FIRST_NIGHT_ID,
  HERO,
  HERO_SHELL_ID,
  HERO_SHELL_STYLE_ID,
  PHONE_POSTER_QUERY,
  POSTER_FADE_MS,
  WORDS_FADE_MS,
} from './hero-copy'

export type HeroShellAssets = {
  /** The home page's built CSS (night-sea.css, black-hole.css and the rest of its chunk) */
  css: string
  /** The posters' addresses: computers, phones; each also in AVIF, a third smaller */
  poster: string
  phonePoster: string
  posterAvif: string
  phonePosterAvif: string
  /**
   * The title's font, its glyphs alone, as base64 woff2 (assets/fonts/
   * night-sea-hero.woff2): the title shows in it as soon as the HTML is in
   */
  heroFont?: string
}

/** The night the first screen stands on; the same as --ns-night (night-sea.css) */
const NIGHT = '#04060d'

/** The family that holds the title's glyphs (night-sea.css puts it first in --ns-serif) */
const HERO_FONT_FAMILY = 'Night Sea Hero'

/**
 * Where the HTML's first screen shows: the home page, unless the docs lead
 * here (their page holds until the app's: see SHOW below). The test as script.
 */
const SHELL_HERE = `(location.pathname === '/' && document.referrer.indexOf(location.origin + '/docs/') !== 0)`

/** What the first screen shows; what else the home page's CSS holds stays with the app */
const FIRST_SCREEN_CLASS =
  /^\.(night-sea|ns-(hole|first|sky|hero|phrase|what|actions|pill|shore|more))/

/** Where the block opened at `open` closes (a bracket in a string doesn't count) */
function closingBrace(css: string, open: number): number {
  let depth = 0
  let quote = ''
  for (let i = open; i < css.length; i++) {
    const c = css[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
    } else if (c === '"' || c === "'") quote = c
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i
  }
  return css.length
}

/** A selector list's selectors (a comma in brackets belongs to its selector) */
function selectorsOf(prelude: string): string[] {
  const out: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) {
      out.push(prelude.slice(from, i))
      from = i + 1
    }
  }
  out.push(prelude.slice(from))
  return out.map((s) => s.trim())
}

function onFirstScreen(selector: string): boolean {
  const classes = selector.match(/\.(night-sea|ns-[\w-]+)/g)
  return !!classes && classes.every((c) => FIRST_SCREEN_CLASS.test(c))
}

/**
 * The home page's CSS cut to what its first screen shows, which travels inside
 * the HTML. The whole of it comes with the app's page moments later.
 */
export function firstScreenCss(css: string): string {
  let out = ''
  let at = 0
  while (at < css.length) {
    const open = css.indexOf('{', at)
    if (open < 0) break
    const close = closingBrace(css, open)
    // statements without a block before it (@charset) don't count
    const prelude = css.slice(at, open).split(';').pop()?.trim() ?? ''
    const body = css.slice(open + 1, close)
    if (prelude === '@font-face') {
      out += `${prelude}{${body}}`
    } else if (prelude.startsWith('@keyframes')) {
      if (!prelude.includes('ns-gw')) out += `${prelude}{${body}}`
    } else if (/^@(media|supports|container|layer)\b/.test(prelude)) {
      const inner = firstScreenCss(body)
      if (inner) out += `${prelude}{${inner}}`
    } else if (!prelude.startsWith('@')) {
      const kept = selectorsOf(prelude).filter(onFirstScreen)
      if (kept.length) out += `${kept.join(',')}{${body}}`
    }
    at = close + 1
  }
  return out
}

const TEMPLATE_ID = 'ns-shell-tpl'

const escape = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')

const phrases = (pair: readonly string[]) =>
  pair.map((p) => `<span class="ns-phrase">${escape(p)}</span>`).join(' ')

/**
 * Only the shell's own: over the app's night (a loading screen), under its
 * site bar; held back at .01, not 0 (night-sea.css ns-rise: browsers skip
 * what is painted at 0 when they measure Largest Contentful Paint); the
 * scroll bar's room kept from the start, so the long page coming in under it
 * does not narrow the screen; the few things the app's stylesheet does for
 * every page (its reset), for the moments before it is in: not a pixel moves
 * when it comes
 */
const SHELL_CSS = `
html:has(#${HERO_SHELL_ID}){overflow-x:hidden;overflow-y:scroll;scrollbar-width:thin;scrollbar-color:rgba(233,236,243,.16) transparent;background:${NIGHT}}
body:has(#${HERO_SHELL_ID}){margin:0}
:where(#${HERO_SHELL_ID},#${HERO_SHELL_ID} *){box-sizing:border-box;margin:0;padding:0;border:0 solid}
:where(#${HERO_SHELL_ID}) h1{font-size:inherit;font-weight:inherit}
:where(#${HERO_SHELL_ID}) a{color:inherit;text-decoration:inherit}
:where(#${HERO_SHELL_ID}) :is(img,svg){display:block}
#${HERO_SHELL_ID}{position:absolute;top:0;left:0;right:0;z-index:1}
#${HERO_SHELL_ID} .ns-hero{transition:opacity ${WORDS_FADE_MS}ms}
#${HERO_SHELL_ID}.ns-shell-wait .ns-hero{opacity:.01}
#${HERO_SHELL_ID} .ns-sky-poster img{opacity:.01;transition:opacity ${POSTER_FADE_MS}ms ease-out}
#${HERO_SHELL_ID} .ns-sky-poster img.ns-in{opacity:1}`

/** The markup NightSeaHome renders for its first screen  */
export function heroShellMarkup(
  assets: Omit<HeroShellAssets, 'css' | 'heroFont'>
) {
  return `<div id="${HERO_SHELL_ID}" lang="zh-CN" class="night-sea ns-hole"><main><section class="ns-first">\
<picture class="ns-sky ns-sky-poster"><source media="${PHONE_POSTER_QUERY}" type="image/avif" srcset="${escape(assets.phonePosterAvif)}">\
<source media="${PHONE_POSTER_QUERY}" srcset="${escape(assets.phonePoster)}">\
<source type="image/avif" srcset="${escape(assets.posterAvif)}">\
<img src="${escape(assets.poster)}" alt="" fetchpriority="high"></picture>\
<div class="ns-sky-fade" aria-hidden="true"></div>\
<div class="ns-hero"><h1>${phrases(HERO.title)}</h1>\
<p class="ns-what">${phrases(HERO.what)}</p>\
<div class="ns-actions"><a href="/sign-up" class="ns-pill ns-pill-solid">${escape(HERO.start)}</a>\
<a href="/docs/" class="ns-pill ns-pill-quiet">${escape(HERO.docs)}</a></div></div>\
<div class="ns-shore">\
<a href="#ns-more" class="ns-more" aria-label="${escape(HERO.more)}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5"></path></svg></a></div>\
</section></main></div>`
}

// From the docs, none: the browser keeps their page and its site bar on screen
// until the app's comes, and a first screen without the bar would cut that short.
// On the home page (nothing holds it back: appStylesheetScript): the template
// into the page, the line's own address in it, the words held back the moment
// their font takes, which comes inside the HTML (at most 1.5 s if it fails), so
// they don't change face, and the poster held back until all of it can show
// (not drawn in as it comes), then faded up.
// For the app taking over (performance.now()): data-at, when the screen went
// in (its words' way in started); data-words, when they showed; the poster's
// data-in, when it came up.
const SHOW = `(function () {
  try {
    if (!${SHELL_HERE}) return
    var tpl = document.getElementById('${TEMPLATE_ID}')
    if (!tpl || !tpl.content) return
    var frag = tpl.content.cloneNode(true)
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
      document.fonts.load('1em "${HERO_FONT_FAMILY}"', ${JSON.stringify(HERO.title[0])}).then(shown, shown)
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

/**
 * The app's stylesheet, in place of its tag in the head. On the home page it
 * doesn't hold the first screen back, which brings its own CSS: it loads beside
 * it, and the app waits for it (window.__appCss, main.tsx). Every other page
 * has nothing to show without it: it holds them as a tag in the head does.
 */
export function appStylesheetScript(href: string): string {
  return `(function (href) {
  if (${SHELL_HERE}) {
    var link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.fetchPriority = 'low'
    window.__appCss = new Promise(function (done) {
      link.onload = link.onerror = done
    })
    document.head.appendChild(link)
  } else {
    document.write('<link rel="stylesheet" href="' + href + '">')
  }
})(${JSON.stringify(href)})`
}

/**
 * First in the head: the page and the phone's bar stand on the night from the
 * first frame, not on white until the first screen is in. dropHeroShell takes it
 * away with a class change, which the bar's colour follows (use-theme-color-meta.ts).
 */
export function firstNightScript(): string {
  return `(function () {
  if (!${SHELL_HERE}) return
  document.documentElement.classList.add('${FIRST_NIGHT_ID}')
  var style = document.createElement('style')
  style.id = '${FIRST_NIGHT_ID}'
  style.textContent = '.${FIRST_NIGHT_ID},.${FIRST_NIGHT_ID} body{background:${NIGHT}}'
  document.head.appendChild(style)
  var bar = document.querySelector('meta[name=theme-color]')
  if (bar) bar.setAttribute('content', '${NIGHT}')
})()`
}

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
  const face = assets.heroFont
    ? `@font-face{font-family:"${HERO_FONT_FAMILY}";src:url(data:font/woff2;base64,${assets.heroFont}) format("woff2");font-weight:400 600;font-display:block}`
    : ''
  // the font stays when the first screen goes, for the app's title: dropHeroShell
  const style = `<style>${face}</style><style id="${HERO_SHELL_STYLE_ID}">${firstScreenCss(css)}${SHELL_CSS}</style>`
  return [
    {
      tag: 'template',
      attrs: { id: TEMPLATE_ID },
      children: style + heroShellMarkup(assets),
    },
    { tag: 'script', children: SHOW },
  ]
}
