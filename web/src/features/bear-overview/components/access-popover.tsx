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
import { ChevronDown, Globe } from 'lucide-react'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

import type { AccessHandle } from '../lib/access'
import { AccessPanel } from './access-panel'

type AccessPopoverProps = Omit<ComponentProps<typeof AccessPanel>, 'folded'> & {
  handle: AccessHandle
}

/**
 * 接入信息 in the page header: address, key and lines in a popover. Other
 * triggers on the handle (the empty usage card's button) open the same
 * popover anchored to themselves, so it never lands off screen.
 */
export function AccessPopover(props: AccessPopoverProps) {
  const { t } = useTranslation()
  return (
    <Popover handle={props.handle}>
      <PopoverTrigger
        render={<Button variant='outline' className='h-9 px-3' />}
      >
        <Globe data-icon='inline-start' />
        {t('Connection details')}
        <ChevronDown data-icon='inline-end' className='opacity-60' />
      </PopoverTrigger>
      <PopoverContent
        align='end'
        sideOffset={8}
        // .bo-pop carries the page's text and focus rules into the portal
        className='bo-vars bo-pop w-[min(400px,calc(100vw-24px))] p-0'
      >
        <AccessPanel
          lines={props.lines}
          line={props.line}
          onLine={props.onLine}
          format={props.format}
          onFormat={props.onFormat}
          apiKey={props.apiKey}
          folded={false}
        />
      </PopoverContent>
    </Popover>
  )
}

/** Another 接入信息 button that opens the header's popover next to itself */
export function AccessTrigger(props: { handle: AccessHandle }) {
  const { t } = useTranslation()
  return (
    <PopoverTrigger
      handle={props.handle}
      render={<Button variant='outline' className='h-9 px-3' />}
    >
      <Globe data-icon='inline-start' />
      {t('Connection details')}
    </PopoverTrigger>
  )
}
