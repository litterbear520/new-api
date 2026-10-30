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
import { useNavigate } from '@tanstack/react-router'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { parseSkillMd } from '../../lib/skill-import'
import { parseFrontmatter } from '../../lib/skill-text'
import type { NewSkillSeed } from './dialog-store'
import { buildSkillMd } from './skill-md-text'

type NewSkillDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  seed?: NewSkillSeed | null
}

function NewSkillForm(props: {
  formId: string
  seed?: NewSkillSeed | null
  onDone: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const putMySkill = useBearDrawStore((s) => s.putMySkill)
  const [name, setName] = useState(props.seed?.name ?? '')
  const [description, setDescription] = useState(props.seed?.description ?? '')
  const [instructions, setInstructions] = useState(() =>
    props.seed?.text
      ? parseFrontmatter(props.seed.text).body.trim()
      : t(
          '## Ask first\n- What the product is and who buys it\n\n## Which pictures\n1. Main picture 1:1\n2. Selling point picture 1:1\n\n## How to write each one\n- Background: …\n- Light: …\n- Text: copy the user’s words exactly\n'
        )
  )
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('Give the skill a name first'))
      nameRef.current?.focus()
      return
    }
    const text = buildSkillMd({ name, description, instructions })
    try {
      putMySkill(parseSkillMd(text))
    } catch (err) {
      // parseSkillMd's messages are i18n keys
      setError(t(err instanceof Error ? err.message : String(err)))
      return
    }
    toast.success(t('Saved to My skills'), {
      action: {
        label: t('Take a look'),
        onClick: () =>
          void navigate({
            to: '/draw',
            search: { view: 'skills', tab: 'mine' },
          }),
      },
    })
    props.onDone()
  }

  return (
    <form id={props.formId} className='bd-newsk' onSubmit={submit}>
      <div className='bd-field'>
        <Label htmlFor={`${id}-name`}>{t('Skill name')}</Label>
        <Input
          ref={nameRef}
          id={`${id}-name`}
          value={name}
          placeholder={t('For example: new-arrival posters for my shop')}
          aria-invalid={error != null && !name.trim() ? true : undefined}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
        />
      </div>
      <div className='bd-field'>
        <Label htmlFor={`${id}-desc`}>{t('One-line summary')}</Label>
        <Input
          id={`${id}-desc`}
          value={description}
          placeholder={t('What it makes, in one sentence')}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className='bd-field'>
        <Label htmlFor={`${id}-body`}>{t('How to do it (SKILL.md)')}</Label>
        <Textarea
          id={`${id}-body`}
          className='bd-newsk-ta'
          rows={12}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>
      {error && (
        <p className='bd-field-err' role='alert'>
          {error}
        </p>
      )}
    </form>
  )
}

/** 新建技能 / 另存为我的技能: a SKILL.md saved in 「我的技能」. */
export function NewSkillDialog(props: NewSkillDialogProps) {
  const { t } = useTranslation()
  const formId = useId()
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.seed?.text ? t('Save as my own skill') : t('New skill')}
      description={t(
        'Saved only on this device; pick it in Agent mode like any other skill.'
      )}
      contentClassName='bd-pop bd-dlg bd-dlg-lg'
      titleClassName='bd-dlg-t'
      footer={
        <Button type='submit' form={formId} className='bd-btn-ink'>
          {t('Save')}
        </Button>
      }
    >
      <NewSkillForm
        formId={formId}
        seed={props.seed}
        onDone={() => props.onOpenChange(false)}
      />
    </Dialog>
  )
}
