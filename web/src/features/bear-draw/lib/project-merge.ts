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
import type { Project } from '../types'

/*
 * Two tabs can change the same stored project. When the stored copy moved
 * on since this tab read it, both sides' changes are merged if they touch
 * different things: field by field, and item by item in lists of things
 * with ids (messages, parts, canvas nodes, frames). Something changed on
 * both sides in different ways can't be merged.
 */

const CONFLICT = Symbol('conflict')

type Merged = unknown

type Fields = Record<string, unknown>

const isFields = (v: unknown): v is Fields =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Deep equality of stored data; a field set to undefined counts as absent. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((x, i) => sameValue(x, b[i]))
  }
  if (!isFields(a) || !isFields(b)) return false
  const ka = Object.keys(a).filter((k) => a[k] !== undefined)
  const kb = Object.keys(b).filter((k) => b[k] !== undefined)
  return ka.length === kb.length && ka.every((k) => sameValue(a[k], b[k]))
}

/** The ids of a list whose items all have a distinct string id, else null. */
function idsOf(list: unknown[]): string[] | null {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const x of list) {
    if (!isFields(x) || typeof x.id !== 'string' || seen.has(x.id)) return null
    seen.add(x.id)
    ids.push(x.id)
  }
  return ids
}

const byId = (list: unknown[]) =>
  new Map(list.map((x) => [(x as Fields).id as string, x]))

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

/** Order of the merged list: the side that moved or added things leads. */
function listOrder(
  base: string[],
  mine: string[],
  theirs: string[],
  kept: Map<string, unknown>
): string[] | null {
  const inBase = new Set(base)
  const survivors = (ids: string[]) => ids.filter((id) => kept.has(id))
  const old = (ids: string[]) => ids.filter((id) => inBase.has(id))
  const om = survivors(mine)
  const ot = survivors(theirs)
  const ob = survivors(base)
  const mineTouched = !sameOrder(old(om), ob) || old(om).length !== om.length
  const theirsTouched = !sameOrder(old(ot), ob) || old(ot).length !== ot.length
  if (!theirsTouched) return om
  if (!mineTouched) return ot
  return null
}

/** An item both sides added: fine only when it is the same item. */
const addedBoth = (mine: unknown, theirs: unknown): Merged =>
  sameValue(mine, theirs) ? mine : CONFLICT

function mergeLists(base: unknown[], mine: unknown[], theirs: unknown[]) {
  const b = idsOf(base)
  const m = idsOf(mine)
  const t = idsOf(theirs)
  if (!b || !m || !t) return CONFLICT
  const B = byId(base)
  const M = byId(mine)
  const T = byId(theirs)
  const kept = new Map<string, unknown>()
  for (const id of new Set([...b, ...m, ...t])) {
    if (M.has(id) && T.has(id)) {
      const v = B.has(id)
        ? merge3(B.get(id), M.get(id), T.get(id))
        : addedBoth(M.get(id), T.get(id))
      if (v === CONFLICT) return CONFLICT
      kept.set(id, v)
    } else if (M.has(id) || T.has(id)) {
      const side = M.has(id) ? M.get(id) : T.get(id)
      // Added on one side: kept. Deleted on one side: gone, unless the
      // other side changed it meanwhile.
      if (!B.has(id)) kept.set(id, side)
      else if (!sameValue(side, B.get(id))) return CONFLICT
    }
  }
  const order = listOrder(b, m, t, kept)
  if (!order) return CONFLICT
  const out = order.map((id) => kept.get(id))
  if (sameOrder(order, m) && out.every((x, i) => x === mine[i])) return mine
  return out
}

function mergeFields(base: Fields, mine: Fields, theirs: Fields) {
  const out: Fields = {}
  for (const k of new Set([
    ...Object.keys(base),
    ...Object.keys(mine),
    ...Object.keys(theirs),
  ])) {
    const v = merge3(base[k], mine[k], theirs[k])
    if (v === CONFLICT) return CONFLICT
    if (v !== undefined) out[k] = v
  }
  return out
}

function merge3(base: unknown, mine: unknown, theirs: unknown): Merged {
  // Mine first when theirs is unchanged, so untouched values keep their identity.
  if (sameValue(theirs, base) || sameValue(mine, theirs)) return mine
  if (sameValue(mine, base)) return theirs
  if (Array.isArray(base) && Array.isArray(mine) && Array.isArray(theirs)) {
    return mergeLists(base, mine, theirs)
  }
  if (isFields(base) && isFields(mine) && isFields(theirs)) {
    return mergeFields(base, mine, theirs)
  }
  return CONFLICT
}

/**
 * `mine` and `theirs` both started from `base`: one project holding both
 * sides' changes, or null when they changed the same thing differently.
 * Money spent adds up; the newer edit time wins.
 */
export function mergeProjects(
  base: Project,
  mine: Project,
  theirs: Project
): Project | null {
  const strip = (p: Project) => ({ ...p, cost: 0, updatedAt: 0 })
  const v = merge3(strip(base), strip(mine), strip(theirs))
  if (v === CONFLICT) return null
  return {
    ...(v as Project),
    cost: mine.cost + theirs.cost - base.cost,
    updatedAt: Math.max(mine.updatedAt, theirs.updatedAt),
  }
}

/**
 * The record to store for `cur`: this tab's own edits (fields that are no
 * longer the object it read) over the stored record `raw`. Fields it never
 * touched keep the stored value, so what loading settled for display (a
 * reply cut off by a closed page) is not written back.
 */
export function ownChanges(raw: Project, view: Project, cur: Project): Project {
  const out: Fields = { ...raw }
  const a = view as unknown as Fields
  const b = cur as unknown as Fields
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[k] === b[k]) continue
    if (b[k] === undefined) delete out[k]
    else out[k] = b[k]
  }
  return out as unknown as Project
}

/**
 * What this tab shows for a merged `record`: its own objects where the
 * record kept the stored value it read (`raw`, shown as `view`).
 */
export function shownAfterMerge(
  raw: Project,
  view: Project,
  record: Project
): Project {
  const r = raw as unknown as Fields
  const v = view as unknown as Fields
  const out: Fields = {}
  for (const [k, x] of Object.entries(record as unknown as Fields)) {
    out[k] = x === r[k] ? v[k] : x
  }
  return out as unknown as Project
}

/**
 * `latest` moved on from `prev` while `merged` (also from `prev`) was being
 * stored: `latest`'s newer edits on top of `merged`. A field both changed
 * keeps `latest`'s value; it is saved again with the next save.
 */
export function rebase(prev: Project, latest: Project, merged: Project) {
  const p = prev as unknown as Fields
  const l = latest as unknown as Fields
  const m = merged as unknown as Fields
  const out: Fields = {}
  for (const k of new Set([...Object.keys(l), ...Object.keys(m)])) {
    let v: unknown
    if (l[k] === p[k]) v = m[k]
    else {
      v = merge3(p[k], l[k], m[k])
      if (v === CONFLICT) v = l[k]
    }
    if (v !== undefined) out[k] = v
  }
  return out as unknown as Project
}
