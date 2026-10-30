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
// The home page's first screen comes with the page's HTML (hero-shell-html.ts
// builds it, rsbuild.config.ts puts it in index.html), so its words and its
// poster show while the app's scripts still load. NightSeaHome draws the same
// screen, then takes that one away.
import { HERO_SHELL_ID } from './hero-copy'

/**
 * Takes the HTML's first screen away: the app shows its own, or another page.
 * Its style stays (the same rules as the app's; the title font came in with it)
 */
export function dropHeroShell() {
  document.querySelector(`#${HERO_SHELL_ID}`)?.remove()
}
