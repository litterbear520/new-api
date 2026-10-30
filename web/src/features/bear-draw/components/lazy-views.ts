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
/*
 * The project page (canvas, chat with its Markdown renderer) and the skills
 * library are chunks of their own, so the home page paints without them.
 * `warmProject` starts the project chunk as soon as the user shows they are
 * about to open one (typing, hovering the recent projects).
 */

export const loadProjectView = () => import('./project/project-view')
export const loadLibraryView = () => import('./library/library-view')

let warming: Promise<unknown> | null = null

export function warmProject(): void {
  warming ??= loadProjectView().catch(() => {
    warming = null
  })
}
