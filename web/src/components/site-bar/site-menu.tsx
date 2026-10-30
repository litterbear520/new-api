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
import { useRouterState } from '@tanstack/react-router'
import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { LiquidGlass } from '@/components/liquid-glass'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { isSiteLinkActive } from '@/components/layout/lib/site-nav'
import type { TopNavLink } from '@/components/layout/types'
import { cn } from '@/lib/utils'

import { SiteLink } from './site-link'

/** Three lines that cross into an ✕ while the menu is open. */
function MenuIcon({ open }: { open: boolean }) {
  const line =
    'absolute inset-x-0 block h-[1.5px] rounded-full bg-current transition-all duration-300'
  return (
    <span className='relative size-4' aria-hidden='true'>
      <span
        className={cn(line, 'origin-center', open ? 'top-[7px] rotate-45' : 'top-[3px]')}
      />
      <span
        className={cn(line, 'top-[7px]', open ? 'scale-x-0 opacity-0' : 'opacity-100')}
      />
      <span
        className={cn(line, 'origin-center', open ? 'top-[7px] -rotate-45' : 'top-[11px]')}
      />
    </span>
  )
}

type MenuButtonProps = {
  className?: string
  onClick: () => void
}

/** The phone menu button where the page has its own menu (the console's drawer). */
export function MenuButton(props: MenuButtonProps) {
  const { t } = useTranslation()
  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      className={cn('size-9', props.className)}
      onClick={props.onClick}
      aria-label={t('Toggle navigation menu')}
    >
      <MenuIcon open={false} />
    </Button>
  )
}

type SiteMenuProps = {
  links: TopNavLink[]
  inConsole: boolean
  onLinkClick: (event: MouseEvent<HTMLAnchorElement>, link: TopNavLink) => void
  className?: string
}

/**
 * The site links for screens too narrow for them in the bar: a pane of the
 * same glass that grows out of the menu button.
 */
export function SiteMenu(props: SiteMenuProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className={cn('size-9', props.className)}
            aria-label={t('Toggle navigation menu')}
          />
        }
      >
        <MenuIcon open={open} />
      </PopoverTrigger>
      <PopoverContent
        align='end'
        sideOffset={10}
        className='w-auto gap-0 bg-transparent p-0 shadow-none ring-0 duration-200'
      >
        <LiquidGlass className='rounded-[22px] p-1.5'>
          <nav aria-label={t('Site menu')} className='flex w-52 flex-col gap-0.5'>
            {props.links.map((link) => {
              const active = isSiteLinkActive(link.href, pathname, props.inConsole)
              return (
                <SiteLink
                  key={`${link.title}:${link.href}`}
                  link={link}
                  active={active}
                  onClick={(event) => {
                    props.onLinkClick(event, link)
                    setOpen(false)
                  }}
                  className={cn(
                    'focus-visible:ring-ring flex h-11 items-center justify-between rounded-2xl px-4 text-[15px] font-medium outline-none transition-colors focus-visible:ring-2',
                    active
                      ? 'text-foreground bg-white/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.95),0_1px_4px_-1px_rgb(0_0_0/0.16)] dark:bg-white/13 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]'
                      : 'text-muted-foreground hover:text-foreground',
                    link.disabled && 'pointer-events-none opacity-50'
                  )}
                />
              )
            })}
          </nav>
        </LiquidGlass>
      </PopoverContent>
    </Popover>
  )
}
