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
import { Link, useLocation } from '@tanstack/react-router'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { type ReactNode, useState, useEffect } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'

import { checkIsActive } from '../lib/url-utils'
import type {
  NavCollapsible,
  NavChatPresets,
  NavLink,
  NavGroup as NavGroupProps,
} from '../types'
import { ChatPresetsItem } from './chat-presets-item'

/**
 * Sidebar navigation group component
 * Renders a group of navigation items, supporting regular links and collapsible submenus
 */
export function NavGroup({ title, items }: NavGroupProps) {
  const { state, isMobile } = useSidebar()
  const href = useLocation({ select: (location) => location.href })
  const pathname = useLocation({ select: (location) => location.pathname })
  const searchParams = useLocation({
    select: (location) => location.searchStr,
  })
  // An item with search params is active only when they match, and then it
  // wins over a path-only item for the same page.
  const matchesSearch = (item: NavLink) => {
    if (!item.search || item.url !== pathname) return false
    const current = new URLSearchParams(searchParams)
    return Object.entries(item.search).every(([k, v]) => current.get(k) === v)
  }
  const searchMatch = items.find(
    (item) => 'search' in item && item.search && matchesSearch(item as NavLink)
  )
  const isActive = (item: NavLink) => {
    if (item.search) return matchesSearch(item)
    if (searchMatch && item.url === searchMatch.url) return false
    return checkIsActive(href, item)
  }

  return (
    <SidebarGroup className='px-2 py-1'>
      {title && (
        <SidebarGroupLabel className='text-muted-foreground/70 px-2 text-[11px] font-medium tracking-wider uppercase'>
          {title}
        </SidebarGroupLabel>
      )}
      <SidebarMenu>
        {items.map((item) => {
          const key = `${item.title}-${item.url || item.type}`

          // Special handling: dynamic chat presets list
          if (item.type === 'chat-presets') {
            return <ChatPresetsItem key={key} item={item as NavChatPresets} />
          }

          // If no sub-items, render regular link
          if (!item.items) {
            return (
              <SidebarMenuLink
                key={key}
                item={item as NavLink}
                active={isActive(item as NavLink)}
              />
            )
          }

          // In collapsed state on non-mobile, render dropdown menu
          if (state === 'collapsed' && !isMobile) {
            return (
              <SidebarMenuCollapsedDropdown
                key={key}
                item={item as NavCollapsible}
                href={href}
              />
            )
          }

          // Render collapsible menu
          return (
            <SidebarMenuCollapsible
              key={key}
              item={item as NavCollapsible}
              href={href}
            />
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

/**
 * Navigation badge component
 */
function NavBadge({ children }: { children: ReactNode }) {
  return <Badge className='shrink-0 px-1 py-0 text-xs'>{children}</Badge>
}

/**
 * Red dot at the end of the row, or on the icon's corner when the sidebar is
 * collapsed. Positioned against the menu item, so the button's overflow
 * clipping doesn't cut it off.
 */
function NavDot({ label }: { label: string }) {
  return (
    <span className='bg-destructive group-data-[collapsible=icon]:ring-sidebar pointer-events-none absolute end-3 top-1/2 size-2 -translate-y-1/2 rounded-full group-data-[collapsible=icon]:end-1 group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:translate-y-0 group-data-[collapsible=icon]:ring-2'>
      <span className='sr-only'>{label}</span>
    </span>
  )
}

/**
 * Sidebar menu link item
 */
function SidebarMenuLink(props: { item: NavLink; active: boolean }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const url = typeof props.item.url === 'string' ? props.item.url : ''

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={props.active}
        tooltip={
          props.item.dot
            ? `${props.item.title} · ${props.item.dot}`
            : props.item.title
        }
        render={
          props.item.external ? (
            <a href={url} target='_blank' rel='noopener noreferrer' />
          ) : (
            <Link
              to={props.item.url}
              // For a `to` that is not a route literal the router types
              // `search` as `true | (prev) => never`, so no value fits.
              search={props.item.search as never}
              preload={isMobile ? false : undefined}
              onClick={() => setOpenMobile(false)}
            />
          )
        }
      >
        {props.item.icon && <props.item.icon className='shrink-0' />}
        {props.item.dot && <NavDot label={props.item.dot} />}
        <span className='min-w-0 flex-1 truncate'>{props.item.title}</span>
        {props.item.badge && <NavBadge>{props.item.badge}</NavBadge>}
        {props.item.external && (
          <ArrowUpRight
            aria-hidden='true'
            className='text-muted-foreground ms-auto size-3.5! group-data-[collapsible=icon]:hidden'
          />
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/**
 * Sidebar collapsible menu item
 */
function SidebarMenuCollapsible({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  // 检查当前路径是否匹配子菜单项
  const isSubItemActive = checkIsActive(href, item)
  // 使用受控状态，初始值基于当前路径是否匹配
  const [isOpen, setIsOpen] = useState(() => isSubItemActive)

  // 当路径变化时，如果匹配子菜单项，自动展开父级菜单
  useEffect(() => {
    if (isSubItemActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true)
    }
  }, [isSubItemActive])

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className='group/collapsible'
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        className='group/collapsible-trigger'
        render={<SidebarMenuButton tooltip={item.title} />}
      >
        {item.icon && <item.icon className='shrink-0' />}
        <span className='min-w-0 flex-1 truncate'>{item.title}</span>
        {item.badge && <NavBadge>{item.badge}</NavBadge>}
        <ChevronRight className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]/collapsible-trigger:rotate-90' />
      </CollapsibleTrigger>
      <CollapsibleContent className='CollapsibleContent'>
        <SidebarMenuSub>
          {item.items.map((subItem) => (
            <SidebarMenuSubItem key={subItem.title}>
              <SidebarMenuSubButton
                isActive={checkIsActive(href, subItem)}
                render={
                  <Link
                    to={subItem.url}
                    preload={isMobile ? false : undefined}
                    onClick={() => setOpenMobile(false)}
                  />
                }
              >
                {subItem.icon && <subItem.icon className='shrink-0' />}
                <span className='min-w-0 flex-1 truncate'>{subItem.title}</span>
                {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Sidebar dropdown menu item when collapsed
 */
function SidebarMenuCollapsedDropdown({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          className='group/dropdown-trigger'
          render={
            <SidebarMenuButton
              tooltip={item.title}
              isActive={checkIsActive(href, item)}
            />
          }
        >
          {item.icon && <item.icon className='shrink-0' />}
          <span className='min-w-0 flex-1 truncate'>{item.title}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
          <ChevronRight className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[popup-open]/dropdown-trigger:rotate-90' />
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' sideOffset={4}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {item.title} {item.badge ? `(${item.badge})` : ''}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {item.items.map((sub) => (
              <DropdownMenuItem
                key={`${sub.title}-${sub.url}`}
                render={
                  <Link
                    to={sub.url}
                    className={`${checkIsActive(href, sub) ? 'bg-secondary' : ''}`}
                  />
                }
              >
                {sub.icon && <sub.icon />}
                <span className='max-w-52 text-wrap'>{sub.title}</span>
                {sub.badge && (
                  <span className='ms-auto text-xs'>{sub.badge}</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
