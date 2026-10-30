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
import { createContext, useContext } from 'react'

/** What a part in the chat can ask the project page to do. */
export type PartActions = {
  /** The user's balance in USD; null until known. */
  balanceUsd: number | null
  /** The agent of this project is thinking or drawing. */
  busy: boolean
  /** Opens the canvas; with ids (pictures or a set), centres on them. */
  openCanvas: (ids?: string[]) => void
  /** Packs a set's finished pictures for download. */
  exportGroup: (groupId: string) => void
  /** Puts text in the composer, e.g. a suggestion. */
  setComposerText: (text: string) => void
  focusComposer: () => void
  /** Starts over on the drawing home page. */
  newProject: () => void
}

const noop = () => undefined

export const PartActionsContext = createContext<PartActions>({
  balanceUsd: null,
  busy: false,
  openCanvas: noop,
  exportGroup: noop,
  setComposerText: noop,
  focusComposer: noop,
  newProject: noop,
})

export function usePartActions(): PartActions {
  return useContext(PartActionsContext)
}
