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
import type { CompareState, Ctx, NodeRec } from './context'
import { elOf, esc, h, reduced } from './dom'
import { clamp } from './geometry'
import { ICONS } from './icons'

/*
 * 对比 two pictures over the canvas: a slider when they have the same
 * shape (drag the line, ← → nudge), side by side otherwise.
 */

function setDivider(box: HTMLElement, p: number) {
  box.style.setProperty('--bd-cv-p', `${p * 100}%`)
  box.setAttribute('aria-valuenow', String(Math.round(p * 100)))
}

export function createCompare(c: Ctx) {
  function bar(A: NodeRec, B: NodeRec, same: boolean): string {
    const L = c.L
    const names = `<span class="bd-cv-cmp-names"><i>A</i>${esc(A.label || 'A')}<i>B</i>${esc(B.label || 'B')}</span>`
    const seg = same
      ? `<div class="bd-cv-seg" role="tablist"><button type="button" role="tab" data-m="slide">${esc(L.slide)}</button><button type="button" role="tab" data-m="side">${esc(L.sideBySide)}</button></div>`
      : ''
    const close = `<button type="button" class="bd-cv-cmp-x" title="${esc(L.closeTip)}" aria-label="${esc(L.closeCompare)}">${ICONS.x}</button>`
    return `<div class="bd-cv-cmp-bar"><b>${esc(L.compare)}</b>${names}${seg}${close}</div>`
  }

  function compare(a: string, b: string) {
    const A = c.nodes.get(String(a))
    const B = c.nodes.get(String(b))
    if (!A || !B) return
    if (A.status !== 'ready' || B.status !== 'ready') {
      c.fx.toast(c.L.bothReady)
      return
    }
    closeCompare(true)
    c.fx.closeMenu()
    c.fx.cancelPick()
    const ra = A.w / A.h
    const rb = B.w / B.h
    const same = Math.abs(ra - rb) / ra < 0.02
    const el = h('div', 'bd-cv-cmp')
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-label', c.L.compareTitle)
    el.innerHTML = `${bar(A, B, same)}<div class="bd-cv-cmp-stage"></div><div class="bd-cv-cmp-hint"></div>`
    c.d.ui.append(el)
    const cm: CompareState = {
      el,
      A,
      B,
      same,
      mode: same ? 'slide' : 'side',
      p: 0.5,
    }
    c.cmp = cm
    el.addEventListener('pointerdown', (e) => {
      const t = elOf(e.target)
      if (t === el || t?.classList.contains('bd-cv-cmp-stage')) closeCompare()
    })
    el.querySelector('.bd-cv-cmp-x')?.addEventListener('click', () =>
      closeCompare()
    )
    for (const btn of el.querySelectorAll<HTMLElement>('[data-m]')) {
      btn.addEventListener('click', () => {
        cm.mode = btn.dataset.m === 'side' ? 'side' : 'slide'
        renderCompare()
      })
    }
    renderCompare()
    c.d.tb.classList.remove('is-on')
    c.fx.invalidate()
  }

  function renderSlide(
    cm: CompareState,
    stage: HTMLElement,
    sw: number,
    sh: number
  ) {
    const { A, B } = cm
    const r = A.w / A.h
    let bw = sw
    let bh = bw / r
    if (bh > sh) {
      bh = sh
      bw = bh * r
    }
    const L = c.L
    stage.innerHTML = `<div class="bd-cv-cmp-box" style="width:${bw}px;height:${bh}px;--bd-cv-p:${cm.p * 100}%" tabindex="0" role="slider" aria-label="${esc(L.divider)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(cm.p * 100)}"><img class="bd-cv-cmp-b" alt="" draggable="false" src="${esc(B.src)}"><img class="bd-cv-cmp-a" alt="" draggable="false" src="${esc(A.src)}"><span class="bd-cv-cmp-tag is-a">A · ${esc(A.label)}</span><span class="bd-cv-cmp-tag is-b">B · ${esc(B.label)}</span><div class="bd-cv-cmp-line"></div><div class="bd-cv-cmp-knob">${ICONS.chevL}${ICONS.chevR}</div></div>`
    const box = stage.firstElementChild
    if (!(box instanceof HTMLElement)) return
    const setP = (clientX: number) => {
      const rr = box.getBoundingClientRect()
      if (!rr.width) return
      cm.p = clamp((clientX - rr.left) / rr.width, 0, 1)
      setDivider(box, cm.p)
    }
    box.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      try {
        box.setPointerCapture(e.pointerId)
      } catch {
        // The pointer may already be gone.
      }
      box.classList.add('is-drag')
      setP(e.clientX)
    })
    box.addEventListener('pointermove', (e) => {
      if (box.hasPointerCapture(e.pointerId)) setP(e.clientX)
    })
    box.addEventListener('pointerup', () => box.classList.remove('is-drag'))
  }

  function renderSide(
    cm: CompareState,
    stage: HTMLElement,
    sw: number,
    sh: number
  ) {
    const half = (sw - 24) / 2
    const fig = (n: NodeRec, k: string) => {
      const r = n.w / n.h
      let w = half
      let hh = w / r
      if (hh > sh - 28) {
        hh = sh - 28
        w = hh * r
      }
      return `<figure class="bd-cv-cmp-fig"><div class="bd-cv-cmp-img" style="width:${w}px;height:${hh}px"><img alt="" draggable="false" src="${esc(n.src)}"></div><figcaption><i>${k}</i>${esc(n.label)} <span>${n.w} × ${n.h}</span></figcaption></figure>`
    }
    stage.innerHTML = `<div class="bd-cv-cmp-side">${fig(cm.A, 'A')}${fig(cm.B, 'B')}</div>`
  }

  function renderCompare() {
    const cm = c.cmp
    if (!cm) return
    for (const b of cm.el.querySelectorAll<HTMLElement>('[data-m]')) {
      const on = b.dataset.m === cm.mode
      b.classList.toggle('is-on', on)
      b.setAttribute('aria-selected', String(on))
    }
    const stage = cm.el.querySelector<HTMLElement>('.bd-cv-cmp-stage')
    const hint = cm.el.querySelector('.bd-cv-cmp-hint')
    if (!stage || !hint) return
    // The bar sits lower when the host covers the top (--bd-cv-inset-top).
    const inset = getComputedStyle(c.d.el).getPropertyValue('--bd-cv-inset-top')
    const lower = Math.max(0, (Number.parseFloat(inset) || 16) - 16)
    const sw = Math.max(120, c.W - 96)
    const sh = Math.max(120, c.H - 150 - lower)
    hint.textContent = cm.mode === 'slide' ? c.L.slideHint : c.L.escClose
    if (cm.mode === 'slide') renderSlide(cm, stage, sw, sh)
    else renderSide(cm, stage, sw, sh)
  }

  function closeCompare(instant?: boolean) {
    const cm = c.cmp
    if (!cm) return
    c.cmp = null
    if (instant || reduced()) {
      cm.el.remove()
    } else {
      cm.el.classList.add('is-out')
      window.setTimeout(() => cm.el.remove(), 180)
    }
    c.tbKey = ''
    c.fx.invalidate()
  }

  function nudgeCompare(delta: number) {
    const cm = c.cmp
    if (!cm || cm.mode !== 'slide') return
    cm.p = clamp(cm.p + delta, 0, 1)
    const box = cm.el.querySelector<HTMLElement>('.bd-cv-cmp-box')
    if (box) setDivider(box, cm.p)
  }

  return { compare, renderCompare, closeCompare, nudgeCompare }
}
