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
import type { TopNavLink } from '../types'

const CONSOLE_HREF = '/dashboard'

/**
 * Whether a site-wide link (主页 / 控制台 / 模型广场 …) marks where the
 * reader is. Every console page counts as 控制台; a section also owns its
 * sub-pages, so a model's details still light 模型广场.
 */
export function isSiteLinkActive(
  href: string,
  pathname: string,
  inConsole: boolean
): boolean {
  if (href === CONSOLE_HREF) return inConsole
  if (inConsole) return false
  if (href === '/') return pathname === '/'
  const base = href.replace(/\/+$/, '')
  return pathname === base || pathname.startsWith(`${base}/`)
}

/**
 * How a link opens: `route` through the router, `page` as a full load in
 * the same tab (the docs are a separate site on this domain), `tab` for
 * another site.
 */
export function siteLinkTarget(link: TopNavLink): 'route' | 'page' | 'tab' {
  if (!link.external) return 'route'
  // `//host/…` is another site too
  return /^\/(?!\/)/.test(link.href) ? 'page' : 'tab'
}

/** The site-wide links without 控制台, for places already in the console. */
export function withoutConsole(links: TopNavLink[]): TopNavLink[] {
  return links.filter((link) => link.href !== CONSOLE_HREF)
}
