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
import type { Ctx, MenuAt } from './context'
import { closest, esc, h, translate } from './dom'
import { clamp } from './geometry'
import { ICONS } from './icons'
import { measure } from './query'
import type { MenuItem } from './types'
import { TOOLS } from './ui'

/* Pop-up menus (right click, ⋯, zoom) and the bottom bars' buttons. */

/** Drops separators at the ends and doubled ones. */
export function tidyMenu(items: MenuItem[]): MenuItem[] {
  const out: MenuItem[] = []
  for (const it of items) {
    if (it.sep && (!out.length || out.at(-1)?.sep)) continue
    out.push(it)
  }
  while (out.at(-1)?.sep) out.pop()
  return out
}

/** Arrow keys, Home and End move between the menu's items. */
function menuKeys(m: HTMLElement, e: KeyboardEvent) {
  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(e.key)) return
  e.preventDefault()
  const items = [
    ...m.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
  ]
  if (!items.length) return
  const active = document.activeElement
  const at = active instanceof HTMLButtonElement ? items.indexOf(active) : -1
  let next = 0
  if (e.key === 'End') next = items.length - 1
  else if (e.key === 'ArrowDown') next = (at + 1) % items.length
  else if (e.key === 'ArrowUp') next = (at - 1 + items.length) % items.length
  items[next]?.focus()
}

export function createMenus(c: Ctx) {
  const d = c.d

  function closeMenu() {
    if (!c.menuEl) return
    c.menuEl.remove()
    c.menuEl = null
  }

  function menuButton(it: Exclude<MenuItem, { sep: true }>) {
    const icon = it.icon ?? '<span class="bd-cv-i"></span>'
    const kbd = it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ''
    const cls = `bd-cv-menu-item${it.danger ? ' is-danger' : ''}`
    const b = h('button', cls, `${icon}<span>${esc(it.label)}</span>${kbd}`)
    b.type = 'button'
    b.setAttribute('role', 'menuitem')
    if (it.disabled) b.disabled = true
    b.addEventListener('click', () => {
      closeMenu()
      if (it.run) it.run()
      else if (it.id) c.fx.act(it.id, it.payload)
    })
    return b
  }

  /** Opens a menu at a canvas point; `key` names it (toggle buttons). */
  function openMenu(
    items: MenuItem[],
    at: MenuAt,
    head?: HTMLElement | null,
    key?: string
  ) {
    closeMenu()
    const list = tidyMenu(items)
    if (!list.length) return
    const m = h('div', 'bd-cv-menu')
    m.setAttribute('role', 'menu')
    if (key) m.dataset.k = key
    if (head) m.append(head)
    for (const it of list) {
      if (it.sep) {
        const sep = h('div', 'bd-cv-menu-sep')
        sep.setAttribute('role', 'separator')
        m.append(sep)
      } else {
        m.append(menuButton(it))
      }
    }
    m.addEventListener('keydown', (e) => menuKeys(m, e))
    d.ui.append(m)
    const mw = m.offsetWidth
    const mh = m.offsetHeight
    let x = at.x
    let y = at.y
    if (at.align === 'center') x -= mw / 2
    else if (at.align === 'right') x -= mw
    if (at.above) y -= mh
    if (y + mh > c.H - 8) y = Math.max(8, at.y - mh - 12)
    m.style.transform = translate(
      clamp(x, 8, c.W - mw - 8),
      clamp(y, 8, c.H - mh - 8)
    )
    c.menuEl = m
    m.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus({
      preventScroll: true,
    })
  }

  function zoomMenu(btn: HTMLElement) {
    if (c.menuEl?.dataset.k === 'zoom') {
      closeMenu()
      return
    }
    const L = c.L
    const r = btn.getBoundingClientRect()
    measure(c)
    const items: MenuItem[] = [
      { label: L.zoomIn, icon: ICONS.plus, kbd: '+', run: c.fx.zoomIn },
      { label: L.zoomOut, icon: ICONS.minus, kbd: '−', run: c.fx.zoomOut },
      { sep: true },
      { label: L.fitAll, icon: ICONS.scan, kbd: '⇧1', run: c.fx.fit },
      {
        label: L.fitSelection,
        icon: ICONS.scan,
        kbd: '⇧2',
        run: () => c.fx.focus([...c.sel]),
        disabled: !c.sel.size,
      },
      {
        label: '100%',
        icon: ICONS.image,
        kbd: '⇧0',
        run: () => c.fx.zoomTo(1),
      },
    ]
    const at: MenuAt = {
      x: r.right - c.rect.left,
      y: r.top - c.rect.top - 8,
      align: 'right',
      above: true,
    }
    openMenu(items, at, null, 'zoom')
  }

  d.ui.addEventListener('click', (e) => {
    const b = closest(e.target, 'button')
    if (!b || !d.ui.contains(b)) return
    if (b.closest('.bd-cv-panel, .bd-cv-menu, .bd-cv-cmp')) return
    const tool = TOOLS.find((t) => t === b.dataset.tool)
    if (tool) {
      c.fx.setTool(tool)
      return
    }
    const k = b.dataset.ui
    if (k === 'upload') c.fx.act('upload', {})
    else if (k === 'mini') c.fx.setMini(!c.miniOn)
    else if (k === 'zoom') zoomMenu(b)
  })

  return { closeMenu, openMenu }
}
