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
  ChevronDown,
  FileUp,
  ImagePlus,
  Plus,
  Sparkles,
  SwatchBook,
  Upload,
} from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/features/draw/components/tip'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import type { Mode } from '../../types'
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
  /** In a project: pictures on the canvas can be used with "@". */
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
          desc={t('Product shots, references or a logo')}
          onClick={props.onUpload}
        />
        <MenuRow
          icon={<BookOpen />}
          label={t('Use a skill…')}
          desc={t('Or type / in the box')}
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
          desc={t('From a SKILL.md file')}
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
          desc={t('Upload once, and every set stays on brand')}
          onClick={() => openDialog('brand')}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModeItem(props: {
  value: Mode
  icon: ReactNode
  label: string
  desc: string
}) {
  return (
    <DropdownMenuRadioItem
      value={props.value}
      closeOnClick
      className='bd-mi bd-mi-radio'
    >
      <span className='bd-mi-ic' aria-hidden='true'>
        {props.icon}
      </span>
      <span className='bd-mi-main'>
        <span>{props.label}</span>
        <span className='bd-mi-desc'>{props.desc}</span>
      </span>
    </DropdownMenuRadioItem>
  )
}

/** Agent (plans first) or Image (draws what you typed). */
export function ModeMenu(props: {
  finalFocus: RefObject<HTMLTextAreaElement | null>
}) {
  const { t } = useTranslation()
  const mode = useBearDrawStore((s) => s.prefs.mode)
  const setPrefs = useBearDrawStore((s) => s.setPrefs)
  const image = mode === 'image'
  return (
    <DropdownMenu>
      <Tip label={t('Mode')}>
        <DropdownMenuTrigger
          render={
            <button type='button' className='bd-chip bd-mode'>
              {image ? (
                <ImagePlus aria-hidden='true' />
              ) : (
                <Sparkles aria-hidden='true' />
              )}
              {image ? t('Image mode') : t('Agent')}
              <ChevronDown className='bd-chev' aria-hidden='true' />
            </button>
          }
        />
      </Tip>
      <DropdownMenuContent
        side='top'
        align='start'
        sideOffset={8}
        finalFocus={props.finalFocus}
        className='bd-pop bd-menu w-[300px]'
      >
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(v) =>
            setPrefs({ mode: v === 'image' ? 'image' : 'agent' })
          }
        >
          <ModeItem
            value='agent'
            icon={<Sparkles />}
            label={t('Agent')}
            desc={t(
              'Thinks first: asks, plans and quotes, then makes a whole set'
            )}
          />
          <ModeItem
            value='image'
            icon={<ImagePlus />}
            label={t('Image mode')}
            desc={t('Draws exactly what you type, no planning')}
          />
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
