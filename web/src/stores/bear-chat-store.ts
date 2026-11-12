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

import { readSettings, writeSettings } from '@/features/bear-chat/lib/storage'
import type {
  ChatParams,
  ChatSettings,
  Conversation,
} from '@/features/bear-chat/types'

/*
 * State of the chat page. Conversations are written to IndexedDB by
 * features/bear-chat/hooks/use-chat-persistence.ts; replies stream from
 * features/bear-chat/lib/run.ts and keep going if the user leaves the page,
 * so this store is global.
 */

export type PanelView = 'preview' | 'code'
export type PanelDevice = 'desk' | 'phone'

export type PanelState = {
  open: boolean
  /** The artifact on show. */
  artId: string | null
  view: PanelView
  device: PanelDevice
  max: boolean
  /** The user closed it during this reply: don't pop it open again. */
  dismissed: string | null
}

export type LiveReply = {
  convId: string
  turnId: string
  replyId: string
  /** How it started: a new message, a retry, or an edited message. */
  kind: 'send' | 'retry' | 'edit'
}

export const DEFAULT_PARAMS: ChatParams = {
  temperature: null,
  top_p: null,
  max_tokens: null,
  effort: null,
}

function initialSettings(): ChatSettings {
  const saved = readSettings()
  return {
    model: typeof saved.model === 'string' ? saved.model : '',
    group: typeof saved.group === 'string' ? saved.group : '',
    params: { ...DEFAULT_PARAMS, ...saved.params },
    mood: saved.mood === 'quiet' || saved.mood === 'hide' ? saved.mood : 'live',
    panelW: typeof saved.panelW === 'number' ? saved.panelW : 0,
  }
}

type ChatState = {
  uid: number | null
  loaded: boolean
  /** Newest first. */
  convs: Conversation[]
  /** null = the new-conversation page. */
  curId: string | null
  /** System prompt typed on the new-conversation page. */
  draftSystem: string
  settings: ChatSettings
  live: LiveReply | null
  panel: PanelState
}

type ChatActions = {
  init: (uid: number, convs: Conversation[]) => void
  select: (id: string | null) => void
  putConv: (conv: Conversation) => void
  updateConv: (id: string, fn: (conv: Conversation) => Conversation) => void
  removeConv: (id: string) => void
  setDraftSystem: (text: string) => void
  setSettings: (patch: Partial<ChatSettings>) => void
  setParams: (patch: Partial<ChatParams>) => void
  setLive: (live: LiveReply | null) => void
  openPanel: (artId: string, patch?: Partial<PanelState>) => void
  closePanel: (dismissed?: string | null) => void
  setPanel: (patch: Partial<PanelState>) => void
}

const byNewest = (a: Conversation, b: Conversation) => b.updatedAt - a.updatedAt

export const useBearChatStore = create<ChatState & ChatActions>()((set) => ({
  uid: null,
  loaded: false,
  convs: [],
  curId: null,
  draftSystem: '',
  settings: initialSettings(),
  live: null,
  panel: {
    open: false,
    artId: null,
    view: 'preview',
    device: 'desk',
    max: false,
    dismissed: null,
  },

  init: (uid, convs) =>
    set((s) => ({
      uid,
      loaded: true,
      convs: [...convs].sort(byNewest),
      curId: null,
      // Another account on this browser: nothing of the last one carries over
      // (an unsent system prompt would go out in the new account's chat).
      ...(s.uid !== null && s.uid !== uid
        ? {
            draftSystem: '',
            live: null,
            panel: {
              ...s.panel,
              open: false,
              max: false,
              artId: null,
              dismissed: null,
            },
          }
        : {}),
    })),

  select: (id) =>
    set((s) => ({
      curId: id,
      panel: {
        ...s.panel,
        open: false,
        max: false,
        artId: null,
        dismissed: null,
      },
    })),

  putConv: (conv) =>
    set((s) => {
      const rest = s.convs.filter((c) => c.id !== conv.id)
      return { convs: [conv, ...rest].sort(byNewest) }
    }),

  updateConv: (id, fn) =>
    set((s) => {
      let changed = false
      const convs = s.convs.map((c) => {
        if (c.id !== id) return c
        const next = fn(c)
        if (next !== c) changed = true
        return next
      })
      return changed ? { convs: convs.sort(byNewest) } : {}
    }),

  removeConv: (id) =>
    set((s) => ({
      convs: s.convs.filter((c) => c.id !== id),
      curId: s.curId === id ? null : s.curId,
    })),

  setDraftSystem: (draftSystem) => set({ draftSystem }),

  setSettings: (patch) =>
    set((s) => {
      const settings = { ...s.settings, ...patch }
      writeSettings(settings)
      return { settings }
    }),

  setParams: (patch) =>
    set((s) => {
      const settings = {
        ...s.settings,
        params: { ...s.settings.params, ...patch },
      }
      writeSettings(settings)
      return { settings }
    }),

  setLive: (live) => set({ live }),

  openPanel: (artId, patch) =>
    set((s) => ({ panel: { ...s.panel, ...patch, open: true, artId } })),

  closePanel: (dismissed = null) =>
    set((s) => ({ panel: { ...s.panel, open: false, max: false, dismissed } })),

  setPanel: (patch) => set((s) => ({ panel: { ...s.panel, ...patch } })),
}))

export function currentConversation(state: ChatState): Conversation | null {
  if (!state.curId) return null
  return state.convs.find((c) => c.id === state.curId) ?? null
}
