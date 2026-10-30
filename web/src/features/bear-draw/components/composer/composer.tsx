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
import { forwardRef, useId, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/context/theme-provider'
import { useGlass, useGlassLight } from '@/features/draw/hooks/use-glass'
import { useHalo } from '@/features/draw/hooks/use-halo'
import { cn } from '@/lib/utils'
import { findProject } from '@/stores/bear-draw-store'
import { useNightSeaStore } from '@/stores/night-sea-store'

import { DrawBear } from '../bear/draw-bear'
import { lastAgent, useDrawBear } from '../bear/use-draw-bear'
import { AuroraBack, AuroraRing } from './aurora'
import { ComposerBar } from './composer-bar'
import { ComposerChips } from './composer-chips'
import { ComposerPicker } from './composer-picker'
import { ComposerRefs } from './composer-refs'
import { Placeholder } from './placeholder'
import { isImageFile } from './use-attachments'
import { useComposer, type ComposerProps } from './use-composer'
import type { ComposerHandle } from './use-handle'

export type { ComposerProps } from './use-composer'
export type { ComposerHandle } from './use-handle'

const GLASS = { bezel: 32, depth: 16, frost: 8 }
const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files')

/**
 * The input box on the home page and docked in a project: text with "/"
 * skills and "@" canvas pictures, attached pictures, the mode and model
 * menus, liquid glass with the aurora while the agent works, and the pixel
 * bear on its rim.
 */
export const Composer = forwardRef<ComposerHandle, ComposerProps>(
  function Composer(props, ref) {
    const { t } = useTranslation()
    const dark = useTheme().resolvedTheme === 'dark'
    // the night sea is found by wishing on a meteor (bear-chat Meteors)
    const nightOn = useNightSeaStore((s) => s.on)
    const night = dark && nightOn
    const [focused, setFocused] = useState(false)
    const [drop, setDrop] = useState(false)
    const wrapRef = useRef<HTMLDivElement>(null)
    const listId = useId()
    const c = useComposer(props, ref, focused)
    const bear = useDrawBear({ projectId: props.projectId, dark: night })
    const glass = useGlass<HTMLDivElement>(
      night ? { ...GLASS, tint: [0.3, 0.55], tone: 'sea' } : GLASS
    )
    useGlassLight(wrapRef, '.bd-glass')
    const working = c.busy || (c.live != null && c.live.phase !== 'wait')
    const halo = useHalo(
      working,
      () => lastAgent(props.projectId)?.status === 'done'
    )
    const home = props.variant === 'home'
    const picker = c.picker
    const ta = c.taRef

    return (
      <div
        ref={wrapRef}
        className={cn('bd-comp', home ? 'bd-comp-home' : 'bd-comp-dock')}
        data-focus={focused ? '' : undefined}
        data-drop={drop ? '' : undefined}
      >
        <DrawBear
          bear={bear}
          notice={props.notice}
          hint={props.hint}
          onNotice={props.onNotice}
        />
        <AuroraBack mounted={halo.mounted} on={halo.on} flash={halo.flash} />
        <div
          ref={glass}
          className='bd-comp-box bd-glass'
          onClick={(e) => {
            const el = e.target as HTMLElement
            if (
              el === e.currentTarget ||
              el.classList.contains('bd-comp-field')
            ) {
              ta.current?.focus()
            }
          }}
          onDragOver={(e) => {
            if (!hasFiles(e)) return
            e.preventDefault()
            setDrop(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setDrop(false)
            }
          }}
          onDrop={(e) => {
            if (!hasFiles(e)) return
            e.preventDefault()
            setDrop(false)
            void c.att.addFiles([...e.dataTransfer.files])
          }}
        >
          <AuroraRing mounted={halo.mounted} on={halo.on} flash={halo.flash} />
          <ComposerRefs
            refs={c.att.refs}
            needPhoto={c.needPhoto}
            photoHint={c.preset?.hint}
            showAdd={c.mode === 'image' && !home}
            onAdd={() => c.fileRef.current?.click()}
            onRemove={c.att.remove}
          />
          <ComposerChips
            mode={c.mode}
            skill={c.skill}
            preset={c.preset}
            onClearSkill={() => {
              c.clearSkill()
              ta.current?.focus()
            }}
            onClearPreset={() => {
              c.clearPreset()
              ta.current?.focus()
            }}
          />
          <div className='bd-comp-field'>
            {!c.text && (
              <Placeholder
                mode={c.mode}
                skillName={c.skill?.name ?? null}
                example={c.example}
                exampleKey={c.turn}
              />
            )}
            <textarea
              ref={ta}
              className='bd-comp-ta'
              rows={home ? 2 : 1}
              value={c.text}
              aria-label={t('Describe what you want to design')}
              aria-autocomplete='list'
              aria-controls={picker.kind ? listId : undefined}
              aria-activedescendant={
                picker.kind && picker.items.length
                  ? `${listId}-${picker.active}`
                  : undefined
              }
              onChange={(e) => {
                const v = e.target.value
                c.setText(v)
                picker.evaluate(v, e.target.selectionStart ?? v.length)
                bear.director?.typing()
              }}
              onSelect={(e) => {
                const el = e.currentTarget
                picker.evaluate(el.value, el.selectionStart ?? el.value.length)
              }}
              onKeyDown={c.onKeyDown}
              onPaste={(e) => {
                const files = [...e.clipboardData.files].filter(isImageFile)
                if (!files.length) return
                e.preventDefault()
                void c.att.addFiles(files)
              }}
              onFocus={() => {
                setFocused(true)
                bear.director?.focus(() => !ta.current?.value.trim())
              }}
              onBlur={() => {
                setFocused(false)
                bear.director?.blur()
                picker.close()
              }}
            />
          </div>
          <ComposerBar
            variant={props.variant}
            canvas={props.projectId != null}
            busy={c.busy}
            ready={c.ready}
            estimate={c.estimate}
            taRef={ta}
            onUpload={() => c.fileRef.current?.click()}
            onSkill={() => c.startPicker('/')}
            onCanvas={() => c.startPicker('@')}
            onSend={c.send}
            onStop={props.onStop}
          />
          <input
            ref={c.fileRef}
            type='file'
            accept='image/*'
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              void c.att.addFiles(files)
            }}
          />
        </div>
        {picker.kind && (
          <ComposerPicker
            id={listId}
            kind={picker.kind}
            items={picker.items}
            active={picker.active}
            hasPictures={(findProject(props.projectId)?.nodes ?? []).some(
              (n) => n.status === 'ready'
            )}
            onChoose={picker.choose}
            onHover={picker.hover}
          />
        )}
      </div>
    )
  }
)
