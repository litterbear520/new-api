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
import type { Ctx } from './context'
import { closest, h, report } from './dom'
import { firstOf, measure, pub, pubG, pubNodes, selKind } from './query'
import type { ActionPayload, PublicNode } from './types'

/*
 * Actions from the toolbar, menus, keys and the 重试 button. The page's
 * onAction runs first; returning false skips the built-in behaviour.
 */

function download(n: PublicNode) {
  const src = n.src ?? ''
  const m =
    /^data:image\/(\w+)/.exec(src) ?? /\.(png|jpe?g|webp|gif)(\?|$)/i.exec(src)
  const ext = m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.png'
  const a = document.createElement('a')
  a.href = src
  a.download = (n.label || n.id).replaceAll(/[\\/:*?"<>|\s]+/g, '_') + ext
  document.body.append(a)
  a.click()
  a.remove()
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  return new Promise((resolve, reject) => {
    const ta = h('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.append(ta)
    ta.select()
    try {
      if (document.execCommand('copy')) resolve()
      else reject(new Error('Copy failed'))
    } catch (err) {
      reject(err)
    } finally {
      ta.remove()
    }
  })
}

export function createActions(c: Ctx) {
  const d = c.d

  /** What the action is about: the selection, unless `extra` says. */
  function payload(extra?: Partial<ActionPayload>): ActionPayload {
    const ids = [...c.sel]
    const kind = selKind(c)
    const p: ActionPayload = { ids, kind, nodes: [] }
    const g = kind === 'group' ? c.groups.get(ids[0]) : undefined
    if (g) {
      p.group = pubG(g)
      p.nodes = pubNodes(c, g.children)
    } else if (kind !== 'group') {
      p.nodes = pubNodes(c, ids)
      if (p.nodes.length === 1) p.node = p.nodes[0]
    }
    return { ...p, ...extra }
  }

  function act(id: string, extra?: Partial<ActionPayload>) {
    if (id === 'rename') {
      const gid = extra?.ids?.[0] ?? firstOf(c.sel)
      if (gid != null && c.groups.has(gid)) c.fx.startRename(gid)
      return
    }
    const p = payload(extra)
    let skip = false
    try {
      skip = c.o.onAction?.(id, p) === false
    } catch (err) {
      report(err)
    }
    if (skip || !c.alive) return
    builtin(id, p)
  }

  function builtin(id: string, p: ActionPayload) {
    switch (id) {
      case 'mark':
        c.fx.setTool('mark')
        break
      case 'compare':
        if (p.nodes.length === 2) c.fx.compare(p.nodes[0].id, p.nodes[1].id)
        else if (p.node) startPick(p.node.id)
        break
      case 'download':
        for (const n of p.nodes) if (n.status === 'ready' && n.src) download(n)
        break
      case 'copy-prompt': {
        const text = p.node?.meta.prompt
        if (!text) {
          c.fx.toast(c.L.noPrompt)
          break
        }
        copyText(text)
          .then(() => c.fx.toast(c.L.promptCopied))
          .catch(() => c.fx.toast(c.L.copyFailed))
        break
      }
      case 'more':
        c.fx.openMore(p)
        break
      case 'delete':
        for (const x of p.ids) c.fx.remove(x)
        break
      case 'fit':
        c.fx.focus(p.ids.length ? p.ids : 'all', { maxScale: 1 })
        break
      case 'fit-all':
        c.fx.fit()
        break
      case 'zoom-100':
        c.fx.zoomTo(1)
        break
      default:
        break
    }
  }

  /** 对比 with one picture: the next picture clicked is the other. */
  function startPick(id: string) {
    c.pick = id
    c.fx.toast(c.L.pickToCompare, 0)
    c.fx.invalidate()
  }

  function cancelPick() {
    c.pick = null
    c.fx.hideToast()
    c.fx.invalidate()
  }

  d.tb.addEventListener('click', (e) => {
    const b = closest(e.target, '[data-act]')
    if (!b) return
    measure(c)
    const r = b.getBoundingClientRect()
    const anchor = {
      x: r.left - c.rect.left + r.width / 2,
      y: r.bottom - c.rect.top + 6,
    }
    act(b.dataset.act ?? '', { anchor })
  })

  d.el.addEventListener('click', (e) => {
    const rb = closest(e.target, '[data-cv-retry]')
    const ne = rb?.closest<HTMLElement>('.bd-cv-node')
    const n = ne ? c.nodes.get(ne.dataset.cvId ?? '') : undefined
    if (!n) return
    const p = pub(n)
    act('retry', { ids: [n.id], kind: 'image', node: p, nodes: [p] })
  })

  return { act, startPick, cancelPick }
}
