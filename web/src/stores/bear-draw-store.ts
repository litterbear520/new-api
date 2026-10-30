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
import { create } from 'zustand'

import {
  DEFAULT_PREFS,
  MAX_COUNT,
  RATIOS,
  STORAGE_KEYS,
} from '@/features/bear-draw/constants'
import type {
  Attachment,
  BrandKit,
  LiveState,
  Mode,
  Prefs,
  Project,
  Skill,
} from '@/features/bear-draw/types'

/*
 * State of the drawing page (the design agent). Projects are written to
 * IndexedDB by features/bear-draw/hooks/use-persistence.ts; the agent and
 * the pictures run in features/bear-draw/lib/engine and keep going when the
 * user leaves the page, so this store is global.
 */

/** A message composed on the home page, sent once its project opens. */
export type Draft = {
  text: string
  mode: Mode
  refs: Attachment[]
  skillId?: string
  presetId?: string
}

type State = {
  uid: number | null
  loaded: boolean
  /** Newest first. */
  projects: Project[]
  /** Work in progress per project id (memory only). */
  live: Record<string, LiveState>
  prefs: Prefs
  brandKit: BrandKit | null
  mySkills: Skill[]
  favorites: string[]
  draft: Draft | null
}

type Actions = {
  init: (uid: number, projects: Project[]) => void
  putProject: (p: Project) => void
  updateProject: (id: string, fn: (p: Project) => Project) => void
  removeProject: (id: string) => void
  setLive: (id: string, live: LiveState | null) => void
  setPrefs: (patch: Partial<Prefs>) => void
  setBrandKit: (kit: BrandKit | null) => void
  putMySkill: (skill: Skill) => void
  removeMySkill: (id: string) => void
  toggleFavorite: (skillId: string) => void
  setDraft: (draft: Draft | null) => void
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or full storage: lasts for this visit.
  }
}

/** Per-account keys, so two accounts on one browser keep their own kits. */
const userKey = (key: string, uid: number | null) =>
  uid == null ? key : `${key}.${uid}`

export function readPrefs(): Prefs {
  const saved = readJson(STORAGE_KEYS.prefs) as Partial<Prefs> | null
  const p = { ...DEFAULT_PREFS, ...saved }
  return {
    mode: p.mode === 'image' ? 'image' : 'agent',
    brain:
      typeof p.brain === 'string' && p.brain ? p.brain : DEFAULT_PREFS.brain,
    image:
      typeof p.image === 'string' && p.image ? p.image : DEFAULT_PREFS.image,
    ratio: RATIOS.includes(p.ratio) ? p.ratio : DEFAULT_PREFS.ratio,
    count: Math.min(MAX_COUNT, Math.max(1, Math.round(Number(p.count) || 1))),
    transparent: p.transparent === true,
    brand: p.brand !== false,
  }
}

const byNewest = (a: Project, b: Project) => b.updatedAt - a.updatedAt

export const useBearDrawStore = create<State & Actions>()((set, get) => ({
  uid: null,
  loaded: false,
  projects: [],
  live: {},
  prefs: readPrefs(),
  brandKit: null,
  mySkills: [],
  favorites: [],
  draft: null,

  init: (uid, projects) =>
    set({
      uid,
      loaded: true,
      projects: [...projects].sort(byNewest),
      brandKit:
        (readJson(userKey(STORAGE_KEYS.brand, uid)) as BrandKit) ?? null,
      mySkills: (readJson(userKey(STORAGE_KEYS.skills, uid)) as Skill[]) ?? [],
      favorites:
        (readJson(userKey(STORAGE_KEYS.favorites, uid)) as string[]) ?? [],
    }),

  putProject: (p) =>
    set((s) => ({
      projects: [p, ...s.projects.filter((x) => x.id !== p.id)].sort(byNewest),
    })),

  updateProject: (id, fn) =>
    set((s) => {
      let changed = false
      const projects = s.projects.map((p) => {
        if (p.id !== id) return p
        const next = fn(p)
        if (next !== p) changed = true
        return next
      })
      return changed ? { projects: projects.sort(byNewest) } : s
    }),

  removeProject: (id) =>
    set((s) => {
      const live = { ...s.live }
      delete live[id]
      return { projects: s.projects.filter((p) => p.id !== id), live }
    }),

  setLive: (id, value) =>
    set((s) => {
      const live = { ...s.live }
      if (value) live[id] = value
      else delete live[id]
      return { live }
    }),

  setPrefs: (patch) => {
    const prefs = { ...get().prefs, ...patch }
    writeJson(STORAGE_KEYS.prefs, prefs)
    set({ prefs })
  },

  setBrandKit: (kit) => {
    writeJson(userKey(STORAGE_KEYS.brand, get().uid), kit)
    set({ brandKit: kit })
  },

  putMySkill: (skill) => {
    const mySkills = [skill, ...get().mySkills.filter((s) => s.id !== skill.id)]
    writeJson(userKey(STORAGE_KEYS.skills, get().uid), mySkills)
    set({ mySkills })
  },

  removeMySkill: (id) => {
    const mySkills = get().mySkills.filter((s) => s.id !== id)
    writeJson(userKey(STORAGE_KEYS.skills, get().uid), mySkills)
    set({ mySkills })
  },

  toggleFavorite: (skillId) => {
    const favs = get().favorites
    const favorites = favs.includes(skillId)
      ? favs.filter((x) => x !== skillId)
      : [skillId, ...favs]
    writeJson(userKey(STORAGE_KEYS.favorites, get().uid), favorites)
    set({ favorites })
  },

  setDraft: (draft) => set({ draft }),
}))

export function findProject(id: string | null | undefined): Project | null {
  if (!id) return null
  return useBearDrawStore.getState().projects.find((p) => p.id === id) ?? null
}

let seq = 0
/** Short unique ids for projects, messages, parts and canvas nodes. */
export function newId(prefix: string): string {
  seq = (seq + 1) % 1296
  return `${prefix}${Date.now().toString(36)}${seq.toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 5)}`
}
