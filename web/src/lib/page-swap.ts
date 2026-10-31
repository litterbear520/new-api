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

/** Where a page sits, for how the screen changes to it. */
export type PagePlace = {
  /** On the night sky (home, sign-in). */
  dark: boolean
  /** In the console's frame (its sidebar). */
  console: boolean
}

/**
 * Going between the night sky and the light pages, or into and out of the
 * console's frame, the whole screen cross-fades (the router's view
 * transition, type page, see main.tsx); other page changes only fade the
 * page in.
 */
export function crossFades(from: PagePlace, to: PagePlace) {
  return from.dark !== to.dark || from.console !== to.console
}

/**
 * Whether the screen is cross-fading into the next page right now. A page
 * mounting inside that cross-fade must not fade itself in on top: it would
 * come in empty and blurred through it.
 */
export function inPageSwap() {
  try {
    return document.documentElement.matches(
      ':active-view-transition-type(page)'
    )
  } catch {
    // a browser without view transition types: no cross-fade either
    return false
  }
}
