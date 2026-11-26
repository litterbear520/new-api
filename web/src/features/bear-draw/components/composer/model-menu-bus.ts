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
/* 「换模型」 on an error card opens the model menu that is on the page. */
export const OPEN_EVENT = 'bear-draw:model-menu'

export type ModelMenuAsk = {
  /** Unfolds the planner list. */
  section?: 'brain'
  /** Runs once a planner is picked; the menu closes first. */
  onPicked?: () => void
}

/** Opens the model menu of the composer. */
export function openModelMenu(ask: ModelMenuAsk = {}): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: ask }))
}
