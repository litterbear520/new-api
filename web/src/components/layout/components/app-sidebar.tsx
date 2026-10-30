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
import {
  ArrowUpRight,
  BookOpen,
  Box,
  House,
  Info,
  Link as LinkIcon,
  PanelLeft,
  SearchIcon,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { SiteLink } from '@/components/site-bar/site-link'
import { useLayout } from '@/context/layout-provider'
import { useSearch } from '@/context/search-provider'
import { useBrand } from '@/hooks/use-brand'
import { useSidebarView } from '@/hooks/use-sidebar-view'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { MOTION_TRANSITION, MOTION_VARIANTS } from '@/lib/motion'

import { withoutConsole } from '../lib/site-nav'
import { NavGroup } from './nav-group'
import { SidebarViewHeader } from './sidebar-view-header'

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iP(hone|ad|od)/.test(navigator.platform)

/**
 * Logo and name back to the home page, for the phone drawer only: on wider
 * screens the site bar over the sidebar shows them.
 */
function DrawerBrand() {
  const { t } = useTranslation()
  const { name, logo } = useBrand()
  const { setOpenMobile } = useSidebar()

  return (
    <Link
      to='/'
      aria-label={t('Go to home')}
      onClick={() => setOpenMobile(false)}
      className='hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex h-9 min-w-0 items-center gap-2 rounded-md px-1.5 outline-none focus-visible:ring-2 md:hidden'
    >
      <img src={logo} alt='' className='size-6 shrink-0 rounded-md object-cover' />
      <span className='truncate text-[15px] font-semibold tracking-tight'>
        {name}
      </span>
    </Link>
  )
}

/** Collapses the sidebar to its icons, and opens it again. */
function SidebarCollapse() {
  const { t } = useTranslation()
  const { state, toggleSidebar } = useSidebar()
  const label =
    state === 'expanded' ? t('Collapse sidebar') : t('Expand sidebar')

  return (
    <SidebarMenu className='max-md:hidden'>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={label}
          onClick={toggleSidebar}
          aria-label={label}
          className='text-muted-foreground'
        >
          <PanelLeft />
          <span className='min-w-0 flex-1 truncate'>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/** Search: opens the ⌘K command menu. */
function SidebarSearch() {
  const { t } = useTranslation()
  const { setOpen } = useSearch()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={t('Search')} onClick={() => setOpen(true)}>
          <SearchIcon />
          <span className='min-w-0 flex-1 truncate'>{t('Search')}</span>
          <kbd className='text-muted-foreground bg-sidebar-accent/60 ms-auto rounded px-1.5 font-sans text-[11px] leading-5 group-data-[collapsible=icon]:hidden in-data-[mobile=true]:hidden'>
            {IS_MAC ? '⌘K' : 'Ctrl K'}
          </kbd>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

const SITE_LINK_ICONS: Record<string, LucideIcon> = {
  '/': House,
  '/pricing': Box,
  '/activity': Sparkles,
  '/rankings': Trophy,
  '/about': Info,
  '/docs': BookOpen,
}

/**
 * 主页 / 模型广场 / 活动 / 文档 for screens below `lg`, where the top bar's
 * dock keeps only its icons. The sidebar is the console, so no 控制台.
 */
function SidebarSiteLinks() {
  const { t } = useTranslation()
  const { setOpenMobile } = useSidebar()
  const links = withoutConsole(useTopNavLinks())
  if (links.length === 0) return null

  return (
    <div className='lg:hidden'>
      <SidebarSeparator className='mx-4 my-1' />
      <SidebarGroup>
        <SidebarMenu aria-label={t('Site links')}>
          {links.map((link) => {
            // the docs link is the site's only external one
            const Icon =
              SITE_LINK_ICONS[link.href] ??
              (link.external ? BookOpen : LinkIcon)
            return (
              <SidebarMenuItem key={`${link.title}:${link.href}`}>
                <SidebarMenuButton
                  tooltip={link.title}
                  render={
                    <SiteLink link={link} onClick={() => setOpenMobile(false)} />
                  }
                >
                  <Icon />
                  <span className='min-w-0 flex-1 truncate'>{link.title}</span>
                  <ArrowUpRight
                    aria-hidden='true'
                    className='text-muted-foreground ms-auto size-3.5! group-data-[collapsible=icon]:hidden'
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroup>
    </div>
  )
}

/**
 * Application sidebar: brand, search and navigation. Messages, language,
 * theme and the account menu live in the top bar.
 *
 * Adopts the Vercel / Cloudflare "drill-in" pattern: the URL drives
 * which sidebar *view* is rendered. Clicking a top-level entry like
 * `System Settings` swaps the sidebar to a contextual workspace —
 * with a `← Back to Dashboard` affordance — instead of stacking the
 * sub-navigation inside the root tree.
 *
 * Architecture:
 *   - View resolution + filtering: {@link useSidebarView}
 *   - View registry: `layout/lib/sidebar-view-registry.ts`
 *   - Per-view header: {@link SidebarViewHeader}
 *
 * Adding a new nested view only requires registering a {@link SidebarView}
 * in the registry; this component requires no changes.
 */
export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { key, view, navGroups } = useSidebarView()
  const shouldReduce = useReducedMotion()

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      {/* the site bar floats over the top of the sidebar */}
      <SidebarHeader className='gap-1 px-2 pt-1.5 pb-1 md:pt-(--app-header-height)'>
        <DrawerBrand />
        <SidebarSearch />
      </SidebarHeader>

      {view && <SidebarViewHeader view={view} />}

      <SidebarContent className='py-1'>
        <AnimatePresence mode='wait' initial={false}>
          <motion.div
            key={key}
            initial={
              shouldReduce ? false : MOTION_VARIANTS.sidebarSlide.initial
            }
            animate={MOTION_VARIANTS.sidebarSlide.animate}
            exit={shouldReduce ? undefined : MOTION_VARIANTS.sidebarSlide.exit}
            transition={MOTION_TRANSITION.fast}
            className='flex flex-col'
          >
            {navGroups
              .filter((group) => !group.searchOnly)
              .map((props, index) => (
                <Fragment key={props.id || props.title || index}>
                  {index > 0 && <SidebarSeparator className='mx-4 my-1' />}
                  <NavGroup {...props} />
                </Fragment>
              ))}
          </motion.div>
        </AnimatePresence>
        <SidebarSiteLinks />
      </SidebarContent>

      <SidebarFooter className='px-2 pb-2'>
        <SidebarCollapse />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
