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
import {
  AtSign,
  BookOpen,
  FileUp,
  Plus,
  SwatchBook,
  Upload,
} from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/features/draw/components/tip'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { openDialog } from '../dialogs/dialog-bus'

function MenuRow(props: {
  icon: ReactNode
  label: string
  desc?: string
  kbd?: string
  onClick: () => void
}) {
  return (
    <DropdownMenuItem className='bd-mi' onClick={props.onClick}>
      <span className='bd-mi-ic' aria-hidden='true'>
        {props.icon}
      </span>
      <span className='bd-mi-main'>
        <span>{props.label}</span>
        {props.desc && <span className='bd-mi-desc'>{props.desc}</span>}
      </span>
      {props.kbd && (
        <kbd className='bd-kbd' aria-hidden='true'>
          {props.kbd}
        </kbd>
      )}
    </DropdownMenuItem>
  )
}

type PlusMenuProps = {
  /** Where the focus goes when the menu closes (the textarea). */
  finalFocus: RefObject<HTMLTextAreaElement | null>
  /** The project has finished pictures: they can be used with "@". */
  canvas: boolean
  onUpload: () => void
  onSkill: () => void
  onCanvas: () => void
}

/** +: upload, skills, the brand kit. */
export function PlusMenu(props: PlusMenuProps) {
  const { t } = useTranslation()
  const brandKit = useBearDrawStore((s) => s.brandKit)
  return (
    <DropdownMenu>
      <Tip label={t('Upload, skills, brand kit')}>
        <DropdownMenuTrigger
          render={
            <button
              type='button'
              className='bd-comp-plus'
              aria-label={t('Add')}
            >
              <Plus aria-hidden='true' />
            </button>
          }
        />
      </Tip>
      <DropdownMenuContent
        side='top'
        align='start'
        sideOffset={8}
        finalFocus={props.finalFocus}
        className='bd-pop bd-menu w-72'
      >
        <MenuRow
          icon={<Upload />}
          label={t('Upload pictures')}
          onClick={props.onUpload}
        />
        <MenuRow
          icon={<BookOpen />}
          label={t('Use a skill…')}
          kbd='/'
          onClick={props.onSkill}
        />
        {props.canvas && (
          <MenuRow
            icon={<AtSign />}
            label={t('Use a picture from the canvas')}
            kbd='@'
            onClick={props.onCanvas}
          />
        )}
        <MenuRow
          icon={<FileUp />}
          label={t('Import a skill')}
          onClick={() => openDialog('import-skill')}
        />
        <DropdownMenuSeparator />
        <MenuRow
          icon={<SwatchBook />}
          label={
            brandKit
              ? t('Brand kit: {{name}}', { name: brandKit.name })
              : t('Set up a brand kit')
          }
          onClick={() => openDialog('brand')}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
