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
import { Upload } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { storeAttachments } from '../../lib/engine'
import { BrandColors } from './brand-colors'
import {
  draftFromKit,
  fontPresets,
  kitFromDraft,
  type BrandKitDraft,
} from './brand-kit-form'
import { BrandKitPreview } from './brand-kit-preview'
import { Segmented } from './segmented'

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

function BrandKitEditor(props: { formId: string; onSaved: () => void }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(() =>
    draftFromKit(useBearDrawStore.getState().brandKit)
  )
  const [nameMissing, setNameMissing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const setBrandKit = useBearDrawStore((s) => s.setBrandKit)
  const patch = (p: Partial<BrandKitDraft>) => setDraft((d) => ({ ...d, ...p }))
  const fonts = fontPresets(t)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim()) {
      setNameMissing(true)
      nameRef.current?.focus()
      return
    }
    const kit = kitFromDraft(draft)
    setBrandKit(kit)
    toast.success(
      t('Brand kit “{{name}}” saved; every set from now on uses it', {
        name: kit.name,
      })
    )
    props.onSaved()
  }

  const takeLogo = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const [att] = await storeAttachments([file])
      if (att) patch({ logo: { id: att.id, w: att.w, h: att.h } })
    } catch {
      toast.error(t('This picture could not be read'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className='bd-bk'>
      <form id={props.formId} className='bd-bk-form' onSubmit={submit}>
        <div className='bd-field'>
          <Label htmlFor={`${id}-name`}>{t('Brand name')}</Label>
          <Input
            ref={nameRef}
            id={`${id}-name`}
            value={draft.name}
            placeholder={t('For example: Beiyu')}
            aria-invalid={nameMissing || undefined}
            onChange={(e) => {
              patch({ name: e.target.value })
              if (e.target.value.trim()) setNameMissing(false)
            }}
          />
          {nameMissing && (
            <p className='bd-field-err' role='alert'>
              {t('Give the brand a name first')}
            </p>
          )}
        </div>
        <div className='bd-field'>
          <span className='bd-field-l'>{t('Brand logo')}</span>
          <div className='bd-bk-logo-row'>
            <button
              type='button'
              className='bd-bk-up'
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload aria-hidden='true' />
              {draft.logo
                ? t('Use another logo')
                : t('Upload a logo (a transparent PNG works best)')}
            </button>
            {draft.logo && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => patch({ logo: null })}
              >
                {t('Remove the logo')}
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type='file'
            accept='image/*'
            hidden
            onChange={(e) => {
              void takeLogo(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
        <div className='bd-field'>
          <span className='bd-field-l'>{t('Brand colours')}</span>
          <BrandColors
            colors={draft.colors}
            onChange={(colors) => patch({ colors })}
          />
        </div>
        <div className='bd-field'>
          <span className='bd-field-l'>{t('Type style')}</span>
          <Segmented
            value={draft.fonts}
            options={fonts.map((f) => ({ value: f.value, label: f.label }))}
            onChange={(fonts) => patch({ fonts })}
            aria-label={t('Type style')}
            className='bd-bk-fonts'
          />
        </div>
        <div className='bd-field'>
          <Label htmlFor={`${id}-tone`}>{t('Tone')}</Label>
          <Input
            id={`${id}-tone`}
            value={draft.tone}
            placeholder={t('For example: quiet, restrained, warm')}
            onChange={(e) => patch({ tone: e.target.value })}
          />
        </div>
        <div className='bd-field'>
          <Label htmlFor={`${id}-points`}>{t('Main selling points')}</Label>
          <Textarea
            id={`${id}-points`}
            rows={3}
            value={draft.points}
            placeholder={t(
              'One per line, for example: keeps warm for 12 hours'
            )}
            onChange={(e) => patch({ points: e.target.value })}
          />
        </div>
        <div className='bd-field'>
          <Label htmlFor={`${id}-notes`}>{t('Note')}</Label>
          <Input
            id={`${id}-notes`}
            value={draft.notes}
            placeholder={t('For example: no cartoons, no loud red and green')}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </div>
      </form>
      <BrandKitPreview draft={draft} />
    </div>
  )
}

/** 品牌套件: logo, colours, type, tone and selling points for every set. */
export function BrandKitDialog(props: DialogProps) {
  const { t } = useTranslation()
  const hasKit = useBearDrawStore((s) => s.brandKit != null)
  const formId = useId()

  const turnOff = () => {
    // Keep the kit (logo, colours, points); just stop applying it.
    useBearDrawStore.getState().setPrefs({ brand: false })
    toast(t('Brand kit turned off'))
    props.onOpenChange(false)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Brand kit')}
      description={t(
        'Kept only in this browser on this device. In Agent mode every set uses it.'
      )}
      contentClassName='bd-pop bd-dlg bd-dlg-lg'
      titleClassName='bd-dlg-t'
      footer={
        <>
          {hasKit && (
            <Button type='button' variant='ghost' onClick={turnOff}>
              {t('Stop using the brand kit')}
            </Button>
          )}
          <Button type='submit' form={formId} className='bd-btn-ink'>
            {t('Save')}
          </Button>
        </>
      }
    >
      <BrandKitEditor
        formId={formId}
        onSaved={() => props.onOpenChange(false)}
      />
    </Dialog>
  )
}
