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

/** Page-wide dialogs any part of the drawing page can open. */
export type DialogKind = 'brand' | 'import-skill' | 'new-skill' | 'credits'

/** Starting values for 「新建技能」 (e.g. 另存为我的技能). */
export type NewSkillSeed = {
  name?: string
  description?: string
  /** A SKILL.md; its front matter is dropped. */
  text?: string
}

type DialogState = {
  kind: DialogKind | null
  seed: NewSkillSeed | null
  /** Changes on every open, so a dialog opened twice starts fresh. */
  serial: number
}

export const useDialogStore = create<DialogState>()(() => ({
  kind: null,
  seed: null,
  serial: 0,
}))

export function openDialog(kind: DialogKind, seed?: NewSkillSeed): void {
  useDialogStore.setState((s) => ({
    kind,
    seed: seed ?? null,
    serial: s.serial + 1,
  }))
}

export function closeDialog(): void {
  // the seed stays until the next open, so the closing dialog keeps its text
  useDialogStore.setState({ kind: null })
}
