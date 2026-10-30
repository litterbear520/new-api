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
import { Link } from '@tanstack/react-router'
import type { ComponentPropsWithoutRef } from 'react'

import { siteLinkTarget } from '@/components/layout/lib/site-nav'
import type { TopNavLink } from '@/components/layout/types'

type SiteLinkProps = Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
  link: TopNavLink
  /** The reader is on this link's page. */
  active?: boolean
}

/**
 * One of the site-wide links (主页 / 控制台 / 模型广场 …), opened the way
 * it should be: through the router, as a full page load in the same tab
 * (the docs are another site on this domain), or in a new tab for another
 * site. Shows the link's title unless given children.
 */
export function SiteLink(props: SiteLinkProps) {
  const { link, active, children, ...anchor } = props
  const common = {
    ...anchor,
    'aria-current': active ? ('page' as const) : undefined,
    'aria-disabled': link.disabled || undefined,
    tabIndex: link.disabled ? -1 : anchor.tabIndex,
  }
  const content = children ?? link.title
  switch (siteLinkTarget(link)) {
    case 'route':
      return (
        <Link {...common} to={link.href} disabled={link.disabled}>
          {content}
        </Link>
      )
    case 'page':
      return (
        <a {...common} href={link.href}>
          {content}
        </a>
      )
    case 'tab':
      return (
        <a {...common} href={link.href} target='_blank' rel='noopener noreferrer'>
          {content}
        </a>
      )
  }
}
