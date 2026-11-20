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
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

/**
 * The ⓘ next to a title. Hover shows the text, and so do a click, a tap
 * and Enter: phones have no hover, and iOS does not focus a tapped button.
 */
export function InfoTip(props: { text: string }) {
  const { t } = useTranslation()
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        render={
          <Button
            variant='ghost'
            size='icon-xs'
            className='bo-i'
            aria-label={t('About: {{text}}', { text: props.text })}
          />
        }
      >
        <Info aria-hidden='true' />
      </PopoverTrigger>
      <PopoverContent
        side='top'
        aria-label={t('Tip')}
        className='w-auto max-w-64 p-2.5 text-xs leading-relaxed'
      >
        {props.text}
      </PopoverContent>
    </Popover>
  )
}
