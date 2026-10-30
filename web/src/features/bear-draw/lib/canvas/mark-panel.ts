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
import { burnMarks, type Burned } from './burn'
import type { Ctx, MarkRec, NodeRec } from './context'
import { closest, elOf, esc, report } from './dom'
import { ICONS } from './icons'
import { markNode, pub } from './query'

/*
 * The 圈选 panel (top right while the tool is on): the numbered marks with
 * a note each, 清空 and 完成圈选, which hands the page the marked picture.
 */
export function createMarkPanel(c: Ctx) {
  const panel = c.d.panel
  let html = ''

  function header(n: NodeRec | null): string {
    const L = c.L
    const sub = n
      ? `<span class="bd-cv-pn-sub">${esc(n.label || L.thisPicture)}</span>`
      : ''
    return `<div class="bd-cv-pn-hd"><span class="bd-cv-pn-ic">${ICONS.lasso}</span><b>${esc(L.mark)}</b>${sub}<button type="button" class="bd-cv-pn-x" data-pn="close" title="${esc(L.exitMarkTip)}" aria-label="${esc(L.exitMark)}">${ICONS.x}</button></div>`
  }

  function body(n: NodeRec | null, marks: MarkRec[]): string {
    const L = c.L
    if (!n) return `<p class="bd-cv-pn-empty">${esc(L.markPickFirst)}</p>`
    if (!marks.length) {
      return `<p class="bd-cv-pn-empty">${esc(L.markEmpty)}</p>`
    }
    const items = marks.map(
      (m) =>
        `<li><span class="bd-cv-pn-n">${m.n}</span><input data-mk="${m.n}" value="${esc(m.note)}" placeholder="${esc(L.markNote)}" maxlength="80" aria-label="${esc(L.markNoteLabel(m.n))}"><button type="button" data-pn="del" data-n="${m.n}" title="${esc(L.markRemove)}" aria-label="${esc(L.markRemoveLabel(m.n))}">${ICONS.x}</button></li>`
    )
    return `<ol class="bd-cv-pn-list bd-cv-scroll">${items.join('')}</ol>`
  }

  function footer(marks: MarkRec[]): string {
    const L = c.L
    const off = marks.length ? '' : ' disabled'
    return `<div class="bd-cv-pn-ft"><button type="button" data-pn="clear"${off}>${esc(L.clear)}</button><button type="button" class="is-primary" data-pn="done"${off}>${ICONS.check}<span>${esc(L.markDone)}</span></button></div>`
  }

  function renderPanel() {
    const show = c.tool === 'mark'
    panel.hidden = !show
    if (!show) {
      html = ''
      return
    }
    const n = markNode(c)
    const marks = n ? n.marks : []
    if (n) c.fx.hideToast()
    const next = header(n) + body(n, marks) + footer(marks)
    if (next === html) return
    // Keep the caret in the note being typed when the panel is redrawn.
    const active = document.activeElement
    const typing =
      active instanceof HTMLInputElement && panel.contains(active)
        ? {
            mk: active.dataset.mk,
            a: active.selectionStart,
            b: active.selectionEnd,
          }
        : null
    html = next
    panel.innerHTML = next
    if (!typing?.mk) return
    const inp = panel.querySelector<HTMLInputElement>(
      `[data-mk="${typing.mk}"]`
    )
    if (!inp) return
    inp.focus({ preventScroll: true })
    inp.setSelectionRange(typing.a, typing.b)
  }

  async function marksDone(n: NodeRec, btn: HTMLButtonElement | null) {
    if (!n.marks.length) return
    if (btn) btn.disabled = true
    let res: Burned = { dataUrl: null, marksOnly: true }
    try {
      res = await burnMarks(n.src, n.w, n.h, n.marks)
    } catch (err) {
      report(err)
    }
    if (!c.alive) return
    const p = pub(n)
    c.fx.act('mark-done', {
      ids: [n.id],
      kind: 'image',
      node: p,
      nodes: [p],
      marks: p.marks,
      dataUrl: res.dataUrl,
      marksOnly: res.marksOnly,
    })
    c.fx.setTool('select')
  }

  panel.addEventListener('input', (e) => {
    const inp = elOf(e.target)
    const n = markNode(c)
    if (!(inp instanceof HTMLInputElement) || !inp.dataset.mk || !n) return
    const m = n.marks.find((x) => x.n === Number(inp.dataset.mk))
    if (!m) return
    m.note = inp.value
    c.fx.changed()
  })

  panel.addEventListener('keydown', (e) => {
    const t = elOf(e.target)
    if (e.key === 'Enter' && t instanceof HTMLInputElement && t.dataset.mk) {
      e.preventDefault()
      const next = t.closest('li')?.nextElementSibling?.querySelector('input')
      if (next) next.focus()
      else t.blur()
    } else if (e.key === 'Escape') {
      if (t instanceof HTMLElement) t.blur()
      c.d.el.focus({ preventScroll: true })
    }
  })

  panel.addEventListener('click', (e) => {
    const b = closest(e.target, '[data-pn]')
    if (!b) return
    const n = markNode(c)
    const k = b.dataset.pn
    if (k === 'close') {
      c.fx.setTool('select')
    } else if (k === 'clear') {
      c.fx.clearMarks()
    } else if (k === 'del' && n) {
      n.marks = n.marks.filter((m) => m.n !== Number(b.dataset.n))
      n.marks.forEach((m, i) => {
        m.n = i + 1
      })
      c.fx.renderMarks(n)
      renderPanel()
      c.fx.changed()
    } else if (k === 'done' && n) {
      void marksDone(n, b instanceof HTMLButtonElement ? b : null)
    }
  })

  return { renderPanel }
}
